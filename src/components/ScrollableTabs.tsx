
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = { key: string; label: string; badge?: number };

type Props = {
  tabs: Tab[];
  param?: string;           // query param name for active tab
  defaultKey?: string;
  onChange?: (key: string) => void;
  className?: string;
};

export default function ScrollableTabs({
  tabs,
  param = "tab",
  defaultKey,
  onChange,
  className = "",
}: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const activeFromUrl = params.get(param) || defaultKey || tabs[0]?.key;

  const [active, setActive] = useState(activeFromUrl);
  useEffect(() => { setActive(activeFromUrl); }, [activeFromUrl]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft < max - 1);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
  }, []);

  const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  const select = (key: string) => {
    setActive(key);
    const usp = new URLSearchParams(window.location.search);
    usp.set(param, key);
    router.replace(`?${usp.toString()}`, { scroll: false });
    onChange?.(key);
    // optional: announce change for a11y
  };

  return (
    <div className={`relative ${className}`}>
      {/* Edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />

      {/* Scroll buttons (auto-hide when not needed) */}
      {canLeft && (
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-160)}
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 dark:bg-black/80 p-1 shadow-sm backdrop-blur-md z-10"
        >‹</button>
      )}
      {canRight && (
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(160)}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 dark:bg-black/80 p-1 shadow-sm backdrop-blur-md z-10"
        >›</button>
      )}

      {/* The tabs */}
      <div
        ref={scrollerRef}
        role="tablist"
        className="no-scrollbar -mx-4 flex snap-x overflow-x-auto px-4"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => select(t.key)}
              className={[
                "relative mr-2 mb-2 inline-flex snap-start items-center gap-2 rounded-full px-4 py-2 text-sm",
                "whitespace-nowrap border",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              style={{ minHeight: 40 }} // 44px tappable incl. padding
            >
              <span>{t.label}</span>
              {typeof t.badge === "number" && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold ring-2 ring-background">
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
