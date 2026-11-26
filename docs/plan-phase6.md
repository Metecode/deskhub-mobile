# Phase 6 plan (approved)

Goal: a morning bulletin that the user's own ChatGPT subscription writes, shown on the phone and read aloud
with the day's weather, first event and reminder; weekly reminders such as a Monday weight and waist
measurement, with a chart. The companion stays unmodified: all of this is the bridge's and the web app's own.

Mock-ups with made-up data: [first open of the day](mockups/bulletin-morning.png),
[the bulletin while it is read aloud](mockups/bulletin-reading.png), [a table](mockups/bulletin-table.png).
The numbers are placeholders, and a picture isn't pixel-exact. The icons are the app's own (Material Icons,
Claude's logo); the bulletin's tab gets `article` from the same font. Not drawn yet: the weather and event
line on *Günaydın*, the measurement chart, the running state.

## Why

The user has a ChatGPT scheduled task that writes an investment bulletin every morning, and a reminder to
measure on Mondays. ChatGPT's tasks can't be read from outside: there is no API for them, and the e-mail they
send only says that a task is done. Codex CLI, however, signs in with the same ChatGPT plan, so the bridge can
run the same prompt itself.

**No API keys and no credits.** Codex runs with `auth_mode: chatgpt`; the bridge refuses to run it when
`OPENAI_API_KEY` is set, so that a run is never billed by the token by mistake. Text-to-speech is the phone's
own (Web Speech API), free and offline. The spreadsheet's service account is free and needs no billing.

## Where things are

| What | Where | In git |
| --- | --- | --- |
| The prompt | `bulletin.prompt.md` next to `.env` (`BULLETIN_PROMPT_FILE`) | No; `bulletin.prompt.example.md` is, made up |
| Reminders | `reminders.json` next to `.env` | No; `reminders.example.json` is |
| Service account key | `google-service-account.json` next to `.env` (`SHEETS_KEY_FILE`) | No |
| Bulletins, sheet exports, measurements | `%LOCALAPPDATA%\deskhub-mobile\data\` (next to `bridge.log`) | No |

`.gitignore` gets the three file names. The bridge's log shows Codex's exit code and duration, never the
prompt, the sheet or the bulletin.

## The bulletin

### Writing it (bridge)

- **Once a day, when Desk Hub is first opened that day**, as the user asked: whichever comes first, the bridge
  starting (it starts when the user signs in to Windows) or a phone connecting, from `BULLETIN_FROM` on
  (default `06:00`, local time; a night session before it doesn't make the day's bulletin from the day
  before's news). The user wakes around 8; Codex needs about 2 minutes, so *Günaydın* shows "Hazırlanıyor"
  that long. One retry after 10 minutes if a run fails; after that the phone shows the error and a
  "Try again" button (`bridge.bulletin.run`).
- No prompt file, no bulletin: the tab isn't shown.
- How Codex runs, verified on this PC (codex-cli 0.171, tried on 26 Nov: 2 minutes, about 1,000 words):

  ```
  codex --search --disable shell_tool --disable apps exec --ephemeral --skip-git-repo-check -s read-only -o <file> -
  ```

  - The prompt goes in on stdin; `spawn` with an argument list, no shell. The working folder is an empty one
    under `data\`.
  - `--search`: web search, the one tool it has.
  - `--disable shell_tool`, `-s read-only`: no commands and no files written. A web page could try to steer
    it.
  - `--disable apps`: no ChatGPT connectors (Drive, Gmail, ...). Web search and the user's private data are
    never open in the same run, so a page can't make it read something private and send it out in a search.
    The only private data it sees is the sheet's export, which the bridge puts into the prompt itself.
  - On 26 Nov, `codex --disable apps --disable shell_tool features list` showed both off. The bridge runs
    that same check before every run and refuses to run Codex if either is still on (the features' names
    may change between Codex versions).
- Where Codex is: `CODEX_PATH`, else `codex` on the `PATH`, else the newest
  `%USERPROFILE%\.vscode\extensions\openai.chatgpt-*\bin\windows-x86_64\codex.exe` (the VS Code extension's
  copy, whose folder changes with every update). Not found, or not signed in (`codex login status`): the
  phone says so, in Turkish, with what to do.
- **What the bridge adds to the user's prompt**, at its end, as a block of its own:
  1. The sheet's export as CSV, between clear markers, with the time it was read. Without one: "the sheet
     couldn't be read", so the prompt's own fallback list applies.
  2. "Don't calculate the portfolio table or profit and loss; the bridge does. Write the comment only, and
     don't quote amounts of the portfolio."
  3. "End with a `## Kaynaklar` section (every link that was used, with its date) and then a fenced
     `prices` block": JSON lines of `{ "ticker", "price", "previous_close", "currency", "kind": "close" |
     "premarket" | "afterhours" | "spot" | "futures", "at": ISO time, "source": URL }`, one per holding and
     watched symbol, plus `USDTRY` and `XAU_GRAM_TRY` (gram gold, with its kind of price).
- Kept as `data\bulletin\YYYY-MM-DD.md` with `YYYY-MM-DD.json` (the parsed parts), the last 14 days.
- Mock mode: a made-up bulletin, prices and sheet; no Codex.

### Checking it (bridge)

A bulletin is shown even when a check fails, with a note saying which: what Codex wrote is still worth reading.

- **Sources:** the `## Kaynaklar` section must be there, with `http(s)` links only. Missing: a note
  "Kaynaklar yok".
