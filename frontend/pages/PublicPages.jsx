import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Mail, MapPin, Phone, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, formatEtb } from '../utils/api.jsx';
import { CountUpValue, FallbackCover, PasswordInput } from '../components/UiPrimitives.jsx';

export function HomePage({ onNavigate, onOpenCourse }) {
  const { user } = useAuth();
  const [featured, setFeatured] = useState([]);
  const [stats, setStats] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  useEffect(() => {
    apiRequest('/api/courses?limit=6&sort=popular')
      .then((d) => setFeatured(d.courses || []))
      .catch(() => {});
    apiRequest('/api/courses/public-stats')
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Editorial Hero Split */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-blue-700 tracking-wide">
                Cohort 2027 Admissions Open · Addis Ababa &amp; Online
              </p>
              <h1 className="mt-3 font-display font-bold tracking-tight text-slate-900 text-4xl sm:text-5xl leading-[1.1]">
                Structured digital learning built for lasting mastery.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                Ezana Academy unifies expert-led video curricula, verified assessments, real-time attendance, and transparent academic reporting across students, instructors, and families.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onNavigate(user ? 'dashboard' : 'register')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>{user ? `Enter ${user.role} Dashboard` : 'Get Started Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('courses')}
                  className="px-5 py-3 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Browse All Courses
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Every account includes the first 5 tutorial videos of every course free. Full course unlock is fixed at ETB 218.
              </p>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 card-hover-lift">
                <img
                  src="/src/assets/images/hero_ezana_academy_1794751962755.jpg"
                  alt="Students studying together at Ezana Academy digital campus"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:block animate-float-hanging absolute -bottom-4 -left-4 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Live Catalog</p>
                <p className="font-display text-lg font-bold text-slate-900 tabular-nums">
                  <CountUpValue value={`${stats?.totalCourses ?? featured.length} Courses · ${stats?.totalLessons ?? 30}+ Lessons`} />
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Live Dynamic Proof Strip */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="animate-fade-up">
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                <CountUpValue value={`${stats?.freeLessonLimit ?? 5} Free`} />
              </p>
              <p className="mt-1 text-sm text-slate-600">Tutorial lessons per course upon login</p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: '75ms' }}>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                <CountUpValue value={`ETB ${stats?.proPriceEtb ?? 218}`} />
              </p>
              <p className="mt-1 text-sm text-slate-600">Fixed Ezana Pro unlock per course</p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                <CountUpValue value={`${stats?.totalCourses ?? featured.length} Active`} />
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Published courses across {stats?.totalCategories ?? 6} categories
              </p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: '225ms' }}>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                <CountUpValue value={`${stats?.totalLessons ?? 0} Videos`} />
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {stats?.totalStudents ?? 0} learners · {stats?.totalInstructors ?? 0} instructors
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Featured Curriculum</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Open any course to preview the syllabus or watch the first five tutorial lessons free after signing in.
            </p>
          </div>
          <button
            onClick={() => onNavigate('courses')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            View full catalog &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((course, idx) => (
            <div
              key={course.id}
              onClick={() => onOpenCourse(course.id)}
              style={{ animationDelay: `${idx * 60}ms` }}
              className="animate-fade-up card-hover-lift group cursor-pointer bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                {!imgErrors[course.id] && course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((p) => ({ ...p, [course.id]: true }))}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                ) : (
                  <FallbackCover title={course.title} className="w-full h-full" />
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{course.category_name || 'General'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{course.level}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{course.lesson_count} lessons</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2 flex-1">{course.description}</p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{course.instructor_name || 'Ezana Faculty'}</span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    5 Free · Pro {formatEtb(course.pro_price_etb)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ezana Pro Value Section */}
      <section className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <h2 className="font-display text-3xl font-bold">Transparent access for every learner.</h2>
            <p className="mt-3 text-slate-300 text-base leading-relaxed max-w-2xl">
              Evaluate any Ezana Academy course with up to five complete tutorial videos at no cost. When you are ready for the full curriculum, assignments, and official certificate eligibility, upgrade that course with Ezana Pro.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>First 5 lessons unlocked free on signup</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>All remaining video modules unlocked</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>Downloadable study notes &amp; quizzes</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>Permanent course-specific access</span></div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-7">
              <p className="text-xs font-medium text-blue-300">Ezana Pro Plan · Per Course</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tabular-nums">ETB 218</span>
                <span className="text-sm text-slate-400">one-time per course</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Fixed across every course in Ezana Academy. Pay via Telebirr, CBE Birr, Chapa, or Amole with instant receipt generation.
              </p>
              <button
                onClick={() => onNavigate(user ? 'courses' : 'register')}
                className="mt-6 w-full py-3 px-4 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
              >
                {user ? 'Choose a Course to Unlock' : 'Create Free Account'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AboutPage({ onNavigate }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div>
        <p className="text-xs font-medium text-blue-700">About Ezana Academy</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-slate-900">
          Academic rigor meets modern digital instruction.
        </h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          Founded in Addis Ababa, Ezana Academy provides structured technology, mathematics, business, laboratory science, design, and language programs. Our platform connects instructors, students, parents, and administrators inside a single transparent academic record.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <BookOpen className="w-6 h-6 text-blue-700" />
          <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">Structured Curricula</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Every course is organized into progressive sections with clear learning objectives, supplementary notes, and knowledge checks.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <ShieldCheck className="w-6 h-6 text-blue-700" />
          <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">Role-Based Governance</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Dedicated portals for Owners, Administrators, Instructors, Students, and Parents ensure every stakeholder sees accurate real-time records.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <Users className="w-6 h-6 text-blue-700" />
          <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">Family Transparency</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Parents can link multiple children under one account, review attendance and grades, settle tuition fees, and message instructors directly.
          </p>
        </div>
      </div>

      <div className="bg-slate-100 border border-slate-200 rounded-xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Ready to explore our curriculum?</h2>
          <p className="mt-1 text-sm text-slate-600">Watch up to five lessons free in every course immediately after registration.</p>
        </div>
        <button
          onClick={() => onNavigate('courses')}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shrink-0"
        >
          Explore Courses
        </button>
      </div>
    </div>
  );
}

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await apiRequest('/api/contact', { method: 'POST', body: form });
      setStatus({ type: 'success', text: res.message });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-medium text-blue-700">Contact Admissions &amp; Support</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">Reach Ezana Academy</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Have questions about enrollment, parent account linking, instructor applications, or Ezana Pro course access? Send our office a message.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Addis Ababa Campus</p>
                <p className="text-slate-600">Bole Sub-City, Bole Atlas Road, Addis Ababa, Ethiopia</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Email</p>
                <p className="text-slate-600">admissions@ezana.edu.et</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Phone</p>
                <p className="text-slate-600 tabular-nums">+251 11 555 0190</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-semibold text-slate-900">Send an Inquiry</h2>
            {status && (
              <div className={`p-3.5 rounded-lg text-sm border ${status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                {status.text}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Abebe Kebede"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Admissions / Course Inquiry"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="How can our academic team assist you?"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Sending...' : 'Submit Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function LoginPage({ onNavigate, onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Sign in to Ezana Academy</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your email and password to open your dashboard.</p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="you@ezana.edu.et"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Enter password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            {busy ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600 text-center">
          New to Ezana Academy?{' '}
          <button onClick={() => onNavigate('register')} className="font-semibold text-blue-700 hover:underline">
            Get Started
          </button>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage({ onNavigate, onSuccess }) {
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }
    setBusy(true);
    try {
      const user = await register(form);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Create Your Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Get instant access to your Student Dashboard and watch 5 free tutorial lessons per course.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="student@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <PasswordInput
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Confirm Password</label>
            <PasswordInput
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Repeat password"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            {busy ? 'Creating Account...' : 'Create Account & Go to Dashboard'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600 text-center">
          Already registered?{' '}
          <button onClick={() => onNavigate('login')} className="font-semibold text-blue-700 hover:underline">
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
