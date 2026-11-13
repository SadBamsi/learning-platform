// Проверяет структуру и данные контента: node scripts/validate-content.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "content");
const REQUIRED = ["meta.json", "theory.md", "practice.md", "quiz.json"];
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const readJson = (p, where) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(where, `невалидный JSON (${e.message})`);
    return null;
  }
};

let topics = 0;
let questions = 0;

for (const course of fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const cdir = path.join(ROOT, course.name);
  const cj = readJson(path.join(cdir, "course.json"), `${course.name}/course.json`);
  if (cj && (!cj.title || !cj.description)) fail(`${course.name}/course.json`, "нужны title и description");

  for (const t of fs.readdirSync(cdir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const where = `${course.name}/${t.name}`;
    const dir = path.join(cdir, t.name);
    topics++;

    for (const f of REQUIRED) if (!fs.existsSync(path.join(dir, f))) fail(where, `нет файла ${f}`);
    if (!/^\d{2}-[a-z0-9-]+$/.test(t.name)) fail(where, "имя папки должно быть вида NN-slug");

    const meta = readJson(path.join(dir, "meta.json"), `${where}/meta.json`);
    if (meta) {
      if (!meta.title || !meta.summary) fail(where, "meta.json: нужны title и summary");
      if (meta.level && !["middle", "senior"].includes(meta.level)) fail(where, `meta.json: level=${meta.level}`);
      if (meta.frequency && ![1, 2, 3].includes(meta.frequency)) fail(where, `meta.json: frequency=${meta.frequency}`);
    }

    const quiz = readJson(path.join(dir, "quiz.json"), `${where}/quiz.json`);
    if (Array.isArray(quiz)) {
      if (quiz.length < 5) fail(where, `в тесте только ${quiz.length} вопросов (минимум 5)`);
      quiz.forEach((q, i) => {
        questions++;
        const w = `${where}/quiz.json[${i}]`;
        if (!q.question) fail(w, "нет question");
        if (!Array.isArray(q.options) || q.options.length < 2) return fail(w, "нужно минимум 2 options");
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) fail(w, `answer=${q.answer} вне диапазона`);
        if (new Set(q.options).size !== q.options.length) fail(w, "повторяющиеся варианты ответа");
      });
    } else if (quiz) fail(where, "quiz.json должен быть массивом");

    for (const f of ["theory.md", "practice.md", "solutions.md"]) {
      const p = path.join(dir, f);
      if (fs.existsSync(p) && fs.readFileSync(p, "utf8").trim().length < 200) fail(where, `${f} подозрительно короткий`);
    }
  }
}

if (errors.length) {
  console.error(`✖ Найдено ошибок: ${errors.length}\n` + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`✔ Контент валиден: тем — ${topics}, вопросов в тестах — ${questions}`);