- **Prices:** the `prices` block is parsed with Zod. A line is kept only if its ticker is a holding, a watched
  symbol or `USDTRY`, its `at` is within the last 4 days (the prompt's own window, weekends and holidays
  included), its `kind` fits the time (a `close` after that day's US close), its source is `http(s)`, and the
  price is above 0. A holding without a kept price is shown as "fiyat doğrulanamadı", never guessed. The
  block itself is not shown on the phone.
- This checks that a price is well formed, fresh and sourced; it can't check that the number is right. The
  phone says where each price comes from.

### The portfolio (bridge, in code)

- From the sheet, not from Codex. Looked at with the user on 26 Nov; the tabs and columns the bridge uses
  (found by their header text, not by position, so that columns can be added; tests on a made-up sheet with
  the same headers):

  | Tab | Columns | Used for |
  | --- | --- | --- |
  | `Pozisyonlar` | `Sembol`, `Adet <date> dahil`, `Maliyet USD` | Quantity and cost (commission included, splits already applied). The date in the quantity's header is how far it goes. Its price, value and K/Z columns are not used: they are from an older day. |
  | `Alımlar` | `Tarih`, `Güncel sembol`, `Adet`, `Toplam maliyet USD`, `Kayıt ID` | Purchases **after** that date, added on top, so nothing counts twice. `Güncel sembol` already maps SPLG to SPYM. |
  | `Ödüller` | `Pay değişimi`, `Hak kazanma tarihi` | The IBKR reward shares: shown, left out of returns. |
  | `Altın Alımları` | `Gram`, `Ayar`, `Toplam maliyet TL` | Gold's grams and TL cost: its value from gram gold, its profit and loss in TL. |
  | `Kontrol` | `Konu`, `Bulgu / yöntem` | Splits are only text here. A split after the quantity's date is a note "bölünme var, adet kontrol edilmeli", never applied by guess. |

  `Özet`, `Gelirler`, `Nakit ve Döviz` and `Belgeler` are not read: dividends and deposits aren't gains, and
  the old cash balance isn't a total (the prompt's own rules). Numbers are Turkish (`1.234,56`).
- A symbol in `Pozisyonlar` that the prompt's list has as watched (VST now) is a position: "Yeni pozisyon",
  with its one-time card, as the prompt asks.
- The day's change needs the day before's close as well, so the `prices` block gets `previous_close`.
- The rules come from the user's prompt and are kept in code: positions are symbols with a purchase; watched
  ones have none and get no profit and loss; a watched symbol with a purchase becomes "Yeni pozisyon"; splits
  and the SPLG → SPYM rename are applied without counting twice; IBKR reward shares are left out of returns;
  no profit and loss for physical gold or BIST without quantity and cost; cost includes commission; no
  TWR/XIRR, and "hesaplanamadı" without cash flows; deposits aren't gains; no TL return without a TL cost.
