# CLAUDE.md — правила репо gemhog

Полное ТЗ в `GEMHOG_SPEC.md`. Этот файл — правила, которые действуют на каждую сессию.

## Что это
Gemhog — read-only терминал для pons v2 на Robinhood Chain (chain id 4663). Грейдит токены по тому, держат ли ранние покупатели: cohort retention → скор 0–100 → грейд по шкале чистоты бриллиантов (FL … I3). Один движок, три входа: сайт (Next.js), CLI, Telegram-бот. **Форма продукта и репо — как у https://github.com/insomnia-vip/hop-out.** Если сомневаешься, как оформить README, страницу, док или релиз — открой hop-out и сделай так же.

## Жёсткие ограничения (нарушать нельзя)
- **Никакого подписания.** В репо нет `PRIVATE_KEY`, `privateKeyToAccount`, `signTransaction`, `sendTransaction`, `writeContract`, `walletClient`, `signMessage`. CI-job `no-signer` грепает `lib/ app/ bin/` и валит билд. Holder Check запрашивает у кошелька только `eth_requestAccounts` — адрес, и ничего больше. Это главный сигнал доверия продукта, он важнее любой фичи.
- Только чтение чейна: `eth_call`, `eth_getLogs`, multicall3, Blockscout API, Pons API, DexScreener. Ничего не пишем.
- Демо-данные всегда помечены словом `DEMO` — в CLI, на сайте, в экспорте. Никогда не выдаём синтетику за живой чейн.
- Никаких скрытых ref-ссылок, трекеров, телеметрии. Единственный внешний POST — Telegram-алерт, и только если пользователь сам задал токен.
- Лицензия MIT. Код из bodkin / novamp / hop-out (тоже MIT) сохраняет упоминание источника в шапке файла.

## Стек
- Движок: `lib/gemhog/`, TypeScript, ESM, единственная runtime-зависимость `viem`. Его импортируют и CLI, и API-роуты сайта. Формула грейда существует в одном месте.
- CLI: `bin/gemhog.mjs`, `commander`, собирается `tsconfig.cli.json` как у hop-out.
- Сайт: Next.js App Router, Tailwind, shadcn только для реально используемых компонентов (button, input, card, badge, dialog). Деплой — Vercel.
- Бот: Python 3.11, aiogram 3.x, `bot/`. Бот НЕ реализует логику — он ходит в `gemhog serve` (127.0.0.1) и форматирует ответ.
- Тесты: `node --test`, фикстуры в `test/fixtures/`. Python-тесты бота — `pytest`.
- pnpm, Node ≥ 20 (CI на 22 и 24).
- Ничего из этого не требует API-ключей для базовой работы. Ключи (Blockscout, RPC, Telegram) — опциональные ускорители через `.env`.

## Код
- Читалки чейна в `lib/gemhog/read/`, чистая математика в `lib/gemhog/grade/` (без сети, тестируется на фикстурах), команды в `bin/`.
- RPC — через один gate с ограничением параллелизма и бэкоффом на 429 (из bodkin). Публичный RPC Robinhood метрит `eth_getLogs` отдельно — логи читать чанками по блокам.
- Дорогие чтения (холдеры, фандинг, трансферы) — только для короткого списка, никогда для всего окна лончей. Сначала дешёвый индекс, потом `deepen()` по кандидатам (паттерн novamp).
- Каждая команда: `--format text|json|markdown`, `--output <file>`; экспорт не перезаписывает существующий файл.
- Вывод для людей — моноширинные таблицы, без эмодзи, цвет только на грейде. Каждый ответ печатает provenance: block, observedAt, число RPC-вызовов, источники.
- Картинки для README не рисуются руками: `scripts/render-readme.mjs` делает SVG из реального вывода команд и кладёт рядом JSON-капчу с временем.
- Комментарии объясняют «почему». Коммиты короткие, в нижнем регистре: `grade: weigh the 24h checkpoint double`, `holders: paste-an-address mode`.

## Релизы
Каждый майлстоун из спеки = версия `0.x.0` с датой в `CHANGELOG.md`, git-тег, обновлённый README в затронутой части. Как у hop-out: шесть релизов за два дня видны на GitHub, это часть доверия.

## Язык
Код, README, docs, комментарии, коммиты, вывод CLI и сайта — английский. Общение в сессии — русский.

## Проверка перед коммитом
`pnpm check` (typecheck + lint + test + build) зелёный. `pnpm gemhog doctor` печатает адреса контрактов и параметры pons, снятые с живого чейна, все строки зелёные. Иначе — не коммитить, чинить.

## Чего не делать
- Не добавлять фичи, которых нет в спеке, без вопроса.
- Не писать README «на потом» — README обновляется в той сессии, где появилась команда или страница.
- Не тащить из hop-out их хостинг (`.openai/`, `chatgpt-auth.ts`, vinext, wrangler) и все 70 shadcn-компонентов.
- Не изобретать адреса контрактов. Адреса из `lib/gemhog/chain.ts` (снят с bodkin), `doctor` перепроверяет их через `factory.feeEscrow()`, `memeHook()`, `launchDeployer()`.
- Не выкладывать список `hunt` через публичный API. `GET /api/top` отдаёт только счётчики. Список — только в CLI и в боте владельца.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
