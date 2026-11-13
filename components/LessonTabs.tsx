"use client";
import { useState, type ReactNode } from "react";

export function LessonTabs({
  theory,
  practice,
  quiz,
}: {
  theory: ReactNode;
  practice: ReactNode;
  quiz: ReactNode;
}) {
  const [tab, setTab] = useState<"theory" | "practice" | "quiz">("theory");
  const items = [
    ["theory", "1. Теория"],
    ["practice", "2. Практика"],
    ["quiz", "3. Тест"],
  ] as const;
  return (
    <>
      <div className="tabs">
        {items.map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "theory" && theory}
      {tab === "practice" && practice}
      {tab === "quiz" && quiz}
    </>
  );
}
