## Практика

1. Создай папку, выполни `npm init -y`.
2. Напиши `math.js` (CJS) с функциями `add` и `mul`, подключи их в `app.js` через `require`.
3. Переведи проект на ESM: добавь `"type": "module"` в `package.json` и замени `require`/`module.exports` на `import`/`export`.
4. Используй `import.meta.dirname` и `node:path`, чтобы вывести полный путь до `package.json`.
5. Добавь в `scripts` команду `"start": "node app.js"` и запусти `npm start`.
6. **Задача:** создай модуль `logger.js`, экспортирующий функцию `log(level, message)`, которая печатает время, уровень и сообщение. Подключи его из двух разных файлов и убедись, что модуль кэшируется (добавь `console.log("logger loaded")` и посчитай, сколько раз он появится).
