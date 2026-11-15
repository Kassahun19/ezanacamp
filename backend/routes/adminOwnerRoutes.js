import bcrypt from 'bcryptjs';
import express from 'express';
import { get, query, run } from '../../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();

// --- Dashboard Overview tailored to logged-in role ---
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'Owner' || role === 'Admin') {
      const counts = await query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`);
      const roleCounts = Object.fromEntries(counts.map((r) => [r.role, Number(r.count)]));
      const coursesCount = (await get(`SELECT COUNT(*) AS count FROM courses`))?.count || 0;
      const enrollmentsCount = (await get(`SELECT COUNT(*) AS count FROM enrollments`))?.count || 0;
      const pendingRequests = (await get(`SELECT COUNT(*) AS count FROM enrollment_requests WHERE status = 'Pending'`))?.count || 0;
      const revenueTotal = (await get(`SELECT COALESCE(SUM(amount_etb), 0) AS total FROM payments WHERE status = 'Completed'`))?.total || 0;
      const outstandingTotal = (await get(`SELECT COALESCE(SUM(GREATEST(amount_etb - discount_etb - paid_etb, 0)), 0) AS total FROM fees`))?.total || 0;
      const attRows = await query(`SELECT status, COUNT(*) AS count FROM attendance GROUP BY status`);
      const attTotal = attRows.reduce((s, r) => s + Number(r.count), 0);
      const attPresent = attRows.filter((r) => r.status !== 'Absent').reduce((s, r) => s + Number(r.count), 0);
      const avgGrade = (await get(`SELECT ROUND(AVG((score * 100.0) / max_score), 1) AS avg FROM grades`))?.avg || 0;

      const recentActivity = await query(
        `SELECT al.*, CONCAT(u.first_name, ' ', u.last_name) AS actor_name
         FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
         ORDER BY al.created_at DESC LIMIT 8`
      );
      const categoryBreakdown = await query(
        `SELECT cat.name, COUNT(c.id) AS course_count,
                (SELECT COUNT(*) FROM enrollments e JOIN courses c2 ON c2.id = e.course_id WHERE c2.category_id = cat.id) AS enrollment_count
         FROM categories cat LEFT JOIN courses c ON c.category_id = cat.id
         GROUP BY cat.id, cat.name ORDER BY enrollment_count DESC`
      );

      const pendingProRequests = await query(
        `SELECT ce.id, ce.user_id, ce.course_id, ce.amount_etb, ce.status, ce.granted_at,
                CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.email AS student_email, u.student_code,
                c.title AS course_title,
                p.reference AS payment_reference, p.method AS payment_method
         FROM course_entitlements ce
         JOIN users u ON u.id = ce.user_id
         JOIN courses c ON c.id = ce.course_id
         LEFT JOIN payments p ON p.id = ce.payment_id
         WHERE ce.status = 'Pending'
         ORDER BY ce.granted_at DESC`
      );

      const upcomingLive = await query(
        `SELECT lc.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
         FROM live_classes lc LEFT JOIN courses c ON c.id = lc.course_id LEFT JOIN users u ON u.id = lc.instructor_id
         ORDER BY lc.scheduled_at ASC LIMIT 5`
      );

      return res.json({
        role,
        kpis: {
          students: roleCounts.Student || 0,
          instructors: roleCounts.Instructor || 0,
          parents: roleCounts.Parent || 0,
          admins: roleCounts.Admin || 0,
          courses: coursesCount,
          enrollments: enrollmentsCount,
          pendingRequests,
          pendingProRequestsCount: pendingProRequests.length,
          totalRevenueEtb: Number(revenueTotal),
          outstandingEtb: Number(outstandingTotal),
          attendanceRate: attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 100,
          avgGradePercent: Number(avgGrade || 0),
        },
        recentActivity,
        categoryBreakdown,
        pendingProRequests,
        upcomingLive: upcomingLive.map((l) => ({ ...l, meeting_id: '461 902 8612', passcode: 'MJQNp0' })),
      });
    }

    if (role === 'Instructor') {
      const assignedCourses = await query(`SELECT id, title, level, status, source_type FROM courses WHERE instructor_id = ? OR created_by = ?`, [req.user.id, req.user.id]);
      const courseIds = assignedCourses.map((c) => c.id);
      let enrolledStudents = 0;
      let pendingSubmissions = 0;
      if (courseIds.length > 0) {
        const ph = courseIds.map(() => '?').join(',');
        enrolledStudents = (await get(`SELECT COUNT(DISTINCT student_id) AS count FROM enrollments WHERE course_id IN (${ph})`, courseIds))?.count || 0;
        pendingSubmissions = (await get(`SELECT COUNT(*) AS count FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id IN (${ph}) AND s.status = 'Submitted'`, courseIds))?.count || 0;
      }
      const upcomingLive = await query(
        `SELECT lc.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
         FROM live_classes lc LEFT JOIN courses c ON c.id = lc.course_id LEFT JOIN users u ON u.id = lc.instructor_id
         WHERE lc.instructor_id = ? ORDER BY lc.scheduled_at ASC LIMIT 5`,
        [req.user.id]
      );
      const earnings = await get(`SELECT COALESCE(SUM(amount_etb), 0) AS total FROM instructor_payouts WHERE instructor_id = ?`, [req.user.id]);

      return res.json({
        role,
        kpis: {
          assignedCourses: assignedCourses.length,
          enrolledStudents,
          pendingSubmissions,
          upcomingSessions: upcomingLive.length,
          totalEarningsEtb: Number(earnings?.total || 0),
        },
        assignedCourses,
        upcomingLive: upcomingLive.map((l) => ({ ...l, meeting_id: '461 902 8612', passcode: 'MJQNp0' })),
      });
    }

    if (role === 'Student') {
      const enrollments = await query(
        `SELECT e.course_id, c.title, c.thumbnail_url, c.level,
                (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.is_active = 1 AND l.availability_status = 'Available') AS total_lessons,
                (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.course_id = c.id AND lp.user_id = ? AND lp.status = 'Completed') AS completed_lessons
         FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = ?`,
        [req.user.id, req.user.id]
      );
      const recentLessons = await query(
        `SELECT lp.*, l.title AS lesson_title, c.title AS course_title
         FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id JOIN courses c ON c.id = lp.course_id
         WHERE lp.user_id = ? ORDER BY lp.last_accessed_at DESC LIMIT 4`,
        [req.user.id]
      );
      const upcomingAssignments = await query(
        `SELECT a.*, c.title AS course_title FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE a.course_id IN (SELECT course_id FROM enrollments WHERE student_id = ?) AND a.status = 'Published'
         ORDER BY a.due_date ASC LIMIT 5`,
        [req.user.id]
      );
      const outstanding = (await get(`SELECT COALESCE(SUM(GREATEST(amount_etb - discount_etb - paid_etb, 0)), 0) AS total FROM fees WHERE student_id = ?`, [req.user.id]))?.total || 0;
      const avgGrade = (await get(`SELECT ROUND(AVG((score * 100.0) / max_score), 1) AS avg FROM grades WHERE student_id = ? AND released = 1`, [req.user.id]))?.avg || 0;

      const upcomingLive = await query(
        `SELECT lc.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
         FROM live_classes lc LEFT JOIN courses c ON c.id = lc.course_id LEFT JOIN users u ON u.id = lc.instructor_id
         ORDER BY lc.scheduled_at ASC LIMIT 5`
      );

      return res.json({
        role,
        kpis: {
          enrolledCourses: enrollments.length,
          completedCourses: enrollments.filter((e) => e.total_lessons > 0 && e.completed_lessons >= e.total_lessons).length,
          avgGradePercent: Number(avgGrade || 0),
          outstandingFeesEtb: Number(outstanding),
        },
        enrollments,
        recentLessons,
        upcomingAssignments,
        upcomingLive: upcomingLive.map((l) => ({ ...l, meeting_id: '461 902 8612', passcode: 'MJQNp0' })),
      });
    }

    if (role === 'Parent') {
      const children = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.student_code, u.phone, psl.relationship,
                (SELECT cl.name FROM class_students cs JOIN classes cl ON cl.id = cs.class_id WHERE cs.student_id = u.id LIMIT 1) AS class_name
         FROM parent_student_links psl JOIN users u ON u.id = psl.student_id
         WHERE psl.parent_id = ? AND psl.status = 'Approved' ORDER BY u.first_name ASC`,
        [req.user.id]
      );
      const activeChildId = req.query.childId ? Number(req.query.childId) : children[0]?.id;
      if (activeChildId && !children.some((c) => c.id === activeChildId)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Child is not linked to your parent account.' });
      }

      let childSummary = null;
      if (activeChildId) {
        const enrolled = await query(
          `SELECT c.id, c.title, c.level,
                  (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.is_active = 1 AND l.availability_status = 'Available') AS total_lessons,
                  (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.course_id = c.id AND lp.user_id = ? AND lp.status = 'Completed') AS completed_lessons
           FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = ?`,
          [activeChildId, activeChildId]
        );
        const attRows = await query(`SELECT status, COUNT(*) AS count FROM attendance WHERE user_id = ? GROUP BY status`, [activeChildId]);
        const attTotal = attRows.reduce((s, r) => s + Number(r.count), 0);
        const attOk = attRows.filter((r) => r.status !== 'Absent').reduce((s, r) => s + Number(r.count), 0);
        const avgGrade = (await get(`SELECT ROUND(AVG((score * 100.0) / max_score), 1) AS avg FROM grades WHERE student_id = ? AND released = 1`, [activeChildId]))?.avg || 0;
        const outstanding = (await get(`SELECT COALESCE(SUM(GREATEST(amount_etb - discount_etb - paid_etb, 0)), 0) AS total FROM fees WHERE student_id = ?`, [activeChildId]))?.total || 0;

        childSummary = {
          childId: activeChildId,
          enrolledCourses: enrolled,
          attendanceRate: attTotal > 0 ? Math.round((attOk / attTotal) * 100) : 100,
          avgGradePercent: Number(avgGrade || 0),
          outstandingFeesEtb: Number(outstanding),
        };
      }

      return res.json({ role, children, activeChildId: activeChildId || null, childSummary });
    }

    return res.json({ role });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// --- User Management (Owner & Admin) ---
