import express from 'express';
import { get, query, run } from '../../database/db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();

async function getAcademyMeta() {
  const settingsRows = await query(`SELECT setting_key, setting_value FROM platform_settings`);
  const settings = {};
  for (const r of settingsRows) {
    settings[r.setting_key] = r.setting_value;
  }
  const categories = await query(`SELECT * FROM categories ORDER BY name ASC`);
  const levels = await query(`SELECT * FROM levels ORDER BY sort_order ASC`);
  const subjects = await query(`SELECT s.*, c.name AS category_name FROM subjects s LEFT JOIN categories c ON c.id = s.category_id ORDER BY s.name ASC`);
  const instructors = await query(`SELECT id, first_name, last_name, expertise, qualifications, bio FROM users WHERE role = 'Instructor' AND status = 'Active' ORDER BY first_name ASC`);
  return { settings, categories, levels, subjects, instructors };
}

router.get('/meta', async (_req, res) => {
  try {
    const meta = await getAcademyMeta();
    return res.json(meta);
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/public-stats', async (_req, res) => {
  try {
    const courseStats = await get(
      `SELECT COUNT(*) AS totalCourses,
              COALESCE(AVG(pro_price_etb), 218) AS proPriceEtb,
              COALESCE(MIN(free_lesson_limit), 5) AS freeLessonLimit
       FROM courses WHERE status = 'Published'`
    );
    const lessonStats = await get(
      `SELECT COUNT(*) AS totalLessons FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.is_active = 1 AND l.availability_status = 'Available' AND c.status = 'Published'`
    );
    const studentStats = await get(`SELECT COUNT(*) AS totalStudents FROM users WHERE role = 'Student' AND status = 'Active'`);
    const instStats = await get(`SELECT COUNT(*) AS totalInstructors FROM users WHERE role = 'Instructor' AND status = 'Active'`);
    const enrollStats = await get(`SELECT COUNT(*) AS totalEnrollments FROM enrollments`);
    const reviewStats = await get(`SELECT ROUND(COALESCE(AVG(rating), 4.9), 1) AS avgRating FROM course_reviews WHERE status = 'Published'`);
    const catStats = await get(`SELECT COUNT(*) AS totalCategories FROM categories`);

    return res.json({
      totalCourses: Number(courseStats?.totalCourses || 0),
      totalLessons: Number(lessonStats?.totalLessons || 0),
      totalStudents: Number(studentStats?.totalStudents || 0),
      totalInstructors: Number(instStats?.totalInstructors || 0),
      totalEnrollments: Number(enrollStats?.totalEnrollments || 0),
      totalCategories: Number(catStats?.totalCategories || 0),
      proPriceEtb: Math.round(Number(courseStats?.proPriceEtb || 218)),
      freeLessonLimit: Number(courseStats?.freeLessonLimit || 5),
      avgRating: Number(reviewStats?.avgRating || 4.9),
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      search = '',
      category = '',
      level = '',
      language = '',
      accessType = '',
      statusFilter = '',
      instructorId = '',
      sort = 'recent',
      page = '1',
      limit = '12',
      includeAllStatuses = 'false',
    } = req.query;

    const isStaff = req.user && ['Owner', 'Admin', 'Instructor'].includes(req.user.role);
    const showAll = includeAllStatuses === 'true' && isStaff;

    let sql = `
      SELECT c.id, c.title, c.slug, c.description, c.learning_objectives, c.prerequisites, c.target_audience,
             c.thumbnail_url, c.category_id, cat.name AS category_name, c.subject_id, sub.name AS subject_name,
             c.level, c.language, c.instructor_id, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name,
             c.pro_price_etb, c.free_lesson_limit, c.status, c.visibility, c.source_type,
             c.estimated_duration, c.tags_json, c.last_synced_at, c.sync_status, c.created_at,
             (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.is_active = 1 AND l.availability_status = 'Available') AS lesson_count,
             (SELECT COALESCE(SUM(l.duration_seconds), 0) FROM lessons l WHERE l.course_id = c.id AND l.is_active = 1 AND l.availability_status = 'Available') AS total_duration_seconds,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count,
             (SELECT ROUND(AVG(r.rating), 1) FROM course_reviews r WHERE r.course_id = c.id AND r.status = 'Published') AS avg_rating,
             (SELECT COUNT(*) FROM course_reviews r WHERE r.course_id = c.id AND r.status = 'Published') AS review_count
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN subjects sub ON sub.id = c.subject_id
      LEFT JOIN users u ON u.id = c.instructor_id
      WHERE 1=1
    `;
    const params = [];

    if (!showAll) {
      sql += ` AND c.status = 'Published' AND c.visibility = 'Public'`;
    } else if (req.user.role === 'Instructor') {
      sql += ` AND (c.instructor_id = ? OR c.created_by = ? OR c.status = 'Published')`;
      params.push(req.user.id, req.user.id);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.tags_json LIKE ? OR EXISTS (SELECT 1 FROM lessons l WHERE l.course_id = c.id AND l.title LIKE ?))`;
      params.push(q, q, q, q);
    }

    if (category) {
      const numericCat = /^\d+$/.test(String(category).trim()) ? Number(category) : -1;
      sql += ` AND (cat.name = ? OR cat.slug = ? OR c.category_id = ?)`;
      params.push(category, category, numericCat);
    }
    if (level) {
      sql += ` AND c.level = ?`;
      params.push(level);
    }
    if (language) {
      sql += ` AND c.language = ?`;
      params.push(language);
    }
    if (instructorId) {
      sql += ` AND c.instructor_id = ?`;
      params.push(Number(instructorId));
    }

    let courses = await query(sql, params);

    // Attach user-specific enrollment, entitlement, progress, bookmark state
    const userId = req.user?.id;
    let enrolledSet = new Set();
    let proStatusMap = new Map();
    let bookmarkSet = new Set();
    let progressMap = new Map();

    if (userId) {
      const enrolls = await query(`SELECT course_id FROM enrollments WHERE student_id = ?`, [userId]);
      enrolledSet = new Set(enrolls.map((e) => e.course_id));
      const ents = await query(`SELECT course_id, status FROM course_entitlements WHERE user_id = ?`, [userId]);
      proStatusMap = new Map(ents.map((e) => [e.course_id, e.status]));
      const bms = await query(`SELECT course_id FROM course_bookmarks WHERE user_id = ?`, [userId]);
      bookmarkSet = new Set(bms.map((b) => b.course_id));
      const progs = await query(
        `SELECT course_id, COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_lessons
         FROM lesson_progress WHERE user_id = ? GROUP BY course_id`,
        [userId]
      );
      for (const p of progs) progressMap.set(p.course_id, p.completed_lessons);
    }

    courses = courses.map((c) => {
      const lessonCount = Number(c.lesson_count || 0);
      const completedLessons = progressMap.get(c.id) || 0;
      const progressPercent = lessonCount > 0 ? Math.round((completedLessons / lessonCount) * 100) : 0;
      const proReqStatus = proStatusMap.get(c.id) || null;
      const hasProAccess =
        (req.user && ['Owner', 'Admin'].includes(req.user.role)) ||
        (req.user && req.user.role === 'Instructor' && c.instructor_id === req.user.id) ||
        proReqStatus === 'Active';

      let tags = [];
      try { tags = JSON.parse(c.tags_json || '[]'); } catch { tags = []; }

      return {
        ...c,
        tags,
        lesson_count: lessonCount,
        completed_lessons: completedLessons,
        progress_percent: progressPercent,
        is_enrolled: enrolledSet.has(c.id),
        has_pro_access: hasProAccess,
        pro_request_status: hasProAccess ? 'Active' : proReqStatus,
        is_bookmarked: bookmarkSet.has(c.id),
        pro_price_etb: Number(c.pro_price_etb || 218),
        free_lesson_limit: Number(c.free_lesson_limit || 5),
      };
    });

    if (accessType === 'free') {
      courses = courses.filter((c) => !c.has_pro_access);
    } else if (accessType === 'pro') {
      courses = courses.filter((c) => c.has_pro_access || c.lesson_count > c.free_lesson_limit);
    }

    if (statusFilter && userId) {
      if (statusFilter === 'enrolled') courses = courses.filter((c) => c.is_enrolled);
      if (statusFilter === 'in_progress') courses = courses.filter((c) => c.progress_percent > 0 && c.progress_percent < 100);
      if (statusFilter === 'completed') courses = courses.filter((c) => c.progress_percent === 100);
      if (statusFilter === 'locked') courses = courses.filter((c) => !c.has_pro_access && c.lesson_count > c.free_lesson_limit);
      if (statusFilter === 'available') courses = courses.filter((c) => !c.is_enrolled);
    }

    // Sorting
    if (sort === 'title_asc') courses.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'title_desc') courses.sort((a, b) => b.title.localeCompare(a.title));
    else if (sort === 'popular') courses.sort((a, b) => Number(b.enrollment_count) - Number(a.enrollment_count));
    else if (sort === 'highest_rated') courses.sort((a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0));
    else if (sort === 'shortest') courses.sort((a, b) => Number(a.total_duration_seconds) - Number(b.total_duration_seconds));
    else if (sort === 'longest') courses.sort((a, b) => Number(b.total_duration_seconds) - Number(a.total_duration_seconds));
    else courses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = courses.length;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 100);
    const paged = courses.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      courses: paged,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const { videoSort = 'order' } = req.query;

    const course = await get(
      `SELECT c.id, c.title, c.slug, c.description, c.learning_objectives, c.prerequisites, c.target_audience,
              c.thumbnail_url, c.category_id, cat.name AS category_name, c.subject_id, sub.name AS subject_name,
              c.level, c.language, c.instructor_id,
              CONCAT(u.first_name, ' ', u.last_name) AS instructor_name, u.qualifications AS instructor_qualifications,
              u.expertise AS instructor_expertise, u.bio AS instructor_bio,
              c.pro_price_etb, c.free_lesson_limit, c.status, c.visibility, c.source_type,
              c.estimated_duration, c.tags_json, c.last_synced_at, c.sync_status, c.created_at
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN subjects sub ON sub.id = c.subject_id
       LEFT JOIN users u ON u.id = c.instructor_id
       WHERE c.id = ?`,
      [courseId]
    );

    if (!course) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });
    }

    const isStaff = req.user && (
      ['Owner', 'Admin'].includes(req.user.role) ||
      (req.user.role === 'Instructor' && course.instructor_id === req.user.id)
    );

    if (course.status !== 'Published' && !isStaff) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'This course is not currently published.' });
    }

    const sections = await query(`SELECT * FROM course_sections WHERE course_id = ? ORDER BY sort_order ASC`, [courseId]);
    const rawLessons = await query(
      `SELECT l.*, s.title AS section_title
       FROM lessons l
       LEFT JOIN course_sections s ON s.id = l.section_id
       WHERE l.course_id = ? AND l.is_active = 1
       ORDER BY l.sort_order ASC, l.id ASC`,
      [courseId]
    );

    const userId = req.user?.id || null;
    let hasProEntitlement = isStaff;
    let proRequestStatus = isStaff ? 'Active' : null;
    let isEnrolled = false;
    let isBookmarked = false;
    const progressMap = new Map();
    const bookmarkLessons = new Set();
    const notesMap = new Map();

    if (userId) {
      const ent = await get(`SELECT id, status FROM course_entitlements WHERE user_id = ? AND course_id = ?`, [userId, courseId]);
      if (ent) {
        if (!isStaff) proRequestStatus = ent.status;
        if (ent.status === 'Active') hasProEntitlement = true;
      }
      const enr = await get(`SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?`, [userId, courseId]);
      isEnrolled = Boolean(enr);
      const cbm = await get(`SELECT id FROM course_bookmarks WHERE user_id = ? AND course_id = ?`, [userId, courseId]);
      isBookmarked = Boolean(cbm);

      const progs = await query(`SELECT * FROM lesson_progress WHERE user_id = ? AND course_id = ?`, [userId, courseId]);
      for (const p of progs) progressMap.set(p.lesson_id, p);

      const lbms = await query(`SELECT lesson_id FROM lesson_bookmarks WHERE user_id = ?`, [userId]);
      for (const b of lbms) bookmarkLessons.add(b.lesson_id);

      const lnotes = await query(`SELECT lesson_id, content FROM lesson_notes WHERE user_id = ?`, [userId]);
      for (const n of lnotes) notesMap.set(n.lesson_id, n.content);
    }

    const freeLimit = Number(course.free_lesson_limit || 5);
    let eligibleIndex = 0;

    let lessons = rawLessons.map((l) => {
      const isAvailable = l.availability_status === 'Available';
      let isFreeTier = false;
      if (isAvailable) {
        isFreeTier = eligibleIndex < freeLimit;
        eligibleIndex += 1;
      }

      // Authenticated users can watch first 5 eligible lessons free; Pro entitlement unlocks all
      const canWatch = Boolean(userId) && isAvailable && (isFreeTier || hasProEntitlement);
      const prog = progressMap.get(l.id);

      return {
        id: l.id,
        course_id: l.course_id,
        section_id: l.section_id,
        section_title: l.section_title || 'Curriculum',
        title: l.title,
        description: l.description,
        learning_objectives: l.learning_objectives,
        instructor_notes: canWatch ? l.instructor_notes : '',
        thumbnail_url: l.thumbnail_url || course.thumbnail_url,
        duration_seconds: l.duration_seconds,
        duration_label: l.duration_label,
        published_at: l.published_at,
        availability_status: l.availability_status,
        sort_order: l.sort_order,
        is_free_tier: isFreeTier,
        is_locked: !canWatch,
        requires_login: !userId && isFreeTier,
        requires_pro: !isFreeTier && !hasProEntitlement,
        youtube_video_id: canWatch ? l.youtube_video_id : null,
        progress: prog || null,
        is_bookmarked: bookmarkLessons.has(l.id),
        personal_note: notesMap.get(l.id) || '',
      };
    });

    if (videoSort === 'newest') {
      lessons = [...lessons].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (videoSort === 'oldest') {
      lessons = [...lessons].sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
    }

    const reviews = await query(
      `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name
       FROM course_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.course_id = ? AND r.status = 'Published' ORDER BY r.created_at DESC`,
      [courseId]
    );
    const announcements = await query(
      `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
       FROM announcements a LEFT JOIN users u ON u.id = a.author_id
       WHERE a.course_id = ? AND a.status = 'Published' ORDER BY a.created_at DESC`,
      [courseId]
    );
    const resources = await query(
      `SELECT id, title, description, resource_type, file_url, file_name, visibility, created_at
       FROM resources WHERE course_id = ? ORDER BY created_at DESC`,
      [courseId]
    );
    const relatedCourses = await query(
      `SELECT id, title, thumbnail_url, level, estimated_duration, pro_price_etb
       FROM courses WHERE status = 'Published' AND id != ? AND (category_id = ? OR level = ?)
       LIMIT 3`,
      [courseId, course.category_id, course.level]
    );

    const availableCount = lessons.filter((l) => l.availability_status === 'Available').length;
    const completedCount = lessons.filter((l) => l.progress?.status === 'Completed').length;

    let tags = [];
    try { tags = JSON.parse(course.tags_json || '[]'); } catch { tags = []; }

    return res.json({
      course: {
        ...course,
        tags,
        pro_price_etb: Number(course.pro_price_etb || 218),
        free_lesson_limit: freeLimit,
        has_pro_access: hasProEntitlement,
        pro_request_status: proRequestStatus,
        is_enrolled: isEnrolled,
        is_bookmarked: isBookmarked,
        available_lesson_count: availableCount,
        completed_lesson_count: completedCount,
        progress_percent: availableCount > 0 ? Math.round((completedCount / availableCount) * 100) : 0,
      },
      sections,
      lessons,
      reviews,
      announcements,
      resources,
      relatedCourses,
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/:courseId/lessons/:lessonId', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const lessonId = Number(req.params.lessonId);

    const course = await get(`SELECT * FROM courses WHERE id = ?`, [courseId]);
    if (!course) return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });

    const allLessons = await query(
      `SELECT * FROM lessons WHERE course_id = ? AND is_active = 1 AND availability_status = 'Available' ORDER BY sort_order ASC, id ASC`,
      [courseId]
    );

    const targetIndex = allLessons.findIndex((l) => l.id === lessonId);
    if (targetIndex === -1) {
      return res.status(404).json({ error: 'LESSON_UNAVAILABLE', message: 'This lesson is unavailable or does not exist.' });
    }

    const isStaff = ['Owner', 'Admin'].includes(req.user.role) || (req.user.role === 'Instructor' && course.instructor_id === req.user.id);
    const ent = await get(`SELECT id FROM course_entitlements WHERE user_id = ? AND course_id = ? AND status = 'Active'`, [req.user.id, courseId]);
    const hasPro = isStaff || Boolean(ent);
    const freeLimit = Number(course.free_lesson_limit || 5);

    if (targetIndex >= freeLimit && !hasPro) {
      return res.status(403).json({
        error: 'EZANA_PRO_REQUIRED',
        upgradePriceEtb: Number(course.pro_price_etb || 218),
        courseId,
        courseTitle: course.title,
        message: 'Please upgrade to the Ezana Pro plan (ETB 218) to unlock the full tutorial videos for this course.',
      });
    }

    const lesson = allLessons[targetIndex];
    const progress = await get(`SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    const note = await get(`SELECT content, updated_at FROM lesson_notes WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    const bm = await get(`SELECT id FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    const quiz = await get(`SELECT id, title, duration_minutes, max_score FROM quizzes WHERE lesson_id = ? AND status = 'Published'`, [lessonId]);

    return res.json({
      lesson,
      progress: progress || null,
      note: note?.content || '',
      isBookmarked: Boolean(bm),
      quiz: quiz || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/enroll', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const course = await get(`SELECT id, title, status FROM courses WHERE id = ?`, [courseId]);
    if (!course) return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });

    const existing = await get(`SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?`, [req.user.id, courseId]);
    if (!existing) {
      await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [req.user.id, courseId]);
      await logAudit({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'COURSE_ENROLLED',
        entityType: 'Course',
        entityId: courseId,
        details: { title: course.title },
      });
    }
    return res.json({ message: 'Successfully enrolled in course.', enrolled: true });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/bookmark', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const existing = await get(`SELECT id FROM course_bookmarks WHERE user_id = ? AND course_id = ?`, [req.user.id, courseId]);
    if (existing) {
      await run(`DELETE FROM course_bookmarks WHERE id = ?`, [existing.id]);
      return res.json({ bookmarked: false });
    }
    await run(`INSERT INTO course_bookmarks (user_id, course_id) VALUES (?, ?)`, [req.user.id, courseId]);
    return res.json({ bookmarked: true });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/reviews', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { rating, comment = '' } = req.body || {};
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 5.' });
    }
    const enrolled = await get(`SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?`, [req.user.id, courseId]);
    if (!enrolled && req.user.role === 'Student') {
      return res.status(403).json({ error: 'NOT_ENROLLED', message: 'Only enrolled students can review this course.' });
    }

    const existing = await get(`SELECT id FROM course_reviews WHERE course_id = ? AND user_id = ?`, [courseId, req.user.id]);
    if (existing) {
      await run(`UPDATE course_reviews SET rating = ?, comment = ? WHERE id = ?`, [numRating, comment.trim(), existing.id]);
    } else {
      await run(`INSERT INTO course_reviews (course_id, user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'Published')`, [courseId, req.user.id, numRating, comment.trim()]);
    }
    return res.json({ message: 'Review saved successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/lessons/:lessonId/progress', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const lessonId = Number(req.params.lessonId);
    const { watchedSeconds = 0, durationSeconds = 600, markComplete = false } = req.body || {};

    const lesson = await get(`SELECT id, duration_seconds FROM lessons WHERE id = ? AND course_id = ?`, [lessonId, courseId]);
    if (!lesson) return res.status(404).json({ error: 'NOT_FOUND', message: 'Lesson not found.' });

    const dur = Math.max(Number(durationSeconds || lesson.duration_seconds || 600), 1);
    const watched = Math.min(Math.max(Number(watchedSeconds || 0), 0), dur);
    let pct = Math.min(Math.round((watched / dur) * 100), 100);

    const existing = await get(`SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    let status = existing?.status === 'Completed' ? 'Completed' : 'In Progress';
    if (markComplete === true || pct >= 85) {
      status = 'Completed';
      pct = 100;
    }

    if (existing) {
      await run(
        `UPDATE lesson_progress SET
          watched_seconds = ?, duration_seconds = ?, progress_percent = ?, status = ?,
          last_accessed_at = NOW(),
          completed_at = CASE WHEN ? = 'Completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END
         WHERE id = ?`,
        [Math.max(watched, existing.watched_seconds || 0), dur, Math.max(pct, existing.progress_percent || 0), status, status, existing.id]
      );
    } else {
      await run(
        `INSERT INTO lesson_progress (user_id, course_id, lesson_id, watched_seconds, duration_seconds, progress_percent, status, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'Completed' THEN NOW() ELSE NULL END)`,
        [req.user.id, courseId, lessonId, watched, dur, pct, status, status]
      );
    }

    const updated = await get(`SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    return res.json({ progress: updated });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/lessons/:lessonId/bookmark', requireAuth, async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const existing = await get(`SELECT id FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    if (existing) {
      await run(`DELETE FROM lesson_bookmarks WHERE id = ?`, [existing.id]);
      return res.json({ bookmarked: false });
    }
    await run(`INSERT INTO lesson_bookmarks (user_id, lesson_id) VALUES (?, ?)`, [req.user.id, lessonId]);
    return res.json({ bookmarked: true });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/:courseId/lessons/:lessonId/note', requireAuth, async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const { content = '' } = req.body || {};
    const existing = await get(`SELECT id FROM lesson_notes WHERE user_id = ? AND lesson_id = ?`, [req.user.id, lessonId]);
    if (existing) {
      await run(`UPDATE lesson_notes SET content = ?, updated_at = NOW() WHERE id = ?`, [String(content), existing.id]);
    } else {
      await run(`INSERT INTO lesson_notes (user_id, lesson_id, content) VALUES (?, ?, ?)`, [req.user.id, lessonId, String(content)]);
    }
    return res.json({ message: 'Lesson note saved.', content: String(content) });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/:courseId/lessons/:lessonId/report', requireAuth, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const lessonId = Number(req.params.lessonId);
    const { reason, details = '' } = req.body || {};
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Please specify a reason for reporting.' });
    }
    await run(
      `INSERT INTO lesson_reports (lesson_id, course_id, user_id, reason, details) VALUES (?, ?, ?, ?, ?)`,
      [lessonId, courseId, req.user.id, reason.trim(), details.trim()]
    );
    return res.status(201).json({ message: 'Problem report submitted. Our academic team will review it shortly.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
