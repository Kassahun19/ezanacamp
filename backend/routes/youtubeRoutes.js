import express from 'express';
import { get, query, run } from '../../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/auditService.js';
import { importChannelToCourse, syncExistingCourse } from '../services/syncService.js';
import { fetchChannelVideos, validateAndFetchChannel } from '../services/youtubeService.js';
import { decryptSecret, encryptSecret, maskSecretKey } from '../utils/crypto.js';

const router = express.Router();
const ytLimiter = createRateLimiter({ windowMs: 60000, max: 30, keyPrefix: 'youtube' });

async function resolveApiKey({ apiKey, integrationId, user }) {
  if (apiKey && String(apiKey).trim()) {
    return { key: String(apiKey).trim(), integrationId: integrationId || null };
  }
  if (integrationId) {
    const integ = await get(`SELECT * FROM youtube_integrations WHERE id = ?`, [Number(integrationId)]);
    if (!integ) throw new Error('Selected YouTube integration credential not found.');
    if (user.role === 'Instructor' && integ.owner_user_id !== user.id) {
      // Check if Owner allows using platform key
      const allowPlatform = await get(`SELECT setting_value FROM platform_settings WHERE setting_key = 'allow_instructor_youtube_keys'`);
      if (allowPlatform?.setting_value !== 'true') {
        throw new Error('Unauthorized integration credential.');
      }
    }
    return { key: decryptSecret(integ.encrypted_api_key), integrationId: integ.id };
  }
  if (process.env.YOUTUBE_API_KEY) {
    return { key: process.env.YOUTUBE_API_KEY, integrationId: null };
  }
  throw new Error('Please provide a YouTube Data API v3 Key or select a saved integration.');
}

