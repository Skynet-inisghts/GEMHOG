"""The GEMHOG Telegram bot.

A thin shell over `gemhog serve` (127.0.0.1): zero grading logic lives here.
Needs TELEGRAM_BOT_TOKEN in the environment; everything else has defaults.

    cd bot && pip install -r requirements.txt && python main.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timezone

from aiogram import Bot, Dispatcher, F
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

import api
import format as fmt
import store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("gemhog-bot")

SITE_BASE = os.environ.get("GEMHOG_SITE_URL") or None
WATCH_INTERVAL_SEC = 15 * 60
ALERT_POLL_SEC = 60
ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")

dp = Dispatcher()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dp.message(Command("start", "help"))
async def cmd_help(message: Message) -> None:
    await message.answer(fmt.HELP)


@dp.message(Command("check"))
async def cmd_check(message: Message, command: CommandObject) -> None:
    token = (command.args or "").strip()
    if not ADDRESS.match(token):
        await message.answer("usage: /check 0x… (a pons token contract address)")
        return
    note = await message.answer("reading the chain; a young token takes seconds, an old one up to a minute…")
    try:
        report = await api.check(token)
    except api.ServeError as error:
        await note.edit_text(f"error: {error}")
        return
    await note.edit_text(fmt.format_check(report, SITE_BASE), disable_web_page_preview=True)


@dp.message(Command("top"))
async def cmd_top(message: Message) -> None:
    try:
        result = await api.top()
    except api.ServeError as error:
        await message.answer(f"error: {error}")
        return
    await message.answer(fmt.format_top(result))


@dp.message(Command("watch"))
async def cmd_watch(message: Message, command: CommandObject) -> None:
    token = (command.args or "").strip()
    if not ADDRESS.match(token):
        await message.answer("usage: /watch 0x… (a pons token contract address)")
        return
    try:
        report = await api.check(token)
    except api.ServeError as error:
        await message.answer(f"error: {error}")
        return
    store.add_watch(message.chat.id, token, report.get("symbol", "?"))
    store.update_watch(message.chat.id, token, report["grade"], report.get("score", 0), report["color"]["devSells"] if "color" in report else 0)
    await message.answer(
        f"watching ${report.get('symbol', '?')} · re-graded every 15 minutes, you get a message on any change. /unwatch stops all."
    )


@dp.message(Command("unwatch"))
async def cmd_unwatch(message: Message) -> None:
    removed = store.remove_watches(message.chat.id)
    await message.answer(f"stopped watching {removed} token{'s' if removed != 1 else ''}.")


@dp.message(Command("alerts"))
async def cmd_alerts(message: Message, command: CommandObject) -> None:
    arg = (command.args or "").strip().lower()
    if arg == "on":
        store.set_alerts(message.chat.id, True, now_iso())
        await message.answer("alerts on: VS1 or better from the hunt lands here. needs gemhog hunt --follow running next to serve.")
    elif arg == "off":
        store.set_alerts(message.chat.id, False, now_iso())
        await message.answer("alerts off.")
    else:
        await message.answer("usage: /alerts on|off")


@dp.message(F.text.regexp(r"^0x[0-9a-fA-F]{40}$"))
async def bare_address(message: Message) -> None:
    """A pasted contract address means /check."""
    note = await message.answer("reading the chain…")
    try:
        report = await api.check(message.text.strip())
    except api.ServeError as error:
        await note.edit_text(f"error: {error}")
        return
    await note.edit_text(fmt.format_check(report, SITE_BASE), disable_web_page_preview=True)


async def watch_loop(bot: Bot) -> None:
    while True:
        await asyncio.sleep(WATCH_INTERVAL_SEC)
        for row in store.list_watches():
            try:
                report = await api.check(row["token"])
            except api.ServeError:
                continue
            before = {
                "grade": row["last_grade"] or report["grade"],
                "score": row["last_score"] if row["last_score"] is not None else report["score"],
                "color": {"devSells": row["last_dev_sells"] or 0},
            }
            change = fmt.format_watch_change(row["symbol"], before, report)
            store.update_watch(row["chat_id"], row["token"], report["grade"], report.get("score", 0), report["color"]["devSells"])
            if change:
                try:
                    await bot.send_message(row["chat_id"], change)
                except Exception:  # noqa: BLE001 - a blocked chat must not kill the loop
                    log.warning("could not message chat %s", row["chat_id"])


async def alert_loop(bot: Bot) -> None:
    while True:
        await asyncio.sleep(ALERT_POLL_SEC)
        subscribers = store.alert_subscribers()
        if not subscribers:
            continue
        for sub in subscribers:
            try:
                fresh = await api.alerts(sub["since"])
            except api.ServeError:
                break
            for alert in fresh:
                if store.mark_alert_sent(sub["chat_id"], alert["token"]):
                    try:
                        await bot.send_message(sub["chat_id"], fmt.format_alert(alert))
                    except Exception:  # noqa: BLE001
                        log.warning("could not alert chat %s", sub["chat_id"])


async def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set; the bot cannot start without it")
    try:
        await api.health()
    except api.ServeError as error:
        log.warning("serve is not up yet (%s); start gemhog serve, the bot will keep trying", error)
    bot = Bot(token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    asyncio.create_task(watch_loop(bot))
    asyncio.create_task(alert_loop(bot))
    log.info("gemhog bot polling")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