- Out of it: per holding quantity, cost, value, unrealised profit and loss in $ and %, the day's $ change;
  the totals; the gap to the target mix (US ETF 60 %, US stocks 15 %, gold 25 %). The targets and the
  `SPLG → SPYM` mapping are settings in the prompt file's front matter, not in the code.
- The phone shows this as the *Portföyüm* table, from the numbers, in place of Codex's table if it wrote one.
  *Bir bakışta*'s daily change comes from it too.

### The spreadsheet (bridge)

- A Google Cloud service account with the Sheets API, read-only scope
  (`https://www.googleapis.com/auth/spreadsheets.readonly`). The user shares the sheet with its address as a
  viewer. No billing account is needed.
- The bridge signs a JWT with the key (Node's `crypto`, no Google library), gets a token, and reads the
  sheet's tabs as values (`spreadsheets.values.batchGet`) right before each run. The sheet's ID is
  `SHEETS_ID` in `.env`.
- Failing that (no key, not shared, offline), the bulletin runs without it and says so first, as the prompt
  asks; the portfolio table is left out.
- `docs/setup.md` gets the steps in Turkish and English, with pictures-free text: make the project, turn on the
  Sheets API, make the service account and a JSON key, share the sheet.
- "Anyone with the link can view" is not used: it makes the holdings public to whoever has the link. On
  26 Nov the sheet was shared that way; the user was told to make it *Restricted* again, as the service account
  doesn't need it. Codex's own Google Drive connector isn't used either (see `--disable apps`).

### Showing it (web)

- **Bülten** tab (`article`), only when the bridge has a bulletin set up. It counts as a tab like the others:
  it can be moved (`tabOrder.ts`), swiped to, and is under *All* when the dock is full. A small dot while
  today's bulletin hasn't been opened.
- **Markdown with `react-markdown` and `remark-gfm`.** Raw HTML stays off (no `rehype-raw`); the default
  `urlTransform` keeps unsafe links out, and our `a` allows `http(s)` only and opens a new tab. Our own
  components for `table` (its own sideways scroll frame; a swipe on it doesn't change the page; numbers right,
  a leading `+` green and `−` red), `h2` (anchors for the chips), `p`/`li` (price tags such as
  `[kapanış 25 Kas]` as small grey labels, `Yorum:` in Claude's orange) and `code` (the `prices` block is
  dropped). Both packages go into the web app only; the CSP needs no change.
- At the top, chips for the sections the bulletin has: a press scrolls there.
- Under the title, the notes from the checks, if any.
- **While it is being written:** "Hazırlanıyor · 1 dk 20 sn", counting from `started_at`, with yesterday's
  bulletin below it, dimmed. **Failed:** the error in Turkish and *Tekrar dene*.

### Günaydın (web)

- Once today's bulletin is there, the next time the screen is woken or the app is opened, Home's stage shows
  *Günaydın*, all of the morning in one place:
  - the weather now and today's high and low (from the Weather page's data);
  - the first event of the day (from the calendar), or "Bugün etkinlik yok";
  - today's reminder, if there is one;
  - the bulletin's *Bir bakışta* lines and its concrete step, in orange.
- **Dinle**, **Bülteni aç**, **Kapat**. Closing it is remembered for that day; Home is as before.
- Without a bulletin (none set up, or not ready yet), *Günaydın* still comes with the first three, and the
  bulletin's place says that it is being written.

### Reading it aloud (web)

- `speechSynthesis`. The voices come late on Android, so the app waits for `voiceschanged` (and asks
  `getVoices()` again after it) before it picks one: a `tr-TR` voice, a local one first.
- Chrome speaks only after a touch, so it starts from **Dinle**, or, if turned on in the settings, from the
  first touch of the day that wakes the screen.
- **Dinle on Günaydın** reads the morning as one: "Günaydın. Hava 9 derece, parçalı bulutlu, en yüksek 13.
  İlk etkinlik saat 10'da, Sprint planlama. Bugün kilo ve bel ölçümü günü." and then the bulletin's short part.
