"use client";
import { useState, type ReactNode } from "react";

type Tab = "theory" | "practice" | "solutions" | "quiz";

export function LessonTabs({
  theory,
  practice,
  solutions,
  quiz,
}: {
  theory: ReactNode;
  practice: ReactNode;
  solutions?: ReactNode;
  quiz: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("theory");
  const items: [Tab, string][] = [
    ["theory", "1. Теория"],
    ["practice", "2. Задания"],
    ...(solutions ? ([["solutions", "3. Решения"]] as [Tab, string][]) : []),
    ["quiz", `${solutions ? 4 : 3}. Тест`],
  ];
  const content: Record<Tab, ReactNode> = { theory, practice, solutions, quiz };
  return (
    <>
      <div className="tabs" role="tablist">
        {items.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {content[tab]}
    </>
  );
}
