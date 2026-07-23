/**
 * BottomSheet — غلاف سهل للـ Drawer (vaul)
 * يطلع من الأسفل وبيُسحب للإغلاق مثل تطبيقات iOS
 *
 * الاستخدام:
 *   <BottomSheet open={open} onOpenChange={setOpen} title="العنوان">
 *     <p>المحتوى هنا</p>
 *   </BottomSheet>
 */
import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useDoubleClickClose } from "@/hooks/use-double-click-close";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** إذا true يظهر زر X لإغلاق الـ sheet */
  showClose?: boolean;
  /** ارتفاع ثابت للـ sheet (مثلاً "60vh") — اختياري */
  height?: string;
  className?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  showClose = false,
  height,
  className,
  children,
}: BottomSheetProps) {
  const requireDoubleClick = useDoubleClickClose();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "focus:outline-none",
          className
        )}
        style={height ? { height } : undefined}
      >
        {/* Handle */}
        <div className="bottom-sheet-handle" />

        {(title || showClose) && (
          <DrawerHeader className="relative pt-2">
            {showClose && (
              <DrawerClose asChild>
                <button
                  onClick={requireDoubleClick}
                  className="absolute start-4 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="إغلاق"
                  title="اضغط مرتين للإغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </DrawerClose>
            )}
            {title && (
              <DrawerTitle className="text-center text-base font-semibold">
                {title}
              </DrawerTitle>
            )}
            {description && (
              <DrawerDescription className="text-center text-sm">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
        )}

        <div className="overflow-y-auto px-4 pb-safe">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
