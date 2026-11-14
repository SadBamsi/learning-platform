> **Ответ за 30 секунд.** Поле формы бывает **управляемым** (controlled: значение хранится в состоянии, `value` + `onChange`) и **неуправляемым** (uncontrolled: значение живёт в DOM, читается через `ref` или `FormData`). Управляемые нужны, когда значение влияет на интерфейс на лету (валидация при вводе, зависимые поля, маски); для простых форм достаточно неуправляемых. В **React 19** у `<form>` появился проп **`action`**: в него передают функцию (в том числе асинхронную), React вызывает её с `FormData`, оборачивает в переход и сбрасывает неуправляемые поля после успеха. Вокруг этого построены хуки: **`useActionState`** (результат действия, функция для `<form action>` и `pending`), **`useFormStatus`** (состояние отправки внутри дочернего компонента формы), **`useOptimistic`** (мгновенно показать ожидаемый результат с откатом при ошибке). На сервере это те же функции в виде **Server Actions** (Next.js). Для сложных форм с валидацией часто берут `react-hook-form` + `zod`.

## Что именно спрашивают

- «Controlled и uncontrolled компоненты: разница, плюсы и минусы?»
- «Почему `value` без `onChange` даёт предупреждение?»
- «Как сделать валидацию формы? Когда показывать ошибки?»
- «Что нового в React 19 для форм: `action`, `useActionState`, `useFormStatus`, `useOptimistic`?»
- «Как предотвратить двойную отправку?»
- «Как сбросить форму? Почему поля очищаются после отправки?»
- «Чем `react-hook-form` лучше самописной формы?»

## Controlled и uncontrolled

**Управляемый input:**

```jsx
const [value, setValue] = useState("");
<input value={value} onChange={(e) => setValue(e.target.value)} />
```

Каждое нажатие — `setState` и рендер (проверено: 3 символа → 3 рендера). Плюсы: значение всегда в состоянии, легко валидировать, форматировать, блокировать кнопку, синхронизировать поля. Минусы: рендер на каждый символ (для больших форм заметно), больше кода.

Если указать `value` и не дать `onChange`, поле становится **только для чтения**, и React предупреждает (проверено: «You provided a `value` prop to a form field without an `onChange` handler… read-only field»). Для начального значения неуправляемого поля используют `defaultValue`.

**Неуправляемый input:**

```jsx
<form onSubmit={(e) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  console.log(Object.fromEntries(data));        // { name: "..." }
}}>
  <input name="name" defaultValue="Ann" />
</form>
```

Значение берётся из DOM в момент отправки. Плюсы: минимум рендеров, меньше кода. Минусы: сложнее реагировать на ввод «на лету».

**Не переключайте** поле между режимами (`value` меняется с `undefined` на строку и обратно) — React предупреждает «changing an uncontrolled input to be controlled». Инициализируйте пустой строкой: `useState("")`.

Особые случаи: `<input type="file">` всегда неуправляемый; `checkbox` управляется через `checked`; `<select>` — через `value` на самом `<select>`; `<textarea>` — `value`.

## Валидация

Правила хорошего UX:

- Валидируйте **на сервере всегда** (клиентская проверка — только удобство); возвращайте ошибки по полям.
- Показывайте ошибку поля **после** того, как пользователь покинул его (`onBlur`, состояние `touched`) или после первой отправки, а не на первом символе.
- Связывайте ошибки с полями для доступности: `<label htmlFor>`, `aria-invalid`, `aria-describedby` на текст ошибки; фокус на первое невалидное поле после отправки.
- Блокируйте повторную отправку на время запроса (`disabled` на кнопке или `pending` из `useActionState`).

Схемы (`zod`, `valibot`, `yup`) описывают правила один раз; одну и ту же схему можно использовать на клиенте и на сервере.

## Form actions (React 19)

```jsx
<form action={async (formData) => {
  await save(formData.get("name"));
}}>
  <input name="name" defaultValue="Ann" />
  <button>Сохранить</button>
</form>
```

Что делает React:

- Вызывает функцию с `FormData` при отправке (без `e.preventDefault()`; проверено: функция получила `Ann`).
- Выполняет её **как переход** (transition), поэтому интерфейс остаётся отзывчивым и работает `isPending`.
- После **успешного** завершения **сбрасывает неуправляемые поля** формы к `defaultValue` (проверено: пользователь ввёл `Bob`, после действия в поле снова `Ann`).

