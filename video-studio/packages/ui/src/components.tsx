import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Ortak arayüz bileşenleri (web + masaüstü aynı bileşenleri kullanır).
 * Tailwind sınıflarıyla stillendirilir; tema koyu varsayılandır.
 */

const buttonVariants = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
  secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
  danger: "bg-red-700 hover:bg-red-600 text-white",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-zinc-700 bg-zinc-900 p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-base font-semibold text-zinc-100">{title}</h2> : null}
      {children}
    </section>
  );
}

const badgeVariants = {
  neutral: "bg-zinc-700 text-zinc-200",
  success: "bg-emerald-800 text-emerald-100",
  warning: "bg-amber-800 text-amber-100",
  error: "bg-red-800 text-red-100",
  info: "bg-sky-800 text-sky-100",
  mock: "bg-pink-700 text-white",
} as const;

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: keyof typeof badgeVariants;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${badgeVariants[variant]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-400">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none disabled:opacity-50";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-20`} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded bg-zinc-700"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description ? <p className="mt-1 text-xs text-zinc-400">{description}</p> : null}
    </div>
  );
}

export function ErrorNote({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      className="rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-200"
      role="alert"
    >
      <p>{message}</p>
      {detail ? <p className="mt-1 text-xs text-red-400">{detail}</p> : null}
    </div>
  );
}
