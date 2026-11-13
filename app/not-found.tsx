import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Страница не найдена</h1>
      <p>Такого адреса нет. Возможно, тема ещё не добавлена или ссылка устарела.</p>
      <Link href="/">← На главную</Link>
    </>
  );
}
