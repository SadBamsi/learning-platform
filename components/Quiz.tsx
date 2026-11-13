"use client";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/content";

export function Quiz({ id, questions }: { id: string; questions: QuizQuestion[] }) {
  const [picked, setPicked] = useState<(number | null)[]>(questions.map(() => null));
  const [checked, setChecked] = useState(false);

  const score = picked.filter((p, i) => p === questions[i].answer).length;

  function check() {
    setChecked(true);
    try {
      const prev = JSON.parse(localStorage.getItem("lp:scores") ?? "{}");
      const best = Math.max(prev[id]?.score ?? 0, score);
      prev[id] = { score: best, total: questions.length };
      localStorage.setItem("lp:scores", JSON.stringify(prev));
    } catch {}
  }

  return (
    <>
      {questions.map((q, i) => (
        <div className="q" key={i}>
          <strong>
            {i + 1}. {q.question}
          </strong>
          {q.options.map((o, j) => (
            <label key={j}>
              <input
                type="radio"
                name={`q${i}`}
                disabled={checked}
                checked={picked[i] === j}
                onChange={() => setPicked(picked.map((p, k) => (k === i ? j : p)))}
              />{" "}
              {o}
            </label>
          ))}
          {checked && (
            <p className={picked[i] === q.answer ? "ok" : "bad"}>
              {picked[i] === q.answer ? "Верно." : `Неверно. Правильный ответ: ${q.options[q.answer]}.`}{" "}
              {q.explanation}
            </p>
          )}
        </div>
      ))}
      {!checked ? (
        <button className="primary" onClick={check} disabled={picked.includes(null)}>
          Проверить
        </button>
      ) : (
        <>
          <p>
            <strong>
              Результат: {score} / {questions.length}
            </strong>
          </p>
          <button
            className="primary"
            onClick={() => {
              setChecked(false);
              setPicked(questions.map(() => null));
            }}
          >
            Пройти заново
          </button>
        </>
      )}
    </>
  );
}
