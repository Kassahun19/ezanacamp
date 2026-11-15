import express from 'express';
import { get, query, run, transaction } from '../../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { slugify } from '../utils/crypto.js';

const router = express.Router();

const ZOOM_MEETING_URL = 'https://us05web.zoom.us/j/4619028612?pwd=D8hDld9Qase3OLIDozrgc9axiBDadQ.1';
const ZOOM_MEETING_ID = '461 902 8612';
const ZOOM_PASSCODE = 'MJQNp0';

// Helper to verify Parent has access to studentId
async function resolveStudentScope(req) {
  if (req.user.role === 'Student') {
    if (req.query.studentId && Number(req.query.studentId) !== req.user.id) {
      return { forbidden: true, ids: [] };
    }
    return { forbidden: false, ids: [req.user.id] };
  }
  if (req.user.role === 'Parent') {
    const links = await query(
      `SELECT student_id FROM parent_student_links WHERE parent_id = ? AND status = 'Approved'`,
      [req.user.id]
    );
    const linkedIds = links.map((l) => l.student_id);
    if (req.query.studentId) {
      const requested = Number(req.query.studentId);
      if (!linkedIds.includes(requested)) return { forbidden: true, ids: [] };
      return { forbidden: false, ids: [requested] };
    }
    return { forbidden: false, ids: linkedIds };
  }
  return { forbidden: false, ids: null }; // Staff
}