- **Short** (default): *Bir bakışta*, the three developments and the concrete step, about 1 to 2 minutes.
  **Tamamı**: everything but the tables, the links, the price tags and the sources.
- Read sentence by sentence (long texts stop half-way in some browsers). The sentence being read is marked
  and kept in view. A bar at the bottom: back, pause, forward, *Tamamı*, close.
- **Speed** in the settings: 0.8×, 1×, 1.2×, 1.5× (`rate`), kept on the phone.
- Before reading, the text is made sayable: `−` as "eksi", `%` before a number, `$` after it, `TSİ`, `K/Z`
  and the like written out. The list lives next to the code, with tests.
- **Diagnostics** show the speech engine: the voice in use (name, language, local or not), how many Turkish
  voices there are, and the speed. Without a Turkish voice the phone says how to add one (Settings, General
  management, Text-to-speech, Google's engine, Turkish).

## Reminders

- Weekly ones from `reminders.json`, for example: Monday, "Kilo ve bel ölçümü", with the fields `kg` and `cm`.
- On its day, the panel shows it under the weather in place of the next event, with **Kaydet** and **Sonra**.
  *Kaydet* asks for the fields with the phone's number keyboard; *Sonra* hides it for 2 hours. Done or the day
  over, it goes.
- Entries are sent as `bridge.reminder.save` and kept by the bridge in `data\measurements.jsonl`.
- **The chart, in this phase:** our own SVG (as `HistoryChart`), one per field: every entry as a point and the
  4-week moving average as a line, the last 6 months. It opens from the reminder card, from the card after
  *Kaydet*, and from *All* as *Ölçümler*. The card itself shows the last entry and the change since the one
  before.
- Commands from phones stay strict: the new `bridge.*` commands are checked field by field, and none of them
  reaches the companion.

## Protocol

| Message | Way | What |
| --- | --- | --- |
| `bridge.bulletin` | bridge → phones | `{ date, state: 'off' \| 'running' \| 'ready' \| 'failed', started_at?, made_at?, markdown?, portfolio?, prices?, sources?, notes?, error? }`; in the snapshot too |
| `bridge.bulletin.run` | phone → bridge | Run it again now (at most once every 10 minutes) |
| `bridge.reminders` | bridge → phones | Today's reminders with their fields and last entry |
| `bridge.measurements` | bridge → phones | A field's entries for the chart, on request |
| `bridge.measurements.get` | phone → bridge | `{ id }` |
| `bridge.reminder.save` | phone → bridge | `{ id, values }`, numbers only, checked against the reminder's fields |

All in `packages/protocol` with Zod schemas, and in `docs/protocol.md`.

## Not in this phase

- Changing the prompt from the phone (it is a file on the PC).
- A paid or cloud voice.
- Checking prices against a second source.
- The ChatGPT task itself: the user may turn it off so that the plan's limit isn't used twice.
- Waking the PC for the bulletin (`autostart.ps1 -WakeForBulletin`): dropped once the bulletin moved to the
  day's first opening. This PC's Modern Standby often ignores wake timers anyway.

## Steps

- [x] Plan approved and written down
- [x] Codex's flags checked on this PC (`--disable apps`, `--disable shell_tool`)
- [x] Protocol: the messages above
- [x] Bridge: finding and running Codex, the schedule, `data\`, what it adds to the prompt
- [ ] Bridge: the sheet (service account, JWT, CSV)
- [x] The sheet's tabs and columns, looked at with the user
- [x] Bridge: the portfolio's numbers, tested on a made-up sheet with the same headers
- [x] Bridge: the price block and the sources, checked
- [ ] Bridge: reminders and measurements
- [ ] Bridge: mock mode
- [ ] Web: Bülten tab (`react-markdown`, `remark-gfm`, our components), running and failed states
- [ ] Web: Günaydın
- [ ] Web: reading aloud, speed, diagnostics
- [ ] Web: reminder card and measurement chart
- [ ] Mock-ups for what isn't drawn yet
- [ ] README, `README.tr.md`, docs/protocol.md, docs/setup.md
- [ ] Verified with the mock and the real Codex
- [ ] Verified on the phone (by the user)
