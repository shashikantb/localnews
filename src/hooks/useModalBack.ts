
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Pushes a history entry when `open` is true and closes on Android/WebView back (popstate).
 */
export function useModalBack(open: boolean, onClose: () => void, key: string = "modal") {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    // create a back-stop so the next "Back" triggers popstate
    try { window.history.pushState({ [key]: true, ts: Date.now() }, ""); } catch {}

    const onPop = () => {
      // On back button press, close the modal...
      onClose();
      // ...and ensure the user is back on the home page.
      router.replace("/", { scroll: false });
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // This is no longer needed as the onPop handler now controls navigation
      // try { window.history.back(); } catch {}
    };
  }, [open, onClose, key, router]);
}
