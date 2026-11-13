import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getCourse, getLessons, getLessonContent } from "@/lib/content";
import { LessonTabs } from "@/components/LessonTabs";
import { Quiz } from "@/components/Quiz";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course, lesson } = await params;
  const lessons = getLessons(course);
  const meta = lessons.find((l) => l.slug === lesson);
  if (!getCourse(course) || !meta) notFound();
  const { theory, practice, quiz } = getLessonContent(course, lesson);
  const md = (s: string) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{s}</ReactMarkdown>;

  return (
    <>
      <h1>{meta.title}</h1>
      <LessonTabs
        theory={md(theory)}
        practice={md(practice)}
        quiz={<Quiz id={`${course}/${lesson}`} questions={quiz} />}
      />
    </>
  );
}
