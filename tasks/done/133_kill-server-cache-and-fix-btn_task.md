<context>
Анализ сетевых запросов показал, что клиентский cache-busting работает, но API-роут `app/api/admin/stats/route.ts` возвращает старые данные. Проблема в серверном кэшировании Next.js. Также кнопка обновления скрывается на вкладке CRM.
</context>

<task>
1. Открыть файл бэкенда `app/api/admin/stats/route.ts`.
2. В самом начале файла (сразу после импортов) добавить две строки:
   `export const dynamic = 'force-dynamic';`
   `export const revalidate = 0;`
   Это заставит Next.js всегда выполнять запрос к Supabase и никогда не кэшировать результат.
3. Открыть файл фронтенда `app/admin/page.tsx`.
4. Найти блок с рендером кнопки обновления (примерно 376 строка): `{activeTab === 'stats' && ( <motion.button ... onClick={refreshStats} > 🔄 </motion.button> )}`.
5. УДАЛИТЬ условие `{activeTab === 'stats' && ...}`, оставив только саму кнопку `<motion.button>...</motion.button>`. Кнопка должна отображаться всегда, на любой вкладке.
6. Перенести этот файл в `tasks/done/` после выполнения.
</task>

<rules>
- Строго добавить `force-dynamic` в роут, это критически важно для App Router.
- Исполнитель: Claude Code.
</rules>