router.get('/users', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const { role = '', status = '', search = '' } = req.query;
    let sql = `SELECT id, first_name, last_name, email, role, status, phone, student_code, qualifications, expertise, experience_years, created_at FROM users WHERE 1=1`;
    const params = [];

    if (req.user.role === 'Instructor') {
      sql += ` AND role = 'Student'`;
    } else if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR student_code LIKE ?)`;
      params.push(q, q, q, q);
    }
    const users = await query(sql + ` ORDER BY created_at DESC`, params);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/users', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, password = 'Ezana@2027!', role = 'Student', phone = '', qualifications = '', expertise = '', experience_years = 0 } = req.body || {};
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'First name, last name, and email are required.' });
    }
    if (req.user.role === 'Admin' && role === 'Owner') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admins cannot create Owner accounts.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const exists = await get(`SELECT id FROM users WHERE email = ?`, [cleanEmail]);
    if (exists) return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const studentCode = role === 'Student' ? `EZN-2027-${Math.floor(1000 + Math.random() * 9000)}` : '';
    const r = await run(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status, phone, qualifications, expertise, experience_years, student_code)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?)`,
      [first_name.trim(), last_name.trim(), cleanEmail, hash, role, phone, qualifications, expertise, Number(experience_years || 0), studentCode]
    );
    await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'USER_CREATED', entityType: 'User', entityId: r.lastInsertRowid, details: { role, email: cleanEmail } });
    return res.status(201).json({ id: r.lastInsertRowid, message: `${role} account created.` });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/users/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const target = await get(`SELECT * FROM users WHERE id = ?`, [targetId]);
    if (!target) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    if (req.user.role === 'Admin' && (target.role === 'Owner' || req.body?.role === 'Owner')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admins cannot modify Owner accounts or assign the Owner role.' });
    }

    const { first_name, last_name, role, status, phone, qualifications, expertise, experience_years, password } = req.body || {};
    await run(
      `UPDATE users SET
        first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
        role = COALESCE(?, role), status = COALESCE(?, status), phone = COALESCE(?, phone),
        qualifications = COALESCE(?, qualifications), expertise = COALESCE(?, expertise),
        experience_years = COALESCE(?, experience_years), updated_at = NOW()
       WHERE id = ?`,
      [first_name || null, last_name || null, role || null, status || null, phone !== undefined ? phone : null, qualifications !== undefined ? qualifications : null, expertise !== undefined ? expertise : null, experience_years !== undefined ? Number(experience_years) : null, targetId]
    );
    if (password && String(password).trim().length >= 8) {
      const hash = await bcrypt.hash(String(password).trim(), 10);
      await run(`UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [hash, targetId]);
    }
    await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'USER_UPDATED', entityType: 'User', entityId: targetId, details: { role, status } });
    return res.json({ message: 'User account updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/users/:id', requireAuth, requireRole('Owner'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'SELF_DELETE', message: 'You cannot delete your own Owner account.' });
  await run(`DELETE FROM users WHERE id = ?`, [targetId]);
  await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'USER_DELETED', entityType: 'User', entityId: targetId });
  return res.json({ message: 'User deleted.' });
});

// --- Parent-Student Links ---
router.get('/parent-links', requireAuth, async (req, res) => {
  let sql = `
    SELECT psl.*,
           CONCAT(p.first_name, ' ', p.last_name) AS parent_name, p.email AS parent_email,
           CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.email AS student_email, s.student_code
    FROM parent_student_links psl
    JOIN users p ON p.id = psl.parent_id
    JOIN users s ON s.id = psl.student_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'Parent') {
    sql += ` AND psl.parent_id = ?`;
    params.push(req.user.id);
  }
  const links = await query(sql + ` ORDER BY psl.created_at DESC`, params);
  return res.json({ links });
});

