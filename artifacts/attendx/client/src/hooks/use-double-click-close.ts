import { useCallback, useEffect, useRef } from "react";

type CloseClickEvent = {
  preventDefault: () => void;
};

/**
 * Requires two clicks before a close action is performed.
 * The first click is intentionally consumed so Radix close primitives do not
 * dismiss their dialog on the first click.
 */
export function useDoubleClickClose(action?: () => void) {
  const waitingForSecondClick = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  return useCallback((event?: CloseClickEvent) => {
    if (waitingForSecondClick.current) {
      waitingForSecondClick.current = false;
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      action?.();
      return;
    }

    event?.preventDefault();
    waitingForSecondClick.current = true;
    resetTimer.current = setTimeout(() => {
      waitingForSecondClick.current = false;
      resetTimer.current = null;
    }, 700);
  }, [action]);
}