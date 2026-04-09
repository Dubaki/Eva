📋 Прочитай docs/BOOT.md.

<context>
Необходимо заменить стандартный браузерный `window.confirm` на нативный UI Telegram, так как браузерный алерт показывает системную информацию домена, что портит UX.
</context>

<task>
**ЧАСТЬ 1: Замена Confirm на нативный Telegram Popup**
1. В компоненте Этапа 3 (где задается вопрос "Удивил ли тебя результат?"):
   - Найти обработчик клика на кнопки "Да" и "Нет", где сейчас используется `window.confirm`.
   - Заменить `window.confirm` на использование `window.Telegram.WebApp.showPopup`.
   - Параметры для showPopup:
     `title: "Уверена?"`
     `message: "Ты не сможешь изменить свой ответ."`
     `buttons: [{id: "yes", type: "default", text: "Да"}, {type: "cancel", text: "Отмена"}]`
   - В callback-функции `showPopup` проверять: если `buttonId === "yes"`, то продолжать логику (показывать скрытый текст и кнопку "Далее").

**ЧАСТЬ 2: Fallback (на случай если showPopup недоступен)**
2. Так как пользователи могут тестировать приложение в десктоп-браузере, где объекта Telegram нет, добавить проверку:
   `if (window.Telegram?.WebApp?.showPopup) { ... } else { const isOk = window.confirm("Уверена?"); if(isOk) { ... } }`

3. Перенести в done/.
</task>

<rules>
- Исполнитель: Qwen Code.
</rules>