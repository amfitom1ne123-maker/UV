# backend/tg_bot.py
import os, asyncio
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message
import httpx

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_CALLBACK = os.getenv("API_CALLBACK", "http://localhost:8000/admin/auth/telegram/callback")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

@dp.message(F.text.regexp(r"^/start\s+(.+)"))
async def start_with_nonce(msg: Message):
    nonce = msg.text.split(maxsplit=1)[1]
    # Отправляем callback на бэкенд
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(API_CALLBACK, json={
            "nonce": nonce,
            "tg_id": msg.from_user.id,
            "tg_username": msg.from_user.username or ""
        })
    if r.status_code == 200:
        await msg.answer("✅ Подтверждено. Вернись в браузер — вход завершится автоматически.")
    else:
        await msg.answer("❌ Не удалось подтвердить. Нонc недействителен или у вас нет доступа.")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
