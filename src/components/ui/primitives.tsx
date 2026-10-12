import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-blue-800 text-white hover:bg-blue-900",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        destructive: "bg-red-700 text-white hover:bg-red-800",
        success: "bg-emerald-700 text-white hover:bg-emerald-800",
        ghost: "text-slate-700 hover:bg-slate-100",
        link: "text-blue-800 underline-offset-4 hover:underline",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-8 px-3 text-xs", lg: "h-12 px-6 text-base", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export function buttonClass(variant: ButtonProps["variant"] = "default", size: ButtonProps["size"] = "default", className?: string) {
  return cn(buttonVariants({ variant, size }), className);
}

const fieldBase =
  "w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, "min-h-20 py-2", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-slate-700", className)} {...props} />;
}

export function Field({
  label,
  error,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold text-slate-900", className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

const badgeTone = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
} as const;

export function Badge({ tone = "slate", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTone[tone], className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export const Th = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600", className)} {...props} />
);
export const Td = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-b border-slate-100 px-3 py-2.5 align-top text-slate-800", className)} {...props} />
);

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {text && <p className="max-w-md text-sm text-slate-500">{text}</p>}
      {children}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
