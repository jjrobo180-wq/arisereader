// The small building blocks every Teacher Hub screen is made of.
import { forwardRef, type ReactNode } from "react";

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 break-words font-semibold text-slate-900">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:min-h-10 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

/** A text box. It takes a ref, so a screen can put the cursor in it. */
export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={`min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:min-h-10 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

export function PrimaryButton({
  children,
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

/** A box to type in with its name above it, so two date boxes side by side can be told apart. */
export function Labeled({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{children}</div>;
}