router.post('/parent-links', requireAuth, async (req, res) => {
  const { parent_id, student_id, student_code = '', relationship = 'Guardian', notes = '' } = req.body || {};
  let resolvedStudentId = student_id ? Number(student_id) : null;
  if (!resolvedStudentId && student_code.trim()) {
    const st = await get(`SELECT id FROM users WHERE student_code = ? AND role = 'Student'`, [student_code.trim()]);
    resolvedStudentId = st?.id || null;
  }
  if (!resolvedStudentId) return res.status(404).json({ error: 'STUDENT_NOT_FOUND', message: 'Valid student ID or student code is required.' });

  const resolvedParentId = req.user.role === 'Parent' ? req.user.id : Number(parent_id);
  const status = req.user.role === 'Parent' ? 'Pending' : 'Approved';
  await run(
    `INSERT IGNORE INTO parent_student_links (parent_id, student_id, relationship, status, notes) VALUES (?, ?, ?, ?, ?)`,
    [resolvedParentId, resolvedStudentId, relationship, status, notes]
  );
  await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'PARENT_LINK_CREATED', entityType: 'ParentStudentLink', entityId: resolvedStudentId, details: { status } });
  return res.status(201).json({ message: status === 'Approved' ? 'Parent linked to student.' : 'Child linking request submitted for admin approval.' });
});

