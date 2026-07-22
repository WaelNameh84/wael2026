/**
 * mobile-feel.ts
 * يضيف Ripple + Haptic على كل أزرار التطبيق تلقائياً
 * بدون تعديل أي مكوّن
 */

/* ── Haptic feedback (يشتغل فقط على الموبايل) ── */
export function haptic(style: "light" | "medium" | "heavy" = "light") {
  if (!navigator.vibrate) return;
  const ms = style === "light" ? 8 : style === "medium" ? 18 : 30;
  navigator.vibrate(ms);
}

/* ── Ripple wave على أي زر يُضغط عليه ── */
function triggerRipple(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement;
  if (!target) return;

  // أضف الكلاس اللي يحتاجه الـ ripple
  target.classList.add("ripple-host");

  const rect  = target.getBoundingClientRect();
  const wave  = document.createElement("span");
  wave.className = "ripple-wave";
  wave.style.top  = `${e.clientY - rect.top}px`;
  wave.style.left = `${e.clientX - rect.left}px`;

  target.appendChild(wave);
  wave.addEventListener("animationend", () => wave.remove(), { once: true });

  // haptic خفيف مع كل ضغطة
  haptic("light");
}

/* ── تسجيل الـ listeners على كل الأزرار الحالية والمضافة لاحقاً ── */
function attach(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  if (el.dataset.rippleAttached) return;
  el.dataset.rippleAttached = "1";
  el.addEventListener("pointerdown", triggerRipple as EventListener);
}

function scanAndAttach(root: Element | Document = document) {
  root.querySelectorAll("button, a, [role='button']").forEach(attach);
}

/* ── MutationObserver يراقب العناصر الجديدة ── */
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (node instanceof Element) {
        if (node.matches("button, a, [role='button']")) attach(node);
        scanAndAttach(node);
      }
    });
  }
});

/* ── Swipe to go back — من الحافة اليسرى (LTR) أو اليمنى (RTL) ── */
export function initSwipeBack() {
  const isRTL = document.documentElement.dir === "rtl";
  let startX = 0, startY = 0;

  document.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dy > 60) return; // مجرد تمرير عمودي

    const W = window.innerWidth;
    const fromEdge = isRTL
      ? startX > W - 40 && dx < -80   // RTL: من اليمين لليسار
      : startX < 40    && dx > 80;    // LTR: من اليسار لليمين

    if (fromEdge) window.history.back();
  }, { passive: true });
}

/* ── Theme color — يحدّث لون شريط الساعة ليتطابق مع لون التطبيق ── */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;

  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();

  if (!primary) return;

  // --primary هو قيم HSL بدون hsl() — نحوّلها للون كامل
  meta.content = `hsl(${primary})`;
}

export function initMobileFeel() {
  scanAndAttach();
  observer.observe(document.body, { childList: true, subtree: true });
  initSwipeBack();

  // مزامنة أولية ثم مراقبة تغييرات الثيم
  syncThemeColor();
  const themeObserver = new MutationObserver(syncThemeColor);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}
