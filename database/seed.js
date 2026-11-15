import bcrypt from 'bcryptjs';
import { get, initDatabase, run, toMysqlDatetime } from './db.js';

export async function seedDatabase() {
  await initDatabase();

  const completed = await get(`SELECT setting_value FROM platform_settings WHERE setting_key = 'academy_name'`);
  if (completed) {
    return;
  }
  const existingRoles = await get('SELECT COUNT(*) AS count FROM roles');
  if (existingRoles && existingRoles.count > 0) {
    return;
  }

  console.log('[Seed] Initializing Ezana Academy database records...');

  // 1. Roles & Permissions
  const roleSeeds = [
    {
      name: 'Owner',
      description: 'Full platform governance, financial control, RBAC, and integration management',
      permissions: [
        'dashboard:view', 'reports:view', 'reports:export',
        'users:manage', 'students:manage', 'instructors:manage', 'parents:manage',
        'academic:manage', 'courses:manage', 'courses:publish', 'courses:approve', 'courses:delete',
        'subjects:manage', 'timetables:manage', 'attendance:manage', 'grades:manage', 'resources:manage',
        'finance:manage', 'invoices:manage', 'transactions:view',
        'communication:manage', 'announcements:manage', 'support:manage',
        'roles:manage', 'settings:manage', 'academy:manage', 'integrations:manage', 'audit:view',
        'youtube:import', 'youtube:keys'
      ],
    },
    {
      name: 'Admin',
      description: 'Daily academy administration, enrollment management, academic operations, and finance monitoring',
      permissions: [
        'dashboard:view', 'reports:view', 'reports:export',
        'users:manage', 'students:manage', 'instructors:manage', 'parents:manage',
        'academic:manage', 'courses:manage', 'courses:publish',
        'subjects:manage', 'timetables:manage', 'attendance:manage', 'grades:manage', 'resources:manage',
        'enrollments:manage', 'certificates:manage',
        'finance:view', 'finance:record', 'invoices:manage',
        'communication:manage', 'announcements:manage', 'support:manage',
        'youtube:import'
      ],
    },
    {
      name: 'Instructor',
      description: 'Teaching, course authoring, YouTube course import, grading, attendance, and student engagement',
      permissions: [
        'dashboard:view', 'courses:own', 'courses:create', 'resources:own',
        'classes:own', 'students:assigned', 'timetables:own', 'attendance:record',
        'live_classes:manage', 'assignments:manage', 'quizzes:manage', 'grades:own',
        'reports:own', 'communication:students', 'communication:parents', 'forums:moderate',
        'earnings:view', 'youtube:import'
      ],
    },
    {
      name: 'Student',
      description: 'Personal learning environment, video tutorials, assessments, grades, fees, and communication',
      permissions: [
        'dashboard:view', 'learning:view', 'courses:enroll', 'lessons:watch',
        'assignments:submit', 'quizzes:attempt', 'grades:self', 'attendance:self',
        'certificates:self', 'fees:self', 'payments:make', 'communication:student', 'forums:post'
      ],
    },
    {
      name: 'Parent',
      description: 'Linked child monitoring, academic reports, attendance, fee payments, and instructor communication',
      permissions: [
        'dashboard:view', 'children:view', 'children:switch', 'monitoring:view',
        'grades:children', 'attendance:children', 'fees:children', 'payments:children',
        'communication:parent', 'children:link_request'
      ],
    },
  ];

  for (const r of roleSeeds) {
    await run(
      'INSERT INTO roles (name, description, permissions_json, is_system) VALUES (?, ?, ?, 1)',
      [r.name, r.description, JSON.stringify(r.permissions)]
    );
  }

  // 2. Users (Password for seeded accounts: Ezana@2027!)
  const defaultHash = await bcrypt.hash('Ezana@2027!', 10);

  const userSeeds = [
    {
      first_name: 'Kassahun',
      last_name: 'Mulatu',
      email: 'owner@ezana.edu.et',
      role: 'Owner',
      phone: '+251 911 200 101',
      qualifications: 'MSc Software Architecture & Academic Systems',
      expertise: 'Platform Strategy, Educational Governance',
      experience_years: 14,
      bio: 'Founder and Executive Director of Ezana Academy.',
      student_code: '',
    },
    {
      first_name: 'Meron',
      last_name: 'Teshager',
      email: 'admin@ezana.edu.et',
      role: 'Admin',
      phone: '+251 911 200 102',
      qualifications: 'MBA Educational Administration',
      expertise: 'Registrar Operations, Enrollment & Finance',
      experience_years: 9,
      bio: 'Head of Academy Administration & Student Records.',
      student_code: '',
    },
    {
      first_name: 'Selamawit',
      last_name: 'Tadesse',
      email: 'selamawit.tadesse@ezana.edu.et',
      role: 'Instructor',
      phone: '+251 911 300 201',
      qualifications: 'PhD Computer Science, Addis Ababa University',
      expertise: 'Full-Stack Web Engineering, Algorithms, Distributed Systems',
      experience_years: 10,
      bio: 'Senior Software Engineering Instructor leading technical bootcamps and curriculum.',
      student_code: '',
    },
    {
      first_name: 'Dawit',
      last_name: 'Bekele',
      email: 'dawit.bekele@ezana.edu.et',
      role: 'Instructor',
      phone: '+251 911 300 202',
      qualifications: 'MSc Applied Mathematics & Quantitative Finance',
      expertise: 'Linear Algebra, Calculus, Corporate Finance, Natural Sciences',
      experience_years: 8,
      bio: 'Quantitative Mathematics & Finance Educator at Ezana Academy.',
      student_code: '',
    },
    {
      first_name: 'Abebe',
      last_name: 'Kebede',
      email: 'abebe.kebede@ezana.edu.et',
      role: 'Student',
      phone: '+251 912 400 301',
      qualifications: '',
      expertise: '',
      experience_years: 0,
      bio: 'Cohort 2027 Honors Scholar focusing on Software Engineering and Quantitative Methods.',
      student_code: 'EZN-2027-0104',
    },
    {
      first_name: 'Hana',
      last_name: 'Girum',
      email: 'hana.girum@ezana.edu.et',
      role: 'Student',
      phone: '+251 912 400 302',
      qualifications: '',
      expertise: '',
      experience_years: 0,
      bio: 'Cohort 2027 Science & Design Track Student.',
      student_code: 'EZN-2027-0105',
    },
    {
      first_name: 'Tigist',
      last_name: 'Alemu',
      email: 'tigist.alemu@ezana.edu.et',
      role: 'Parent',
      phone: '+251 911 500 401',
      qualifications: '',
      expertise: '',
      experience_years: 0,
      bio: 'Parent & Guardian monitoring Abebe Kebede and Hana Girum.',
      student_code: '',
    },
  ];

  const userIds = {};
  for (const u of userSeeds) {
    const res = await run(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status, phone, qualifications, expertise, experience_years, bio, student_code)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?)`,
      [u.first_name, u.last_name, u.email, defaultHash, u.role, u.phone, u.qualifications, u.expertise, u.experience_years, u.bio, u.student_code]
    );
    userIds[u.email] = res.lastInsertRowid;
  }

  const ownerId = userIds['owner@ezana.edu.et'];
  const adminId = userIds['admin@ezana.edu.et'];
  const inst1Id = userIds['selamawit.tadesse@ezana.edu.et'];
  const inst2Id = userIds['dawit.bekele@ezana.edu.et'];
  const student1Id = userIds['abebe.kebede@ezana.edu.et'];
  const student2Id = userIds['hana.girum@ezana.edu.et'];
  const parentId = userIds['tigist.alemu@ezana.edu.et'];

  // Link parent to both students
  await run(
    `INSERT INTO parent_student_links (parent_id, student_id, relationship, status, notes) VALUES (?, ?, 'Mother', 'Approved', 'Primary guardian verified by Registrar')`,
    [parentId, student1Id]
  );
  await run(
    `INSERT INTO parent_student_links (parent_id, student_id, relationship, status, notes) VALUES (?, ?, 'Aunt / Guardian', 'Approved', 'Secondary dependent verified')`,
    [parentId, student2Id]
  );

  // 3. Academic Structure
  const ay1 = await run(`INSERT INTO academic_years (name, start_date, end_date, status) VALUES ('2026-2027 Academic Year', '2026-09-01', '2027-06-30', 'Active')`);
  const ay2 = await run(`INSERT INTO academic_years (name, start_date, end_date, status) VALUES ('2025-2026 Academic Year', '2025-09-01', '2026-06-30', 'Closed')`);
  const ayId = ay1.lastInsertRowid;

  const sem1 = await run(`INSERT INTO semesters (academic_year_id, name, start_date, end_date, status) VALUES (?, 'Semester I (Fall 2026)', '2026-09-01', '2027-01-31', 'Active')`, [ayId]);
  await run(`INSERT INTO semesters (academic_year_id, name, start_date, end_date, status) VALUES (?, 'Semester II (Spring 2027)', '2027-02-01', '2027-06-30', 'Upcoming')`, [ayId]);
  const semId = sem1.lastInsertRowid;

  const deptTech = await run(`INSERT INTO departments (name, head_name, description) VALUES ('School of Computing & Engineering', 'Dr. Selamawit Tadesse', 'Software engineering, web systems, and computational sciences')`);
  const deptQuant = await run(`INSERT INTO departments (name, head_name, description) VALUES ('School of Quantitative & Business Studies', 'Prof. Dawit Bekele', 'Mathematics, economics, finance, and enterprise leadership')`);
  const deptSci = await run(`INSERT INTO departments (name, head_name, description) VALUES ('School of Natural Sciences & Humanities', 'Meron Teshager', 'Biological sciences, studio design, and academic communication')`);

  const classA = await run(`INSERT INTO classes (name, section, department_id, academic_year_id, instructor_id, capacity, room) VALUES ('Cohort 2027 — Engineering', 'Section A', ?, ?, ?, 45, 'Hall B-204')`, [deptTech.lastInsertRowid, ayId, inst1Id]);
  const classB = await run(`INSERT INTO classes (name, section, department_id, academic_year_id, instructor_id, capacity, room) VALUES ('Cohort 2027 — Sciences & Finance', 'Section B', ?, ?, ?, 40, 'Hall A-108')`, [deptQuant.lastInsertRowid, ayId, inst2Id]);

  await run(`INSERT INTO class_students (class_id, student_id) VALUES (?, ?)`, [classA.lastInsertRowid, student1Id]);
  await run(`INSERT INTO class_students (class_id, student_id) VALUES (?, ?)`, [classB.lastInsertRowid, student2Id]);

  // 4. Categories, Levels, Subjects
  const categoryList = [
    ['Technology', 'technology', 'Software engineering, web architectures, and cloud systems'],
    ['Mathematics', 'mathematics', 'Linear algebra, calculus, probability, and discrete structures'],
    ['Business', 'business', 'Corporate finance, accounting, and strategic management'],
    ['Science', 'science', 'Cellular biology, chemistry, and laboratory research methods'],
    ['Art & Design', 'art-design', 'Editorial typography, product design, and visual systems'],
    ['Language', 'language', 'Academic writing, technical communication, and linguistics'],
    ['Personal Development', 'personal-development', 'Study systems, leadership, and career readiness'],
  ];
  const catIds = {};
  for (const [name, slug, desc] of categoryList) {
    const res = await run(`INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)`, [name, slug, desc]);
    catIds[name] = res.lastInsertRowid;
  }

  for (const [idx, lvl] of ['Beginner', 'Intermediate', 'Advanced'].entries()) {
    await run(`INSERT INTO levels (name, sort_order) VALUES (?, ?)`, [lvl, idx + 1]);
  }

  const subjectList = [
    ['Full-Stack Engineering', 'CS-301', catIds['Technology'], 'Modern frontend, REST APIs, and relational databases'],
    ['Linear Algebra & Calculus', 'MATH-201', catIds['Mathematics'], 'Matrix methods, vector spaces, and multivariable derivatives'],
    ['Corporate Finance', 'FIN-210', catIds['Business'], 'Capital markets, valuation, and financial reporting'],
    ['Cellular Biology', 'BIO-105', catIds['Science'], 'Molecular genetics, microscopy, and cellular metabolism'],
    ['Interface Architecture', 'DES-204', catIds['Art & Design'], 'Design systems, grid geometry, and typographic craft'],
    ['Technical Communication', 'ENG-102', catIds['Language'], 'Structured academic writing and technical documentation'],
  ];
  const subjIds = {};
  for (const [name, code, cid, desc] of subjectList) {
    const res = await run(`INSERT INTO subjects (name, code, category_id, description) VALUES (?, ?, ?, ?)`, [name, code, cid, desc]);
    subjIds[name] = res.lastInsertRowid;
  }

  // 5. Courses & Lessons (6 courses, 8 lessons each — first 5 free, 6..8 require Ezana Pro ETB 218)
  const coursesData = [
    {
      title: 'Full-Stack Web Engineering & REST Systems',
      slug: 'full-stack-web-engineering-rest-systems',
      description: 'Master modern React architecture, Node.js and Express REST services, JWT authentication, and relational MySQL database modeling from first principles.',
      learning_objectives: 'Design normalized relational schemas; Build authenticated Express REST APIs; Structure modular React interfaces; Deploy secure full-stack web apps.',
      prerequisites: 'Basic JavaScript syntax and HTML/CSS fundamentals.',
      target_audience: 'Aspiring software engineers and computer science undergraduates.',
      thumbnail_url: '/src/assets/images/course_web_engineering_1794751963554.jpg',
      category: 'Technology',
      subject: 'Full-Stack Engineering',
      level: 'Intermediate',
      language: 'English',
      instructor_id: inst1Id,
      estimated_duration: '6h 40m',
      tags: ['React', 'Node.js', 'REST API', 'MySQL'],
      lessons: [
        ['01. Architectural Overview & HTTP Request Lifecycle', 'rfscVS0vtbw', '14:20', 860, 'Foundations'],
        ['02. Semantic HTML, Modern CSS & Responsive Grid Systems', 'PkZNo7MFNFg', '18:45', 1125, 'Foundations'],
        ['03. Component State & Hooks in React Applications', 'W6NZfCO5SIk', '21:10', 1270, 'Frontend Systems'],
        ['04. Express Routing, Middleware & JSON Validation', 'Oe421EPjeBE', '19:30', 1170, 'Backend APIs'],
        ['05. Relational Schema Design & Foreign Key Integrity', 'HXV3zeQKqGY', '22:15', 1335, 'Database Modeling'],
        ['06. Password Hashing, JWT Tokens & RBAC Enforcement', '7Q17ubqLfaM', '24:00', 1440, 'Security & Auth'],
        ['07. Server-Side Entitlements & Payment Verification', 'ENrzD9HAZK4', '20:45', 1245, 'Security & Auth'],
        ['08. Production Deployment, Caching & Observability', 'l1EssrLxt7E', '25:30', 1530, 'Deployment'],
      ],
    },
    {
      title: 'Applied Linear Algebra & Calculus for Computing',
      slug: 'applied-linear-algebra-calculus-computing',
      description: 'Build deep geometric intuition for vectors, eigenvalues, matrix decompositions, and multivariable gradients used in data science and engineering.',
      learning_objectives: 'Interpret linear transformations geometrically; Compute eigenvalues and SVD; Apply partial derivatives and gradient descent.',
      prerequisites: 'High school algebra and trigonometry.',
      target_audience: 'Engineering, mathematics, and machine learning students.',
      thumbnail_url: '/src/assets/images/course_mathematics_data_1794751963733.jpg',
      category: 'Mathematics',
      subject: 'Linear Algebra & Calculus',
      level: 'Beginner',
      language: 'English',
      instructor_id: inst2Id,
      estimated_duration: '5h 50m',
      tags: ['Linear Algebra', 'Calculus', 'Vectors', 'Matrices'],
      lessons: [
        ['01. Vectors, Linear Combinations & Span', 'fNk_zzaMoSs', '15:10', 910, 'Vector Spaces'],
        ['02. Linear Transformations & Matrix Multiplication', 'kYB8IZa5AuE', '17:40', 1060, 'Vector Spaces'],
        ['03. Determinants, Area Scaling & Invertibility', 'Ip3X9LOh2dk', '16:25', 985, 'Matrix Theory'],
        ['04. Inverse Matrices, Column Space & Null Space', 'uQhTuRlWMxw', '19:00', 1140, 'Matrix Theory'],
        ['05. Dot Products, Projections & Orthonormality', 'LyGKycYT2v0', '14:50', 890, 'Inner Products'],
        ['06. Eigenvalues, Eigenvectors & Diagonalization', 'PFDu9oVAE-g', '23:15', 1395, 'Spectral Analysis'],
        ['07. Partial Derivatives & Multivariable Gradients', 'WUvTyaaNkzM', '21:30', 1290, 'Multivariable Calculus'],
        ['08. Optimization & Computational Linear Systems', 'aircAruvnKk', '24:20', 1460, 'Applications'],
      ],
    },
    {
      title: 'Corporate Finance, Accounting & Ethiopian Markets',
      slug: 'corporate-finance-accounting-ethiopian-markets',
      description: 'Understand balance sheets, discounted cash flow valuation, working capital management, and emerging capital market structures in East Africa.',
      learning_objectives: 'Analyze financial statements; Build DCF valuation models; Evaluate project NPV and IRR; Structure institutional budgets.',
      prerequisites: 'Basic spreadsheet literacy.',
      target_audience: 'Business students, analysts, and emerging founders.',
      thumbnail_url: '/src/assets/images/course_business_finance_1794751964162.jpg',
      category: 'Business',
      subject: 'Corporate Finance',
      level: 'Intermediate',
      language: 'English',
      instructor_id: inst2Id,
      estimated_duration: '5h 15m',
      tags: ['Finance', 'Accounting', 'Valuation', 'ETB Markets'],
      lessons: [
        ['01. Time Value of Money & Discounting Principles', 'OmJ-4B-mS-Y', '16:00', 960, 'Financial Foundations'],
        ['02. Reading Income Statements & Balance Sheets', 'WEDIj9JBTC8', '18:20', 1100, 'Financial Statements'],
        ['03. Cash Flow Statements & Working Capital Cycles', 'u-iP6M5K7V8', '17:15', 1035, 'Financial Statements'],
        ['04. Net Present Value (NPV) & Internal Rate of Return', '5MgBikgcWnY', '19:45', 1185, 'Capital Budgeting'],
        ['05. Cost of Capital, WACC & Risk Premiums', '8mve0UQkvDo', '15:30', 930, 'Capital Budgeting'],
        ['06. Discounted Cash Flow (DCF) Valuation Modeling', 'rfscVS0vtbw', '22:10', 1330, 'Valuation'],
        ['07. Debt, Equity & Capital Structure Decisions', 'PkZNo7MFNFg', '20:00', 1200, 'Corporate Strategy'],
        ['08. Treasury Controls, Auditing & Governance', 'W6NZfCO5SIk', '18:40', 1120, 'Corporate Strategy'],
      ],
    },
    {
      title: 'Cellular Biology & Modern Laboratory Methods',
      slug: 'cellular-biology-modern-laboratory-methods',
      description: 'Explore prokaryotic and eukaryotic architecture, membrane transport, metabolic pathways, DNA replication, and optical microscopy protocols.',
      learning_objectives: 'Identify organelle structures; Explain ATP synthesis and cellular respiration; Describe transcription and translation; Execute lab safety protocols.',
      prerequisites: 'Introductory secondary school science.',
      target_audience: 'Pre-medical, life science, and laboratory track learners.',
      thumbnail_url: '/src/assets/images/course_science_biology_1794751962914.jpg',
      category: 'Science',
      subject: 'Cellular Biology',
      level: 'Beginner',
      language: 'English',
      instructor_id: inst2Id,
      estimated_duration: '5h 30m',
      tags: ['Biology', 'Genetics', 'Microscopy', 'Biochemistry'],
      lessons: [
        ['01. Cell Theory & Optical Microscopy Fundamentals', 'QnQe0xW_JY4', '14:40', 880, 'Cell Architecture'],
        ['02. Phospholipid Bilayers & Membrane Transport', 'URUJD5NEXC8', '17:50', 1070, 'Cell Architecture'],
        ['03. Mitochondria, Chloroplasts & Bioenergetics', '4Eo7JtRA7lg', '19:10', 1150, 'Metabolism'],
        ['04. Enzymes, Activation Energy & Regulation', 'qgVFkRn8f10', '16:05', 965, 'Metabolism'],
        ['05. DNA Structure, Chromatin & Replication', '8kK2zwjRV0M', '20:30', 1230, 'Molecular Genetics'],
        ['06. Transcription, RNA Processing & Translation', 'itsb2SqR-R0', '22:45', 1365, 'Molecular Genetics'],
        ['07. Mitosis, Meiosis & Cell Cycle Checkpoints', 'L0k-enzoeOM', '18:55', 1135, 'Cell Division'],
        ['08. PCR, Gel Electrophoresis & Lab Diagnostics', '8mve0UQkvDo', '21:15', 1275, 'Lab Methods'],
      ],
    },
    {
      title: 'Editorial Visual Systems & Interface Architecture',
      slug: 'editorial-visual-systems-interface-architecture',
      description: 'Learn typographic hierarchy, grid proportions, accessible color contrast budgets, and systematic UI component architecture for modern web applications.',
      learning_objectives: 'Pair display and body typefaces; Construct 12-column editorial grids; Enforce WCAG AA contrast; Build reusable design tokens.',
      prerequisites: 'Interest in visual design or frontend engineering.',
      target_audience: 'UI designers, frontend developers, and product builders.',
      thumbnail_url: '/src/assets/images/hero_ezana_academy_1794751962755.jpg',
      category: 'Art & Design',
      subject: 'Interface Architecture',
      level: 'Intermediate',
      language: 'English',
      instructor_id: inst1Id,
      estimated_duration: '4h 50m',
      tags: ['Typography', 'Design Systems', 'Accessibility', 'UI'],
      lessons: [
        ['01. Typographic Scale, Line Length & Vertical Rhythm', 'W6NZfCO5SIk', '15:20', 920, 'Typography'],
        ['02. Display & Body Font Pairings with Tabular Numerals', 'PkZNo7MFNFg', '16:40', 1000, 'Typography'],
        ['03. The 60-30-10 Color Discipline & Contrast Ratios', 'rfscVS0vtbw', '18:10', 1090, 'Color & Contrast'],
        ['04. Spatial Hierarchy & Single-Elevation Surfaces', '5MgBikgcWnY', '17:00', 1020, 'Layout Architecture'],
        ['05. Navigation Contracts & Responsive Breakpoints', 'fNk_zzaMoSs', '19:20', 1160, 'Layout Architecture'],
        ['06. Accessible Interactive Controls & Focus States', 'aircAruvnKk', '21:00', 1260, 'Accessibility'],
        ['07. Auditing Real Interfaces for Visual Clarity', 'OmJ-4B-mS-Y', '20:15', 1215, 'Production Critique'],
      ],
    },
    {
      title: 'Academic English & Technical Communication',
      slug: 'academic-english-technical-communication',
      description: 'Develop precision in technical specifications, research abstracts, executive reporting, and structured oral presentations for global academic environments.',
      learning_objectives: 'Write concise technical specifications; Structure persuasive academic arguments; Eliminate ambiguity in documentation.',
      prerequisites: 'Intermediate English reading proficiency.',
      target_audience: 'All Ezana Academy students and research fellows.',
      thumbnail_url: '/src/assets/images/course_business_finance_1794751964162.jpg',
      category: 'Language',
      subject: 'Technical Communication',
      level: 'Beginner',
      language: 'English',
      instructor_id: inst1Id,
      estimated_duration: '4h 10m',
      tags: ['Writing', 'Research', 'Communication', 'Presentations'],
      lessons: [
        ['01. Clarity, Brevity & Active Voice in Technical Prose', '5MgBikgcWnY', '14:15', 855, 'Core Principles'],
        ['02. Structuring Executive Summaries & Abstracts', 'OmJ-4B-mS-Y', '15:45', 945, 'Academic Writing'],
        ['03. Evidence, Citations & Quantitative Precision', 'fNk_zzaMoSs', '16:30', 990, 'Academic Writing'],
        ['04. Writing Engineering & API Documentation', 'rfscVS0vtbw', '18:00', 1080, 'Technical Specs'],
        ['05. Visual Storytelling in Slide Presentations', 'kYB8IZa5AuE', '17:20', 1040, 'Presentations'],
        ['06. Peer Review, Editing & Constructive Critique', 'W6NZfCO5SIk', '16:50', 1010, 'Revision'],
        ['07. Capstone Research Proposal Workshop', 'PkZNo7MFNFg', '21:40', 1300, 'Capstone'],
      ],
    },
  ];

  const courseIds = [];
  const firstCourseLessonIds = [];

  for (const c of coursesData) {
    const res = await run(
      `INSERT INTO courses (
        title, slug, description, learning_objectives, prerequisites, target_audience,
        thumbnail_url, category_id, subject_id, level, language, instructor_id,
        pro_price_etb, free_lesson_limit, status, visibility, source_type, estimated_duration, tags_json, created_by, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 218, 5, 'Published', 'Public', 'Manual', ?, ?, ?, ?)`,
      [
        c.title, c.slug, c.description, c.learning_objectives, c.prerequisites, c.target_audience,
        c.thumbnail_url, catIds[c.category], subjIds[c.subject], c.level, c.language, c.instructor_id,
        c.estimated_duration, JSON.stringify(c.tags), c.instructor_id, ownerId
      ]
    );
    const cid = res.lastInsertRowid;
    courseIds.push(cid);

    await run(`INSERT INTO course_approval_history (course_id, action, actor_id, notes) VALUES (?, 'Published', ?, 'Approved for Cohort 2027 catalog')`, [cid, ownerId]);

    const sectionMap = {};
    let sectionOrder = 1;
    let lessonOrder = 1;

    for (const [lTitle, ytId, durLabel, durSec, secTitle] of c.lessons) {
      if (!sectionMap[secTitle]) {
        const secRes = await run(
          `INSERT INTO course_sections (course_id, title, description, sort_order) VALUES (?, ?, ?, ?)`,
          [cid, secTitle, `${secTitle} module`, sectionOrder++]
        );
        sectionMap[secTitle] = secRes.lastInsertRowid;
      }
      const pubDate = toMysqlDatetime(Date.now() - (20 - lessonOrder) * 86400000);
      const lRes = await run(
        `INSERT INTO lessons (
          course_id, section_id, title, description, learning_objectives, instructor_notes,
          video_source, youtube_video_id, thumbnail_url, duration_seconds, duration_label,
          published_at, availability_status, sort_order, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, 'YouTube', ?, ?, ?, ?, ?, 'Available', ?, 1)`,
        [
          cid,
          sectionMap[secTitle],
          lTitle,
          `Comprehensive guided tutorial covering ${lTitle.replace(/^\d+\.\s*/, '')} with practical exercises and walkthroughs.`,
          `Understand core principles of ${lTitle.replace(/^\d+\.\s*/, '')}; Apply concepts in weekly coursework.`,
          `Review attached study sheet before attempting the lesson checkpoint.`,
          ytId,
          c.thumbnail_url,
          durSec,
          durLabel,
          pubDate,
          lessonOrder++
        ]
      );
      if (cid === courseIds[0]) {
        firstCourseLessonIds.push(lRes.lastInsertRowid);
      }
    }
  }

  // 6. Enrollments, Progress & Reviews
  await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [student1Id, courseIds[0]]);
  await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [student1Id, courseIds[1]]);
  await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [student1Id, courseIds[2]]);
  await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [student2Id, courseIds[3]]);
  await run(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`, [student2Id, courseIds[4]]);

  // Pending enrollment request for admin testing
  await run(`INSERT INTO enrollment_requests (student_id, course_id, notes, status) VALUES (?, ?, 'Requesting elective enrollment for Semester I', 'Pending')`, [student1Id, courseIds[4]]);

  // Lesson progress for Abebe on Course 1 (2 completed, 1 in progress)
  if (firstCourseLessonIds.length >= 3) {
    await run(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, watched_seconds, duration_seconds, progress_percent, status, completed_at) VALUES (?, ?, ?, 860, 860, 100, 'Completed', ?)`, [student1Id, courseIds[0], firstCourseLessonIds[0], toMysqlDatetime(Date.now() - 3 * 86400000)]);
    await run(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, watched_seconds, duration_seconds, progress_percent, status, completed_at) VALUES (?, ?, ?, 1125, 1125, 100, 'Completed', ?)`, [student1Id, courseIds[0], firstCourseLessonIds[1], toMysqlDatetime(Date.now() - 2 * 86400000)]);
    await run(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, watched_seconds, duration_seconds, progress_percent, status) VALUES (?, ?, ?, 540, 1270, 43, 'In Progress')`, [student1Id, courseIds[0], firstCourseLessonIds[2]]);
  }

  // Genuine student reviews
  await run(`INSERT INTO course_reviews (course_id, user_id, rating, comment, status) VALUES (?, ?, 5, 'Clear architecture walkthroughs and practical REST API design exercises.', 'Published')`, [courseIds[0], student1Id]);
  await run(`INSERT INTO course_reviews (course_id, user_id, rating, comment, status) VALUES (?, ?, 5, 'The microscopy protocols and metabolic diagrams made every concept intuitive.', 'Published')`, [courseIds[3], student2Id]);

  // 7. Timetables & Live Classes
  const timetableSeeds = [
    [courseIds[0], classA.lastInsertRowid, inst1Id, 'Web Engineering Lecture', 'Monday', '09:00', '10:30', 'Hall B-204', 'Lesson', '2026-11-16'],
    [courseIds[1], classA.lastInsertRowid, inst2Id, 'Linear Algebra Seminar', 'Tuesday', '11:00', '12:30', 'Hall A-108', 'Lesson', '2026-11-17'],
    [courseIds[2], classA.lastInsertRowid, inst2Id, 'Corporate Finance Workshop', 'Wednesday', '14:00', '15:30', 'Virtual Hall B', 'Live Class', '2026-11-18'],
    [courseIds[3], classB.lastInsertRowid, inst2Id, 'Cellular Biology Lab', 'Thursday', '09:30', '11:30', 'Science Lab 2', 'Lesson', '2026-11-19'],
    [courseIds[0], classA.lastInsertRowid, inst1Id, 'Midterm Architecture Review', 'Friday', '10:00', '12:00', 'Hall B-204', 'Examination', '2026-11-20'],
  ];
  for (const t of timetableSeeds) {
    await run(
      `INSERT INTO timetables (course_id, class_id, instructor_id, title, day_of_week, start_time, end_time, room, session_type, session_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t
    );
  }

  await run(
    `INSERT INTO live_classes (course_id, class_id, instructor_id, title, meeting_url, scheduled_at, duration_minutes, status) VALUES (?, ?, ?, 'REST API Security & JWT Live Clinic', 'https://us05web.zoom.us/j/4619028612?pwd=D8hDld9Qase3OLIDozrgc9axiBDadQ.1', '2026-11-18 15:00', 60, 'Scheduled')`,
    [courseIds[0], classA.lastInsertRowid, inst1Id]
  );
  await run(
    `INSERT INTO live_classes (course_id, class_id, instructor_id, title, meeting_url, scheduled_at, duration_minutes, status) VALUES (?, ?, ?, 'DCF Modeling & Valuation Live Q&A', 'https://us05web.zoom.us/j/4619028612?pwd=D8hDld9Qase3OLIDozrgc9axiBDadQ.1', '2026-11-19 16:00', 75, 'Scheduled')`,
    [courseIds[2], classB.lastInsertRowid, inst2Id]
  );

  // 8. Attendance
  const attDates = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];
  for (const [i, d] of attDates.entries()) {
    await run(`INSERT INTO attendance (user_id, user_role, course_id, class_id, attendance_date, status, notes, recorded_by) VALUES (?, 'Student', ?, ?, ?, ?, ?, ?)`,
      [student1Id, courseIds[0], classA.lastInsertRowid, d, i === 3 ? 'Late' : 'Present', i === 3 ? 'Arrived 8 minutes after start' : 'On time', inst1Id]);
    await run(`INSERT INTO attendance (user_id, user_role, course_id, class_id, attendance_date, status, notes, recorded_by) VALUES (?, 'Student', ?, ?, ?, 'Present', 'Full session participation', ?)`,
      [student2Id, courseIds[3], classB.lastInsertRowid, d, inst2Id]);
  }

  // 9. Assignments & Submissions
  const a1 = await run(
    `INSERT INTO assignments (course_id, class_id, instructor_id, title, description, due_date, max_score, status)
     VALUES (?, ?, ?, 'REST API Endpoint Design Specification', 'Design a normalized MySQL schema and Express route specification for an e-learning module.', '2026-11-24', 100, 'Published')`,
    [courseIds[0], classA.lastInsertRowid, inst1Id]
  );
  const a2 = await run(
    `INSERT INTO assignments (course_id, class_id, instructor_id, title, description, due_date, max_score, status)
     VALUES (?, ?, ?, 'Eigenvalue Decomposition Problem Set', 'Solve problems 1-6 showing characteristic polynomials and geometric interpretations.', '2026-11-22', 100, 'Published')`,
    [courseIds[1], classA.lastInsertRowid, inst2Id]
  );
  await run(
    `INSERT INTO assignment_submissions (assignment_id, student_id, submission_text, attachment_name, score, feedback, status, graded_at, graded_by)
     VALUES (?, ?, 'Completed normalized schema with foreign keys and JWT RBAC middleware notes.', 'abebe-rest-spec.pdf', 94, 'Excellent normalization and clean route boundaries.', 'Graded', ?, ?)`,
    [a1.lastInsertRowid, student1Id, toMysqlDatetime(Date.now() - 86400000), inst1Id]
  );

  // 10. Quizzes & Question Bank
  const q1 = await run(
    `INSERT INTO quizzes (course_id, instructor_id, title, description, duration_minutes, max_score, available_from, available_until, status)
     VALUES (?, ?, 'HTTP, REST & Database Integrity Quiz', 'Assess understanding of HTTP status codes, React hooks, and relational constraints.', 25, 30, '2026-11-01', '2027-02-01', 'Published')`,
    [courseIds[0], inst1Id]
  );
  await run(
    `INSERT INTO quiz_questions (quiz_id, course_id, subject_id, question_text, question_type, options_json, correct_answer, points)
     VALUES (?, ?, ?, 'Which HTTP status code indicates a newly created resource after a POST request?', 'MCQ', ?, '201 Created', 10)`,
    [q1.lastInsertRowid, courseIds[0], subjIds['Full-Stack Engineering'], JSON.stringify(['200 OK', '201 Created', '204 No Content', '400 Bad Request'])]
  );
  await run(
    `INSERT INTO quiz_questions (quiz_id, course_id, subject_id, question_text, question_type, options_json, correct_answer, points)
     VALUES (?, ?, ?, 'True or False: Role-Based Access Control (RBAC) must be enforced on backend API routes, not only in the React UI.', 'TrueFalse', ?, 'True', 10)`,
    [q1.lastInsertRowid, courseIds[0], subjIds['Full-Stack Engineering'], JSON.stringify(['True', 'False'])]
  );
  await run(
    `INSERT INTO quiz_questions (quiz_id, course_id, subject_id, question_text, question_type, options_json, correct_answer, points)
     VALUES (?, ?, ?, 'Which relational constraint ensures a child record references a valid parent primary key?', 'MCQ', ?, 'FOREIGN KEY', 10)`,
    [q1.lastInsertRowid, courseIds[0], subjIds['Full-Stack Engineering'], JSON.stringify(['INDEX', 'FOREIGN KEY', 'DEFAULT', 'VIEW'])]
  );

  // 11. Grades & Certificates
  await run(`INSERT INTO grades (student_id, course_id, academic_year_id, semester_id, assessment_name, assessment_type, score, max_score, letter_grade, remarks, released, recorded_by) VALUES (?, ?, ?, ?, 'Midterm Examination', 'Exam', 91, 100, 'A', 'Strong architectural reasoning', 1, ?)`, [student1Id, courseIds[0], ayId, semId, inst1Id]);
  await run(`INSERT INTO grades (student_id, course_id, academic_year_id, semester_id, assessment_name, assessment_type, score, max_score, letter_grade, remarks, released, recorded_by) VALUES (?, ?, ?, ?, 'Matrix Theory Quiz', 'Quiz', 87, 100, 'A-', 'Consistent analytical precision', 1, ?)`, [student1Id, courseIds[1], ayId, semId, inst2Id]);
  await run(`INSERT INTO grades (student_id, course_id, academic_year_id, semester_id, assessment_name, assessment_type, score, max_score, letter_grade, remarks, released, recorded_by) VALUES (?, ?, ?, ?, 'Microscopy Practical Lab', 'Exam', 95, 100, 'A+', 'Top distinction in lab evaluation', 1, ?)`, [student2Id, courseIds[3], ayId, semId, inst2Id]);

  await run(`INSERT INTO certificates (certificate_code, student_id, course_id, template_name, issued_by) VALUES ('EZN-CERT-2027-001', ?, ?, 'Ezana Academy Official Honors Certificate', ?)`, [student1Id, courseIds[0], adminId]);

  // 12. E-Learning Resources
  await run(`INSERT INTO resources (course_id, subject_id, category_id, title, description, resource_type, file_url, file_name, visibility, uploaded_by) VALUES (?, ?, ?, 'REST API Architecture Reference Handbook (PDF)', 'Complete guide to status codes, pagination, and JWT auth headers.', 'PDF', '/api/resources/sample/rest-handbook.txt', 'rest-handbook.txt', 'Enrolled', ?)`, [courseIds[0], subjIds['Full-Stack Engineering'], catIds['Technology'], inst1Id]);
  await run(`INSERT INTO resources (course_id, subject_id, category_id, title, description, resource_type, file_url, file_name, visibility, uploaded_by) VALUES (?, ?, ?, 'Linear Algebra Matrix Cheat Sheet', 'Key decompositions, determinant properties, and eigenbasis notes.', 'Document', '/api/resources/sample/linear-algebra-notes.txt', 'linear-algebra-notes.txt', 'Public', ?)`, [courseIds[1], subjIds['Linear Algebra & Calculus'], catIds['Mathematics'], inst2Id]);

  // 13. Fees, Payments & Invoices (preserving ETB 218 for Ezana Pro!)
  const f1 = await run(`INSERT INTO fees (student_id, course_id, academic_year_id, semester_id, title, fee_type, amount_etb, discount_etb, paid_etb, due_date, status) VALUES (?, ?, ?, ?, 'Semester I Tuition — Engineering Track', 'Tuition', 2400, 0, 2400, '2026-10-15', 'Paid')`, [student1Id, courseIds[0], ayId, semId]);
  const f2 = await run(`INSERT INTO fees (student_id, course_id, academic_year_id, semester_id, title, fee_type, amount_etb, discount_etb, paid_etb, due_date, status) VALUES (?, ?, ?, ?, 'Laboratory & Digital Library Fee', 'Lab Fee', 650, 0, 0, '2026-12-01', 'Unpaid')`, [student1Id, courseIds[1], ayId, semId]);
  const f3 = await run(`INSERT INTO fees (student_id, course_id, academic_year_id, semester_id, title, fee_type, amount_etb, discount_etb, paid_etb, due_date, status) VALUES (?, ?, ?, ?, 'Semester I Tuition — Sciences Track', 'Tuition', 2200, 200, 1000, '2026-11-30', 'Partially Paid')`, [student2Id, courseIds[3], ayId, semId]);

  const p1 = await run(`INSERT INTO payments (reference, user_id, student_id, fee_id, course_id, payment_type, amount_etb, method, status, gateway_meta) VALUES ('TXN-EZN-2027001', ?, ?, ?, ?, 'Tuition Fee', 2400, 'CBE Birr', 'Completed', 'Verified bank settlement')`, [parentId, student1Id, f1.lastInsertRowid, courseIds[0]]);
  const p2 = await run(`INSERT INTO payments (reference, user_id, student_id, fee_id, course_id, payment_type, amount_etb, method, status, gateway_meta) VALUES ('TXN-EZN-2027002', ?, ?, ?, ?, 'Tuition Fee', 1000, 'Telebirr', 'Completed', 'Partial installment verified')`, [parentId, student2Id, f3.lastInsertRowid, courseIds[3]]);

  await run(`INSERT INTO invoices (invoice_number, student_id, fee_id, payment_id, amount_etb, status, issue_date, due_date) VALUES ('INV-2027-001', ?, ?, ?, 2400, 'Paid', '2026-10-01', '2026-10-15')`, [student1Id, f1.lastInsertRowid, p1.lastInsertRowid]);
  await run(`INSERT INTO invoices (invoice_number, student_id, fee_id, payment_id, amount_etb, status, issue_date, due_date) VALUES ('INV-2027-002', ?, ?, NULL, 650, 'Issued', '2026-11-01', '2026-12-01')`, [student1Id, f2.lastInsertRowid]);
  await run(`INSERT INTO invoices (invoice_number, student_id, fee_id, payment_id, amount_etb, status, issue_date, due_date) VALUES ('INV-2027-003', ?, ?, ?, 2000, 'Partially Paid', '2026-11-01', '2026-11-30')`, [student2Id, f3.lastInsertRowid, p2.lastInsertRowid]);

  // 14. Instructor Payouts
  await run(`INSERT INTO instructor_payouts (instructor_id, period_label, amount_etb, reference, status, paid_at) VALUES (?, 'October 2026 Teaching Stipend', 18500, 'PAY-INST-202610', 'Paid', '2026-11-02')`, [inst1Id]);
  await run(`INSERT INTO instructor_payouts (instructor_id, period_label, amount_etb, reference, status, paid_at) VALUES (?, 'November 2026 Course Royalty', 6540, 'PAY-INST-202611', 'Pending', NULL)`, [inst1Id]);
  await run(`INSERT INTO instructor_payouts (instructor_id, period_label, amount_etb, reference, status, paid_at) VALUES (?, 'October 2026 Teaching Stipend', 16200, 'PAY-INST-202610B', 'Paid', '2026-11-02')`, [inst2Id]);

  // 15. Communication (Announcements, Messages, Discussions, Notifications, Support)
  await run(`INSERT INTO announcements (title, content, target_role, status, author_id) VALUES ('2026-2027 Semester I Midterm Schedule Released', 'Midterm architecture reviews and quantitative examinations begin November 20. Please check your class timetable for exact rooms and virtual links.', 'All', 'Published', ?)`, [adminId]);
  await run(`INSERT INTO announcements (title, content, target_role, course_id, status, author_id) VALUES ('New REST Security Clinic & Supplementary Notes', 'Join Friday live clinic and download the updated REST API Architecture handbook from Course Materials.', 'Student', ?, 'Published', ?)`, [courseIds[0], inst1Id]);

  await run(`INSERT INTO messages (sender_id, recipient_id, student_context_id, subject, body, is_read) VALUES (?, ?, ?, 'Abebe Midterm Progress Update', 'Dear Tigist, Abebe scored 94/100 on the REST API Endpoint Specification and has maintained 100% attendance this week.', 0)`, [inst1Id, parentId, student1Id]);
  await run(`INSERT INTO messages (sender_id, recipient_id, student_context_id, subject, body, is_read) VALUES (?, ?, ?, 'Welcome to Full-Stack Web Engineering', 'Hello Abebe, feel free to message me here if you have questions on Lesson 3 React Hooks.', 0)`, [inst1Id, student1Id, student1Id]);

  await run(`INSERT INTO discussion_posts (course_id, user_id, title, body) VALUES (?, ?, 'Best practices for organizing Express middleware?', 'Should JWT verification happen before route-specific RBAC guards or combined in one middleware chain?')`, [courseIds[0], student1Id]);
  const dParent = await get(`SELECT id FROM discussion_posts LIMIT 1`);
  if (dParent) {
    await run(`INSERT INTO discussion_posts (course_id, parent_id, user_id, title, body) VALUES (?, ?, ?, '', 'Great question! Always verify the JWT signature first via requireAuth, then attach req.user and evaluate requireRole/permissions cleanly.')`, [courseIds[0], dParent.id, inst1Id]);
  }

  await run(`INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, 'Assignment Graded: 94/100', 'Dr. Selamawit Tadesse graded REST API Endpoint Design Specification.', 'Grades', 'assignments')`, [student1Id]);
  await run(`INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, 'Upcoming Fee Due Dec 1', 'Laboratory & Digital Library Fee (ETB 650) is due Dec 1, 2026.', 'Finance', 'fees')`, [parentId]);
  await run(`INSERT INTO notifications (user_id, title, body, category, link_target) VALUES (?, 'Pending Enrollment Request', 'Abebe Kebede requested enrollment in Editorial Visual Systems.', 'Enrollment', 'enrollments')`, [adminId]);

  await run(`INSERT INTO support_tickets (user_id, subject, category, description, status, assigned_to, response_text) VALUES (?, 'Parent Child Link Verification Question', 'Account', 'Confirming Hana Girum secondary guardian linkage status.', 'Resolved', ?, 'Verified and approved by the Registrar office.')`, [parentId, adminId]);

  // 16. Platform Settings & Audit Logs
  const defaultSettings = [
    ['academy_name', 'Ezana Academy'],
    ['academy_tagline', 'Precision Digital Learning & Academic Governance'],
    ['academy_email', 'admissions@ezana.edu.et'],
    ['academy_phone', '+251 11 555 0190'],
    ['academy_address', 'Bole Sub-City, Bole Atlas Campus, Addis Ababa, Ethiopia'],
    ['academy_website', 'https://ezana.edu.et'],
    ['currency', 'ETB'],
    ['ezana_pro_price_etb', '218'],
    ['free_lesson_limit', '5'],
    ['timezone', 'Africa/Addis_Ababa'],
    ['default_language', 'English'],
    ['require_course_approval', 'false'],
    ['allow_instructor_youtube_keys', 'true'],
    ['payment_gateways', JSON.stringify(['Telebirr', 'CBE Birr', 'Chapa', 'Amole'])],
  ];
  for (const [k, v] of defaultSettings) {
    await run(`INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?)`, [k, v]);
  }

  await run(`INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details_json) VALUES (?, 'Owner', 'SYSTEM_INITIALIZED', 'Platform', '1', '{"note":"Ezana Academy 2027 database seeded"}')`, [ownerId]);

  console.log('[Seed] Ezana Academy database seeded successfully.');
}
