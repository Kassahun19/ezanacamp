import express from 'express';
import { get, query, run, toMysqlDatetime } from '../../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// --- Announcements ---
router.get('/announcements', requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name, u.role AS author_role, c.title AS course_title
      FROM announcements a
      LEFT JOIN users u ON u.id = a.author_id
      LEFT JOIN courses c ON c.id = a.course_id
      WHERE 1=1
    `;
    const params = [];
    if (!['Owner', 'Admin'].includes(req.user.role)) {
      sql += ` AND a.status = 'Published' AND (a.target_role = 'All' OR a.target_role = ? OR a.author_id = ?)`;
      params.push(req.user.role, req.user.id);
    }
    const rows = await query(sql + ` ORDER BY a.created_at DESC`, params);
    return res.json({ announcements: rows });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/announcements', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { title, content, target_role = 'All', course_id = null, status = 'Published', publish_at = '' } = req.body || {};
  if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title and content required.' });
  const publishTs = publish_at && String(publish_at).trim() ? toMysqlDatetime(publish_at) : toMysqlDatetime();
  const r = await run(
    `INSERT INTO announcements (title, content, target_role, course_id, status, publish_at, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), content.trim(), target_role, course_id ? Number(course_id) : null, status, publishTs, req.user.id]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Announcement saved.' });
});

router.put('/announcements/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Announcement not found.' });
    if (req.user.role === 'Instructor' && existing.author_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only edit your own announcements.' });
    }
    const { title, content, target_role, status } = req.body || {};
    await run(
      `UPDATE announcements SET title = COALESCE(?, title), content = COALESCE(?, content), target_role = COALESCE(?, target_role), status = COALESCE(?, status) WHERE id = ?`,
      [title?.trim() || null, content?.trim() || null, target_role || null, status || null, id]
    );
    return res.json({ message: 'Announcement updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/announcements/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM announcements WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Announcement not found.' });
  if (req.user.role === 'Instructor' && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only delete your own announcements.' });
  }
  await run(`DELETE FROM announcements WHERE id = ?`, [id]);
  return res.json({ message: 'Announcement deleted.' });
});