// --- Manual Course Creation & Management ---
router.post('/courses', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const {
      title, description = '', learning_objectives = '', prerequisites = '', target_audience = '',
      thumbnail_url = '/src/assets/images/course_web_engineering_1794751963554.jpg',
      category_id = null, subject_id = null, level = 'Beginner', language = 'English',
      instructor_id = null, status = 'Published', visibility = 'Public', estimated_duration = '4h 00m', tags = []
    } = req.body || {};

    if (!title?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Course title is required.' });

    const baseSlug = slugify(title);
    const dup = await get(`SELECT id FROM courses WHERE slug = ?`, [baseSlug]);
    const finalSlug = dup ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const reqApprovalRow = await get(`SELECT setting_value FROM platform_settings WHERE setting_key = 'require_course_approval'`);
    let finalStatus = status;
    if (req.user.role === 'Instructor' && reqApprovalRow?.setting_value === 'true' && finalStatus === 'Published') {
      finalStatus = 'Pending Review';
    }

    const resCourse = await run(
      `INSERT INTO courses (
        title, slug, description, learning_objectives, prerequisites, target_audience,
        thumbnail_url, category_id, subject_id, level, language, instructor_id,
        pro_price_etb, free_lesson_limit, status, visibility, source_type, estimated_duration, tags_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 218, 5, ?, ?, 'Manual', ?, ?, ?)`,
      [
        title.trim(), finalSlug, description, learning_objectives, prerequisites, target_audience,
        thumbnail_url, category_id || null, subject_id || null, level, language,
        instructor_id || req.user.id, finalStatus, visibility, estimated_duration, JSON.stringify(tags), req.user.id
      ]
    );

    const courseId = resCourse.lastInsertRowid;
    await run(`INSERT INTO course_sections (course_id, title, sort_order) VALUES (?, 'Module 1: Foundations', 1)`, [courseId]);
    await run(`INSERT INTO course_approval_history (course_id, action, actor_id, notes) VALUES (?, ?, ?, 'Manual course created')`, [courseId, finalStatus, req.user.id]);

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: courseId,
      details: { title: title.trim(), status: finalStatus },
    });

    return res.status(201).json({ message: 'Course created successfully.', id: courseId, status: finalStatus });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/courses/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const course = await get(`SELECT * FROM courses WHERE id = ?`, [courseId]);
    if (!course) return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });
    if (req.user.role === 'Instructor' && course.instructor_id !== req.user.id && course.created_by !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only edit courses assigned to you.' });
    }

    const {
      title, description, learning_objectives, prerequisites, target_audience,
      thumbnail_url, category_id, subject_id, level, language, instructor_id,
      status, visibility, estimated_duration, tags, approvalNotes
    } = req.body || {};

    let nextStatus = status || course.status;
    if (req.user.role === 'Instructor' && nextStatus === 'Published') {
      const reqApp = await get(`SELECT setting_value FROM platform_settings WHERE setting_key = 'require_course_approval'`);
      if (reqApp?.setting_value === 'true') nextStatus = 'Pending Review';
    }

    await run(
      `UPDATE courses SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        learning_objectives = COALESCE(?, learning_objectives),
        prerequisites = COALESCE(?, prerequisites),
        target_audience = COALESCE(?, target_audience),
        thumbnail_url = COALESCE(?, thumbnail_url),
        category_id = COALESCE(?, category_id),
        subject_id = COALESCE(?, subject_id),
        level = COALESCE(?, level),
        language = COALESCE(?, language),
        instructor_id = COALESCE(?, instructor_id),
        status = ?,
        visibility = COALESCE(?, visibility),
        estimated_duration = COALESCE(?, estimated_duration),
        tags_json = COALESCE(?, tags_json),
        updated_at = NOW()
       WHERE id = ?`,
      [
        title?.trim() || null, description !== undefined ? description : null,
        learning_objectives !== undefined ? learning_objectives : null,
        prerequisites !== undefined ? prerequisites : null,
        target_audience !== undefined ? target_audience : null,
        thumbnail_url || null,
        category_id !== undefined ? (category_id ? Number(category_id) : null) : null,
        subject_id !== undefined ? (subject_id ? Number(subject_id) : null) : null,
        level || null, language || null,
        instructor_id !== undefined ? (instructor_id ? Number(instructor_id) : null) : null,
        nextStatus, visibility || null, estimated_duration || null,
        tags ? JSON.stringify(tags) : null, courseId
      ]
    );

    if (status && status !== course.status) {
      await run(`INSERT INTO course_approval_history (course_id, action, actor_id, notes) VALUES (?, ?, ?, ?)`, [courseId, nextStatus, req.user.id, approvalNotes || `Status updated to ${nextStatus}`]);
    }

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: courseId,
      details: { status: nextStatus },
    });

    return res.json({ message: 'Course updated successfully.', status: nextStatus });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/courses/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    await run(`DELETE FROM courses WHERE id = ?`, [courseId]);
    await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'COURSE_DELETED', entityType: 'Course', entityId: courseId });
    return res.json({ message: 'Course deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/courses/:courseId/lessons', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { title, description = '', learning_objectives = '', instructor_notes = '', youtube_video_id = 'rfscVS0vtbw', duration_label = '12:00', duration_seconds = 720, section_id = null } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Lesson title is required.' });

    const maxRow = await get(`SELECT COALESCE(MAX(sort_order), 0) AS max_ord FROM lessons WHERE course_id = ?`, [courseId]);
    let secId = section_id;
    if (!secId) {
      const sec = await get(`SELECT id FROM course_sections WHERE course_id = ? ORDER BY sort_order ASC LIMIT 1`, [courseId]);
      secId = sec?.id || null;
    }

    const cleanYtId = youtube_video_id && String(youtube_video_id).trim() ? String(youtube_video_id).trim() : null;
    const r = await run(
      `INSERT INTO lessons (course_id, section_id, title, description, learning_objectives, instructor_notes, video_source, youtube_video_id, duration_seconds, duration_label, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 'YouTube', ?, ?, ?, ?)`,
      [courseId, secId, title.trim(), description, learning_objectives, instructor_notes, cleanYtId, Number(duration_seconds), duration_label, Number(maxRow.max_ord) + 1]
    );
    return res.status(201).json({ message: 'Lesson added.', id: r.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/courses/:courseId/lessons/reorder', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { orderedLessonIds = [] } = req.body || {};
    await transaction(async (tx) => {
      for (let i = 0; i < orderedLessonIds.length; i++) {
        await tx.run(`UPDATE lessons SET sort_order = ? WHERE id = ? AND course_id = ?`, [i + 1, Number(orderedLessonIds[i]), courseId]);
      }
    });
    return res.json({ message: 'Lesson order updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/lessons/:lessonId', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const existing = await get(`SELECT * FROM lessons WHERE id = ?`, [lessonId]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Lesson not found.' });
    const { title, description, learning_objectives, instructor_notes, youtube_video_id, duration_label, duration_seconds, availability_status } = req.body || {};
    await run(
      `UPDATE lessons SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        learning_objectives = COALESCE(?, learning_objectives),
        instructor_notes = COALESCE(?, instructor_notes),
        youtube_video_id = COALESCE(?, youtube_video_id),
        duration_label = COALESCE(?, duration_label),
        duration_seconds = COALESCE(?, duration_seconds),
        availability_status = COALESCE(?, availability_status)
       WHERE id = ?`,
      [
        title?.trim() || null,
        description !== undefined ? description : null,
        learning_objectives !== undefined ? learning_objectives : null,
        instructor_notes !== undefined ? instructor_notes : null,
        youtube_video_id !== undefined ? (String(youtube_video_id).trim() || null) : null,
        duration_label || null,
        duration_seconds !== undefined ? Number(duration_seconds) : null,
        availability_status || null,
        lessonId,
      ]
    );
    return res.json({ message: 'Lesson updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/lessons/:lessonId', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    await run(`DELETE FROM lessons WHERE id = ?`, [Number(req.params.lessonId)]);
    return res.json({ message: 'Lesson removed from course.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// --- Categories, Subjects, Levels ---
router.get('/taxonomy', async (_req, res) => {
  try {
    const categories = await query(`SELECT * FROM categories ORDER BY name ASC`);
    const subjects = await query(`SELECT s.*, c.name AS category_name FROM subjects s LEFT JOIN categories c ON c.id = s.category_id ORDER BY s.name ASC`);
    const levels = await query(`SELECT * FROM levels ORDER BY sort_order ASC`);
    return res.json({ categories, subjects, levels });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/categories', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { name, description = '' } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Category name is required.' });
    const r = await run(`INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)`, [name.trim(), slugify(name), description]);
    return res.status(201).json({ id: r.lastInsertRowid, message: 'Category created.' });
  } catch (err) {
    return res.status(400).json({ error: 'CREATE_FAILED', message: err.message });
  }
});

router.put('/categories/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Category name is required.' });
  await run(`UPDATE categories SET name = ?, slug = ?, description = COALESCE(?, description) WHERE id = ?`, [name.trim(), slugify(name), description !== undefined ? description : null, Number(req.params.id)]);
  return res.json({ message: 'Category updated.' });
});

router.delete('/categories/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM categories WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Category deleted.' });
});

router.post('/subjects', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { name, code = '', category_id = null, description = '' } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Subject name is required.' });
    const r = await run(`INSERT INTO subjects (name, code, category_id, description) VALUES (?, ?, ?, ?)`, [name.trim(), code.trim(), category_id ? Number(category_id) : null, description]);
    return res.status(201).json({ id: r.lastInsertRowid, message: 'Subject created.' });
  } catch (err) {
    return res.status(400).json({ error: 'CREATE_FAILED', message: err.message });
  }
});

router.put('/subjects/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, code, category_id, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Subject name is required.' });
  await run(
    `UPDATE subjects SET name = ?, code = COALESCE(?, code), category_id = ?, description = COALESCE(?, description) WHERE id = ?`,
    [name.trim(), code !== undefined ? code.trim() : null, category_id ? Number(category_id) : null, description !== undefined ? description : null, Number(req.params.id)]
  );
  return res.json({ message: 'Subject updated.' });
});