Поэтому при ошибке валидации нужно вернуть введённые значения и подставлять их в `defaultValue`, иначе пользователь потеряет ввод (см. ниже).

### useActionState

```jsx
async function signup(prev, formData) {
  const values = { email: String(formData.get("email") ?? "") };
  if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    return { ok: false, errors: { email: "Некорректный email" }, values };
  }
  await api.signup(values);
  return { ok: true, errors: {}, values: { email: "" } };
}

function Form() {
  const [state, action, pending] = useActionState(signup, { ok: false, errors: {}, values: { email: "" } });
  return (
    <form action={action}>
      <input name="email" defaultValue={state.values.email} />
      {state.errors.email && <b role="alert">{state.errors.email}</b>}
      <button disabled={pending}>Отправить</button>
      {state.ok && <p>Готово</p>}
    </form>
  );
}
```

Сигнатура: `useActionState(fn, initialState)` возвращает `[state, formAction, isPending]`; `fn(prevState, formData)` возвращает **новое состояние**. Проверено на этом примере: во время выполнения `pending`, при ошибке остаются введённые значения и видна ошибка, при успехе поля очищены и ошибок нет.

### useFormStatus

```jsx
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Отправка…" : "Отправить"}</button>;
}
```

Хук читает статус **родительской** `<form>`, поэтому работает только в **дочернем компоненте** формы. Проверено: кнопка внутри формы показала `sending`, а компонент, находящийся вне формы, получил `pending = false`.

### useOptimistic

```jsx
const [optimisticTodos, addOptimistic] = useOptimistic(
  todos,
  (current, newTodo) => [...current, { text: newTodo, sending: true }]
);

async function add(formData) {
  const text = formData.get("t");
  addOptimistic(text);                 // сразу показываем
  await api.add(text);                 // настоящий запрос
  setTodos(await api.list());          // реальное состояние заменяет оптимистичное
}
```

Оптимистичное значение действует, пока выполняется action; по завершении интерфейс показывает реальное состояние. Если запрос провалился и реальное состояние не изменилось, оптимистичная запись **исчезает** (откат). Проверено: во время запроса виден `b (sending)`, после успеха — `b`; для «неудачного» действия запись откатилась.

### Server Actions

В Next.js (и других фреймворках с RSC) в `action` можно передать функцию с директивой `"use server"`: она выполнится на сервере, а форма сможет работать даже без JavaScript (progressive enhancement). Детали — в разделе про Next.js.

## Библиотеки форм

`react-hook-form` — неуправляемые поля + подписки на изменения: меньше рендеров, интеграция со схемами (`zod`) через резолвер, встроенные `touched`/`dirty`/ошибки. Альтернативы: Formik (на управляемых полях), TanStack Form. Для 2–3 полей хватает `FormData` и `useActionState`.

## Частые follow-up вопросы

**Когда выбрать controlled, а когда uncontrolled?**
Controlled — валидация/форматирование при вводе, зависимые поля, программное изменение значений. Uncontrolled — простые формы, большие формы с производительностью, работа с файлами.

**Что передаётся в `action`?**
Объект `FormData` формы; для чтения полей — `formData.get("name")` (ключ — атрибут `name`).

**Как предотвратить двойную отправку?**
Блокировать кнопку на время `pending` (`useActionState`/`useFormStatus`), а на сервере делать операцию идемпотентной (Idempotency-Key).

**Почему форма очистилась после отправки?**
React 19 сбрасывает неуправляемые поля после успешного action. Чтобы сохранить ввод при ошибке, возвращайте значения из action и ставьте их в `defaultValue`.

**`useFormStatus` возвращает `pending: false` всегда — почему?**
Хук вызван не внутри дочернего компонента `<form>` (проверено на компоненте вне формы).

**Нужен ли `e.preventDefault()` при `action`?**
Нет: React сам вызывает функцию и предотвращает перезагрузку страницы. Для `onSubmit` он, как и раньше, нужен.

## Типичные ошибки

- `value` без `onChange` (поле только для чтения).
- Переключение между controlled и uncontrolled.
- Валидация только на клиенте.
- Показ ошибок до взаимодействия пользователя с полем.
- Потеря введённых данных при ошибке после сброса формы.
- `useFormStatus` вне дочернего компонента формы.
- Отсутствие защиты от двойной отправки.
- Отсутствие связи между полем и ошибкой (`aria-describedby`) и меток `label`.
