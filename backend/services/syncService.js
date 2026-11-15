import { get, query, run, toMysqlDatetime, transaction } from '../../database/db.js';
import { decryptSecret, slugify } from '../utils/crypto.js';
import { logAudit } from './auditService.js';
import { fetchChannelVideos } from './youtubeService.js';

function formatEstimatedDuration(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}

export async function importChannelToCourse({ courseInput, selectedVideos, channelId, integrationId, actor }) {
  const cleanSelected = (selectedVideos || []).filter((v) => v && v.youtubeVideoId && v.eligible !== false);
  if (cleanSelected.length === 0) {
    throw new Error('Select at least one eligible public video to create a course.');
  }

  const baseSlug = slugify(courseInput.title);
  const existingSlug = await get(`SELECT id FROM courses WHERE slug = ?`, [baseSlug]);
  const finalSlug = existingSlug ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

  const totalDurationSec = cleanSelected.reduce((sum, v) => sum + Number(v.durationSeconds || 600), 0);
  const estimatedDuration = courseInput.estimated_duration || formatEstimatedDuration(totalDurationSec);

  const requireApprovalRow = await get(`SELECT setting_value FROM platform_settings WHERE setting_key = 'require_course_approval'`);
  const requireApproval = requireApprovalRow?.setting_value === 'true';

  let status = courseInput.status || 'Published';
  if (actor.role === 'Instructor' && requireApproval && status === 'Published') {
    status = 'Pending Review';
  }

  const result = await transaction(async (tx) => {
    const courseRes = await tx.run(
      `INSERT INTO courses (
        title, slug, description, learning_objectives, prerequisites, target_audience,
        thumbnail_url, category_id, subject_id, level, language, instructor_id,
        pro_price_etb, free_lesson_limit, status, visibility, source_type,
        youtube_channel_id, youtube_integration_id, estimated_duration, tags_json,
        last_synced_at, sync_status, created_by, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 218, 5, ?, ?, 'YouTube', ?, ?, ?, ?, NOW(), 'Synced', ?, ?)`,
      [
        courseInput.title,
        finalSlug,
        courseInput.description || '',
        courseInput.learning_objectives || '',
        courseInput.prerequisites || '',
        courseInput.target_audience || '',
        courseInput.thumbnail_url || cleanSelected[0]?.thumbnailUrl || '/src/assets/images/course_web_engineering_1794751963554.jpg',
        courseInput.category_id || null,
        courseInput.subject_id || null,
        courseInput.level || 'Beginner',
        courseInput.language || 'English',
        courseInput.instructor_id || actor.id,
        status,
        courseInput.visibility || 'Public',
        channelId,
        integrationId || null,
        estimatedDuration,
        JSON.stringify(courseInput.tags || []),
        actor.id,
        status === 'Published' ? actor.id : null,
      ]
    );

    const courseId = courseRes.lastInsertRowid;

    const sectionRes = await tx.run(
      `INSERT INTO course_sections (course_id, title, description, sort_order) VALUES (?, 'Core Video Curriculum', 'Imported tutorial lessons organized for Ezana Academy', 1)`,
      [courseId]
    );
    const sectionId = sectionRes.lastInsertRowid;

    let added = 0;
    for (let idx = 0; idx < cleanSelected.length; idx++) {
      const v = cleanSelected[idx];
      await tx.run(
        `INSERT INTO lessons (
          course_id, section_id, title, description, video_source, youtube_video_id,
          thumbnail_url, duration_seconds, duration_label, published_at,
          availability_status, sort_order, is_active
        ) VALUES (?, ?, ?, ?, 'YouTube', ?, ?, ?, ?, ?, 'Available', ?, 1)`,
        [
          courseId,
          sectionId,
          v.title,
          v.description || '',
          v.youtubeVideoId,
          v.thumbnailUrl || '',
          Number(v.durationSeconds || 600),
          v.durationLabel || '10:00',
          toMysqlDatetime(v.publishedAt || Date.now()),
          idx + 1,
        ]
      );
      added++;
    }

    await tx.run(
      `INSERT INTO course_approval_history (course_id, action, actor_id, notes) VALUES (?, ?, ?, ?)`,
      [courseId, status, actor.id, `Course created via YouTube channel import (${added} lessons)`]
    );

    await tx.run(
      `INSERT INTO sync_logs (course_id, integration_id, triggered_by, status, videos_fetched, videos_added, videos_updated, videos_unavailable, finished_at)
       VALUES (?, ?, ?, 'Completed', ?, ?, 0, 0, NOW())`,
      [courseId, integrationId || null, actor.id, cleanSelected.length, added]
    );

    return { courseId, status, added };
  });

  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'COURSE_IMPORTED_YOUTUBE',
    entityType: 'Course',
    entityId: result.courseId,
    details: { title: courseInput.title, lessonsAdded: result.added, status: result.status },
  });

  return result;
}