router.delete('/subjects/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM subjects WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Subject deleted.' });
});

router.post('/levels', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { name, sort_order = 1 } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Level name is required.' });
    const r = await run(`INSERT INTO levels (name, sort_order) VALUES (?, ?)`, [name.trim(), Number(sort_order)]);
    return res.status(201).json({ id: r.lastInsertRowid, message: 'Level created.' });
  } catch (err) {
    return res.status(400).json({ error: 'CREATE_FAILED', message: err.message });
  }
});

router.put('/levels/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, sort_order } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Level name is required.' });
  await run(`UPDATE levels SET name = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?`, [name.trim(), sort_order !== undefined ? Number(sort_order) : null, Number(req.params.id)]);
  return res.json({ message: 'Level updated.' });
});

router.delete('/levels/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM levels WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Level deleted.' });
});

// --- Academic Structure (Years, Semesters, Departments, Classes) ---
router.get('/structure', requireAuth, async (_req, res) => {
  try {
    const academicYears = await query(`SELECT * FROM academic_years ORDER BY start_date DESC`);
    const semesters = await query(`SELECT s.*, ay.name AS academic_year_name FROM semesters s LEFT JOIN academic_years ay ON ay.id = s.academic_year_id ORDER BY s.start_date DESC`);
    const departments = await query(`SELECT * FROM departments ORDER BY name ASC`);
    const classes = await query(
      `SELECT cl.*, d.name AS department_name, ay.name AS academic_year_name,
              CONCAT(u.first_name, ' ', u.last_name) AS instructor_name,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = cl.id) AS student_count
       FROM classes cl
       LEFT JOIN departments d ON d.id = cl.department_id
       LEFT JOIN academic_years ay ON ay.id = cl.academic_year_id
       LEFT JOIN users u ON u.id = cl.instructor_id
       ORDER BY cl.name ASC`
    );
    return res.json({ academicYears, semesters, departments, classes });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/years', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, start_date, end_date, status = 'Active' } = req.body || {};
  if (!name?.trim() || !start_date || !end_date) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name, start date, and end date required.' });
  const r = await run(`INSERT INTO academic_years (name, start_date, end_date, status) VALUES (?, ?, ?, ?)`, [name.trim(), start_date, end_date, status]);
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Academic year created.' });
});

router.put('/years/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, start_date, end_date, status } = req.body || {};
  await run(
    `UPDATE academic_years SET name = COALESCE(?, name), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), status = COALESCE(?, status) WHERE id = ?`,
    [name?.trim() || null, start_date || null, end_date || null, status || null, Number(req.params.id)]
  );
  return res.json({ message: 'Academic year updated.' });
});

router.delete('/years/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM academic_years WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Academic year deleted.' });
});

router.post('/semesters', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { academic_year_id, name, start_date, end_date, status = 'Active' } = req.body || {};
  if (!academic_year_id || !name?.trim() || !start_date || !end_date) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'All semester fields required.' });
  const r = await run(`INSERT INTO semesters (academic_year_id, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)`, [Number(academic_year_id), name.trim(), start_date, end_date, status]);
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Semester created.' });
});

router.put('/semesters/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { academic_year_id, name, start_date, end_date, status } = req.body || {};
  await run(
    `UPDATE semesters SET academic_year_id = COALESCE(?, academic_year_id), name = COALESCE(?, name), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), status = COALESCE(?, status) WHERE id = ?`,
    [academic_year_id ? Number(academic_year_id) : null, name?.trim() || null, start_date || null, end_date || null, status || null, Number(req.params.id)]
  );
  return res.json({ message: 'Semester updated.' });
});

router.delete('/semesters/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM semesters WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Semester deleted.' });
});

router.post('/departments', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, head_name = '', description = '' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Department name required.' });
  const r = await run(`INSERT INTO departments (name, head_name, description) VALUES (?, ?, ?)`, [name.trim(), head_name, description]);
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Department created.' });
});

