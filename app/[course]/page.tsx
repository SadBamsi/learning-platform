import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, getLessons } from "@/lib/content";
import { LessonBadge } from "@/components/LessonBadge";

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const c = getCourse(course);
  if (!c) notFound();
  const lessons = getLessons(course);
  return (
    <>
      <h1>{c.title}</h1>
      <p>{c.description}</p>
      {lessons.map((l, i) => (
        <Link key={l.slug} href={`/${course}/${l.slug}`} className="card">
          <strong>
            {i + 1}. {l.title}
          </strong>
          <LessonBadge id={`${course}/${l.slug}`} />
          <small>{l.summary}</small>
        </Link>
      ))}
    </>
  );
}