router.patch('/parent-links/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  const { status, relationship } = req.body || {};
  await run(
    `UPDATE parent_student_links SET status = COALESCE(?, status), relationship = COALESCE(?, relationship) WHERE id = ?`,
    [status || null, relationship || null, Number(req.params.id)]
  );
  return res.json({ message: `Parent link updated.` });
});

router.delete('/parent-links/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  await run(`DELETE FROM parent_student_links WHERE id = ?`, [Number(req.params.id)]);
  return res.json({ message: 'Parent-student link deleted.' });
});

// --- Roles & Permissions (Owner full control, Admin read-only/limited) ---
router.get('/roles', requireAuth, requireRole('Owner', 'Admin'), async (_req, res) => {
  const roles = await query(`SELECT * FROM roles ORDER BY id ASC`);
  return res.json({
    roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions_json || '[]') })),
  });
});

router.put('/roles/:id', requireAuth, requireRole('Owner'), async (req, res) => {
  const { permissions = [], description } = req.body || {};
  await run(
    `UPDATE roles SET permissions_json = ?, description = COALESCE(?, description) WHERE id = ?`,
    [JSON.stringify(permissions), description || null, Number(req.params.id)]
  );
  await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'Role', entityId: req.params.id });
  return res.json({ message: 'Role permissions updated.' });
});