router.post('/classes', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, section = 'A', department_id = null, academic_year_id = null, instructor_id = null, capacity = 40, room = 'Room 101' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Class name required.' });
  const r = await run(
    `INSERT INTO classes (name, section, department_id, academic_year_id, instructor_id, capacity, room) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name.trim(), section, department_id ? Number(department_id) : null, academic_year_id ? Number(academic_year_id) : null, instructor_id ? Number(instructor_id) : null, Number(capacity), room]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Class created.' });
});

router.put('/classes/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { name, section, capacity, room, instructor_id } = req.body || {};
  await run(
    `UPDATE classes SET name = COALESCE(?, name), section = COALESCE(?, section), capacity = COALESCE(?, capacity), room = COALESCE(?, room), instructor_id = COALESCE(?, instructor_id) WHERE id = ?`,
    [name?.trim() || null, section || null, capacity !== undefined ? Number(capacity) : null, room || null, instructor_id ? Number(instructor_id) : null, Number(req.params.id)]
  );
  return res.json({ message: 'Class updated.' });
});

router.delete('/classes/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM classes WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Class deleted.' });
});

router.post('/classes/:classId/assign-student', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { studentId } = req.body || {};
  await run(`INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)`, [Number(req.params.classId), Number(studentId)]);
  return res.json({ message: 'Student assigned to class.' });
});

// --- Timetables (with Conflict Detection) & Live Classes ---
router.get('/timetables', requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT t.*, c.title AS course_title, cl.name AS class_name, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
      FROM timetables t
      LEFT JOIN courses c ON c.id = t.course_id
      LEFT JOIN classes cl ON cl.id = t.class_id
      LEFT JOIN users u ON u.id = t.instructor_id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role === 'Instructor') {
      sql += ` AND t.instructor_id = ?`;
      params.push(req.user.id);
    } else if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { forbidden, ids } = await resolveStudentScope(req);
      if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view records for linked students.' });
      if (!ids || ids.length === 0) return res.json({ timetables: [] });
      const ph = ids.map(() => '?').join(',');
      sql += ` AND (t.course_id IN (SELECT course_id FROM enrollments WHERE student_id IN (${ph})) OR t.class_id IN (SELECT class_id FROM class_students WHERE student_id IN (${ph})))`;
      params.push(...ids, ...ids);
    }
    sql += ` ORDER BY t.day_of_week ASC, t.start_time ASC`;
    const timetables = await query(sql, params);
    return res.json({ timetables });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/timetables', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const { course_id, class_id = null, instructor_id, title, day_of_week, start_time, end_time, room = 'Virtual Hall', session_type = 'Lesson', session_date = '' } = req.body || {};
    if (!title?.trim() || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title, day, start time, and end time are required.' });
    }
    const instId = Number(instructor_id || req.user.id);

    // Scheduling conflict detection
    const conflicts = await query(
      `SELECT id, title, room, instructor_id FROM timetables
       WHERE day_of_week = ? AND NOT (end_time <= ? OR start_time >= ?)
       AND (instructor_id = ? OR (room = ? AND room != ''))`,
      [day_of_week, start_time, end_time, instId, room]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'SCHEDULE_CONFLICT',
        message: `Scheduling conflict detected with "${conflicts[0].title}" (${day_of_week} ${start_time}-${end_time} in ${conflicts[0].room}).`,
      });
    }

    const r = await run(
      `INSERT INTO timetables (course_id, class_id, instructor_id, title, day_of_week, start_time, end_time, room, session_type, session_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_id ? Number(course_id) : null, class_id ? Number(class_id) : null, instId, title.trim(), day_of_week, start_time, end_time, room, session_type, session_date]
    );
    return res.status(201).json({ id: r.lastInsertRowid, message: 'Timetable entry scheduled.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/timetables/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get(`SELECT * FROM timetables WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Timetable entry not found.' });
    if (req.user.role === 'Instructor' && existing.instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only edit your own timetable entries.' });
    }
    const { title, course_id, day_of_week, start_time, end_time, room, session_type } = req.body || {};
    const nextDay = day_of_week || existing.day_of_week;
    const nextStart = start_time || existing.start_time;
    const nextEnd = end_time || existing.end_time;
    const nextRoom = room !== undefined ? room : existing.room;

    const conflicts = await query(
      `SELECT id, title, room FROM timetables
       WHERE id != ? AND day_of_week = ? AND NOT (end_time <= ? OR start_time >= ?)
       AND (instructor_id = ? OR (room = ? AND room != ''))`,
      [id, nextDay, nextStart, nextEnd, existing.instructor_id, nextRoom]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'SCHEDULE_CONFLICT',
        message: `Scheduling conflict detected with "${conflicts[0].title}" (${nextDay} ${nextStart}-${nextEnd} in ${conflicts[0].room}).`,
      });
    }

    await run(
      `UPDATE timetables SET title = COALESCE(?, title), course_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ?, session_type = COALESCE(?, session_type) WHERE id = ?`,
      [title?.trim() || null, course_id !== undefined ? (course_id ? Number(course_id) : null) : existing.course_id, nextDay, nextStart, nextEnd, nextRoom, session_type || null, id]
    );
    return res.json({ message: 'Timetable entry updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/timetables/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM timetables WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Timetable entry not found.' });
  if (req.user.role === 'Instructor' && existing.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only delete your own timetable entries.' });
  }
  await run(`DELETE FROM timetables WHERE id = ?`, [id]);
  return res.json({ message: 'Timetable entry deleted.' });
});

