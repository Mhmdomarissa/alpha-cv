"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export type FloatingNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

type FloatingNavProps = {
  items: FloatingNavItem[];
  activeId: string;
  className?: string;
};

export default function FloatingNav({ items, activeId, className }: FloatingNavProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === activeId),
  );

  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const updateIndicator = () => {
      const btn = btnRefs.current[activeIndex];
      const container = containerRef.current;
      if (!btn || !container) return;

      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setIndicatorStyle({
        width: btnRect.width,
        left: btnRect.left - containerRect.left,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeIndex]);

  return (
    <div
      className={[
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-2",
        "pb-[env(safe-area-inset-bottom)]",
        className ?? "",
      ].join(" ")}
    >
      <div
        ref={containerRef}
        className="relative flex items-center justify-between bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-xl rounded-full px-1 py-2 border border-gray-200 dark:border-gray-800"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            onClick={item.onSelect}
            className="relative flex flex-col items-center justify-center flex-1 px-2 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
            aria-current={item.id === activeId ? "page" : undefined}
            type="button"
          >
            <div className="z-10">{item.icon}</div>
            <span className="text-[11px] mt-1 hidden sm:block">{item.label}</span>
          </button>
        ))}

        <motion.div
          animate={indicatorStyle}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute top-1 bottom-1 rounded-full bg-blue-500/10 dark:bg-blue-400/20"
        />
      </div>
    </div>
  );
}

