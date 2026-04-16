<context>
КРИТИЧЕСКАЯ ОШИБКА №5: На мобильных устройствах приложение выдает "Missing or invalid authorization". 
ПРИЧИНА: После изоляции window для SSR, `localStorage.getItem('eva_token')` часто возвращает null при первом входе, а API `/api/test/submit` жестко требует JWT.

ЗАВИСИМОСТИ: 150
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: `app/api/test/submit/route.ts`, `app/test/page.tsx`
ТИП: hotfix
</context>

<task>
1. **Рефакторинг авторизации (Backend - route.ts):**
   - Изменить логику проверки в POST `/api/test/submit`.
   - Если заголовок Authorization отсутствует или невалиден, скрипт НЕ ДОЛЖЕН сразу возвращать 401.
   - Скрипт должен попытаться взять `tgId` из тела запроса (body).
   - Если `tgId` предоставлен, найти профиль в БД через `supabaseAdmin.from('profiles').select('id').eq('tg_id', tgId)`.
   - Если профиль найден — считать запрос авторизованным и продолжать сохранение.
2. **Верификация:**
   - Убедиться, что при отсутствии токена в localStorage на фронтенде, запрос на сохранение всё равно проходит успешно через fallback по `tgId`.
## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** _Gemini CLI_
**Файлы изменены:** `app/api/test/submit/route.ts`, `app/test/page.tsx`
**Примечание:** Требуемый функционал был реализован в рамках задачи 150 (умный фоллбэк авторизации через tgId и защита стейта).