import Link from "next/link";
import { getCourses } from "@/lib/content";

export default function Home() {
  const courses = getCourses();
  return (
    <>
      <h1>Курсы</h1>
      {courses.map((c) => (
        <Link key={c.slug} href={`/${c.slug}`} className="card">
          <strong>{c.title}</strong>
          <small>{c.description}</small>
        </Link>
      ))}
    </>
  );
}
