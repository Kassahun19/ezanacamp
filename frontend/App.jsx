import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import PublicNavbar from './components/PublicNavbar.jsx';
import { LoadingRows, ToastBanner } from './components/UiPrimitives.jsx';
import { AboutPage, ContactPage, HomePage, LoginPage, RegisterPage } from './pages/PublicPages.jsx';
import CoursesCatalogPage from './pages/CoursesCatalogPage.jsx';
import CourseDetailPlayerPage from './pages/CourseDetailPlayerPage.jsx';
import EzanaProPage from './pages/EzanaProPage.jsx';
import DashboardShell from './dashboards/DashboardShell.jsx';

function EzanaAppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('home');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [proTarget, setProTarget] = useState({ course: null, lockedLessonTitle: '' });
  const [notice, setNotice] = useState(null);

  function showNotice(text, type = 'success') {
    setNotice({ text, type });
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  function navigate(nextPage, courseId = null) {
    if (courseId !== null) setSelectedCourseId(courseId);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCourse(courseId) {
    setSelectedCourseId(courseId);
    setPage('course-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEzanaPro(course, lockedLessonTitle = '') {
    setProTarget({ course, lockedLessonTitle });
    if (course?.id) setSelectedCourseId(course.id);
    setPage('ezana-pro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
          <p className="font-display text-lg font-semibold text-slate-900 mb-3">Ezana Academy</p>
          <LoadingRows count={3} />
        </div>
      </div>
    );
  }

  if (page === 'dashboard') {
    if (!user) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50">
          <PublicNavbar currentPage="login" onNavigate={navigate} />
          <main className="flex-1">
            <LoginPage
              onNavigate={navigate}
              onSuccess={(u) => {
                showNotice(`Welcome back, ${u.first_name}.`);
                navigate('dashboard');
              }}
            />
          </main>
          <ToastBanner notice={notice} onClose={() => setNotice(null)} />
        </div>
      );
    }

    return (
      <>
        <DashboardShell
          onNavigate={navigate}
          onOpenCourse={openCourse}
          onOpenPro={openEzanaPro}
          showNotice={showNotice}
        />
        <ToastBanner notice={notice} onClose={() => setNotice(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicNavbar currentPage={page} onNavigate={navigate} />

      <main className="flex-1">
        {page === 'home' && <HomePage onNavigate={navigate} onOpenCourse={openCourse} />}
        {page === 'about' && <AboutPage onNavigate={navigate} />}
        {page === 'courses' && (
          <CoursesCatalogPage onOpenCourse={openCourse} onOpenPro={openEzanaPro} />
        )}
        {page === 'course-detail' && selectedCourseId && (
          <CourseDetailPlayerPage
            courseId={selectedCourseId}
            onBack={() => navigate('courses')}
            onNavigate={navigate}
            onOpenPro={openEzanaPro}
            showNotice={showNotice}
          />
        )}
        {page === 'ezana-pro' && (
          <EzanaProPage
            course={proTarget.course}
            lockedLessonTitle={proTarget.lockedLessonTitle}
            onBack={() =>
              selectedCourseId ? navigate('course-detail', selectedCourseId) : navigate('courses')
            }
            onUnlocked={(unlockedCourseId) => {
              setSelectedCourseId(unlockedCourseId);
              navigate('course-detail', unlockedCourseId);
            }}
            onNavigate={navigate}
            showNotice={showNotice}
          />
        )}
        {page === 'contact' && <ContactPage />}
        {page === 'login' && (
          <LoginPage
            onNavigate={navigate}
            onSuccess={(u) => {
              showNotice(`Signed in as ${u.first_name} ${u.last_name} (${u.role}).`);
              navigate('dashboard');
            }}
          />
        )}
        {page === 'register' && (
          <RegisterPage
            onNavigate={navigate}
            onSuccess={(u) => {
              showNotice(`Account created. Welcome to Ezana Academy, ${u.first_name}!`);
              navigate('dashboard');
            }}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-slate-600">
          <div>
            <p className="font-display text-base font-bold text-slate-900">Ezana Academy</p>
            <p className="mt-1 text-xs text-slate-500">
              Addis Ababa Digital Learning &amp; Academic Governance Platform · Ezana Pro ETB 218 per course
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <button onClick={() => navigate('home')} className="hover:text-slate-900">Home</button>
            <button onClick={() => navigate('about')} className="hover:text-slate-900">About</button>
            <button onClick={() => navigate('courses')} className="hover:text-slate-900">Courses</button>
            <button onClick={() => navigate('contact')} className="hover:text-slate-900">Contact</button>
            {user ? (
              <button onClick={() => navigate('dashboard')} className="text-blue-700 hover:underline">
                Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => navigate('login')} className="hover:text-slate-900">Login</button>
                <button onClick={() => navigate('register')} className="text-blue-700 hover:underline">Get Started</button>
              </>
            )}
          </div>
        </div>
      </footer>

      <ToastBanner notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <EzanaAppContent />
    </AuthProvider>
  );
}