router.get('/live-classes', requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT lc.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
      FROM live_classes lc
      LEFT JOIN courses c ON c.id = lc.course_id
      LEFT JOIN users u ON u.id = lc.instructor_id
      ORDER BY lc.scheduled_at DESC
    `;
    const rows = await query(sql);
    const liveClasses = rows.map((row) => ({
      ...row,
      meeting_url: ZOOM_MEETING_URL,
      meeting_id: ZOOM_MEETING_ID,
      passcode: ZOOM_PASSCODE,
    }));
    return res.json({ liveClasses, zoomCredentials: { url: ZOOM_MEETING_URL, meetingId: ZOOM_MEETING_ID, passcode: ZOOM_PASSCODE } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/live-classes', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { course_id = null, class_id = null, title, scheduled_at, duration_minutes = 60 } = req.body || {};
  if (!title?.trim() || !scheduled_at) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title and scheduled time required.' });
  const r = await run(
    `INSERT INTO live_classes (course_id, class_id, instructor_id, title, meeting_url, scheduled_at, duration_minutes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`,
    [course_id ? Number(course_id) : null, class_id ? Number(class_id) : null, req.user.id, title.trim(), ZOOM_MEETING_URL, scheduled_at, Number(duration_minutes)]
  );
  const authorizedUsers = await query(`SELECT id FROM users WHERE status = 'Active'`);
  for (const u of authorizedUsers) {
    await run(
      `INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, ?, ?, 'Live Class', 'live-classes')`,
      [u.id, `New Live Class: ${title.trim()}`, `Scheduled for ${scheduled_at}. Use Meeting ID: ${ZOOM_MEETING_ID} | Passcode: ${ZOOM_PASSCODE} to join via Zoom.`]
    );
  }
  return res.status(201).json({
    id: r.lastInsertRowid,
    meeting_url: ZOOM_MEETING_URL,
    meeting_id: ZOOM_MEETING_ID,
    passcode: ZOOM_PASSCODE,
    message: `Live class scheduled. Users notified with Meeting ID ${ZOOM_MEETING_ID} & Passcode ${ZOOM_PASSCODE}.`,
  });
});

router.post('/live-classes/:id/join', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lc = await get(`SELECT * FROM live_classes WHERE id = ?`, [id]);
  if (!lc) return res.status(404).json({ error: 'NOT_FOUND', message: 'Live class session not found.' });
  await run(
    `INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, ?, ?, 'Live Class', 'live-classes')`,
    [req.user.id, `Zoom Credentials: ${lc.title}`, `Meeting ID: ${ZOOM_MEETING_ID} | Passcode: ${ZOOM_PASSCODE}. Link: ${ZOOM_MEETING_URL}`]
  );
  return res.json({
    meetingUrl: ZOOM_MEETING_URL,
    meetingId: ZOOM_MEETING_ID,
    passcode: ZOOM_PASSCODE,
    message: `Use Meeting ID: ${ZOOM_MEETING_ID} · Passcode: ${ZOOM_PASSCODE} to join "${lc.title}".`,
  });
});

router.put('/live-classes/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM live_classes WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Live class not found.' });
  if (req.user.role === 'Instructor' && existing.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only edit your own live sessions.' });
  }
  const { title, course_id, scheduled_at, duration_minutes, status, recording_url } = req.body || {};
  await run(
    `UPDATE live_classes SET title = COALESCE(?, title), course_id = ?, scheduled_at = COALESCE(?, scheduled_at), duration_minutes = COALESCE(?, duration_minutes), status = COALESCE(?, status), recording_url = COALESCE(?, recording_url), meeting_url = ? WHERE id = ?`,
    [title?.trim() || null, course_id !== undefined ? (course_id ? Number(course_id) : null) : existing.course_id, scheduled_at || null, duration_minutes ? Number(duration_minutes) : null, status || null, recording_url !== undefined ? recording_url : null, ZOOM_MEETING_URL, id]
  );
  return res.json({ message: 'Live class updated.' });
});

router.patch('/live-classes/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { status, recording_url = '' } = req.body || {};
  await run(`UPDATE live_classes SET status = COALESCE(?, status), recording_url = COALESCE(?, recording_url) WHERE id = ?`, [status || null, recording_url || null, Number(req.params.id)]);
  return res.json({ message: 'Live class updated.' });
});

router.delete('/live-classes/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM live_classes WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Live class not found.' });
  if (req.user.role === 'Instructor' && existing.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only delete your own live sessions.' });
  }
  await run(`DELETE FROM live_classes WHERE id = ?`, [id]);
  return res.json({ message: 'Live class deleted.' });
});

// --- Attendance ---
router.get('/attendance', requireAuth, async (req, res) => {
  try {
    const { courseId = '', date = '' } = req.query;
    let sql = `
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.student_code, c.title AS course_title
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN courses c ON c.id = a.course_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { forbidden, ids } = await resolveStudentScope(req);
      if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view attendance for linked students.' });
      if (!ids || ids.length === 0) return res.json({ records: [], summary: { total: 0, present: 0, absent: 0, late: 0, percentage: 100 } });
      sql += ` AND a.user_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    } else if (req.user.role === 'Instructor') {
      sql += ` AND (c.instructor_id = ? OR a.recorded_by = ?)`;
      params.push(req.user.id, req.user.id);
    }

    if (courseId) {
      sql += ` AND a.course_id = ?`;
      params.push(Number(courseId));
    }
    if (date) {
      sql += ` AND a.attendance_date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY a.attendance_date DESC, a.id DESC`;
    const records = await query(sql, params);
    const total = records.length;
    const present = records.filter((r) => r.status === 'Present').length;
    const late = records.filter((r) => r.status === 'Late').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    return res.json({ records, summary: { total, present, late, absent, percentage } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/attendance', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const { user_id, user_role = 'Student', course_id = null, class_id = null, attendance_date, status = 'Present', notes = '' } = req.body || {};
    if (!user_id || !attendance_date) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'User and date are required.' });
    const r = await run(
      `INSERT INTO attendance (user_id, user_role, course_id, class_id, attendance_date, status, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(user_id), user_role, course_id ? Number(course_id) : null, class_id ? Number(class_id) : null, attendance_date, status, notes, req.user.id]
    );
    return res.status(201).json({ id: r.lastInsertRowid, message: 'Attendance recorded.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/attendance/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { attendance_date, status, notes } = req.body || {};
  await run(
    `UPDATE attendance SET attendance_date = COALESCE(?, attendance_date), status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?`,
    [attendance_date || null, status || null, notes !== undefined ? notes : null, Number(req.params.id)]
  );
  return res.json({ message: 'Attendance record updated.' });
});

router.delete('/attendance/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  await run(`DELETE FROM attendance WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Attendance record deleted.' });
});

