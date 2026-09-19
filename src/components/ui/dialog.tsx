import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[60] flex max-h-[92dvh] w-[min(100%-1.5rem,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-card text-ink shadow-[var(--shadow-card-hover)]",
          "max-md:w-[min(100%-1rem,40rem)] max-md:max-h-[96dvh]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <DialogPrimitive.Title className="text-base font-medium">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="grid size-11 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">إغلاق</span>
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