// --- Platform Settings & Academy Profile ---
router.get('/settings', async (_req, res) => {
  const rows = await query(`SELECT * FROM platform_settings`);
  const settings = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return res.json({ settings });
});

router.put('/settings', requireAuth, requireRole('Owner'), async (req, res) => {
  const updates = req.body || {};
  for (const [k, v] of Object.entries(updates)) {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    await run(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [k, val]
    );
  }
  await logAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'PLATFORM_SETTINGS_UPDATED', entityType: 'Settings', entityId: 'global' });
  return res.json({ message: 'Platform settings saved.' });
});

// --- Audit Logs (Owner only) ---
router.get('/audit-logs', requireAuth, requireRole('Owner'), async (req, res) => {
  const { search = '', action = '' } = req.query;
  let sql = `
    SELECT al.*, CONCAT(u.first_name, ' ', u.last_name) AS actor_name, u.email AS actor_email
    FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id WHERE 1=1
  `;
  const params = [];
  if (action) {
    sql += ` AND al.action LIKE ?`;
    params.push(`%${action}%`);
  }
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    sql += ` AND (al.action LIKE ? OR al.entity_type LIKE ? OR u.first_name LIKE ? OR u.email LIKE ?)`;
    params.push(q, q, q, q);
  }
  const logs = await query(sql + ` ORDER BY al.created_at DESC LIMIT 150`, params);
  return res.json({ logs });
});

// --- Reports & Analytics Export ---
router.get('/reports', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const { type = 'academic' } = req.query;
    if (type === 'financial') {
      const rows = await query(
        `SELECT p.reference, p.payment_type, p.amount_etb, p.method, p.status, p.paid_at,
                CONCAT(u.first_name, ' ', u.last_name) AS student_name, c.title AS course_title
         FROM payments p LEFT JOIN users u ON u.id = COALESCE(p.student_id, p.user_id) LEFT JOIN courses c ON c.id = p.course_id
         ORDER BY p.paid_at DESC`
      );
      return res.json({ type, rows });
    }
    if (type === 'attendance') {
      const rows = await query(
        `SELECT a.attendance_date, a.status, a.notes, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title
         FROM attendance a JOIN users u ON u.id = a.user_id LEFT JOIN courses c ON c.id = a.course_id
         ORDER BY a.attendance_date DESC`
      );
      return res.json({ type, rows });
    }
    if (type === 'enrollment') {
      const rows = await query(
        `SELECT e.enrolled_at, e.status, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title, c.level
         FROM enrollments e JOIN users u ON u.id = e.student_id JOIN courses c ON c.id = e.course_id
         ORDER BY e.enrolled_at DESC`
      );
      return res.json({ type, rows });
    }
    const rows = await query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title,
              g.assessment_name, g.assessment_type, g.score, g.max_score, g.letter_grade, g.created_at
       FROM grades g JOIN users u ON u.id = g.student_id JOIN courses c ON c.id = g.course_id
       ORDER BY g.created_at DESC`
    );
    return res.json({ type: 'academic', rows });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
