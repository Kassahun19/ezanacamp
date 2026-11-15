import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Eye, EyeOff, Info, X } from 'lucide-react';

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  className = '',
  required = false,
  minLength,
  id,
  name,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full pr-10 ${className || 'px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600'}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 transition-colors rounded"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function CountUpValue({ value, duration = 650 }) {
  const raw = String(value ?? '0');
  const [display, setDisplay] = useState(raw);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(raw);
      return;
    }

    const tokens = raw.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!tokens || tokens.length === 0) {
      setDisplay(raw);
      return;
    }

    const targets = tokens.map((tok) => ({
      num: Number(tok.replace(/,/g, '')),
      decimals: tok.includes('.') ? tok.split('.')[1].length : 0,
      hasComma: tok.includes(','),
    }));

    let rafId;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      let idx = 0;
      const formatted = raw.replace(/\d[\d,]*(?:\.\d+)?/g, () => {
        const meta = targets[idx++];
        const val = meta.num * eased;
        const fixed = meta.decimals > 0 ? val.toFixed(meta.decimals) : String(Math.round(val));
        if (!meta.hasComma) return fixed;
        const [intPart, decPart] = fixed.split('.');
        const withCommas = Number(intPart).toLocaleString('en-US');
        return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
      });
      setDisplay(formatted);
      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        setDisplay(raw);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [raw, duration]);

  return <>{display}</>;
}

export function IconActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'neutral',
  disabled = false,
  type = 'button',
  className = '',
}) {
  const styles = {
    neutral: 'text-slate-600 border-slate-300 bg-white hover:bg-slate-100 hover:text-slate-900',
    primary: 'text-white border-blue-700 bg-blue-700 hover:bg-blue-800',
    info: 'text-blue-700 border-blue-200 bg-blue-50/70 hover:bg-blue-100',
    success: 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    danger: 'text-red-600 border-red-200 bg-white hover:bg-red-50',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center p-1.5 rounded-md border transition-all duration-150 active:scale-95 disabled:opacity-35 disabled:pointer-events-none ${styles[variant] || styles.neutral} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

export function StatusIndicator({ status }) {
  const norm = String(status || '').toLowerCase();
  let color = 'text-slate-700';
  let Icon = Info;

  if (['active', 'published', 'paid', 'completed', 'approved', 'present', 'connected', 'synced', 'resolved', 'issued', 'available'].includes(norm)) {
    color = 'text-emerald-700';
    Icon = CheckCircle2;
  } else if (['pending', 'pending review', 'partially paid', 'in progress', 'late', 'scheduled', 'draft', 'upcoming', 'changes requested'].includes(norm)) {
    color = 'text-amber-700';
    Icon = Clock;
  } else if (['suspended', 'inactive', 'unpaid', 'overdue', 'failed', 'rejected', 'absent', 'unavailable', 'invalid', 'import failed'].includes(norm)) {
    color = 'text-red-700';
    Icon = AlertCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="animate-fade-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{ animationDelay: `${idx * 65}ms` }}
          className="animate-fade-up card-hover-lift bg-white border border-slate-200 rounded-lg p-5"
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
            <CountUpValue value={item.value} />
          </p>
          {item.hint && <p className="mt-1.5 text-xs text-slate-500">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function LoadingRows({ count = 4 }) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-11 bg-slate-100 rounded-md animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="animate-fade-up bg-white border border-slate-200 rounded-lg p-10 text-center">
      <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ToastBanner({ notice, onClose }) {
  if (!notice) return null;
  const isError = notice.type === 'error';
  return (
    <div
      role="alert"
      className={`animate-fade-up fixed bottom-5 right-5 z-50 max-w-md flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${
        isError ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {isError ? <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />}
      <p className="text-sm leading-snug flex-1">{notice.text}</p>
      <button onClick={onClose} aria-label="Dismiss notification" className="opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="animate-scale-in bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalFrame({ open, title, subtitle, onClose, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
      <div className={`animate-scale-in bg-white border border-slate-200 rounded-xl w-full ${maxWidth} my-8 shadow-xl`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close modal" className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function FallbackCover({ title, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4 text-center ${className}`}>
      <span className="font-display text-sm font-semibold tracking-tight line-clamp-2">{title}</span>
    </div>
  );
}
