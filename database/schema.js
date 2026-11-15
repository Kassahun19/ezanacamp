export const mysqlSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS roles (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions_json LONGTEXT NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Student',
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    phone VARCHAR(64) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500) NOT NULL DEFAULT '',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Africa/Addis_Ababa',
    language VARCHAR(64) NOT NULL DEFAULT 'English',
    qualifications VARCHAR(500) NOT NULL DEFAULT '',
    expertise VARCHAR(500) NOT NULL DEFAULT '',
    experience_years INT NOT NULL DEFAULT 0,
    bio TEXT,
    student_code VARCHAR(64) NOT NULL DEFAULT '',
    notify_email TINYINT(1) NOT NULL DEFAULT 1,
    notify_sms TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS parent_student_links (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parent_id INT NOT NULL,
    student_id INT NOT NULL,
    relationship VARCHAR(64) NOT NULL DEFAULT 'Guardian',
    status VARCHAR(50) NOT NULL DEFAULT 'Approved',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_parent_student (parent_id, student_id),
    CONSTRAINT fk_psl_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_psl_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS academic_years (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    start_date VARCHAR(40) NOT NULL,
    end_date VARCHAR(40) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS semesters (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    academic_year_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    start_date VARCHAR(40) NOT NULL,
    end_date VARCHAR(40) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_semesters_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS departments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    head_name VARCHAR(150) NOT NULL DEFAULT '',
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS classes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    section VARCHAR(32) NOT NULL DEFAULT 'A',
    department_id INT NULL,
    academic_year_id INT NULL,
    instructor_id INT NULL,
    capacity INT NOT NULL DEFAULT 40,
    room VARCHAR(120) NOT NULL DEFAULT 'Room 101',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_classes_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_classes_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT fk_classes_inst FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS class_students (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_class_student (class_id, student_id),
    CONSTRAINT fk_cs_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS subjects (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(64) NOT NULL DEFAULT '',
    category_id INT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subjects_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS levels (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS youtube_integrations (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    label VARCHAR(180) NOT NULL DEFAULT 'Primary Academy Channel Key',
    encrypted_api_key TEXT NOT NULL,
    key_last4 VARCHAR(16) NOT NULL DEFAULT '',
    default_channel_id VARCHAR(128) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'Connected',
    last_validated_at DATETIME NULL,
    last_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_yt_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS courses (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(191) NOT NULL UNIQUE,
    description TEXT,
    learning_objectives TEXT,
    prerequisites TEXT,
    target_audience TEXT,
    thumbnail_url VARCHAR(500) NOT NULL DEFAULT '',
    category_id INT NULL,
    subject_id INT NULL,
    level VARCHAR(64) NOT NULL DEFAULT 'Beginner',
    language VARCHAR(64) NOT NULL DEFAULT 'English',
    instructor_id INT NULL,
    pro_price_etb DECIMAL(10,2) NOT NULL DEFAULT 218.00,
    free_lesson_limit INT NOT NULL DEFAULT 5,
    status VARCHAR(50) NOT NULL DEFAULT 'Published',
    visibility VARCHAR(50) NOT NULL DEFAULT 'Public',
    source_type VARCHAR(50) NOT NULL DEFAULT 'Manual',
    youtube_channel_id VARCHAR(128) NOT NULL DEFAULT '',
    youtube_integration_id INT NULL,
    estimated_duration VARCHAR(64) NOT NULL DEFAULT '4h 30m',
    tags_json TEXT,
    last_synced_at DATETIME NULL,
    sync_status VARCHAR(50) NOT NULL DEFAULT 'Idle',
    created_by INT NULL,
    approved_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_courses_subj FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_courses_inst FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS course_sections (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sections_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lessons (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    section_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    learning_objectives TEXT,
    instructor_notes TEXT,
    video_source VARCHAR(50) NOT NULL DEFAULT 'YouTube',
    youtube_video_id VARCHAR(64) DEFAULT NULL,
    thumbnail_url VARCHAR(500) NOT NULL DEFAULT '',
    duration_seconds INT NOT NULL DEFAULT 600,
    duration_label VARCHAR(32) NOT NULL DEFAULT '10:00',
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    availability_status VARCHAR(50) NOT NULL DEFAULT 'Available',
    sort_order INT NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_lessons_course_yt (course_id, youtube_video_id),
    INDEX idx_lessons_course_order (course_id, sort_order),
    CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_lessons_section FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lesson_progress (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    lesson_id INT NOT NULL,
    watched_seconds INT NOT NULL DEFAULT 0,
    duration_seconds INT NOT NULL DEFAULT 600,
    progress_percent INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'In Progress',
    last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    UNIQUE KEY uq_progress_user_lesson (user_id, lesson_id),
    CONSTRAINT fk_lp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_lp_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_lp_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lesson_bookmarks (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bm_user_lesson (user_id, lesson_id),
    CONSTRAINT fk_lb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_lb_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lesson_notes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    content TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_note_user_lesson (user_id, lesson_id),
    CONSTRAINT fk_ln_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ln_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS course_bookmarks (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cb_user_course (user_id, course_id),
    CONSTRAINT fk_cb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cb_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS course_reviews (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Published',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_review_course_user (course_id, user_id),
    CONSTRAINT fk_cr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS course_approval_history (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor_id INT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cah_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS enrollments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    UNIQUE KEY uq_enrollment (student_id, course_id),
    CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS enrollment_requests (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_er_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_er_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS course_entitlements (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    plan_name VARCHAR(80) NOT NULL DEFAULT 'Ezana Pro',
    amount_etb DECIMAL(10,2) NOT NULL DEFAULT 218.00,
    payment_id INT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_entitlement (user_id, course_id),
    CONSTRAINT fk_ce_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ce_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS timetables (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NULL,
    class_id INT NULL,
    instructor_id INT NULL,
    title VARCHAR(255) NOT NULL,
    day_of_week VARCHAR(32) NOT NULL,
    start_time VARCHAR(16) NOT NULL,
    end_time VARCHAR(16) NOT NULL,
    room VARCHAR(120) NOT NULL DEFAULT 'Virtual Hall A',
    session_type VARCHAR(64) NOT NULL DEFAULT 'Lesson',
    session_date VARCHAR(40) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS live_classes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NULL,
    class_id INT NULL,
    instructor_id INT NULL,
    title VARCHAR(255) NOT NULL,
    meeting_url VARCHAR(500) NOT NULL,
    scheduled_at VARCHAR(64) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    recording_url VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS attendance (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_role VARCHAR(50) NOT NULL DEFAULT 'Student',
    course_id INT NULL,
    class_id INT NULL,
    attendance_date VARCHAR(40) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Present',
    notes TEXT,
    recorded_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS assignments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    class_id INT NULL,
    instructor_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date VARCHAR(40) NOT NULL,
    max_score DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    attachment_url VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'Published',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    submission_text TEXT,
    attachment_name VARCHAR(255) NOT NULL DEFAULT '',
    score DECIMAL(10,2) NULL,
    feedback TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    graded_at DATETIME NULL,
    graded_by INT NULL,
    UNIQUE KEY uq_submission (assignment_id, student_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS quizzes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    lesson_id INT NULL,
    instructor_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    max_score DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    available_from VARCHAR(40) NOT NULL DEFAULT '',
    available_until VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'Published',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NULL,
    course_id INT NULL,
    subject_id INT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'MCQ',
    options_json TEXT NOT NULL,
    correct_answer VARCHAR(500) NOT NULL,
    points DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_id INT NOT NULL,
    answers_json LONGTEXT NOT NULL,
    score DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_score DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Completed',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS grades (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    academic_year_id INT NULL,
    semester_id INT NULL,
    assessment_name VARCHAR(255) NOT NULL,
    assessment_type VARCHAR(64) NOT NULL DEFAULT 'Exam',
    score DECIMAL(10,2) NOT NULL,
    max_score DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    letter_grade VARCHAR(16) NOT NULL DEFAULT 'A',
    remarks TEXT,
    released TINYINT(1) NOT NULL DEFAULT 1,
    recorded_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS resources (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NULL,
    subject_id INT NULL,
    category_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(64) NOT NULL DEFAULT 'PDF',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    visibility VARCHAR(50) NOT NULL DEFAULT 'Enrolled',
    uploaded_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS certificates (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    certificate_code VARCHAR(120) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    template_name VARCHAR(255) NOT NULL DEFAULT 'Ezana Academy Official Completion Certificate',
    issued_by INT NULL,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Issued'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS fees (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NULL,
    academic_year_id INT NULL,
    semester_id INT NULL,
    title VARCHAR(255) NOT NULL,
    fee_type VARCHAR(64) NOT NULL DEFAULT 'Tuition',
    amount_etb DECIMAL(10,2) NOT NULL,
    discount_etb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_etb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    due_date VARCHAR(40) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS payments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(120) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    student_id INT NULL,
    fee_id INT NULL,
    course_id INT NULL,
    payment_type VARCHAR(64) NOT NULL DEFAULT 'Ezana Pro',
    amount_etb DECIMAL(10,2) NOT NULL,
    method VARCHAR(64) NOT NULL DEFAULT 'Telebirr',
    status VARCHAR(50) NOT NULL DEFAULT 'Completed',
    gateway_meta VARCHAR(255) NOT NULL DEFAULT '',
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(120) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    fee_id INT NULL,
    payment_id INT NULL,
    amount_etb DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Issued',
    issue_date VARCHAR(40) NOT NULL DEFAULT '',
    due_date VARCHAR(40) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS announcements (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_role VARCHAR(50) NOT NULL DEFAULT 'All',
    course_id INT NULL,
    class_id INT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Published',
    publish_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    author_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS messages (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    student_context_id INT NULL,
    subject VARCHAR(255) NOT NULL DEFAULT 'Direct Message',
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    archived_by_sender TINYINT(1) NOT NULL DEFAULT 0,
    archived_by_recipient TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS discussion_posts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    parent_id INT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'System',
    link_target VARCHAR(120) NOT NULL DEFAULT '',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS support_tickets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    assigned_to INT NULL,
    response_text TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sync_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    integration_id INT NULL,
    triggered_by INT NULL,
    status VARCHAR(50) NOT NULL,
    videos_fetched INT NOT NULL DEFAULT 0,
    videos_added INT NOT NULL DEFAULT 0,
    videos_updated INT NOT NULL DEFAULT 0,
    videos_unavailable INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lesson_reports (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NOT NULL,
    course_id INT NOT NULL,
    user_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(150) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    actor_role VARCHAR(50) NOT NULL DEFAULT '',
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL DEFAULT '',
    entity_id VARCHAR(80) NOT NULL DEFAULT '',
    details_json LONGTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS instructor_payouts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT NOT NULL,
    period_label VARCHAR(180) NOT NULL,
    amount_etb DECIMAL(10,2) NOT NULL,
    reference VARCHAR(120) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Paid',
    paid_at VARCHAR(40) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];
