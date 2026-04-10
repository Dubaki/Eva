📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Критический баг: Блокировка входа (Hard Gate) работает, но статус `is_subscribed` в БД не обновляется при нажатии кнопки подтверждения в боте. Пользователи застревают на экране "Доступ закрыт". 
</context>

<task>
1. **Найти обработчик кнопки "✅ Я подписалась":** Файл `lib/telegram-bot.ts` или аналогичный.
2. **Внедрить принудительный апдейт:** Сразу после успешной проверки `getChatMember` (статусы 'member', 'creator', 'administrator'), добавить блок:
   ```typescript
   console.log('[BOT Auth] User confirmed subscription. TG_ID:', ctx.from.id);
   
   const { data, error } = await supabaseAdmin
     .from('profiles')
     .update({ is_subscribed: true, subscribed_at: new Date().toISOString() })
     .eq('tg_id', ctx.from.id)
     .select();

   if (error) {
     console.error('[BOT Auth] DB Update Error:', error);
   } else {
     console.log('[BOT Auth] DB Update Success. Result:', data);
   }