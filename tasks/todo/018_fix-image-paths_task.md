📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
После деплоя на Vercel (Linux) пропали картинки. Причина: case sensitivity. В репозитории лежат файлы в нижнем регистре (hero.png, controller.png, perfectionist.png, pleaser.png, stayer.png), а в коде, вероятно, используются заглавные буквы (Hero.png, Controller.png).
</context>

<task>
1. Найти все упоминания изображений в `app/test/page.tsx` и `app/result/page.tsx` (и других файлах, если нужно).
2. Исправить все пути так, чтобы они:
   - Строго соответствовали нижнему регистру (например, `/hero.png`, `/controller.png`).
   - Обязательно начинались со слеша `/`.
3. Закоммитить эти изменения (commit: "fix: update image paths to lowercase for Vercel") и сделать `git push origin main`.
4. Перенести этот файл в tasks/done/.
</task>

<rules>
- Исполнитель: Claude Code.
- Выполнить git push самостоятельно, чтобы Vercel сразу начал пересборку.
</rules>