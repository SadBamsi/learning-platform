import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content");

export type Course = { slug: string; title: string; description: string };
export type Lesson = { slug: string; title: string; summary: string };
export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
};

const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8"));

export function getCourses(): Course[] {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      slug: d.name,
      ...readJson<Omit<Course, "slug">>(path.join(ROOT, d.name, "course.json")),
    }));
}

export function getCourse(slug: string): Course | undefined {
  return getCourses().find((c) => c.slug === slug);
}

export function getLessons(course: string): Lesson[] {
  const dir = path.join(ROOT, course);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      slug: d.name,
      ...readJson<Omit<Lesson, "slug">>(path.join(dir, d.name, "meta.json")),
    }));
}

export function getLessonContent(course: string, lesson: string) {
  const dir = path.join(ROOT, course, lesson);
  return {
    theory: fs.readFileSync(path.join(dir, "theory.md"), "utf8"),
    practice: fs.readFileSync(path.join(dir, "practice.md"), "utf8"),
    quiz: readJson<QuizQuestion[]>(path.join(dir, "quiz.json")),
  };
}
