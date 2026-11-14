## Решения

### Задание 1

- а) `value` без `onChange` — поле только для чтения, React предупреждает (проверено). Либо добавить `onChange`, либо использовать `defaultValue`.
- б) Начальное `undefined` делает поле неуправляемым, а после первого ввода — управляемым: предупреждение «changing an uncontrolled input to be controlled» (проверено). Исправление: `useState("")`.
- в) Нет `e.preventDefault()` (страница перезагрузится), а `onSubmit` не использует событие. Исправление:

```jsx
<form onSubmit={(e) => { e.preventDefault(); save(email); }}>
```

или перейти на `<form action={...}>` (в React 19 `preventDefault` не нужен).

### Задание 2

```jsx
function SignUp() {
  const [values, setValues] = useState({ email: "", password: "", confirm: "" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const errors = {};
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Некорректный email";
  if (values.password.length < 8) errors.password = "Минимум 8 символов";
  if (values.confirm !== values.password) errors.confirm = "Пароли не совпадают";

  const show = (f) => (touched[f] || submitted) && errors[f];
  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const blur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setPending(true);
    try { await api.signup(values); } finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {["email", "password", "confirm"].map((f) => (
        <div key={f}>
          <input
            name={f}
            type={f === "email" ? "email" : "password"}
            value={values[f]}
            onChange={change}
            onBlur={blur}
            aria-invalid={!!show(f)}
            aria-describedby={show(f) ? `${f}-err` : undefined}
          />
          {show(f) && <p id={`${f}-err`} role="alert">{errors[f]}</p>}
        </div>
      ))}
      <button disabled={pending}>Зарегистрироваться</button>
    </form>
  );
}
```

Ошибки вычисляются при рендере (не хранятся в состоянии). Проверено запуском: при вводе ошибки нет, после ухода с поля она появляется, отправка невалидной формы показывает ошибки без вызова API, валидная — вызывает API один раз. Ввод 3 символов в управляемое поле даёт 3 рендера (проверено). Сократить: использовать неуправляемые поля и читать `FormData` при отправке, либо `react-hook-form` (подписка на нужные поля), либо вынести каждое поле в отдельный компонент с локальным состоянием.

### Задание 3

```jsx
async function signup(prev, formData) {
  const values = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const errors = {};
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Некорректный email";
  if (values.password.length < 8) errors.password = "Минимум 8 символов";
  if (Object.keys(errors).length) return { ok: false, errors, values };

  await api.signup(values);
  return { ok: true, errors: {}, values: { email: "", password: "" } };
}

function SignUp() {
  const [state, action, pending] = useActionState(signup, {
    ok: false, errors: {}, values: { email: "", password: "" },
  });
  return (
    <form action={action}>
      <input name="email" defaultValue={state.values.email} />
      {state.errors.email && <p role="alert">{state.errors.email}</p>}
      <input name="password" type="password" defaultValue={state.values.password} />
      {state.errors.password && <p role="alert">{state.errors.password}</p>}
      <button disabled={pending}>Отправить</button>
      {state.ok && <p>Готово</p>}
    </form>
  );
}
```

Проверено на аналогичном примере (email + age): при ошибке остаются введённые значения и видна ошибка, при успехе поля очищены, ошибок нет. Без `defaultValue` из состояния React 19 сбросил бы неуправляемые поля к начальным значениям после завершения action, и пользователь потерял бы ввод; поэтому вводимые данные возвращают из action и подставляют в `defaultValue`. Для пароля обычно не возвращают значение обратно: безопаснее оставить поле пустым.

### Задание 4

```jsx
import { useFormStatus } from "react-dom";

function SubmitButton({ children }) {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Отправка…" : children}</button>;
}

<form action={save}>
  <input name="name" />
  <SubmitButton>Сохранить</SubmitButton>
</form>
```

`useFormStatus` читает статус **родительской формы**, поэтому должен вызываться в компоненте, который находится внутри `<form>`. Если вызвать его в компоненте, который сам рендерит `<form>`, родительской формы нет и `pending` всегда `false` (проверено: компонент вне формы получил `false`, кнопка внутри формы — `sending` во время отправки).

### Задание 5

```jsx
function Todos({ initial }) {
  const [todos, setTodos] = useState(initial);
  const [optimistic, addOptimistic] = useOptimistic(
    todos,
    (current, text) => [...current, { id: `tmp-${text}`, text, sending: true }]
  );

  async function add(formData) {
    const text = String(formData.get("text"));
    addOptimistic(text);
    const saved = await api.add(text);          // при ошибке функция бросает исключение
    setTodos((t) => [...t, saved]);
  }

  return (
    <form action={add}>
      <input name="text" />
      <button>Добавить</button>
      <ul>
        {optimistic.map((t) => (
          <li key={t.id}>{t.text}{t.sending && " (отправляется…)"}</li>
        ))}
      </ul>
    </form>
  );
}
```

Проверено на аналогичном примере: во время запроса виден элемент `b (sending)`, после успеха — обычный `b`; когда состояние не изменилось (имитация ошибки), оптимистичная запись исчезла. Ошибку из `api.add` нужно перехватить (try/catch или error boundary) и показать пользователю.

### Задание 6

Слои защиты:

1. **Клиент:** блокировать кнопку на время отправки (`pending` из `useActionState`/`useFormStatus` или локальный флаг), игнорировать повторные submit, пока запрос идёт.
2. **Сеть:** `Idempotency-Key` в запросе — одинаковый ключ для повторов одной и той же отправки.
3. **Сервер:** идемпотентность (уникальные ограничения в БД, хранение ключей, дедупликация).

Клиентская часть:

```jsx
function Form() {
  const [state, action, pending] = useActionState(save, null);
  return (
    <form action={action}>
      {/* ...поля... */}
      <button disabled={pending}>Отправить</button>
    </form>
  );
}
```

### Задание 7

1. Для 30 полей лучше неуправляемые поля (или `react-hook-form`): нет рендера на каждый символ, значения читаются из `FormData` при отправке. Управляемыми делают только поля, чьё значение нужно интерфейсу «на лету».
2. После **успешного** завершения action React сбрасывает неуправляемые поля формы к `defaultValue` (проверено: `Bob` → `Ann`).
3. Клиентскую проверку можно обойти (запрос отправляют напрямую), и она не защищает данные и бизнес-правила; сервер — единственное доверенное место.
