"use client";
import { useEffect, useState } from "react";

export function LessonBadge({ id }: { id: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("lp:scores") ?? "{}")[id];
      if (s) setText(`✓ тест: ${s.score}/${s.total}`);
    } catch {}
  }, [id]);
  return text ? <span className="badge">{text}</span> : null;
}
