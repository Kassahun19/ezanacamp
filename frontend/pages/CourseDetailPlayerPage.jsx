import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Lock,
  Play,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, formatEtb } from '../utils/api.jsx';
import { LoadingRows, ModalFrame, StatusIndicator } from '../components/UiPrimitives.jsx';

export default function CourseDetailPlayerPage({ courseId, onBack, onNavigate, onOpenPro, showNotice }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoSort, setVideoSort] = useState('order');
  const [activeLesson, setActiveLesson] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Video unavailable', details: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  async function loadCourse(sortVal = videoSort) {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/courses/${courseId}?videoSort=${sortVal}`);
      setData(res);
      if (res.lessons && res.lessons.length > 0 && !activeLesson) {
        const firstUnlocked = res.lessons.find((l) => !l.is_locked);
        if (firstUnlocked) {
          selectLesson(firstUnlocked, res.course);
        }
      }
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setActiveLesson(null);
    loadCourse('order');
  }, [courseId, user]);

  async function selectLesson(lesson, courseObj = data?.course) {
    if (!user) {
      showNotice('Please log in or create an account to watch up to 5 free tutorial lessons per course.', 'error');
      onNavigate('login');
      return;
    }
    if (lesson.availability_status !== 'Available') {
      setPlayerError('This lesson video is currently unavailable.');
      setActiveLesson(lesson);
      return;
    }
    if (lesson.is_locked) {
      onOpenPro(courseObj || data?.course, lesson.title);
      return;
    }

    setPlayerLoading(true);
    setPlayerError('');
    try {
      const res = await apiRequest(`/api/courses/${courseId}/lessons/${lesson.id}`);
      setActiveLesson({ ...lesson, ...res.lesson, progress: res.progress, is_bookmarked: res.isBookmarked });
      setNoteText(res.note || '');
      // Record last accessed timestamp without falsely marking complete
      await apiRequest(`/api/courses/${courseId}/lessons/${lesson.id}/progress`, {
        method: 'POST',
        body: {
          watchedSeconds: res.progress?.watched_seconds || 5,
          durationSeconds: lesson.duration_seconds || 600,
          markComplete: false,
        },
      }).catch(() => {});
    } catch (err) {
      if (err.code === 'EZANA_PRO_REQUIRED') {
        onOpenPro(courseObj || data?.course, lesson.title);
      } else {
        setPlayerError(err.message);
      }
    } finally {
      setPlayerLoading(false);
    }
  }

  async function markLessonComplete() {
    if (!activeLesson) return;
    try {
      await apiRequest(`/api/courses/${courseId}/lessons/${activeLesson.id}/progress`, {
        method: 'POST',
        body: {
          watchedSeconds: activeLesson.duration_seconds || 600,
          durationSeconds: activeLesson.duration_seconds || 600,
          markComplete: true,
        },
      });
      showNotice('Lesson marked as completed.');
      loadCourse(videoSort);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function toggleLessonBookmark() {
    if (!activeLesson) return;
    try {
      const res = await apiRequest(`/api/courses/${courseId}/lessons/${activeLesson.id}/bookmark`, { method: 'POST' });
      setActiveLesson((p) => ({ ...p, is_bookmarked: res.bookmarked }));
      showNotice(res.bookmarked ? 'Lesson bookmarked.' : 'Bookmark removed.');
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function savePersonalNote() {
    if (!activeLesson) return;
    setSavingNote(true);
    try {
      await apiRequest(`/api/courses/${courseId}/lessons/${activeLesson.id}/note`, {
        method: 'PUT',
        body: { content: noteText },
      });
      showNotice('Personal lesson note saved.');
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setSavingNote(false);
    }
  }

  async function handleEnroll() {
    if (!user) {
      onNavigate('register');
      return;
    }
    try {
      await apiRequest(`/api/courses/${courseId}/enroll`, { method: 'POST' });
      showNotice('Enrolled in course successfully.');
      loadCourse(videoSort);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    try {
      await apiRequest(`/api/courses/${courseId}/reviews`, { method: 'POST', body: reviewForm });
      showNotice('Course review published.');
      setReviewForm({ rating: 5, comment: '' });
      loadCourse(videoSort);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!activeLesson) return;
    try {
      const res = await apiRequest(`/api/courses/${courseId}/lessons/${activeLesson.id}/report`, {
        method: 'POST',
        body: reportForm,
      });
      showNotice(res.message);
      setReportOpen(false);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingRows count={6} />
      </div>
    );
  }

  const { course, lessons = [], reviews = [], announcements = [], resources = [], relatedCourses = [] } = data;
  const activeIdx = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : -1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Courses</span>
        </button>

        <div className="flex items-center gap-3">
          {user && !course.is_enrolled && (
            <button
              onClick={handleEnroll}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg"
            >
              Enroll in Course
            </button>
          )}
          {!course.has_pro_access && (
            <button
              onClick={() => onOpenPro(course)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap ${
                course.pro_request_status === 'Pending'
                  ? 'text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200'
                  : 'text-white bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {course.pro_request_status === 'Pending'
                ? 'Ezana Pro · Pending Approval'
                : `Upgrade to Ezana Pro · ${formatEtb(course.pro_price_etb)}`}
            </button>
          )}
        </div>
      </div>

      {/* Course Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{course.category_name || 'General'}</span>
          <span aria-hidden="true">·</span>
          <span>{course.level}</span>
          <span aria-hidden="true">·</span>
          <span>{course.language}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{course.available_lesson_count} tutorial videos</span>
          {course.estimated_duration && (
            <>
              <span aria-hidden="true">·</span>
              <span>{course.estimated_duration}</span>
            </>
          )}
        </div>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900">{course.title}</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">{course.description}</p>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            Instructor: <span className="font-semibold text-slate-900">{course.instructor_name || 'Ezana Faculty'}</span>
            {course.instructor_qualifications && <span className="ml-2 text-slate-500">({course.instructor_qualifications})</span>}
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="tabular-nums">
                Completed {course.completed_lesson_count} of {course.available_lesson_count} lessons ({course.progress_percent}%)
              </span>
              <span className="font-medium text-slate-900">
                {course.has_pro_access
                  ? 'Ezana Pro Unlocked'
                  : course.pro_request_status === 'Pending'
                    ? 'Ezana Pro Pending Approval'
                    : `Free Access: First ${course.free_lesson_limit} Videos`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Two-Column Video Player + Curriculum Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Video Player & Learning Controls */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            {playerLoading ? (
              <div className="aspect-video flex items-center justify-center text-slate-300 text-sm">
                Loading lesson player...
              </div>
            ) : playerError ? (
              <div className="aspect-video flex flex-col items-center justify-center p-6 text-center text-slate-200">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
                <p className="text-sm font-medium">{playerError}</p>
              </div>
            ) : activeLesson && activeLesson.youtube_video_id ? (
              <div className="aspect-video w-full">
                <iframe
                  key={activeLesson.id}
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${activeLesson.youtube_video_id}?enablejsapi=1&rel=0`}
                  title={activeLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center p-8 text-center text-white">
                <Play className="w-10 h-10 text-blue-400 mb-3" />
                <h3 className="font-display text-lg font-semibold">
                  {user ? 'Select a tutorial lesson from the curriculum' : 'Sign in to watch 5 free tutorial lessons'}
                </h3>
                <p className="mt-1.5 text-sm text-slate-300 max-w-md">
                  {user
                    ? 'First 5 eligible videos in this course are included free. Unlock remaining tutorials with Ezana Pro (ETB 218).'
                    : 'Create an account or log in to unlock the first five lessons of every course immediately.'}
                </p>
                {!user && (
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => onNavigate('login')}
                      className="px-4 py-2 text-sm font-medium bg-white text-slate-900 rounded-lg"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => onNavigate('register')}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Learning Actions Around Player */}
          {activeLesson && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">{activeLesson.section_title} · {activeLesson.duration_label}</p>
                  <h2 className="font-display text-xl font-semibold text-slate-900 mt-0.5">{activeLesson.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={markLessonComplete}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      activeLesson.progress?.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{activeLesson.progress?.status === 'Completed' ? 'Completed' : 'Mark Complete'}</span>
                  </button>
                  <button
                    onClick={toggleLessonBookmark}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border ${
                      activeLesson.is_bookmarked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{activeLesson.is_bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                  </button>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </div>
              </div>

              {activeLesson.description && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Lesson Summary</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{activeLesson.description}</p>
                </div>
              )}

              {activeLesson.learning_objectives && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Learning Objectives</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{activeLesson.learning_objectives}</p>
                </div>
              )}

              {/* Prev / Next Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={activeIdx <= 0}
                  onClick={() => activeIdx > 0 && selectLesson(lessons[activeIdx - 1])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Lesson</span>
                </button>
                <button
                  disabled={activeIdx < 0 || activeIdx >= lessons.length - 1}
                  onClick={() => activeIdx < lessons.length - 1 && selectLesson(lessons[activeIdx + 1])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-lg disabled:opacity-40"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Personal Notes */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-800">My Lesson Notes</label>
                  <button
                    onClick={savePersonalNote}
                    disabled={savingNote}
                    className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write personal study notes or key timestamps for this lesson..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {/* Course Overview, Resources, Reviews */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900">Learning Objectives &amp; Prerequisites</h3>
              <p className="mt-2 text-sm text-slate-600">{course.learning_objectives || 'Master core competencies across all structured lessons.'}</p>
              {course.prerequisites && (
                <p className="mt-2 text-xs text-slate-500">Prerequisites: {course.prerequisites}</p>
              )}
            </div>

            {resources.length > 0 && (
              <div className="pt-5 border-t border-slate-100">
                <h3 className="font-display text-base font-semibold text-slate-900 mb-3">Downloadable Materials</h3>
                <div className="space-y-2">
                  {resources.map((res) => (
                    <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{res.title}</p>
                        <p className="text-xs text-slate-500">{res.resource_type} · {res.description}</p>
                      </div>
                      <a
                        href={res.file_url}
                        download={res.file_name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {announcements.length > 0 && (
              <div className="pt-5 border-t border-slate-100">
                <h3 className="font-display text-base font-semibold text-slate-900 mb-3">Course Announcements</h3>
                <div className="space-y-2.5">
                  {announcements.map((a) => (
                    <div key={a.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{a.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <h3 className="font-display text-base font-semibold text-slate-900">Student Reviews ({reviews.length})</h3>
              {reviews.map((r) => (
                <div key={r.id} className="p-3.5 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{r.student_name}</span>
                    <span className="text-amber-600 font-mono">★ {r.rating}/5</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600">{r.comment}</p>
                </div>
              ))}
              {user && course.is_enrolled && (
                <form onSubmit={submitReview} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-slate-800">Leave a Course Review</p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                        className={`p-1 ${reviewForm.rating >= n ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="Share your learning experience..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                  <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                    Submit Review
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right: Curriculum & Video Lesson Cards */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">Course Lessons</h2>
              <p className="text-xs text-slate-500">First {course.free_lesson_limit} free · Pro {formatEtb(course.pro_price_etb)}</p>
            </div>
            <select
              aria-label="Sort video lessons"
              value={videoSort}
              onChange={(e) => {
                setVideoSort(e.target.value);
                loadCourse(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="order">Course Order</option>
              <option value="newest">Newest Videos First</option>
              <option value="oldest">Oldest Videos First</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
            {lessons.map((lesson, i) => {
              const isSelected = activeLesson?.id === lesson.id;
              const isCompleted = lesson.progress?.status === 'Completed';
              return (
                <button
                  key={lesson.id}
                  onClick={() => selectLesson(lesson)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 bg-white">
                    {lesson.is_locked ? (
                      <Lock className="w-4 h-4 text-amber-600" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-blue-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">{lesson.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{lesson.section_title}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{lesson.duration_label}</span>
                      <span aria-hidden="true">·</span>
                      {lesson.availability_status !== 'Available' ? (
                        <StatusIndicator status="Unavailable" />
                      ) : lesson.is_free_tier ? (
                        <span className="text-emerald-700 font-medium">Free #{i + 1}</span>
                      ) : lesson.is_locked ? (
                        <span className="text-amber-700 font-medium">Ezana Pro</span>
                      ) : (
                        <span className="text-blue-700 font-medium">Unlocked</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Related Courses */}
      {relatedCourses.length > 0 && (
        <div className="pt-4">
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">Related Courses</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedCourses.map((rc) => (
              <button
                key={rc.id}
                onClick={() => onNavigate('course-detail', rc.id)}
                className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-600 transition-colors"
              >
                <p className="text-xs text-slate-500">{rc.level} · {rc.estimated_duration}</p>
                <p className="mt-1 font-display text-base font-semibold text-slate-900">{rc.title}</p>
                <p className="mt-2 text-xs font-mono text-blue-700">Pro {formatEtb(rc.pro_price_etb || 218)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <ModalFrame open={reportOpen} title="Report Lesson Issue" onClose={() => setReportOpen(false)} maxWidth="max-w-md">
        <form onSubmit={submitReport} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Issue Type</label>
            <select
              value={reportForm.reason}
              onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            >
              <option value="Video unavailable">Video unavailable or broken</option>
              <option value="Audio or captions issue">Audio or captions issue</option>
              <option value="Incorrect curriculum content">Incorrect curriculum content</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Details</label>
            <textarea
              rows={3}
              required
              value={reportForm.details}
              onChange={(e) => setReportForm({ ...reportForm, details: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="Describe the issue..."
            />
          </div>
          <button type="submit" className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">
            Submit Report
          </button>
        </form>
      </ModalFrame>
    </div>
  );
}