// --- Assignments & Submissions ---
router.get('/assignments', requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT a.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
      FROM assignments a
      JOIN courses c ON c.id = a.course_id
      LEFT JOIN users u ON u.id = a.instructor_id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role === 'Instructor') {
      sql += ` AND (a.instructor_id = ? OR c.instructor_id = ?)`;
      params.push(req.user.id, req.user.id);
    } else if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { forbidden, ids } = await resolveStudentScope(req);
      if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view assignments for linked students.' });
      if (!ids || ids.length === 0) return res.json({ assignments: [], submissions: [] });
      sql += ` AND a.status = 'Published' AND a.course_id IN (SELECT course_id FROM enrollments WHERE student_id IN (${ids.map(() => '?').join(',')}))`;
      params.push(...ids);
    }
    sql += ` ORDER BY a.due_date ASC`;
    const assignments = await query(sql, params);

    let subSql = `
      SELECT s.*, a.title AS assignment_title, a.max_score, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code
      FROM assignment_submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN users u ON u.id = s.student_id
      WHERE 1=1
    `;
    const subParams = [];
    if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { ids } = await resolveStudentScope(req);
      subSql += ` AND s.student_id IN (${ids.map(() => '?').join(',')})`;
      subParams.push(...ids);
    } else if (req.user.role === 'Instructor') {
      subSql += ` AND a.instructor_id = ?`;
      subParams.push(req.user.id);
    }
    const submissions = await query(subSql, subParams);

    return res.json({ assignments, submissions });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/assignments', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { course_id, title, description = '', due_date, max_score = 100, status = 'Published' } = req.body || {};
  if (!course_id || !title?.trim() || !due_date) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Course, title, and due date required.' });
  const r = await run(
    `INSERT INTO assignments (course_id, instructor_id, title, description, due_date, max_score, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(course_id), req.user.id, title.trim(), description, due_date, Number(max_score), status]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Assignment published.' });
});

router.put('/assignments/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, due_date, max_score, status } = req.body || {};
  await run(
    `UPDATE assignments SET title = COALESCE(?, title), description = COALESCE(?, description), due_date = COALESCE(?, due_date), max_score = COALESCE(?, max_score), status = COALESCE(?, status) WHERE id = ?`,
    [title?.trim() || null, description !== undefined ? description : null, due_date || null, max_score !== undefined ? Number(max_score) : null, status || null, id]
  );
  return res.json({ message: 'Assignment updated.' });
});

router.delete('/assignments/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  await run(`DELETE FROM assignment_submissions WHERE assignment_id = ?`, [id]);
  await run(`DELETE FROM assignments WHERE id = ?`, [id]);
  return res.json({ message: 'Assignment deleted.' });
});

router.post('/assignments/:id/submit', requireAuth, requireRole('Student'), async (req, res) => {
  const assignmentId = Number(req.params.id);
  const { submission_text = '', attachment_name = '' } = req.body || {};
  if (!submission_text.trim() && !attachment_name.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Please enter submission notes or attach a file name.' });
  }
  const existing = await get(`SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`, [assignmentId, req.user.id]);
  if (existing) {
    await run(`UPDATE assignment_submissions SET submission_text = ?, attachment_name = ?, status = 'Submitted', submitted_at = NOW() WHERE id = ?`, [submission_text, attachment_name, existing.id]);
  } else {
    await run(`INSERT INTO assignment_submissions (assignment_id, student_id, submission_text, attachment_name, status) VALUES (?, ?, ?, ?, 'Submitted')`, [assignmentId, req.user.id, submission_text, attachment_name]);
  }
  return res.json({ message: 'Assignment submitted successfully.' });
});

router.post('/submissions/:id/grade', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const subId = Number(req.params.id);
  const { score, feedback = '' } = req.body || {};
  await run(
    `UPDATE assignment_submissions SET score = ?, feedback = ?, status = 'Graded', graded_at = NOW(), graded_by = ? WHERE id = ?`,
    [Number(score), feedback, req.user.id, subId]
  );
  return res.json({ message: 'Submission graded.' });
});

// --- Quizzes, Question Bank & Attempts ---
router.get('/quizzes', requireAuth, async (req, res) => {
  try {
    const quizzes = await query(
      `SELECT q.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
       FROM quizzes q JOIN courses c ON c.id = q.course_id LEFT JOIN users u ON u.id = q.instructor_id
       ORDER BY q.created_at DESC`
    );
    const questions = await query(
      `SELECT qq.*, c.title AS course_title FROM quiz_questions qq LEFT JOIN courses c ON c.id = qq.course_id ORDER BY qq.id ASC`
    );
    let attemptsSql = `SELECT qa.*, q.title AS quiz_title, CONCAT(u.first_name, ' ', u.last_name) AS student_name FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN users u ON u.id = qa.student_id WHERE 1=1`;
    const attParams = [];
    if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { forbidden, ids } = await resolveStudentScope(req);
      if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view quiz attempts for linked students.' });
      if (!ids || ids.length === 0) return res.json({ quizzes, questions: [], attempts: [] });
      attemptsSql += ` AND qa.student_id IN (${ids.map(() => '?').join(',')})`;
      attParams.push(...ids);
    }
    const attempts = await query(attemptsSql + ` ORDER BY qa.submitted_at DESC`, attParams);

    // Hide correct_answer from students until attempted or keep in grading only
    const safeQuestions = req.user.role === 'Student'
      ? questions.map(({ correct_answer: _ca, ...q }) => q)
      : questions;

    return res.json({ quizzes, questions: safeQuestions, attempts });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/quizzes', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { course_id, lesson_id = null, title, description = '', duration_minutes = 30, max_score = 100 } = req.body || {};
  if (!course_id || !title?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Course and quiz title required.' });
  const r = await run(
    `INSERT INTO quizzes (course_id, lesson_id, instructor_id, title, description, duration_minutes, max_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Published')`,
    [Number(course_id), lesson_id ? Number(lesson_id) : null, req.user.id, title.trim(), description, Number(duration_minutes), Number(max_score)]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Quiz created.' });
});

