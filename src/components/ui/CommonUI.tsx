import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, ImageOff, X } from 'lucide-react';

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EDEAF9] via-[#F4F2FB] to-[#DDF3E8]/60 text-[#68667D] ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-5 h-5 mb-1 opacity-60" />
        {fallbackLabel && (
          <span className="text-xs font-medium px-2 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}

export function MetadataLine({ items }: { items: (string | undefined | null | false)[] }) {
  const filtered = items.filter((i): i is string => Boolean(i && i.trim()));
  if (filtered.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#68667D]">
      {filtered.map((item, idx) => (
        <React.Fragment key={`${item}-${idx}`}>
          {idx > 0 && <span aria-hidden="true">·</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F2F0F9] rounded-xl border border-[#E6E3F1]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6D5FD1] ${
              active
                ? 'bg-white text-[#29283A] shadow-xs'
                : 'text-[#68667D] hover:text-[#29283A]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-[#29283A]/35 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full ${maxWidth} bg-white rounded-2xl border border-[#E6E3F1] shadow-xl overflow-hidden flex flex-col max-h-[90vh]`}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E6E3F1]">
              <div>
                <h2 id="modal-title" className="text-lg font-semibold text-[#29283A]">
                  {title}
                </h2>
                {subtitle && <p className="text-xs text-[#68667D] mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-xl text-[#68667D] hover:text-[#29283A] hover:bg-[#F2F0F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-[#4A485E] leading-relaxed">{message}</p>
      <div className="flex items-center justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#29283A] bg-[#F2F0F9] hover:bg-[#E6E3F1] rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            destructive
              ? 'bg-[#C93B3B] hover:bg-[#B22E2E]'
              : 'bg-[#6D5FD1] hover:bg-[#5B4DC4]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 320;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(start + diff * eased));
      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular-nums font-display">
      {display}
      {suffix}
    </span>
  );
}

export function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: { id: number; message: string; type: 'success' | 'error' } | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-white border border-[#E6E3F1] rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3"
          role="status"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#1A7F54] shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-[#C93B3B] shrink-0" />
          )}
          <span className="text-sm text-[#29283A] flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="text-[#68667D] hover:text-[#29283A] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-6xl mx-auto">
      <div className="h-28 bg-[#EDEAF9]/70 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-white rounded-2xl border border-[#E6E3F1]" />
        <div className="h-28 bg-white rounded-2xl border border-[#E6E3F1]" />
        <div className="h-28 bg-white rounded-2xl border border-[#E6E3F1]" />
      </div>
      <div className="h-64 bg-white rounded-2xl border border-[#E6E3F1]" />
    </div>
  );
}
