## Задания на закрепление

Настройте окружение один раз (Vitest + jsdom + React Testing Library, конфигурация из теории), затем выполняйте задания.

### Задание 1. Какой запрос выбрать?

Для каждого элемента назовите наиболее предпочтительный запрос Testing Library и объясните, почему:

```html
<label for="email">Email</label><input id="email" />
<button>Войти</button>
<h1>Профиль</h1>
<p role="alert">Ошибка сети</p>
<img src="a.png" alt="Аватар" />
<div class="spinner"></div>        <!-- без текста и ролей -->
```

### Задание 2. Тест счётчика

Напишите тест для `Counter({ initial, onChange })`: показывает `Счётчик: N`, кнопка «Увеличить» увеличивает значение и вызывает `onChange` с новым числом.

### Задание 3. Тест формы

Для `LoginForm({ onSubmit })` напишите два теста: (а) при email без `@` показывается `role="alert"` с текстом ошибки, и `onSubmit` не вызван; (б) при валидном email вызывается `onSubmit({ email })`, ошибки нет.

### Задание 4. Асинхронная загрузка

Для компонента `User({ id })`, который грузит `/api/users/:id`, напишите три теста: загрузка → имя; ответ `!ok` → ошибка; элемента нет → `queryBy` возвращает `null`, а `getBy` бросает. Как мокать `fetch`? Чем MSW лучше?

### Задание 5. Хук

Протестируйте `useCounter(initial)` и `useDebounce(value, delay)` через `renderHook`. Для debounce используйте fake timers и `rerender` с новыми аргументами.

### Задание 6. Debounce в компоненте

Протестируйте `SearchBox({ onSearch })`: после ввода «react» `onSearch` не вызывается сразу, а вызывается один раз через 300 мс. Объясните, зачем нужны `shouldAdvanceTime` и `advanceTimers`.

### Задание 7. Мок модуля и контекст

(а) Подмените модуль `greet.js` так, чтобы компонент выводил `Mocked`. (б) Протестируйте `ThemeLabel`, читающий контекст, с провайдером `dark`, используя `wrapper`.

### Задание 8. Хрупкий тест

Почему этот тест плох? Перепишите его, проверяя поведение.

```jsx
it("works", () => {
  const { container } = render(<Counter />);
  expect(container.querySelector(".counter > div:nth-child(2) button")).toBeTruthy();
  expect(container).toMatchSnapshot();
  const instance = ...; // доступ к state компонента
  expect(instance.state.count).toBe(0);
});
```

### Задание 9. Устно

1. Чем `getBy`, `queryBy` и `findBy` отличаются?
2. Почему `userEvent` предпочтительнее `fireEvent`?
3. Что не нужно тестировать в unit-тестах компонентов и чем это заменить?
