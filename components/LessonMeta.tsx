import type { Lesson } from "@/lib/content";

const LEVEL_LABEL = { middle: "Middle", senior: "Senior" } as const;

export function LessonMeta({ lesson }: { lesson: Pick<Lesson, "level" | "frequency"> }) {
  if (!lesson.level && !lesson.frequency) return null;
  return (
    <span className="meta">
      {lesson.frequency && (
        <span title="Как часто встречается на собеседованиях">
          Частота: {"●".repeat(lesson.frequency)}
          <span className="dim">{"●".repeat(3 - lesson.frequency)}</span>
        </span>
      )}
      {lesson.level && <span className={`lvl lvl-${lesson.level}`}>{LEVEL_LABEL[lesson.level]}+</span>}
    </span>
  );
}
