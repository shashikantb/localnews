
"use client";
import { useEffect } from "react";

/**
 * Pushes a history entry when `open` is true and closes on Android/WebView back (popstate).
 */
export function useModalBack(open: boolean, onClose: () => void, key: string = "modal") {
  useEffect(() => {
    if (!open) return;

    const state = { [key]: true, ts: Date.now() };
    try { window.history.pushState(state, ""); } catch {}

    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      try { window.history.back(); } catch {}
    };
  }, [open, onClose, key]);
}
