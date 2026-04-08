📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
В production (Vercel + Telegram) стартовая кнопка ("Посмотреть" / "Начать") не переводит пользователя на страницу `/test` (тихое падение). Необходимо добавить обработку ошибок и гарантировать переход.
</context>

<task>
1. Найти компонент стартовой страницы (`app/page.tsx` или компонент Welcome).
2. Найти функцию обработчика клика (например, `handleStart`).
3. Обернуть ВСЮ логику в `try/catch`.
4. В блоке `catch`:
   - Снять состояние загрузки (`setIsLoading(false)`).
   - Вывести ошибку прямо на экран через `alert('Ошибка старта: ' + error.message)` (или Toast, если подключен sonner/react-hot-toast). Это критично для отладки внутри Telegram!
5. Убедиться, что при `debug=true` или если БД недоступна, роутинг `router.push('/test')` всё равно срабатывает как fallback (Graceful Degradation). Пользователь не должен застревать на первом экране.
6. Закоммитить изменения: `git commit -am "fix: add error handling and fallback to start button"`.
7. Отправить код: `git push origin main`.
8. Перенести этот файл в tasks/done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Выполнить git push самостоятельно для запуска сборки на Vercel.
</rules>