router.get('/integrations', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'Owner' || req.user.role === 'Admin') {
      rows = await query(
        `SELECT yi.id, yi.owner_user_id, yi.label, yi.key_last4, yi.default_channel_id, yi.status,
                yi.last_validated_at, yi.last_error, yi.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS owner_name
         FROM youtube_integrations yi LEFT JOIN users u ON u.id = yi.owner_user_id
         ORDER BY yi.created_at DESC`
      );
    } else {
      rows = await query(
        `SELECT id, owner_user_id, label, key_last4, default_channel_id, status, last_validated_at, last_error, created_at
         FROM youtube_integrations WHERE owner_user_id = ? ORDER BY created_at DESC`,
        [req.user.id]
      );
    }
    const masked = rows.map((r) => ({ ...r, masked_key: maskSecretKey(r.key_last4) }));
    return res.json({ integrations: masked });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/integrations', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), ytLimiter, async (req, res) => {
  try {
    const { label = 'YouTube Data API Key', apiKey, defaultChannelId = '' } = req.body || {};
    if (!apiKey || String(apiKey).trim().length < 10) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A valid YouTube Data API v3 key is required.' });
    }
    const cleanKey = String(apiKey).trim();
    const encrypted = encryptSecret(cleanKey);
    const last4 = cleanKey.slice(-4);

    let status = 'Saved';
    let lastError = '';
    if (defaultChannelId.trim()) {
      try {
        await validateAndFetchChannel(cleanKey, defaultChannelId.trim());
        status = 'Connected';
      } catch (err) {
        status = 'Invalid';
        lastError = err.message;
      }
    }

    const resInsert = await run(
      `INSERT INTO youtube_integrations (owner_user_id, label, encrypted_api_key, key_last4, default_channel_id, status, last_validated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [req.user.id, label.trim(), encrypted, last4, defaultChannelId.trim(), status, lastError]
    );

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'YOUTUBE_INTEGRATION_CREATED',
      entityType: 'YouTubeIntegration',
      entityId: resInsert.lastInsertRowid,
      details: { label: label.trim(), status },
    });

    return res.status(201).json({
      integration: {
        id: resInsert.lastInsertRowid,
        label: label.trim(),
        masked_key: maskSecretKey(last4),
        default_channel_id: defaultChannelId.trim(),
        status,
        last_error: lastError,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/integrations/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const integ = await get(`SELECT * FROM youtube_integrations WHERE id = ?`, [id]);
    if (!integ) return res.status(404).json({ error: 'NOT_FOUND', message: 'Integration not found.' });
    if (req.user.role !== 'Owner' && integ.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot remove another user integration credential.' });
    }
    await run(`DELETE FROM youtube_integrations WHERE id = ?`, [id]);
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'YOUTUBE_INTEGRATION_DELETED',
      entityType: 'YouTubeIntegration',
      entityId: id,
    });
    return res.json({ message: 'Integration credential removed.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/validate', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), ytLimiter, async (req, res) => {
  try {
    const { apiKey, integrationId, channelId } = req.body || {};
    const resolved = await resolveApiKey({ apiKey, integrationId, user: req.user });
    const channel = await validateAndFetchChannel(resolved.key, channelId);

    if (resolved.integrationId) {
      await run(`UPDATE youtube_integrations SET status = 'Connected', last_validated_at = NOW(), last_error = '' WHERE id = ?`, [resolved.integrationId]);
    }
    return res.json({ valid: true, channel });
  } catch (err) {
    return res.status(400).json({ valid: false, error: err.code || 'VALIDATION_FAILED', message: err.message });
  }
});

router.post('/preview', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), ytLimiter, async (req, res) => {
  try {
    const { apiKey, integrationId, channelId, pageToken = '', maxResults = 25 } = req.body || {};
    const resolved = await resolveApiKey({ apiKey, integrationId, user: req.user });
    const data = await fetchChannelVideos(resolved.key, channelId, { maxResults, pageToken });
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.code || 'PREVIEW_FAILED', message: err.message });
  }
});

router.post('/import', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), ytLimiter, async (req, res) => {
  try {
    const { apiKey, integrationId, saveKey, keyLabel, channelId, courseInput, selectedVideos } = req.body || {};
    if (!courseInput?.title?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Course title is required.' });
    }
    if (!channelId?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'YouTube Channel ID is required.' });
    }

    let finalIntegrationId = integrationId || null;
    if (saveKey && apiKey?.trim()) {
      const cleanKey = apiKey.trim();
      const saved = await run(
        `INSERT INTO youtube_integrations (owner_user_id, label, encrypted_api_key, key_last4, default_channel_id, status, last_validated_at)
         VALUES (?, ?, ?, ?, ?, 'Connected', NOW())`,
        [req.user.id, keyLabel?.trim() || courseInput.title.trim(), encryptSecret(cleanKey), cleanKey.slice(-4), channelId.trim()]
      );
      finalIntegrationId = saved.lastInsertRowid;
    }

    const result = await importChannelToCourse({
      courseInput,
      selectedVideos,
      channelId: channelId.trim(),
      integrationId: finalIntegrationId,
      actor: req.user,
    });

    return res.status(201).json({
      message: `Course created with ${result.added} imported lessons.`,
      ...result,
    });
  } catch (err) {
    return res.status(400).json({ error: 'IMPORT_FAILED', message: err.message });
  }
});

router.post('/courses/:courseId/sync', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), ytLimiter, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const course = await get(`SELECT * FROM courses WHERE id = ?`, [courseId]);
    if (!course) return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });
    if (req.user.role === 'Instructor' && course.instructor_id !== req.user.id && course.created_by !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only synchronize courses assigned to you.' });
    }

    const result = await syncExistingCourse({
      courseId,
      integrationIdOverride: req.body?.integrationId || null,
      actor: req.user,
    });
    return res.json({ message: 'Channel synchronization complete.', ...result });
  } catch (err) {
    return res.status(400).json({ error: 'SYNC_FAILED', message: err.message });
  }
});

router.get('/courses/:courseId/sync-logs', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const logs = await query(
      `SELECT sl.*, CONCAT(u.first_name, ' ', u.last_name) AS triggered_by_name
       FROM sync_logs sl LEFT JOIN users u ON u.id = sl.triggered_by
       WHERE sl.course_id = ? ORDER BY sl.started_at DESC LIMIT 25`,
      [courseId]
    );
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
