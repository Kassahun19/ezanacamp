import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, CreditCard, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.jsx';

const DEFAULT_CHECKOUT_URL =
  'https://ye-buna.com/kassahunmulatu?ref=product_detail&product=6af9e5352ee4a_kassahunmulatu';

export default function EzanaProPage({ course, lockedLessonTitle, onBack, onUnlocked, onNavigate, showNotice }) {
  const { user } = useAuth();
  const [method, setMethod] = useState('Ye-Buna');
  const [accountRef, setAccountRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(
    course?.pro_request_status === 'Pending' ? DEFAULT_CHECKOUT_URL : ''
  );

  const courseTitle = course?.title || 'Selected Ezana Academy Course';
  const priceEtb = 218;
  const isPending = Boolean(pendingUrl) || course?.pro_request_status === 'Pending';

  async function handleCheckout(e) {
    e.preventDefault();
    if (!user) {
      showNotice('Please log in or create an account to request Ezana Pro.', 'error');
      onNavigate('login');
      return;
    }
    if (!course?.id) {
      showNotice('Select a course from the catalog first.', 'error');
      onNavigate('courses');
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest('/api/finance/ezana-pro/checkout', {
        method: 'POST',
        body: { courseId: course.id, method, accountRef },
      });
      if (res.alreadyUnlocked) {
        showNotice(res.message);
        onUnlocked(course.id);
        return;
      }
      const targetUrl = res.checkoutUrl || DEFAULT_CHECKOUT_URL;
      setPendingUrl(targetUrl);
      showNotice(res.message || 'Request saved as Pending approval. Redirecting to checkout...');
      window.location.href = targetUrl;
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Course</span>
      </button>

      {/* Concise Hint Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        {isPending ? (
          <Clock className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        ) : (
          <Lock className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        )}
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">
            {isPending
              ? 'Your Ezana Pro upgrade request is Pending Owner/Admin approval.'
              : 'Please upgrade to the Ezana Pro plan to unlock the full tutorial videos for this course.'}
          </h1>
          <p className="mt-1 text-sm text-slate-700">
            {isPending
              ? `Complete your ETB 218 payment on Ye-Buna checkout. Once approved by an Owner or Admin, all tutorial videos for "${courseTitle}" will unlock in your dashboard.`
              : lockedLessonTitle
                ? `"${lockedLessonTitle}" is part of the full course curriculum beyond the 5 free tutorial lessons.`
                : `Your free account includes the first 5 tutorial videos of "${courseTitle}". Upgrade for ETB 218 to request full course access.`}
          </p>
        </div>
      </div>

      {/* Ezana Pro Plan Card + Checkout Form */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-7 space-y-5">
          <div>
            <p className="text-xs font-medium text-blue-700">Course-Specific Upgrade · {courseTitle}</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-slate-900">Ezana Pro</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-slate-900 tabular-nums">ETB {priceEtb}</span>
              <span className="text-sm text-slate-500">fixed price per course</span>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Unlock permanent full access to every tutorial video, downloadable instructor study pack, graded quizzes, and official completion certificate eligibility for this course upon Owner/Admin approval.
          </p>

          <ul className="space-y-2.5 text-sm text-slate-700 pt-2 border-t border-slate-100">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Unlocks all tutorial videos beyond the 5 free preview lessons</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full access across desktop, tablet, and mobile sessions</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Downloadable instructor materials, lesson notes, and quizzes</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official invoice &amp; verified payment receipt stored in your account</span>
            </li>
          </ul>
        </div>

        <form onSubmit={handleCheckout} className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-700" />
            <h3 className="font-display text-base font-semibold text-slate-900">Complete Payment</h3>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Course</span>
              <span className="font-medium text-slate-900 text-right max-w-[190px] truncate">{courseTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Ezana Pro Plan</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">ETB 218.00</span>
            </div>
          </div>

          {isPending ? (
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Status: <strong>Pending Approval</strong>. Your request has been submitted to Owner/Admin for verification.
              </div>
              <a
                href={pendingUrl || DEFAULT_CHECKOUT_URL}
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              >
                <span>Proceed to Checkout Page</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="w-full py-2.5 text-xs font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors"
              >
                Go to My Dashboard
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Ye-Buna">Ye-Buna Checkout</option>
                  <option value="Telebirr">Telebirr Mobile Money</option>
                  <option value="CBE Birr">CBE Birr</option>
                  <option value="Chapa">Chapa Checkout</option>
                  <option value="Amole">Amole Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone or Account Reference (Optional)</label>
                <input
                  value={accountRef}
                  onChange={(e) => setAccountRef(e.target.value)}
                  placeholder="+251 911 ..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
              >
                {busy ? 'Submitting Request...' : 'Pay ETB 218 & Unlock Course'}
              </button>
            </>
          )}

          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Submitted requests require Owner/Admin approval after checkout verification</span>
          </p>
        </form>
      </div>
    </div>
  );
}
