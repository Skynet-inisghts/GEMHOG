# GEMHOG — ТЗ

Read-only терминал для pons v2 на Robinhood Chain. Отвечает на один вопрос: **держат ли этот токен, или его уже сливают?** Считает, сколько ранних покупателей всё ещё в позиции, и выдаёт грейд по шкале чистоты бриллиантов.

**Главный референс — HOP OUT.** Форма продукта, структура репо, README, доки, сайт, Holder Check, ритм релизов — всё берём оттуда и наполняем своим содержанием. bodkin и novamp — только источник кода для чтения чейна.

Правила репо — в `CLAUDE.md`. Здесь — что строить и в каком порядке.

---

## 0. Референсы — прочитать до первой строки кода

### 0.1 HOP OUT — форма продукта (копируем структуру)
- Репо: https://github.com/insomnia-vip/hop-out
- Сайт: https://hopout.xyz — посмотреть `/`, `/terminal`, `/holders`, `/docs`
- Что взять один в один, поменяв содержание:
  - **дерево репо**: `bin/hop-out.mjs` (CLI) · `lib/hopout/` (общий движок, его же импортирует сайт) · `app/` (Next.js: `page.tsx`, `terminal/`, `holders/`, `docs/`, `api/quote|holder|health`) · `assets/readme/` (SVG-снимки реального вывода CLI + JSON-капчи с временем) · `public/` (маскот) · `docs/` · `test/` · `.github/workflows/ci.yml`
  - **README** — скелет из раздела 7 ниже повторяет их README блок в блок
  - **`scripts/render-readme.mjs`** — генерирует SVG-«скриншоты» терминала из настоящего вывода команд; картинки в README не рисуются руками
  - **Holder Check** — `/holders`: injected-кошелёк отдаёт только публичный адрес, никаких подписей; плюс режим «вставь любой публичный адрес» (их v0.6)
  - **OFFLINE DEMO** — на сайте и в CLI, синтетические данные с явной пометкой
  - **docs/**: `ARCHITECTURE.md`, `COMMANDS.md`, `METHODOLOGY.md`, `TESTING.md`, `LAUNCH.md`
  - **CHANGELOG.md** с версиями `0.1.0 → 0.6.0` и датами; `SECURITY.md`, `CONTRIBUTING.md`
  - **API-роуты** сайта с описанием контракта прямо в README
  - тон README: «working tool», границы честно («not a proof that a token is safe»)
- Что НЕ брать: OpenAI Sites / `chatgpt-auth.ts` / vinext / wrangler (это их хостинг), 70 shadcn-компонентов болванкой — ставить только те, что реально используются.

### 0.2 bodkin — код чтения чейна
- https://github.com/Phosphenq/bodkin
- Взять: `src/chain.ts` (chain definition, адреса pons v2, multicall3), `src/abi/pons.ts` (factory / curve / escrow), `src/util/rpcGate.ts` (лимиты публичного RPC, бэкофф на 429), `src/util/fmt.ts`, `src/pons/enrich.ts` (одна multicall-выборка по лончу).

### 0.3 novamp — код чтения когорт и снапшоты
- https://github.com/bored2boar/novamp · сайт https://novamp.observer
- Взять: `src/read/launches.ts` (TokenLaunched чанками по блокам), `src/read/buyers.ts` (ранние покупатели с уплаченным tax), `src/read/holders.ts`, `src/read/funding.ts` (фандинг кошельков на 1 хоп — детектор бандла), `src/indexer/blockscout.ts`, `src/alerts/telegram.ts` (один POST без библиотек), `.github/workflows/snapshot.yml` (крон-снапшот в статику), `ci.yml` (job `no-signer`).

### 0.4 Не референсы
https://github.com/mrbuzzoni/loop-rat и https://github.com/Ridarketh/-real-world-agents — из той же меты, но к чейну не относятся. Не открывать.

### 0.5 Внешние источники (как у hop-out в «Boundaries and sources»)
- Pons Portal API/docs: https://www.ponsportal.fun/docs.html · API base `https://api.ponsportal.fun`
- Контракты pons v2: https://github.com/ponsdotdev/ponsfamily/tree/main/contractsV2
- Robinhood Chain docs: https://docs.robinhood.com/chain/
- Blockscout: https://robinhoodchain.blockscout.com (`/api/v2/tokens/{addr}`, `/api/v2/tokens/{addr}/holders`, `/api/v2/tokens/{addr}/transfers`, `/api/v2/addresses/{addr}/tokens`)
- DexScreener (цена после graduation): https://docs.dexscreener.com/api/reference

### 0.6 Чейн
```
chain id        4663
RPC (logs)      https://rpc.mainnet.chain.robinhood.com     # 429 на бёрсты, метрит eth_getLogs отдельно
RPC (state)     publicnode, см. bodkin .env.example          # быстрый, без eth_getLogs
WS              publicnode free websocket                    # подписка на логи
Multicall3      0xcA11bde05977b3631167028862bE2a173976CA11
```
Адреса pons v2 копировать из `bodkin/src/chain.ts`; `doctor` перепроверяет их через `factory.feeEscrow()`, `memeHook()`, `launchDeployer()`.

События (сигнатуры из novamp):
```
TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)
CurveBuy (address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)
CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)
Transfer (address indexed from, address indexed to, uint256 value)
PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)
```
`tax` в CurveBuy — сколько покупатель отдал на opening tax. ~9900 bps = бот, гнавший первый блок; ~0 = человек, который ждал. Бесплатный детектор людей в когорте.
Escrow `V2FeeEscrow`: события `Credited` / `Claimed` — кто получает creator fees и когда клеймит.

---

## 1. Продукт

Как у hop-out: **сайт — витрина и главный вход, CLI — «то же самое локально плюс то, чего на сайте нет», бот — третий вход в тот же движок.**

| Поверхность | Кому | Что умеет |
|---|---|---|
| **Сайт** `/` `/terminal` `/holders` `/docs` | все | `/terminal`: тикер или CA → сертификат грейда, OFFLINE DEMO, share as image. `/holders`: адрес кошелька → все pons-токены в нём с грейдом, плюс holder-receipt по $GEMHOG. Счётчик «N launches at VS2+ in the last 6h — the list is in the CLI» |
| **CLI `gemhog`** | те, кто склонировал | `check`, `demo`, `doctor`, `holders`, экспорт JSON/Markdown — и **`hunt`**: автопоиск лучших камней за окно. `hunt` есть только здесь |
| **Telegram-бот** | подписчики | `/check`, `/top`, `/watch`, алерты VS1+; обёртка над `gemhog serve` |

---

## 2. Движок: как считается грейд

### 2.1 Входные данные по токену
Из `TokenLaunched` → `token`, `curve`, `deployer`, блок и timestamp. Из factory `getLaunchedToken` → `creatorFeeRecipient`, `phase`. Из curve → резервы, `graduated`, `launchedAt`. Из логов: `CurveBuy`/`CurveSell` за окно, `Transfer` токена (балансы когорты, продажи после graduation), `Credited`/`Claimed` escrow. Из Blockscout → топ-холдеры и их число, когда RPC-путь дорог. Из DexScreener → цена после graduation (для holder-receipt).

### 2.2 Когорта
- **Ранняя когорта** — уникальные `recipient` из `CurveBuy` в первые **60 с** после `launchedAt`. Если меньше 20 — расширить до первых 20 покупателей (не дальше 10 минут).
- **Исключить**: `deployer`, `creatorFeeRecipient`, curve, пул, locker, router, и кошельки, чей первый входящий ETH пришёл от `deployer` (фандинг на 1 хоп, `funding.ts` из novamp) — это бандл.
- **Человеческая когорта** — подмножество с `tax ≤ 1500 bps`. В скор идёт человеческая, если в ней ≥ 10 кошельков, иначе вся; обе печатаются.

### 2.3 Чекпоинты и retention
Чекпоинты от `launchedAt`: **5m, 15m, 1h, 6h, 24h, 7d** — только наступившие.
Для кошелька: `peak` — максимум баланса до чекпоинта, `bal(t)` — баланс на чекпоинт (по `Transfer`, не по `balanceOf` на исторический блок — публичный RPC не архивный).
`held(t)` = доля когорты с `bal(t) ≥ 0.8 · peak`. **Half-life** — первый чекпоинт с `held < 0.5`, иначе `never`.

### 2.4 Четыре компоненты (сумма = 100)

| C | Вес | Что | Формула |
|---|---|---|---|
| **Cut** — удержание | 0–40 | ранние держат? | `40 · Σ w_t·held(t) / Σ w_t`, `w = {5m:1, 15m:1, 1h:2, 6h:2, 24h:3, 7d:3}` |
| **Clarity** — концентрация | 0–20 | размазано или в двух руках | топ-10 без curve/pool/locker: `< 20 %` → 20; `20–30 %` → 20→8 линейно; `> 30 %` → 8→0 к 50 %; −5, если бандл держит > 10 % |
| **Color** — дев | 0–20 | дев в игре или вышел | старт 20; `CurveSell`/`Transfer`-out от deployer или creatorFeeRecipient: −8 первый, −12 второй (пол 0); клейм creator fee в первые 24 ч: −4 за клейм, максимум −8; dev buy > 8 % supply: −6 |
| **Carat** — вес | 0–20 | есть ли кто-то | `min(10, holders/25)` + `min(6, cohortEth/2)` + 4, если топ-3 когорты держат < 35 % её объёма |

Моложе 5 минут — `TOO EARLY` и время до первого чекпоинта; в `hunt` — строка «incubating».

### 2.5 Грейд
```
95–100  FL        90–94  IF        85–89  VVS1      80–84  VVS2
70–79   VS1       60–69  VS2       50–59  SI1       40–49  SI2
25–39   I1        10–24  I2        0–9    I3
```
Цвет: VVS2+ — розовый акцент, VS — белый, SI — серый, I — тусклый. Других цветов нет.

### 2.6 Сертификат `check` (эталон, ровно так)
```
$PEANUT · 0xa0c54ffbe2ea6f151468fd40d4281d807fc2f6b5 · launched 2026-09-11 08:14 UTC · 3h 12m ago

GRADE  VVS1   87 / 100

cut      34/40   early cohort 142 wallets (117 human) · still holding: 5m 96% · 15m 91% · 1h 84% · 6h 79%
                 half-life: not reached
clarity  16/20   top 10 hold 14.2% · no bundle
color    17/20   dev bought 2.1% · dev has not sold · fees credited 0.41 ETH, 0 claims
carat    20/20   611 holders · 3.8 ETH in the early cohort · top 3 of cohort 22%

phase    curve 74% → pool                    source  live · robinhood chain 4663 · 14 rpc calls · 2.9s
```
`--format json` — один объект: `{token, symbol, name, launchedAt, ageSec, grade, score, cut:{score,cohort,human,held:{...},halfLife}, clarity:{...}, color:{...}, carat:{...}, phase, source, observedAt, block, rpcCalls, ms}`. `--format markdown` — тот же сертификат в Markdown. Как у hop-out: экспорт в файл через `--output`, не перезаписывает существующий.

---

## 3. Репо и стек (зеркало hop-out)

```
bin/gemhog.mjs           CLI: check, hunt, watch, top, holders, serve, demo, doctor, export
lib/gemhog/
  chain.ts               chain definition, адреса, multicall (из bodkin)
  abi/                   factory, curve, escrow, erc20
  rpc.ts                 gate: лимиты, бэкофф (из bodkin)
  read/                  launches, buys, transfers, escrow, holders, funding, price
  grade/                 cohort.ts, checkpoints.ts, components.ts, grade.ts — чистые функции, без сети
  resolve.ts             тикер → кластер лончей
  certificate.ts         текст / markdown / json
  project-token.ts       официальный $GEMHOG (TBA до лонча), как у hop-out
  demo.ts                синтетический токен с пометкой DEMO
app/                     Next.js App Router: page.tsx, terminal/, holders/, docs/, api/grade|holder|top|pulse|health
assets/                  арт-пак (дан владельцем) + readme/ (SVG-снимки и JSON-капчи)
public/                  маскот, favicon
docs/                    ARCHITECTURE, COMMANDS, METHODOLOGY, TESTING, LAUNCH, BOT
bot/                     Python, aiogram 3.x
test/                    фикстуры и тесты движка и CLI
scripts/render-readme.mjs
.github/workflows/       ci.yml (typecheck, test, no-signer, bot tests), pulse.yml (крон)
```

- Node ≥ 20, pnpm, TypeScript, ESM. Движок `lib/gemhog/` — один код для CLI и `app/api/*`. Runtime-зависимости движка: `viem`. CLI: `commander`. Сайт: `next`, `react`, `tailwindcss`, минимум shadcn (button, input, card, badge, dialog — и только они).
- Хостинг сайта: **Vercel** (проект Next.js; env: `RPC_URL`, `BLOCKSCOUT_API_KEY` — опционально). Пометить в `docs/ARCHITECTURE.md`, что можно и на Cloudflare, как hop-out.
- Бот: Python 3.11, aiogram 3.x, `httpx`, SQLite; ходит только в `gemhog serve` на 127.0.0.1.

---

## 4. CLI

Все команды: `--format text|json|markdown`, `--output <file>`. Без ключей работает всё.

| Команда | Что |
|---|---|
| `doctor [--probe]` | RPC, chain id 4663, адреса factory/escrow/hook против factory, `snipeTaxStartBps`/`snipeTaxSeconds`, Pons API, Blockscout, DexScreener — с измеренной задержкой, как doctor у hop-out. `--probe` грейдит один известный graduated токен |
| `check <token\|ticker>` | сертификат 2.6. Тикер → Pons API / Blockscout search; несколько лончей → таблица кластера (symbol, age, phase, holders, address) и просьба уточнить CA. Alias `grade` |
| `hunt [--window 6h] [--min-grade VS2] [--top 20] [--follow]` | индекс `TokenLaunched` за окно (дёшево) → фильтр мусора (0 покупателей, dead) → `deepen` только по кандидатам → таблица по убыванию скора. `--follow`: не выходить, догрейдить новые по мере их чекпоинтов, печатать при входе в топ, слать Telegram-алерт при VS1+ (если задан токен). Флагман, только в репо |
| `watch <token>` | каждые 30 с пересчёт, печатать только изменения и смену грейда |
| `top [--window 24h]` | короткий hunt из кэша, без deepen. Для бота |
| `holders <wallet>` | все pons-токены на адресе (Blockscout `/addresses/{addr}/tokens`) с грейдом каждого + holder-receipt по $GEMHOG. То же, что `/holders` на сайте |
| `serve [--port 4664]` | локальный HTTP JSON для бота: `GET /check/:addr`, `GET /top?window=`, `GET /holders/:wallet`, `GET /alerts?since=`, `GET /health`. Только 127.0.0.1 |
| `demo` | `check` и `hunt` на фикстурах, каждая строка вывода помечена `DEMO`, без сети |
| `export` | результат последнего `hunt` в CSV/JSON |

Формат `hunt`:
```
gemhog hunt · window 6h · 1 412 launches · 388 with buyers · 61 graded · robinhood chain 4663

#   GRADE  SCORE  SYMBOL      AGE     COHORT  HELD 1h  DEV    TOP10   HOLDERS  TOKEN
1   VVS1      87  PEANUT      3h12m   142     84%      held   14.2%   611      0xa0c5…f6b5
2   VVS2      82  KETTLE      1h40m    88     81%      held   18.0%   340      0x23ca…8e12
3   VS1       74  NOVA        5h01m   204     71%      sold1  22.5%   902      0x23c8…1dc9
…
incubating (under 5m, no grade yet): 37
```

---

## 5. Сайт (`app/`) — как hopout.xyz, в нашей палитре

Палитра из арт-пака: чёрный фон, розовый `#FF7AC4` акцент (в `globals.css` — `--accent`), серый текст, алмаз `#ECFAFF`/`#78C8F0`. Wordmark — Tiny5 из `assets/fonts`, моно — JetBrains Mono. Раскладка страниц повторяет hopout.xyz, цвет и контент — наши.

**`/` landing.** Баннер-хиро (`assets/banner.png` или тот же состав в вёрстке), одна строка «Grade the hands before the bag.», две кнопки: `Open terminal` и `Holder Check`. Три карточки: Terminal / Holder Check / CLI (`git clone … && pnpm hunt`). Блок pulse: «**N** launches graded VS2 or better in the last 6 hours. The list lives in the CLI.» Внизу — `$GEMHOG` + CA с копированием и ссылками Pons / Blockscout (до лонча — `TBA`, поле в `lib/gemhog/project-token.ts`).

**`/terminal`.** Поле CA или тикер → `POST /api/grade` → сертификат 2.6 в моно-блоке, нюхающая свинья слева, грейд крупно. Тикер с несколькими лончами → список кластера, клик по строке. Кнопка **OFFLINE DEMO** — синтетический сертификат с плашкой `DEMO`. Кнопка **share as image** — canvas 1200×675 → PNG. Внизу provenance: block, время наблюдения, число RPC-вызовов, источники — как receipt у hop-out.

**`/holders`.** Два входа, как у hop-out v0.6: **Connect** (injected EVM wallet, `eth_requestAccounts`, берём только адрес; ни подписей, ни switch chain, ни approve — и это написано прямо на странице) и **Paste a public address**. Результат: таблица pons-токенов на адресе, каждый с грейдом и долей от supply, сверху — holder-receipt по $GEMHOG: баланс, грейд комьюнити, ваша доля в ранней когорте (если вы в ней). Кнопка «View example receipt» — синтетика с пометкой.

**`/docs`.** Рендер `docs/*.md`.

**API** (описать в README как у hop-out):
- `POST /api/grade` `{ token }` или `{ ticker }` → сертификат JSON или `{ cluster: [...] }`
- `POST /api/holder` `{ wallet }` → holder-receipt + токены с грейдами
- `GET /api/top?window=6h` → **только** `{ graded, byGrade: {...}, vs2plus: N }` — списка нет, список в CLI
- `GET /api/pulse` → то же из `assets/pulse.json` (пишет `pulse.yml` раз в 20 мин)
- `GET /api/health` → RPC / Pons / Blockscout / DexScreener с задержками
Серверные роуты держат in-memory кэш 60 с на токен, чтобы браузеры не били RPC.

Никаких подписей нигде. CI-job `no-signer` грепает и `lib/`, и `app/`.

---

## 6. Telegram-бот (`bot/`)

Python 3.11, aiogram 3.x, `httpx`, SQLite `bot/state.db`. Ходит в `http://127.0.0.1:4664` (`gemhog serve`). В README — `docker-compose.yml` с двумя сервисами.
- `/check <ca>` → сертификат в `<pre>`, грейд жирным, ссылки Blockscout и `/terminal?token=`.
- `/top` → 10 строк из `GET /top?window=6h` (тут список есть — бот владельца, это не публичный API).
- `/watch <ca>` / `/unwatch` → перегрейд раз в 15 мин, сообщение при смене грейда.
- `/alerts on|off` → алерты VS1+ из `hunt --follow` через `GET /alerts?since=`.
- `/start`, `/help`. Английский, без эмодзи, кроме одного алмаза перед VVS2+.

---

## 7. README — блок в блок как у hop-out

```
<p align=center> assets/avatar-sniffer.png (128px) </p>
<p align=center> assets/banner.png </p>
бейджи: CI status (badge из Actions) · Node 22.13+ · Robinhood_Chain-4663 · signing-none · license-MIT   (flat-square, labelColor #0a0a0a, цвет #FF7AC4)
<p align=center><strong>Grade the hands before the bag.</strong><br/>A browser and local CLI for grading holder retention of Pons V2 tokens on Robinhood Chain.</p>
<p align=center> Website · Terminal · Docs · X / Twitter </p>
<p align=center> Start locally · Holder Check · Live grading · Commands · Methodology · Architecture </p>

## Why GEMHOG
   два абзаца: кошелёк показывает цену, а не то, держат ли; 25 000 лончей в день, «community» в описании ничего не значит.
   GEMHOG берёт токен, находит покупателей первой минуты и смотрит, кто из них ещё здесь на 5m / 15m / 1h / 6h / 24h / 7d.
   The pig is the meme; the certificate is the product.

### Read the hands, not the post
   ![certificate snapshot](assets/readme/certificate-snapshot.svg)   ← из реального check, время капчи внутри картинки
   «A styled documentation view of an actual CLI result… historical, not a current grade.» [Full captured data →](assets/readme/certificate-snapshot.json)

## Available in the current source
   таблица Surface | What works: Browser terminal · Holder Check · Local CLI · Offline walkthrough · Exports · Grade engine · Verification

Official `$GEMHOG` contract: [`CA`](blockscout) · [View on Pons](pons)        ← TBA до лонча

### Holder Check      (абзац как у них: только публичный адрес, никаких подписей; «View example receipt» — синтетика)

## Start in one minute
   git clone · pnpm install --frozen-lockfile · pnpm demo
   pnpm dev → localhost:3000, /terminal, /holders

### Same token. Six checkpoints.
   ![terminal-desk.svg] — «documentation artwork» из данных demo: 24 строки синтетических когорт, retention по чекпоинтам

## Live grading
   pnpm gemhog check --token 0x…        (реальный graduated токен, «supported example, not the GEMHOG contract»)
   pnpm gemhog check --ticker PEANUT
   pnpm gemhog holders --wallet <PUBLIC_WALLET>
   pnpm gemhog hunt --window 6h         ← «lives only in the CLI»

### Check the sources
   ![doctor.svg] + doctor-snapshot.json

## Receipts that travel
   --format json --output · --format markdown --output ; «Exports refuse to overwrite existing files.»

## How it works
   mermaid flowchart: Token → TokenLaunched → early cohort (CurveBuy, tax filter) → Transfer-based balances at checkpoints → Cut/Clarity/Color/Carat → Grade → Browser / CLI / JSON / Markdown
   два абзаца текста + ссылка на docs/METHODOLOGY.md

## Project map      (дерево из раздела 3)

## API and development      (контракт роутов из раздела 5; `pnpm check`; ссылки testing / contributing / changelog / security)

## Boundaries and sources
   «GEMHOG holds no keys and has no transaction path. Holder Check requests only a public EVM address. A grade is a measurement of past holder behaviour, not a prediction and not a proof that a token is safe.»
   Built against Pons Portal data, Pons V2 contracts, Robinhood Chain, Blockscout, DexScreener. Independent of these services. MIT.
```

`scripts/render-readme.mjs` делает `certificate-snapshot.svg`, `terminal-desk.svg`, `doctor.svg`, `json-export.svg` из живого вывода команд и кладёт рядом JSON-капчу с `observedAt`. В `assets/readme/README.md` — как обновить.

---

## 8. Тесты и CI

- `test/fixtures/`: три токена как JSON-снимки логов и холдеров — VVS1, SI2, I2 (дев-слив) — и кластер из трёх лончей под одним тикером.
- `test/grade.test.mjs` — компоненты и грейд на фикстурах; границы: когорта < 20, токен моложе 5 мин, дев не покупал, retention ровно 0.5.
- `test/cohort.test.mjs` — исключение деплоера/бандла, человеческая когорта по tax.
- `test/resolve.test.mjs`, `test/cli.test.mjs` (как у hop-out: команды, форматы, отказ перезаписи), `test/serve.test.mjs`.
- `bot/tests/` — форматирование на замоканном serve.
- `ci.yml`: Node 22 и 24 (как у них), `pnpm check` = typecheck + lint + test + build; job **`no-signer`**: grep по `lib/ app/ bin/` на `PRIVATE_KEY|privateKeyToAccount|signTransaction|sendTransaction|writeContract|walletClient|signMessage` → exit 1; job python tests.
- `pulse.yml`: cron `*/20 * * * *`, пишет `assets/pulse.json` (только счётчики и распределение грейдов, без адресов), коммит от `github-actions[bot]` только при изменении.

---

## 9. Порядок работы — майлстоуны = релизы

Каждый майлстоун — отдельная сессия Claude Code, заканчивается зелёным `pnpm check`, записью в `CHANGELOG.md` с версией и датой, git-тегом и обновлённым README в затронутой части. У hop-out шесть версий за два дня видны на GitHub — это часть доверия, повторяем.

**M0 · v0.1.0 — каркас.** pnpm-проект, `lib/gemhog/chain.ts` + `abi/` + `rpc.ts` (из bodkin, с атрибуцией), `bin/gemhog.mjs` с `doctor` и `demo` (demo — заглушка с пометкой), Next.js `app/` с landing по разделу 5 на арт-паке, `/terminal` и `/holders` как страницы-заглушки с текстом «coming in 0.2», `api/health`. CI с `no-signer`. README: шапка, бейджи, Why, Start in one minute.
*Готово:* `pnpm gemhog doctor` на живом чейне зелёный; `pnpm dev` показывает landing.

**M1 · v0.2.0 — движок и `check`.** `lib/gemhog/read/`, `grade/`, `resolve.ts`, `certificate.ts`, фикстуры и тесты, `check` с тикером и кластером, `POST /api/grade`, страница `/terminal` целиком с OFFLINE DEMO и share as image. `docs/METHODOLOGY.md`. `scripts/render-readme.mjs` → `certificate-snapshot.svg`.
*Готово:* `check` на трёх реальных токенах (graduated, на кривой, мёртвый) совпадает с ручной проверкой на Blockscout по холдерам и продажам дева; `/terminal` по CA даёт тот же JSON, что CLI.

**M2 · v0.3.0 — Holder Check.** `holders` в CLI, `POST /api/holder`, страница `/holders` с connect и paste-режимом, holder-receipt по $GEMHOG (`project-token.ts` с `TBA`), «View example receipt».
*Готово:* по любому публичному адресу с pons-токенами страница показывает их грейды; коннект кошелька не вызывает ничего, кроме `eth_requestAccounts` (проверить в devtools).

**M3 · v0.4.0 — `hunt`.** Индекс лончей за окно, фильтр, `deepen`, таблица, `--follow`, Telegram-алерт, `watch`, `top`, `export`, `GET /api/top` (счётчики) и `pulse.yml` + блок pulse на landing. `terminal-desk.svg`, `doctor.svg`.
*Готово:* `hunt --window 6h` на публичном RPC без 429-падений и в пределах 90 с; `--follow` живёт час.

**M4 · v0.5.0 — `serve` и бот.** HTTP-контракт, `bot/` на aiogram, SQLite, docker-compose, `docs/BOT.md`.
*Готово:* `/check`, `/top`, `/watch`, `/alerts` против живого `serve`; в боте нет ни строки логики грейда.

**M5 · v0.6.0 — полировка и launch kit.** README целиком по разделу 7, все `docs/`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/LAUNCH.md` (что и где постить, куда вписать CA), бейдж tests с реальным числом, `demo` на настоящих фикстурах, финальный `doctor --probe`, деплой на Vercel.

---

## 10. Что даёт владелец, и когда
- Сейчас: этот файл, `CLAUDE.md`, арт-пак в `assets/`.
- К M2: адрес любого своего кошелька с pons-токенами для проверки `/holders`.
- К M3: `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` для алертов (в `.env`, не в репо).
- К M4: токен второго, публичного бота.
- К M5: имя GitHub-репо, домен, аккаунт Vercel.
- После лонча: тикер и CA — `lib/gemhog/project-token.ts` и README.
- Опционально, если публичный RPC душит `hunt`: Blockscout API key (бесплатно на dev.blockscout.com) или свой RPC в `RPC_URL`.