export async function syncExistingCourse({ courseId, integrationIdOverride, actor }) {
  const course = await get(`SELECT * FROM courses WHERE id = ?`, [courseId]);
  if (!course) throw new Error('Course not found.');
  if (course.source_type !== 'YouTube' || !course.youtube_channel_id) {
    throw new Error('This course is not linked to a YouTube channel.');
  }

  const intId = integrationIdOverride || course.youtube_integration_id;
  let apiKey = process.env.YOUTUBE_API_KEY || '';
  if (intId) {
    const integ = await get(`SELECT * FROM youtube_integrations WHERE id = ?`, [intId]);
    if (integ?.encrypted_api_key) {
      apiKey = decryptSecret(integ.encrypted_api_key);
    }
  }
  if (!apiKey) {
    throw new Error('No saved YouTube API integration key found for this course. Please provide or configure an integration key.');
  }

  let fetched;
  try {
    fetched = await fetchChannelVideos(apiKey, course.youtube_channel_id, { maxResults: 50 });
  } catch (err) {
    await run(
      `INSERT INTO sync_logs (course_id, integration_id, triggered_by, status, error_message, finished_at) VALUES (?, ?, ?, 'Failed', ?, NOW())`,
      [courseId, intId || null, actor.id, err.message]
    );
    await run(`UPDATE courses SET sync_status = 'Failed', updated_at = NOW() WHERE id = ?`, [courseId]);
    throw err;
  }

  const existingLessons = await query(`SELECT * FROM lessons WHERE course_id = ?`, [courseId]);
  const existingByYtId = new Map(existingLessons.filter((l) => l.youtube_video_id).map((l) => [l.youtube_video_id, l]));
  const fetchedIds = new Set(fetched.videos.map((v) => v.youtubeVideoId));

  let defaultSection = await get(`SELECT id FROM course_sections WHERE course_id = ? ORDER BY sort_order ASC LIMIT 1`, [courseId]);
  if (!defaultSection) {
    const secRes = await run(`INSERT INTO course_sections (course_id, title, sort_order) VALUES (?, 'Core Video Curriculum', 1)`, [courseId]);
    defaultSection = { id: secRes.lastInsertRowid };
  }

  let maxOrder = existingLessons.reduce((m, l) => Math.max(m, Number(l.sort_order || 0)), 0);
  let added = 0;
  let updated = 0;
  let unavailable = 0;

  await transaction(async (tx) => {
    for (const v of fetched.videos) {
      const existing = existingByYtId.get(v.youtubeVideoId);
      if (existing) {
        if (!v.eligible) {
          await tx.run(`UPDATE lessons SET availability_status = 'Unavailable' WHERE id = ?`, [existing.id]);
          unavailable++;
        } else {
          // Preserve instructor notes, custom section, and sort_order!
          await tx.run(
            `UPDATE lessons SET thumbnail_url = ?, duration_seconds = ?, duration_label = ?, availability_status = 'Available' WHERE id = ?`,
            [v.thumbnailUrl || existing.thumbnail_url, v.durationSeconds, v.durationLabel, existing.id]
          );
          updated++;
        }
      } else if (v.eligible) {
        maxOrder += 1;
        await tx.run(
          `INSERT INTO lessons (
            course_id, section_id, title, description, video_source, youtube_video_id,
            thumbnail_url, duration_seconds, duration_label, published_at,
            availability_status, sort_order, is_active
          ) VALUES (?, ?, ?, ?, 'YouTube', ?, ?, ?, ?, ?, 'Available', ?, 1)`,
          [
            courseId, defaultSection.id, v.title, v.description || '', v.youtubeVideoId,
            v.thumbnailUrl || '', v.durationSeconds, v.durationLabel, toMysqlDatetime(v.publishedAt || Date.now()), maxOrder
          ]
        );
        added++;
      }
    }

    // Mark lessons whose YouTube video was removed/deleted as Unavailable rather than deleting student progress
    for (const existing of existingLessons) {
      if (existing.youtube_video_id && !fetchedIds.has(existing.youtube_video_id) && existing.availability_status === 'Available') {
        await tx.run(`UPDATE lessons SET availability_status = 'Unavailable' WHERE id = ?`, [existing.id]);
        unavailable++;
      }
    }

    await tx.run(`UPDATE courses SET last_synced_at = NOW(), sync_status = 'Synced', updated_at = NOW() WHERE id = ?`, [courseId]);
    await tx.run(
      `INSERT INTO sync_logs (course_id, integration_id, triggered_by, status, videos_fetched, videos_added, videos_updated, videos_unavailable, finished_at)
       VALUES (?, ?, ?, 'Completed', ?, ?, ?, ?, NOW())`,
      [courseId, intId || null, actor.id, fetched.videos.length, added, updated, unavailable]
    );
  });

  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'COURSE_SYNCED_YOUTUBE',
    entityType: 'Course',
    entityId: courseId,
    details: { videosFetched: fetched.videos.length, added, updated, unavailable },
  });

  return { videosFetched: fetched.videos.length, added, updated, unavailable };
}
