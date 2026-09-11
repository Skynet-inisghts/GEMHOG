# Промпт для Claude Code — share-карточки

Перед запуском положи папку `gemhog-cards/` из архива в репо как `assets/cards/` (там: `render_cards.py`, `pig-red.png`, `pig-yellow.png`, `pig-green.png`, `card-*.png` как образцы, `fonts/`).

Дальше вставляй в Claude Code целиком:

---

Добавляем share-карточки в терминал. Прочитай `assets/cards/render_cards.py` целиком — это эталон раскладки и палитр, его надо перенести в TypeScript один в один, не переизобретая. Образцы результата — `assets/cards/card-red.png`, `card-yellow.png`, `card-green.png`.

## Что это
Квадратная картинка 1080×1080 по результату `check`, три варианта по скору:
- 1–35 — красная, свинья `pig-red.png`
- 36–70 — жёлтая, `pig-yellow.png`
- 71–100 — зелёная, `pig-green.png`

Раскладка (все координаты и размеры — в `card()` внутри `render_cards.py`): сверху слева лого токена в круге с обводкой цвета зоны + `$ТИКЕР` (`$` — JetBrains Mono Bold цветом зоны, тикер — Tiny5 белым, ужимается шагом 8px, если длинный), справа скор Unbounded Black цветом зоны, слева от него `/100` серым, под скором грейд Tiny5; ниже полоса 1–100 с тремя зонами и маркером; три строки описания JetBrains Mono; снизу справа свинья 432px со свечением цвета зоны; снизу слева `GEMHOG` (Tiny5, цвет зоны) + `Terminal` (моно серым) и строка `graded <UTC> · gemhog.xyz`. Фон чёрный с едва заметным цветным пятном за свиньёй. Спрайты свиней не перерисовывать — брать PNG из `assets/cards/`.

## Где это живёт
1. **`lib/gemhog/card.ts`** — чистая функция `renderCard(cert: Certificate, opts: { logo?: Buffer }): Promise<Buffer>` на `@napi-rs/canvas` (без нативной сборки, работает на Vercel). Шрифты регистрировать из `assets/fonts/` + `assets/cards/fonts/`. Строки описания собираются функцией `cardLines(cert)` по правилам:
   - строка 1: `early cohort N wallets · X% still holding at <последний наступивший чекпоинт>`
   - строка 2: дев — `dev has not sold · K fee claims` / `dev bought P% and sold M times` / `dev did not buy`
   - строка 3: `top 10 hold T% · H holders` и, если есть бандл, `· bundle holds B%`
   Каждая строка ≤ 52 символа, лишнее режется по слову.
2. **`app/api/card/route.ts`** — `GET /api/card?token=0x…` → `image/png`, `Cache-Control: public, max-age=60`. Внутри — тот же `grade()`, что у `/api/grade`, плюс лого токена: URL картинки из Pons API по адресу токена, скачать на сервере, скруглить в круг; если нет — серый круг с первой буквой тикера, как в эталоне. Никаких новых источников данных.
3. **`/terminal`** — под сертификатом показывать карточку как `<img src="/api/card?token=…">` (ленивая загрузка, скелетон на время генерации). Кнопка **Share as image** теперь скачивает именно эту карточку (`gemhog-<TICKER>-<score>.png`), а не скриншот сертификата. Рядом — **Copy link** на `/terminal?token=…`.
4. **OG-превью**: у `/terminal?token=…` в `generateMetadata` ставить `og:image` и `twitter:image` на `/api/card?token=…`, `twitter:card = summary_large_image`, чтобы ссылка в X разворачивалась в карточку.
5. **CLI**: `gemhog check <token> --card out.png` пишет ту же картинку локально; отказывается перезаписывать существующий файл, как остальные экспорты.
6. **Бот**: `/check <ca>` отвечает карточкой (`sendPhoto`) с подписью в одну строку `$TICKER · GRADE score/100`, сертификат текстом — вторым сообщением в `<pre>`. Бот получает картинку через `GET /card/:addr` у `gemhog serve` — добавь этот роут, он возвращает PNG.

## Ограничения
- Все правила `CLAUDE.md` действуют: read-only, никакого подписания, шрифты локально, никаких внешних CDN.
- Карточка для токена моложе 5 минут не генерируется — `/api/card` отвечает 425 с JSON `{ "tooEarly": true }`, на странице вместо неё текст «card unlocks at 5m».
- `DEMO`-сертификат даёт карточку с плашкой `DEMO` поверх свиньи, как у всего остального демо.

## Тесты и приёмка
- `test/card.test.mjs`: `band()` на границах 35/36/70/71 и вне диапазона; `cardLines()` на трёх фикстурах; длинный тикер (`PEANUTBUTTER`) не пересекает `/100`; рендер трёх фикстур в `assets/readme/cards/` и сравнение размеров/непустоты.
- Прогони на трёх реальных токенах — по одному в каждой зоне — и покажи мне картинки.
- `CHANGELOG.md`: новая минорная версия, `README.md`: раздел `## Share cards` с тремя картинками из `assets/readme/cards/` и командой `--card`. `docs/COMMANDS.md` — флаг `--card`, `docs/ARCHITECTURE.md` — `card.ts` и роут.

Начни с `lib/gemhog/card.ts` и трёх фикстурных картинок, покажи их, и только потом подключай страницу, OG, CLI и бота.