// --- Messages ---
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const messages = await query(
      `SELECT m.*,
              CONCAT(s.first_name, ' ', s.last_name) AS sender_name, s.role AS sender_role,
              CONCAT(r.first_name, ' ', r.last_name) AS recipient_name, r.role AS recipient_role,
              CONCAT(st.first_name, ' ', st.last_name) AS student_context_name
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.recipient_id
       LEFT JOIN users st ON st.id = m.student_context_id
       WHERE (m.sender_id = ? AND m.archived_by_sender = 0) OR (m.recipient_id = ? AND m.archived_by_recipient = 0)
       ORDER BY m.created_at DESC`,
      [req.user.id, req.user.id]
    );
    const contacts = await query(
      `SELECT id, first_name, last_name, role, email FROM users WHERE status = 'Active' AND id != ? ORDER BY role ASC, first_name ASC`,
      [req.user.id]
    );
    return res.json({ messages, contacts });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/messages', requireAuth, async (req, res) => {
  const { recipient_id, student_context_id = null, subject = 'Message', body } = req.body || {};
  if (!recipient_id || !body?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Recipient and message body required.' });

  const r = await run(
    `INSERT INTO messages (sender_id, recipient_id, student_context_id, subject, body) VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, Number(recipient_id), student_context_id ? Number(student_context_id) : null, subject.trim(), body.trim()]
  );
  await run(
    `INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, ?, ?, 'Messages', 'messages')`,
    [Number(recipient_id), `New message from ${req.user.first_name} ${req.user.last_name}`, subject.trim()]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Message sent.' });
});

router.patch('/messages/:id/read', requireAuth, async (req, res) => {
  await run(`UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_id = ?`, [Number(req.params.id), req.user.id]);
  return res.json({ message: 'Marked as read.' });
});

router.delete('/messages/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const msg = await get(`SELECT * FROM messages WHERE id = ?`, [id]);
  if (!msg) return res.status(404).json({ error: 'NOT_FOUND' });
  if (msg.sender_id === req.user.id) await run(`UPDATE messages SET archived_by_sender = 1 WHERE id = ?`, [id]);
  if (msg.recipient_id === req.user.id) await run(`UPDATE messages SET archived_by_recipient = 1 WHERE id = ?`, [id]);
  return res.json({ message: 'Message archived.' });
});

// --- Discussion Forums ---
router.get('/discussions', requireAuth, async (req, res) => {
  const { courseId = '' } = req.query;
  let sql = `
    SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name, u.role AS author_role, c.title AS course_title
    FROM discussion_posts d
    JOIN users u ON u.id = d.user_id
    JOIN courses c ON c.id = d.course_id
    WHERE 1=1
  `;
  const params = [];
  if (courseId) {
    sql += ` AND d.course_id = ?`;
    params.push(Number(courseId));
  }
  const posts = await query(sql + ` ORDER BY d.created_at DESC`, params);
  return res.json({ posts });
});

router.post('/discussions', requireAuth, async (req, res) => {
  const { course_id, parent_id = null, title = '', body } = req.body || {};
  if (!course_id || !body?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Course and post body required.' });
  const r = await run(
    `INSERT INTO discussion_posts (course_id, parent_id, user_id, title, body) VALUES (?, ?, ?, ?, ?)`,
    [Number(course_id), parent_id ? Number(parent_id) : null, req.user.id, title.trim(), body.trim()]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Discussion post published.' });
});

router.put('/discussions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM discussion_posts WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Post not found.' });
  if (!['Owner', 'Admin', 'Instructor'].includes(req.user.role) && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only edit your own discussion posts.' });
  }
  const { title, body } = req.body || {};
  await run(
    `UPDATE discussion_posts SET title = COALESCE(?, title), body = COALESCE(?, body) WHERE id = ?`,
    [title !== undefined ? title.trim() : null, body?.trim() || null, id]
  );
  return res.json({ message: 'Discussion post updated.' });
});

router.delete('/discussions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM discussion_posts WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Post not found.' });
  if (!['Owner', 'Admin', 'Instructor'].includes(req.user.role) && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only delete your own discussion posts.' });
  }
  await run(`DELETE FROM discussion_posts WHERE id = ? OR parent_id = ?`, [id, id]);
  return res.json({ message: 'Discussion post removed.' });
});

// --- Notifications ---
router.get('/notifications', requireAuth, async (req, res) => {
  const rows = await query(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  return res.json({ notifications: rows, unreadCount: rows.filter((n) => !n.is_read).length });
});

router.patch('/notifications/read-all', requireAuth, async (req, res) => {
  await run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id]);
  return res.json({ message: 'All notifications marked as read.' });
});

router.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  await run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [Number(req.params.id), req.user.id]);
  return res.json({ message: 'Notification marked as read.' });
});

router.delete('/notifications/:id', requireAuth, async (req, res) => {
  await run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [Number(req.params.id), req.user.id]);
  return res.json({ message: 'Notification deleted.' });
});

router.post('/notifications/broadcast', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { targetRole = 'All', title, body } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title and message required.' });
  const users = targetRole === 'All'
    ? await query(`SELECT id FROM users WHERE status = 'Active'`)
    : await query(`SELECT id FROM users WHERE role = ? AND status = 'Active'`, [targetRole]);
  for (const u of users) {
    await run(`INSERT INTO notifications (user_id, title, body, category) VALUES (?, ?, ?, 'Broadcast')`, [u.id, title.trim(), body.trim()]);
  }
  return res.status(201).json({ message: `Notification sent to ${users.length} users.` });
});

// --- Support & Feedback ---
router.get('/support', requireAuth, async (req, res) => {
  let sql = `
    SELECT st.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.role AS user_role, u.email AS user_email
    FROM support_tickets st JOIN users u ON u.id = st.user_id
    WHERE 1=1
  `;
  const params = [];
  if (!['Owner', 'Admin'].includes(req.user.role)) {
    sql += ` AND st.user_id = ?`;
    params.push(req.user.id);
  }
  const tickets = await query(sql + ` ORDER BY st.created_at DESC`, params);
  return res.json({ tickets });
});

router.post('/support', requireAuth, async (req, res) => {
  const { subject, category = 'General', description } = req.body || {};
  if (!subject?.trim() || !description?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Subject and description required.' });
  const r = await run(
    `INSERT INTO support_tickets (user_id, subject, category, description, status) VALUES (?, ?, ?, ?, 'Open')`,
    [req.user.id, subject.trim(), category, description.trim()]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Support request submitted.' });
});

router.patch('/support/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { status, response_text, assigned_to } = req.body || {};
  await run(
    `UPDATE support_tickets SET status = COALESCE(?, status), response_text = COALESCE(?, response_text), assigned_to = COALESCE(?, assigned_to), updated_at = NOW() WHERE id = ?`,
    [status || null, response_text !== undefined ? response_text : null, assigned_to ? Number(assigned_to) : null, Number(req.params.id)]
  );
  return res.json({ message: 'Support ticket updated.' });
});

router.delete('/support/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const ticket = await get(`SELECT * FROM support_tickets WHERE id = ?`, [id]);
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND', message: 'Ticket not found.' });
  if (!['Owner', 'Admin'].includes(req.user.role) && ticket.user_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only delete your own support tickets.' });
  }
  await run(`DELETE FROM support_tickets WHERE id = ?`, [id]);
  return res.json({ message: 'Support ticket deleted.' });
});

export default router;