router.put('/quizzes/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { title, description, duration_minutes, max_score, status } = req.body || {};
  await run(
    `UPDATE quizzes SET title = COALESCE(?, title), description = COALESCE(?, description), duration_minutes = COALESCE(?, duration_minutes), max_score = COALESCE(?, max_score), status = COALESCE(?, status) WHERE id = ?`,
    [title?.trim() || null, description !== undefined ? description : null, duration_minutes !== undefined ? Number(duration_minutes) : null, max_score !== undefined ? Number(max_score) : null, status || null, Number(req.params.id)]
  );
  return res.json({ message: 'Quiz updated.' });
});

router.delete('/quizzes/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  await run(`DELETE FROM quiz_questions WHERE quiz_id = ?`, [id]);
  await run(`DELETE FROM quiz_attempts WHERE quiz_id = ?`, [id]);
  await run(`DELETE FROM quizzes WHERE id = ?`, [id]);
  return res.json({ message: 'Quiz deleted.' });
});

router.post('/questions', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { quiz_id = null, course_id = null, subject_id = null, question_text, question_type = 'MCQ', options = [], correct_answer, points = 10 } = req.body || {};
  if (!question_text?.trim() || !correct_answer?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Question and correct answer are required.' });
  const r = await run(
    `INSERT INTO quiz_questions (quiz_id, course_id, subject_id, question_text, question_type, options_json, correct_answer, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [quiz_id ? Number(quiz_id) : null, course_id ? Number(course_id) : null, subject_id ? Number(subject_id) : null, question_text.trim(), question_type, JSON.stringify(options), correct_answer.trim(), Number(points)]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Question added to Question Bank.' });
});

router.put('/questions/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { question_text, options, correct_answer, points } = req.body || {};
  await run(
    `UPDATE quiz_questions SET question_text = COALESCE(?, question_text), options_json = COALESCE(?, options_json), correct_answer = COALESCE(?, correct_answer), points = COALESCE(?, points) WHERE id = ?`,
    [question_text?.trim() || null, options ? JSON.stringify(options) : null, correct_answer?.trim() || null, points !== undefined ? Number(points) : null, Number(req.params.id)]
  );
  return res.json({ message: 'Question updated.' });
});

router.delete('/questions/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  await run(`DELETE FROM quiz_questions WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Question removed from bank.' });
});

router.post('/quizzes/:id/attempt', requireAuth, requireRole('Student'), async (req, res) => {
  const quizId = Number(req.params.id);
  const { answers = {} } = req.body || {};
  const questions = await query(`SELECT * FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    maxScore += Number(q.points || 10);
    if (String(answers[q.id] || '').trim() === String(q.correct_answer).trim()) {
      score += Number(q.points || 10);
    }
  }
  const r = await run(
    `INSERT INTO quiz_attempts (quiz_id, student_id, answers_json, score, max_score, status) VALUES (?, ?, ?, ?, ?, 'Completed')`,
    [quizId, req.user.id, JSON.stringify(answers), score, maxScore || 100]
  );
  return res.status(201).json({ id: r.lastInsertRowid, score, maxScore, message: `Quiz submitted. Score: ${score}/${maxScore}` });
});

// --- Grades & Report Cards ---
router.get('/grades', requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT g.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title
      FROM grades g
      JOIN users u ON u.id = g.student_id
      JOIN courses c ON c.id = g.course_id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role === 'Student' || req.user.role === 'Parent') {
      const { forbidden, ids } = await resolveStudentScope(req);
      if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view grades for linked students.' });
      if (!ids || ids.length === 0) return res.json({ grades: [] });
      sql += ` AND g.released = 1 AND g.student_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    } else if (req.user.role === 'Instructor') {
      sql += ` AND (c.instructor_id = ? OR g.recorded_by = ?)`;
      params.push(req.user.id, req.user.id);
    }
    const grades = await query(sql + ` ORDER BY g.created_at DESC`, params);
    return res.json({ grades });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/grades', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { student_id, course_id, assessment_name, assessment_type = 'Exam', score, max_score = 100, remarks = '', released = 1 } = req.body || {};
  if (!student_id || !course_id || !assessment_name?.trim() || score === undefined) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Student, course, assessment name, and score are required.' });
  }
  const pct = (Number(score) / Math.max(Number(max_score), 1)) * 100;
  const letter = pct >= 93 ? 'A+' : pct >= 88 ? 'A' : pct >= 83 ? 'A-' : pct >= 78 ? 'B+' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D';
  const r = await run(
    `INSERT INTO grades (student_id, course_id, assessment_name, assessment_type, score, max_score, letter_grade, remarks, released, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(student_id), Number(course_id), assessment_name.trim(), assessment_type, Number(score), Number(max_score), letter, remarks, released ? 1 : 0, req.user.id]
  );
  return res.status(201).json({ id: r.lastInsertRowid, letter_grade: letter, message: 'Grade recorded.' });
});

router.put('/grades/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(`SELECT * FROM grades WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Grade not found.' });
  const { assessment_name, assessment_type, score, max_score, remarks, released } = req.body || {};
  const nextScore = score !== undefined ? Number(score) : Number(existing.score);
  const nextMax = max_score !== undefined ? Number(max_score) : Number(existing.max_score);
  const pct = (nextScore / Math.max(nextMax, 1)) * 100;
  const letter = pct >= 93 ? 'A+' : pct >= 88 ? 'A' : pct >= 83 ? 'A-' : pct >= 78 ? 'B+' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D';
  await run(
    `UPDATE grades SET assessment_name = COALESCE(?, assessment_name), assessment_type = COALESCE(?, assessment_type), score = ?, max_score = ?, letter_grade = ?, remarks = COALESCE(?, remarks), released = COALESCE(?, released) WHERE id = ?`,
    [assessment_name?.trim() || null, assessment_type || null, nextScore, nextMax, letter, remarks !== undefined ? remarks : null, released !== undefined ? (released ? 1 : 0) : null, id]
  );
  return res.json({ message: 'Grade updated.', letter_grade: letter });
});

router.delete('/grades/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  await run(`DELETE FROM grades WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Grade record deleted.' });
});

