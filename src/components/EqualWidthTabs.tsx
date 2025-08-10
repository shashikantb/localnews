
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string, badge?: number };

export default function EqualWidthTabs({
  tabs,
  param = "tab",
  activeKey,
}: {
  tabs: Tab[];
  param?: string;
  activeKey?: string; // optional: override active via prop
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = activeKey ?? params.get(param) ?? tabs[0]?.key ?? "";

  const select = (key: string) => {
    const usp = new URLSearchParams(window.location.search);
    usp.set(param, key);
    router.replace(`?${usp.toString()}`, { scroll: false });
  };

  const cols = tabs.length || 4; // fall back to 4
  return (
    <div className="flex-grow">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => select(t.key)}
              className={cn(
                "relative flex items-center justify-center",
                "px-1 py-2",                 // touch target
                "border-b-2",                // underline indicator
                active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted",
                "text-[clamp(11px,2.9vw,14px)] leading-5", // auto-shrink
                "truncate transition-colors duration-200",                  // avoid wrapping
              )}
              style={{ minHeight: 44 }}      // good tap size
              title={t.label}
            >
              <span className="truncate">{t.label}</span>
              {t.badge && t.badge > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                    {t.badge > 9 ? '9+' : t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
