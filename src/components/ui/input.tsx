import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full rounded-md bg-card px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)] disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "h-24 py-2 resize-y", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, "pe-8", className)} {...props}>
      {children}
    </select>
  );
}
