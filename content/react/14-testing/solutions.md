## Решения

Тесты из заданий 2–7 запускались на `vitest 5.1.0` + `@testing-library/react` + `@testing-library/user-event` + `jsdom`: проходят.

### Задание 1

- Поле email — `getByLabelText("Email")` (связь label/input; проверяет доступность).
- Кнопка — `getByRole("button", { name: "Войти" })`.
- Заголовок — `getByRole("heading", { name: "Профиль" })`.
- Ошибка — `getByRole("alert")` (+ `toHaveTextContent`).
- Картинка — `getByAltText("Аватар")` (или `getByRole("img", { name: "Аватар" })`).
- Спиннер без семантики — нужно **добавить доступность** (`role="status"` с `aria-label="Загрузка"`) и искать по роли; если невозможно, `getByTestId("spinner")` как запасной вариант.

### Задание 2

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("увеличивает значение по клику и вызывает onChange", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<Counter initial={1} onChange={onChange} />);

  expect(screen.getByText("Счётчик: 1")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Увеличить" }));

  expect(screen.getByText("Счётчик: 2")).toBeInTheDocument();
  expect(onChange).toHaveBeenCalledWith(2);
});
```

### Задание 3

```jsx
it("показывает ошибку при неверном email", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} />);
  await user.type(screen.getByLabelText("Email"), "bad");
  await user.click(screen.getByRole("button", { name: "Войти" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Некорректный email");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("отправляет валидные данные", async () => {
  const onSubmit = vi.fn().mockResolvedValue();
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} />);
  await user.type(screen.getByLabelText("Email"), "a@b.co");
  await user.click(screen.getByRole("button", { name: "Войти" }));
  expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.co" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
```

### Задание 4

```jsx
afterEach(() => vi.unstubAllGlobals());

it("показывает загрузку, затем имя", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Ann" }) }));
  render(<User id={1} />);
  expect(screen.getByText("Загрузка…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Ann" })).toBeInTheDocument();
});

it("показывает ошибку при !ok", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  render(<User id={1} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Ошибка загрузки");
});

it("getBy бросает, queryBy возвращает null", () => {
  render(<Counter />);
  expect(() => screen.getByText("нет такого")).toThrow();
  expect(screen.queryByText("нет такого")).toBeNull();
});
```

MSW перехватывает запросы на уровне сети (`http.get("/api/users/:id", ...)`): код компонента не знает о подмене, тесты не привязаны к способу запроса (`fetch`/`axios`/TanStack Query), а один набор обработчиков можно использовать и в тестах, и в разработке.

### Задание 5

```jsx
it("useCounter", () => {
  const { result } = renderHook(() => useCounter(5));
  expect(result.current.count).toBe(5);
  act(() => result.current.inc());
  expect(result.current.count).toBe(6);
});

it("useDebounce", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: "a" } });
  rerender({ v: "b" });
  expect(result.current).toBe("a");
  act(() => { vi.advanceTimersByTime(100); });
  expect(result.current).toBe("b");
  vi.useRealTimers();
});
```

### Задание 6

```jsx
it("debounce: onSearch вызывается один раз после паузы", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const onSearch = vi.fn();
  render(<SearchBox onSearch={onSearch} />);

  await user.type(screen.getByLabelText("search"), "react");
  expect(onSearch).not.toHaveBeenCalled();

  await act(async () => { vi.advanceTimersByTime(300); });
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith("react");
  vi.useRealTimers();
});
```

Проверено: с `vi.useFakeTimers()` без дополнительных опций `user.type` в этой конфигурации завис до таймаута (5 с). `userEvent` использует таймеры для пауз между событиями, а Testing Library — для асинхронных утилит; опция `advanceTimers` сообщает `userEvent`, как продвигать фейковое время, а `shouldAdvanceTime: true` позволяет времени идти автоматически, чтобы эти внутренние ожидания завершались. Альтернатива: отправлять значение через `fireEvent.change` (в этом варианте асинхронные паузы отсутствуют).

### Задание 7

```jsx
// а) мок модуля
vi.mock("./greet.js", () => ({ greet: () => "Mocked" }));

it("подменяет зависимость", () => {
  render(<Greeting />);
  expect(screen.getByText("Mocked")).toBeInTheDocument();
});

// б) контекст через wrapper
const wrapper = ({ children }) => <ThemeCtx.Provider value="dark">{children}</ThemeCtx.Provider>;

it("читает контекст", () => {
  render(<ThemeLabel />, { wrapper });
  expect(screen.getByText("theme: dark")).toBeInTheDocument();
});
```

Оба варианта проверены (и `renderHook` с тем же `wrapper` возвращает `dark`).

### Задание 8

Что плохо: селектор по структуре DOM (`.counter > div:nth-child(2) button`) ломается при изменении вёрстки; большой snapshot шумит и его «обновляют не глядя»; обращение к `state` — деталь реализации (после перехода на хуки такого доступа вообще нет). Тест не описывает поведение.

```jsx
it("увеличивает счётчик по клику", async () => {
  const user = userEvent.setup();
  render(<Counter />);
  expect(screen.getByText("Счётчик: 0")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Увеличить" }));
  expect(screen.getByText("Счётчик: 1")).toBeInTheDocument();
});
```

### Задание 9

1. `getBy` — ищет сразу и **бросает** ошибку, если нет; `queryBy` — возвращает `null` (для проверки отсутствия); `findBy` — **асинхронный**, ждёт появления элемента (по умолчанию до 1 с).
2. `userEvent` воспроизводит реальную последовательность событий (фокус, нажатия клавиш, `input`), поэтому ловит ошибки, которые `fireEvent` (одно синтетическое событие) не замечает.
3. Не нужно проверять детали реализации (`state`, имена методов, количество рендеров, структуру DOM). Заменить: тесты поведения через RTL; для полных пользовательских сценариев и серверных частей — E2E (Playwright/Cypress).
