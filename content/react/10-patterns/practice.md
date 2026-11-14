## Задания на закрепление

### Задание 1. Выделить хук

В компоненте несколько раз повторяется один и тот же код. Выделите кастомные хуки и перепишите компоненты.

```jsx
function Modal() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);
  // ...
}

function Menu() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);
  // ...
}
```

Что произойдёт с состоянием, если `Modal` и `Menu` вызывают один и тот же `useToggle`? Разделят ли они его?

### Задание 2. useLocalStorage и синхронизация вкладок

Напишите `useLocalStorage(key, initial)`: читает значение при первом рендере, пишет при изменении, не падает при ошибках `JSON.parse`/квоты. Затем реализуйте версию только для чтения на `useSyncExternalStore`, которая реагирует на событие `storage` из других вкладок. Чем плохо чтение `localStorage` в инициализаторе при SSR?

### Задание 3. Compound Tabs

Реализуйте `Tabs`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel` на Context. Первая вкладка выбрана по умолчанию (`defaultValue`). Добавьте `aria-selected` и `role`. Почему это лучше, чем `<Tabs tabs={[{ title, content }]} />`?

### Задание 4. useControllableState

Сделайте `Toggle`, работающий и без пропса `on` (неуправляемый), и с `on` + `onChange` (управляемый). Предскажите: что покажет `<Toggle on={false} onChange={fn} />`, если родитель не обновляет `on` после клика? Вызовется ли `onChange`?

### Задание 5. useEventListener

Напишите `useEventListener(type, handler)`, чтобы обработчик всегда видел актуальное состояние, а подписка создавалась **один раз**. Покажите, что случится, если сделать подписку с `[handler]` в зависимостях.

### Задание 6. HOC в хук

Перепишите HOC в хук и сравните. Назовите минимум три недостатка HOC.

```jsx
const withWindowWidth = (Comp) => (props) => {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return <Comp {...props} width={w} />;
};
```

### Задание 7. Флаги вместо композиции

Перепишите API кнопки так, чтобы не было несовместимых комбинаций флагов, а иконку можно было поставить слева, справа или не ставить вовсе:

```jsx
<Button primary danger large icon="trash" iconRight loading>Удалить</Button>
```

### Задание 8. Устно

1. Что такое compound components и где они встречаются в библиотеках?
2. Чем controlled отличается от uncontrolled? Когда нужен каждый?
3. Почему хуки заменили HOC и render props?
