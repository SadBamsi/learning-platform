import Link from "next/link";
import { getCourses } from "@/lib/content";

export default function Home() {
  const courses = getCourses();
  return (
    <>
      <h1>Подготовка к fullstack-собеседованию</h1>
      <p>
        Самые частые вопросы по темам: короткий ответ для интервью, глубокий разбор, задания на закрепление и тест.
        Уровень — Middle → Senior.
      </p>
      {courses.map((c) => (
        <Link key={c.slug} href={`/${c.slug}`} className="card">
          <strong>{c.title}</strong>
          <small>{c.description}</small>
        </Link>
      ))}
    </>
  );
}
