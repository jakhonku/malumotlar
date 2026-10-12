"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Textarea } from "./primitives";

/**
 * Tasdiqlash oynasi (native <dialog>). needsComment bo‘lsa sabab majburiy.
 * onConfirm xato qaytarsa (string), oyna ochiq qoladi va xato ko‘rsatiladi.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  needsComment,
  destructive,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  needsComment?: boolean;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<string | void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function submit() {
    if (needsComment && comment.trim().length < 3) {
      setError("Sababni yozing (kamida 3 belgi)");
      return;
    }
    start(async () => {
      const err = await onConfirm(comment.trim());
      if (err) setError(err);
      else {
        setComment("");
        setError(null);
        onClose();
      }
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="p-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        {needsComment && (
          <Textarea
            className="mt-3"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Sabab / izoh"
            aria-label="Sabab"
          />
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending ? "Bajarilmoqda…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
