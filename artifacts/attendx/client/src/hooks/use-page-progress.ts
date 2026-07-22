/**
 * use-page-progress.ts
 * يُشغّل شريط التقدم العلوي عند تغيير الصفحة
 * يرجع { progress (0-100), visible }
 */
import { useEffect, useState } from "react";

export function usePageProgress(location: string) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible]   = useState(false);

  useEffect(() => {
    // ابدأ الشريط
    setProgress(0);
    setVisible(true);

    // تقدم سريع لـ 80% ثم يتوقف وينتظر
    const t1 = setTimeout(() => setProgress(30),  50);
    const t2 = setTimeout(() => setProgress(60), 150);
    const t3 = setTimeout(() => setProgress(80), 300);

    // بعد 600ms اعتبر إن الصفحة حمّلت وأكمل لـ 100
    const t4 = setTimeout(() => {
      setProgress(100);
      // اختفاء ناعم
      const t5 = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t5);
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [location]);

  return { progress, visible };
}