// --- E-Learning Resources ---
router.get('/resources', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT r.*, c.title AS course_title, s.name AS subject_name, cat.name AS category_name,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM resources r
     LEFT JOIN courses c ON c.id = r.course_id
     LEFT JOIN subjects s ON s.id = r.subject_id
     LEFT JOIN categories cat ON cat.id = r.category_id
     LEFT JOIN users u ON u.id = r.uploaded_by
     ORDER BY r.created_at DESC`
  );
  return res.json({ resources: rows });
});

router.post('/resources', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { course_id = null, subject_id = null, category_id = null, title, description = '', resource_type = 'PDF', file_url = '/api/resources/sample/study-guide.txt', file_name = 'study-guide.txt', visibility = 'Enrolled' } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Resource title is required.' });
  const r = await run(
    `INSERT INTO resources (course_id, subject_id, category_id, title, description, resource_type, file_url, file_name, visibility, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [course_id ? Number(course_id) : null, subject_id ? Number(subject_id) : null, category_id ? Number(category_id) : null, title.trim(), description, resource_type, file_url, file_name, visibility, req.user.id]
  );
  return res.status(201).json({ id: r.lastInsertRowid, message: 'Learning resource uploaded.' });
});

router.put('/resources/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const { title, description, resource_type, visibility } = req.body || {};
  await run(
    `UPDATE resources SET title = COALESCE(?, title), description = COALESCE(?, description), resource_type = COALESCE(?, resource_type), visibility = COALESCE(?, visibility) WHERE id = ?`,
    [title?.trim() || null, description !== undefined ? description : null, resource_type || null, visibility || null, Number(req.params.id)]
  );
  return res.json({ message: 'Resource updated.' });
});

router.delete('/resources/:id', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  await run(`DELETE FROM resources WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Resource deleted.' });
});

// --- Certificates ---
router.get('/certificates', requireAuth, async (req, res) => {
  let sql = `
    SELECT cert.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title
    FROM certificates cert
    JOIN users u ON u.id = cert.student_id
    JOIN courses c ON c.id = cert.course_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'Student' || req.user.role === 'Parent') {
    const { forbidden, ids } = await resolveStudentScope(req);
    if (forbidden) return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view certificates for linked students.' });
    if (!ids || ids.length === 0) return res.json({ certificates: [] });
    sql += ` AND cert.student_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  const certificates = await query(sql + ` ORDER BY cert.issued_at DESC`, params);
  return res.json({ certificates });
});

router.post('/certificates', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { student_id, course_id, template_name = 'Ezana Academy Official Completion Certificate' } = req.body || {};
  if (!student_id || !course_id) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Student and course required.' });
  const code = `EZN-CERT-2027-${Math.floor(100 + Math.random() * 900)}`;
  const r = await run(
    `INSERT INTO certificates (certificate_code, student_id, course_id, template_name, issued_by) VALUES (?, ?, ?, ?, ?)`,
    [code, Number(student_id), Number(course_id), template_name, req.user.id]
  );
  return res.status(201).json({ id: r.lastInsertRowid, certificate_code: code, message: 'Certificate issued.' });
});

router.put('/certificates/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { template_name, status } = req.body || {};
  await run(
    `UPDATE certificates SET template_name = COALESCE(?, template_name), status = COALESCE(?, status) WHERE id = ?`,
    [template_name?.trim() || null, status || null, Number(req.params.id)]
  );
  return res.json({ message: 'Certificate updated.' });
});

router.delete('/certificates/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM certificates WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Certificate revoked and removed.' });
});

// --- Enrollment Management ---
router.get('/enrollments', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  const enrollments = await query(
    `SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.email AS student_email, u.student_code, c.title AS course_title
     FROM enrollments e JOIN users u ON u.id = e.student_id JOIN courses c ON c.id = e.course_id
     ORDER BY e.enrolled_at DESC`
  );
  const requests = await query(
    `SELECT er.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.email AS student_email, c.title AS course_title
     FROM enrollment_requests er JOIN users u ON u.id = er.student_id JOIN courses c ON c.id = er.course_id
     ORDER BY er.created_at DESC`
  );
  return res.json({ enrollments, requests });
});

router.post('/enrollments/direct', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { student_id, course_id } = req.body || {};
  if (!student_id || !course_id) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Student and course required.' });
  await run(`INSERT IGNORE INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [Number(student_id), Number(course_id)]);
  return res.status(201).json({ message: 'Student enrolled.' });
});

router.delete('/enrollments/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM enrollments WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Enrollment removed.' });
});

router.patch('/enrollment-requests/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {}; // 'Approved' | 'Rejected'
  const reqRow = await get(`SELECT * FROM enrollment_requests WHERE id = ?`, [id]);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found.' });
  await run(`UPDATE enrollment_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`, [status, req.user.id, id]);
  if (status === 'Approved') {
    await run(`INSERT IGNORE INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [reqRow.student_id, reqRow.course_id]);
  }
  await run(`INSERT INTO notifications (user_id, title, body, category) VALUES (?, ?, ?, 'Enrollment')`, [reqRow.student_id, `Enrollment Request ${status}`, `Your course enrollment request has been ${status.toLowerCase()}.`]);
  return res.json({ message: `Enrollment request ${status.toLowerCase()}.` });
});

export default router;
