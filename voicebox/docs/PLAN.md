# Voicebox: Step-by-Step Plan

**Goal.** A push-to-talk assistant of your own. Hold a button on your phone, or on a
pocket-sized handheld you build, ask a question out loud, and hear the answer in a voice you
choose, a few seconds later. It answers from the model's general knowledge plus anything you
have taught it: notes you dictate, notes you type, and documents you drop in a folder. All
of it runs on your own computer. No cloud AI service is involved.

**What Voicebox is not.** Voicebox is a separate, general-purpose project. It has no built-in
subject and no connection to RINN, regulatory affairs, or medical devices. It borrows *engine
code* from the sibling `rinn-ollama` folder (the Ollama wrapper, the sentence splitter, the
audio helpers, and the `rinn-voice-server` speech program) because that code is generic.
None of RINN's persona, prompts, or documents are used; the one shared program with a RINN
default, the speech server's vocabulary hint for Whisper, is switched off for Voicebox with
`--stt-prompt ""` in Step 0. Voicebox's personality is a text file you write (`persona.md`),
and what it knows is a folder you fill (`knowledge/`).

**Who this is for.** You, or any other AI agent or helper working at your PC without Claude.
Every step says what to open, click, type, and what you should see. When a step's
*Checkpoint* fails, stop and use the *Troubleshooting* table near the end before going on.

**Time.** Server: about 1 hour if the speech server from the RINN voice plan is already
working on the PC, about 3 hours if not. Phone access: 30 minutes. Handheld: one weekend once
the parts have arrived. Teaching it new things takes seconds and never stops.

---

## How it fits together

```
  phone page  ──┐  hold the button, speak, let go
  handheld    ──┤  (the recording is uploaded; nothing heavy runs on the device)
  typed text  ──┘
                │
                ▼
      voicebox-server  (Python, on your PC, port 8800)
                │ 1. speech to text     ──► speech server /v1/audio/transcriptions (Whisper, GPU)
                │ 2. look up your notes ──► knowledge index (SQLite + Ollama embeddings)
                │ 3. ask the model      ──► Ollama, model of your choice (default qwen3.8:27b)
                │ 4. cut the answer into sentences as it streams
                │ 5. sentence to audio  ──► speech server /v1/audio/speech (stock voice or your clone)
                ▼
      streams back to the device: transcript, text as it is written, one audio clip per sentence
```

Programs involved, all on the PC unless noted:

| Program | Port | Job | Start command |
| --- | --- | --- | --- |
| Ollama | 11434 | Runs the language model and the embedding model | starts with Windows |
| `rinn-voice-server` | 8880 | Speech server: Whisper transcription in, Kokoro or cloned-voice audio out | `rinn-voice-server --backend kokoro --voice af_heart --stt large-v3-turbo --stt-prompt ""` |
| `voicebox-server` | 8800 | Voicebox itself: voice turns, notes, the phone page | `voicebox-server` |
| Tailscale | 443 | Gives the phone and the handheld a private HTTPS address for the server | installed once, runs in the background |
| `voicebox` | | Command-line tool to add notes, upload files, list and remove knowledge, ask by text | `voicebox note "..."` |
| `voicebox-device` | | The handheld client (Raspberry Pi, or any laptop with `--no-gpio`) | `voicebox-device` |

Files you will care about, all inside the `voicebox` folder:

| File or folder | What it is |
| --- | --- |
| `persona.md` | The assistant's identity and manners. Plain Markdown; edit any time, restart the server. |
| `knowledge/` | Everything the assistant knows beyond the base model. Sub-folders allowed. `.md`, `.txt`, `.pdf`. |
| `knowledge/notes/` | Notes you dictated or typed; one Markdown file each, named by date. |
| `knowledge/uploads/` | Files uploaded through the phone page or `voicebox upload`. |
| `data/` | The search index (`knowledge.db`) and conversation memory (`sessions.json`). Safe to delete; rebuilt on start. |
| `.env` | Your settings: model, voice, API key, ports. Copied from `.env.example`. |

---

## Step 0: Prerequisites (do once, on the PC)

The server is the Windows 11 PC with the RTX 5090 (or a rented GPU server, see Step 9).
Voicebox needs three things already working there: Ollama with two models, FFmpeg, and the
speech server from the RINN voice plan. That plan lives at
`rinn-ollama/docs/VOICE_ASSISTANT_PLAN.md` in the same repository; the parts referenced
below are generic and do not involve RINN's persona.

1. **Ollama** installed (RINN voice plan, Step 0 item 8) and two models pulled. Open Command
   Prompt (`Win`, type `cmd`, Enter) and run:
   ```bat
   ollama pull qwen3.8:27b
   ollama pull nomic-embed-text
   ```
   The first is the chat model (about 18 GB, once). The second is the small embedding model
   (about 270 MB) that lets Voicebox find the right note for a question.
   - *Checkpoint:* `ollama list` shows both `qwen3.8:27b` and `nomic-embed-text`.
2. **Python 3.11 or 3.12** from python.org with "Add python.exe to PATH" ticked, and **Git for
   Windows** (RINN voice plan, Step 0 items 3 and 4).
   - *Checkpoint:* `python --version` prints 3.11.x or 3.12.x; `git --version` prints a version.
3. **FFmpeg on the PATH.** Phones record in WebM or MP4, and the server needs FFmpeg to
   decode those (the handheld sends WAV and does not need it). If you completed RINN voice
   plan Step 0 item 5 you already have it. Otherwise, in Command Prompt run
   `winget install --id Gyan.FFmpeg.Shared -e`, then open a **new** Command Prompt.
   - *Checkpoint:* `ffmpeg -version` prints a version line. If it says "not recognized", follow
     RINN voice plan Step 0 item 5 to add FFmpeg's `bin` folder to your PATH.
4. **The repository** on the PC:
   ```bat
   cd %USERPROFILE%
   git clone https://github.com/Jordantelder/my-website.git
   cd my-website
   git checkout claude/rinn-rag-model-clone-vph427
   ```
   Skip the clone if `%USERPROFILE%\my-website` already exists; then run `cd my-website`,
   `git pull` instead. If the branch has since been merged, use `git checkout main`.
5. **The speech server working with transcription enabled.** Follow RINN voice plan Steps 2
   and 3 (install the `rinn-ollama` project with its `server` and `kokoro` extras, then start
   the server). Two things Voicebox adds: always include `--stt large-v3-turbo`, because
   Voicebox has no speech recognition of its own, and `--stt-prompt ""`, which switches off
   the regulatory vocabulary hint that server gives Whisper by default for RINN. The command
   is:
   ```bat
   cd %USERPROFILE%\my-website\rinn-ollama
   .venv\Scripts\activate
   rinn-voice-server --backend kokoro --voice af_heart --stt large-v3-turbo --stt-prompt ""
   ```
   - *Checkpoint:* in a browser, <http://127.0.0.1:8880/health> shows `"status":"ok"` and
     `"stt":true`. Leave this window open; it is "window A" from now on.
   - Voices: `af_heart` (female, Kokoro's top-graded voice), `af_bella`, `af_nicole`,
     `am_michael`, `am_fenrir`, `am_puck` (male), `bf_emma` (British). Your cloned voice
     comes later (Step 6H); nothing else changes when you switch.
6. **A phone** with Chrome (Android) or Safari (iPhone), and a **Tailscale account** (free
   for personal use, <https://tailscale.com>); Step 5 uses it.

---

## Step 1: Install Voicebox

1. Open a **second** Command Prompt ("window B") and run:
   ```bat
   cd %USERPROFILE%\my-website\voicebox
   python -m venv .venv
   .venv\Scripts\activate
   python -m pip install --upgrade pip
   pip install -e ..\rinn-ollama
   pip install -e ".[server]"
   ```
   The first `pip install` brings in the shared engine from the sibling folder (no speech
   models, no PyTorch; those live only in the speech server's own environment). The second
   installs Voicebox with PDF reading and audio decoding.
2. *Checkpoint:* `voicebox-server --version` prints `voicebox 0.1.0`, and `voicebox --help`
   lists the sub-commands `health, list, sync, note, upload, remove, ask, reset`.
3. Optional but recommended: run the tests. `pip install -e ".[dev]"` then `pytest -q`. They
   need no GPU, microphone, or running server and finish in a few seconds. All should pass.

---

## Step 2: Configure and start the server

1. Still in window B, create your settings file and open it:
   ```bat
   copy .env.example .env
   notepad .env
   ```
2. Set an API key. Any long password works; to generate one, open PowerShell and run
   `-join ((48..57)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})`, copy the
   output, and in Notepad change the last line to `VOICEBOX_API_KEY=<that value>` (remove
   the leading `#`). Save and close. Leave everything else at its default for now:
   `VOICEBOX_HOST` stays `127.0.0.1` (Tailscale will do the exposing in Step 5), the speech
   server URL stays `http://127.0.0.1:8880/v1`, the voice stays `af_heart`.
   - If your speech server was started with `--api-key`, also set `VOICEBOX_SPEECH_API_KEY`
     to the same value.
3. Start Voicebox:
   ```bat
   voicebox-server
   ```
   You should see three lines: `knowledge: {...} (added 0, ...)`, then
   `ready: model=qwen3.8:27b voice=af_heart persona=persona.md api_key=set`, then
   `Uvicorn running on http://127.0.0.1:8800`. The first start creates `persona.md`,
   `knowledge\notes\`, and `data\` next to `.env`.
4. *Checkpoint:* in a browser open <http://127.0.0.1:8800/health>. You should see
   `"status":"ok"` and `"speech_server":true`. (Without the API key the page hides details;
   the next step shows them.)
   - `"speech_server":false` means window A is closed or still loading.
5. *Checkpoint:* the full health report and a first question by text. Open a **third**
   Command Prompt ("window C"):
   ```bat
   cd %USERPROFILE%\my-website\voicebox
   .venv\Scripts\activate
   voicebox health
   voicebox ask "In one sentence, what can you help me with?"
   ```
   Run from the `voicebox` folder, the tool reads the API key from the same `.env` file the
   server uses (from anywhere else, set `VOICEBOX_API_KEY` and `VOICEBOX_URL` first).
   `voicebox health` prints the JSON with `"warnings": []`. Then an answer prints within a
   few seconds; the first question after a pause takes longer (5 to 15 seconds) while Ollama
   loads the model.
   - A warning such as `embedding model 'nomic-embed-text' is not available` means Step 0
     item 1 was skipped: run `ollama pull nomic-embed-text`, then restart `voicebox-server`.
     Until then Voicebox falls back to keyword search, which still works.

---

## Step 3: Your first voice conversation, from the PC

1. In Chrome or Edge on the PC open <http://127.0.0.1:8800/>. The page has one large **Hold
   to talk** button, a text box, and **Settings** and **+ Note** buttons in the corner.
2. Click **Settings**, paste your API key into *API key*, click **Save**. (The page always
   talks to the server that served it, so there is no address to enter.)
3. Press and hold **Hold to talk**, say *"What is a good way to remember people's names?"*,
   and let go. The browser asks for microphone permission the first time: allow it. The
   button turns red while it listens, grey with *Thinking...* while the server works, and
   your words appear as a *You* bubble, then the answer appears word by word while the first
   sentence is already being spoken.
   - *Checkpoint:* you hear the answer within about 3 seconds of letting go, and the text
     matches what you hear.
4. Hold the button again and say *"Remember that the garage code is four three two one."*
   The reply is *Saved a note: the garage code is four three two one*, and a file appears in
   `knowledge\notes\`. Now ask *"What is the garage code?"* The answer quotes the note, and a
   small *Notes consulted: ...* line appears under the reply.
5. Type a question in the text box and press Enter; it works the same way. To wipe the
   conversation memory for this device, open **Settings** and click **Forget conversation**,
   or simply say *"Forget the conversation."*

Everything in Step 6 (teaching it) works from this page too.

---

## Step 4: Give it a personality (persona.md)

`persona.md` is the whole personality: it is sent to the model as the system prompt on every
turn. The default is a friendly, brief, speech-friendly assistant. To make it yours:

1. In window C run `notepad persona.md`. Keep the speaking rules near the top (short answers,
   plain words, no bullet points or Markdown, numbers read aloud) because the answer is going
   to be spoken. Then add whatever you want, for example:
   ```markdown
   # Voicebox persona

   Your name is Maple. You are the household assistant for the Telder family.
   You are speaking, not writing: two to four sentences, plain words, no lists or markdown,
   say numbers and abbreviations the way a person would read them aloud.
   You know the family's routines from the Notes section when it is present; prefer those
   notes over general knowledge and say which note you used. If the notes do not cover the
   question, say so in a few words and then answer from general knowledge.
   If asked to remember something, the system saves it as a note; confirm briefly.
   ```
2. Keep the paragraph about the "Notes" section; it is what makes the assistant use your
   knowledge folder and name its source. Do not paste secrets into the persona; put them in
   notes, which are only retrieved when relevant.
3. Save, then restart `voicebox-server` in window B (`Ctrl+C`, then `voicebox-server`).
   - *Checkpoint:* ask *"What is your name and who do you work for?"*; the answer reflects the
     file.

---

## Step 5: Reach it from anywhere (phone)

Browsers only allow microphone access over HTTPS (or on `localhost`), and you should never
open your PC to the whole internet. Tailscale solves both: your PC and your phone join a
private network, and `tailscale serve` gives the Voicebox server an HTTPS address that only
your own devices can reach.

1. **Install Tailscale on the PC.** Download the Windows installer from
   <https://tailscale.com/download/windows>, run it, click the Tailscale icon in the system
   tray, choose *Log in*, and sign in (Google, Microsoft, Apple, or GitHub account). The
   installer also adds the `tailscale` command for Command Prompt.
   - *Checkpoint:* in a new Command Prompt, `tailscale status` lists your PC with an IP that
     starts with `100.`.
2. **Enable HTTPS certificates for your network.** In a browser open
   <https://login.tailscale.com/admin/dns>. Turn on **MagicDNS** if it is off, then under
   **HTTPS Certificates** click **Enable HTTPS** and confirm. (Tailscale warns that your
   machine names become part of a public certificate list; that is normal for HTTPS.)
3. **Publish the Voicebox port.** In Command Prompt:
   ```bat
   tailscale serve --bg 8800
   tailscale serve status
   ```
   The status shows a line like `https://your-pc-name.tail1234.ts.net (tailnet only)`
   proxied to `http://127.0.0.1:8800`. Write that address down; it is your Voicebox URL. The
   `--bg` setting survives reboots. (To undo later: `tailscale serve reset`.)
   - *Checkpoint:* in the PC's browser open that `https://...ts.net/health` address; you see
     `"status":"ok"` as in Step 2.
   - Never use `tailscale funnel` for this: Funnel would publish the server to the public
     internet.
4. **Install Tailscale on the phone** (App Store or Play Store), open it, sign in with the
   **same** account, and switch the connection on.
5. **Open Voicebox on the phone.** In Safari or Chrome open your `https://...ts.net` address.
   Tap **Settings**, enter the API key, tap **Save**. Hold to talk, allow the microphone, and
   speak.
   - *Checkpoint:* the phone plays the answer. The first sentence should arrive about 3 to 4
     seconds after you let go on Wi-Fi or a good mobile signal.
6. **Make it an app icon.** iPhone: tap the *Share* button in Safari, then *Add to Home
   Screen*. Android Chrome: tap the three dots, then *Install app* (or *Add to Home screen*).
   It opens full-screen with no browser bar and its own icon.
   - On iPhone the home-screen app keeps its own settings, separate from Safari's: open
     **Settings** in it and enter the API key once more. The first hold asks for the
     microphone again; that is iOS behaviour.
7. Each phone keeps its own conversation memory (Settings, *Device name*). Two people can
   use two phones without mixing their conversations; notes are shared because they belong to
   the assistant, not to a device.

Away from home the phone uses its mobile data and Tailscale finds the PC wherever it is, as
long as the PC is on, signed in, and the two server windows are running (Step 8 makes that
automatic). A day of heavy use is a few tens of megabytes of data.

---

## Step 6: Teach Voicebox new things (whenever you like)

**How knowledge works here.** Everything the assistant knows beyond the base model is a file
in the `knowledge/` folder. When the server starts, and whenever you ask it to sync, it reads
every `.md`, `.txt`, and `.pdf` file, cuts each into pieces of roughly 900 characters, and
stores a numeric fingerprint (an "embedding") of each piece in `data/knowledge.db`. When you
ask a question, the question gets the same fingerprint, the four most similar pieces are
pasted into the model's prompt under a *Notes* heading, and the persona tells the model to
prefer them and to name the note it used. The *Notes consulted: ...* line under an answer
lists the notes that were shown to the model for that question. Unrelated notes are left out:
a chunk must score above a similarity floor and not far below the best match, so a question
about the weather does not drag in your wifi password.

This is retrieval, not training. The model itself never changes; your notes are looked up
per question. The good side: a note is available the second you save it, you can read and
edit every one, and deleting the file makes the assistant forget it. The limit: it can only
use what fits into four pieces per question, so short, specific notes work better than one
enormous document (see 6F).

There are five ways to add knowledge. Use whichever is at hand.

### 6A. Say it

Hold the button and start with *remember that*, *note that*, *make a note that*, or *take a
note*: *"Remember that the plumber is Ana and her number is five five five, zero one zero
zero."* Voicebox does not send this to the model; it saves the words after *remember that*
as a note, indexes it, and replies *Saved a note: ...*. The file lands in
`knowledge/notes/2026-09-05-101530-the-plumber-is-ana-and-her-number-is.md` (date, time,
the first eight words). A question that merely starts with "remember" ("Remember what the
garage code is?") is answered, not saved: the note form needs *remember that* and no
question mark.

- *Checkpoint:* ask *"Who is the plumber?"* and hear the name and number, with *Notes
  consulted:* under the reply.
- Numbers are transcribed the way Whisper heard them, sometimes as words. Say them slowly, or
  type the note (6B) when digits matter.

### 6B. Type it on the phone or PC page

Tap **+ Note**, optionally give it a title, type the note, tap **Save**. The reply bubble shows
the file name that was created. Titles become the *Notes consulted:* label, so a good title
such as *Wi-Fi guest password* makes answers clearer.

### 6C. Drop files into the folder

On the PC, copy any `.md`, `.txt`, or `.pdf` into `%USERPROFILE%\my-website\voicebox\knowledge\`
(sub-folders are fine, for example `knowledge\house\`, `knowledge\recipes\`). Then either
restart `voicebox-server`, or in window C run:

```bat
voicebox sync
```

The output lists what was `added`, `updated`, `removed`, and how many files were `unchanged`.
Only new or changed files are re-read, so syncing is quick even with hundreds of files.

- PDFs must contain real text (you can select words in a PDF viewer). Scanned pages are
  images and index as empty; run them through an OCR tool first, or save the text as `.md`.
- A file's first heading or first line becomes its title. Start Markdown files with
  `# A clear title`.
- *Checkpoint:* `voicebox list` shows the file with a chunk count greater than 0.

### 6D. From any computer, with the command line

Anywhere the `voicebox` tool is installed and can reach the server: in the `voicebox` folder
on the PC it reads `.env` by itself; on a laptop in your Tailscale network set
`VOICEBOX_URL=https://...ts.net` and `VOICEBOX_API_KEY` first (or pass `--url` and
`--api-key`):

```bat
voicebox note "The car's tyre pressure is 36 psi front and 34 rear" --title "Car tyre pressure"
voicebox upload "C:\Users\you\Documents\Boiler manual.pdf"
voicebox list
voicebox remove "uploads/Boiler manual.pdf"
voicebox ask "What pressure do the rear tyres take?"
```

`upload` copies the file into `knowledge/uploads/` on the server and indexes it. `list` shows
every source with its path, title, and number of chunks. `remove` deletes the file and its
index entries.

### 6E. Edit or forget things

Every note is a plain text file, so use any editor: fix a fact, add a line, change the title.
Then `voicebox sync` (or restart the server) and the change is live. Delete a file and sync to
make the assistant forget it. Conversation memory is separate and short (the last ten
exchanges per device): say *"Forget the conversation"* or use *Settings > Forget conversation*
to clear it.

### 6F. Writing notes that get found

- One topic per note, a few sentences long. Ten small notes beat one long page.
- Use the words you will say when you ask. If you will ask "where is the spare key", write
  "The spare key is ..." rather than "Key location: ...".
- Include names, dates, numbers, and units in full. Avoid pronouns ("it", "they") whose
  meaning depends on another note.
- For a long document you want to query in detail (a manual, a contract), also write a short
  note summarising the answers you actually need from it; the summary will be found first.
- Nothing you add is private from anyone who can use the assistant. Keep notes you would not
  want spoken aloud out of it.

### 6G. What to expect

- Answers can still draw on the model's general knowledge. If you want "only my notes"
  behaviour, say so in `persona.md` ("If the notes do not contain the answer, say you do not
  know; do not guess").
- `VOICEBOX_TOP_K` (default 4) is how many pieces are shown to the model per question. Raise
  it to 6 or 8 if answers keep missing a note you know exists, at the cost of a slightly
  slower first word.
- If `/health` shows a warning about the embedding model, search falls back to keyword
  matching until `ollama pull nomic-embed-text` has been run and the server restarted; the
  index rebuilds itself automatically when the embedding model changes.
- Uploads are limited to 25 MB per file. The knowledge folder itself has no limit.
- Back up `knowledge\` and `persona.md` and you have backed up everything the assistant
  knows; `data\` is rebuilt from them.

### 6H. Change the model, the voice, or the thinking mode

All of these are lines in `.env`; restart `voicebox-server` after changing them.

- **Model:** `ollama pull <tag>` any chat model, then `VOICEBOX_MODEL=<tag>`. Smaller models
  answer faster and leave GPU room for the speech server; `qwen3.8:27b` is the default
  because it fits the RTX 5090 with headroom.
- **Thinking mode:** leave `VOICEBOX_THINK=false` for voice. With Qwen3.8, thinking mode
  can take a minute or more before the first word, which is unusable for a spoken exchange.
- **Stock voice:** `VOICEBOX_VOICE=am_michael` (any voice the speech server lists at
  <http://127.0.0.1:8880/v1/audio/voices>).
- **Your cloned voice:** start the speech server with the F5-TTS or Qwen3-TTS backend exactly
  as in RINN voice plan Step 6 (the speech server is generic; only its backend changes), then
  set `VOICEBOX_VOICE=clone` for F5-TTS, or the speaker name you registered for a Qwen3-TTS
  fine-tune. Expect the first sentence about a second later than with Kokoro.
- **Memory length:** `VOICEBOX_MAX_HISTORY_TURNS` (default 10 exchanges per device).

---

## Step 7: Build the handheld (Raspberry Pi Zero 2 W)

The handheld is a small Linux computer with a two-microphone sound board, a speaker, one
button, and a battery, in a printed case. It records while the button is held, sends the WAV
to your server over Tailscale, prints nothing you need to see, and plays the answer as it
streams back. It has no screen and no offline mode: with no server it plays an error tone.

### 7A. Parts

Two audio routes are offered. **Route 1 (USB)** needs no soldering and no drivers and is
the one to build first; **Route 2 (HAT)** is the compact build, and its catch is explained
below. Everything else is shared.

| Part | Why | Approx. price (USD) |
| --- | --- | --- |
| Raspberry Pi Zero 2 W **with pre-soldered header** (sold as "Zero 2 WH" or "with color-coded header") | The computer. Quad-core, 512 MB RAM, 2.4 GHz Wi-Fi, 65 × 30 mm. The plain Zero 2 W has an unpopulated header and needs soldering. | 18 to 22 |
| microSD card, 16 or 32 GB, A1 class | Operating system | 8 |
| **PiSugar 3** battery (Pi Zero size, 1200 mAh) or a slim USB power bank | Power. PiSugar mounts on the back of the Zero with spring pins (no soldering), has its own power button and charges over USB-C. A 5000 mAh power bank runs longer but is bulkier. | 40 (PiSugar) or 15 (power bank) |
| A momentary push button (12 mm panel-mount) and two female jumper wires | The talk button, wired to GPIO 17 and GND (Route 1; Route 2's HAT has one on board) | 3 |
| Filament for the case | Printed on your Bambu P2S | 2 |
| **Route 1:** a USB speakerphone (a compact conference puck such as the Anker PowerConf S330 or a similar "USB speakerphone"), plus a **micro-USB OTG adapter** | Microphone and speaker in one, recognised by Linux as a standard USB sound card. Plug and play. About the size of a coaster, so this build is "small bag", not "pocket". | 30 to 60 |
| **Route 2:** Seeed **ReSpeaker 2-Mics Pi HAT v1** (WM8960 codec) and a small speaker with a **JST 2.0 (PH 2.0 mm) plug** (e.g. Seeed "Mono Enclosed Speaker, 2 W 6 Ω") | Two microphones, speaker socket, headphone jack, three LEDs, and a button already wired to GPIO 17, in the Pi Zero footprint. Presses onto the header. | 15 to 20 |

Total about 90 to 120 USD with the PiSugar. A laptop or desktop with a microphone can stand
in for all of this during setup: the client runs anywhere with `--no-gpio`.

**The catch with Route 2.** Seeed now sells the HAT as **v2.0**, which uses a different
codec (TLV320AIC3104). Raspberry Pi OS ships a driver for the v1's WM8960 codec but not for
the v2.0's, so a v2.0 board needs a kernel module compiled from source (Seeed's wiki
describes it) and recompiled after kernel updates. That is outside what this plan covers.
Buy a **v1** (WM8960) board if you can find one, or use Route 1. Check the codec name in the
listing before buying.

**For makers who solder:** the smallest build uses an I2S microphone (Adafruit SPH0645 or an
INMP441 module) and an Adafruit MAX98357A I2S amplifier with a 4 Ω or 8 Ω speaker. Both are
driven by the in-kernel Google Voice HAT driver (`dtoverlay=googlevoicehat-soundcard`).
Wiring: mic 3V to pin 1, GND to pin 9, BCLK to GPIO 18 (pin 12), LRCL to GPIO 19 (pin 35),
DOUT to GPIO 20 (pin 38), SEL to GND; amp Vin to 5 V (pin 2), GND to pin 6, BCLK to GPIO 18,
LRC to GPIO 19, DIN to GPIO 21 (pin 40). Follow Adafruit's guides for the two boards; the
rest of this plan applies unchanged once `arecord -l` shows the card.

### 7B. Flash the operating system

1. On the PC install **Raspberry Pi Imager** (version 2 or newer) from
   <https://www.raspberrypi.com/software/> and put the microSD card in a reader.
2. Open Imager. It walks through tabs, each with a **Next** button:
   - **Device**: choose *Raspberry Pi Zero 2 W*.
   - **OS**: open *Raspberry Pi OS (other)* and choose *Raspberry Pi OS Lite (64-bit)* (no
     desktop; the Zero has no screen here, and the 64-bit build is the one this plan tests).
   - **Storage**: your microSD card.
3. The **Customisation** tabs follow. Fill them in:
   - **Hostname**: `voicebox-1`.
   - **Localisation**: pick your capital city; Imager sets the time zone, keyboard layout and
     Wi-Fi country from it.
   - **User**: username `pi` (this plan uses `pi` everywhere) and a password.
   - **Wi-Fi**: *secure network*, then your home Wi-Fi name and password. The Zero 2 W is
     **2.4 GHz only**: if your router broadcasts separate 2.4 GHz and 5 GHz names, use the
     2.4 GHz one.
   - **Remote Access**: turn on *Enable SSH* and choose *Use password authentication*.
   - **Raspberry Pi Connect**: leave it off.
4. On the **Writing** tab check the summary, click **Write**, confirm with *I understand,
   erase and write*, and wait for **Finish**.
5. Put the card in the Zero. Route 2: attach the HAT onto the header (all 40 pins, the
   HAT's microphones pointing away from the board) and plug the speaker into the HAT's JST
   socket. Power the Zero through its **PWR IN** micro-USB port (the one nearer the corner
   of the board) from a phone charger. The first boot takes a minute or two.
6. From the PC, in Command Prompt:
   ```bat
   ssh pi@voicebox-1.local
   ```
   Type `yes` at the fingerprint question, then the password. If `.local` does not resolve,
   look up the Zero's IP in your router's device list and use `ssh pi@<ip>`.
   - *Checkpoint:* you see a `pi@voicebox-1:~ $` prompt.
7. Update the system (a few minutes on the Zero):
   ```bash
   sudo apt update && sudo apt full-upgrade -y && sudo reboot
   ```
   Reconnect with `ssh` after the reboot.

### 7C. Enable the sound

**Route 1 (USB speakerphone).** Plug the speakerphone into the Zero's **USB** port (the
micro-USB port nearer the middle of the board) through the OTG adapter and reboot. Nothing
to install. Then continue at "Make it the default" below.

**Route 2 (ReSpeaker v1).** Seeed's current instructions use a device-tree overlay with the
sound driver already in the kernel, which keeps working across system updates. Run on the
Zero:

```bash
sudo apt install -y git make device-tree-compiler
git clone https://github.com/Seeed-Studio/seeed-linux-dtoverlays.git
cd seeed-linux-dtoverlays/
make overlays/rpi/respeaker-2mic-v1_0-overlay.dtbo
sudo cp overlays/rpi/respeaker-2mic-v1_0-overlay.dtbo /boot/firmware/overlays/respeaker-2mic-v1_0.dtbo
echo "dtoverlay=respeaker-2mic-v1_0" | sudo tee -a /boot/firmware/config.txt
sudo reboot
```

Then, for either route, after reconnecting:

1. *Checkpoint:* `aplay -l` lists the HDMI card plus your sound device, and `arecord -l`
   (capture devices only) lists just your sound device. Note its short name in square
   brackets, for example `[seeed2micvoicec]` for the HAT or something like `[S330]` for a
   speakerphone.
2. **Make it the default** sound device so the client (and every other program) uses it
   without extra flags. Create `/etc/asound.conf` with `sudo nano /etc/asound.conf`, paste
   the following with your card name from the checkpoint, save with `Ctrl+O`, `Enter`, exit
   with `Ctrl+X`:
   ```text
   pcm.!default {
     type asym
     playback.pcm "plughw:CARD=seeed2micvoicec"
     capture.pcm "plughw:CARD=seeed2micvoicec"
   }
   ctl.!default {
     type hw
     card seeed2micvoicec
   }
   ```
   `plughw` lets the device accept the 16 kHz mono recordings and 24 kHz playback the client
   uses even if the hardware itself prefers stereo 48 kHz.
3. Set levels: run `alsamixer`, press `F6` and choose your device, raise the playback
   controls (*Speaker* and *Playback* on the HAT; *PCM* or *Speaker* on a USB device) to
   about 80 percent, press `F4` for capture and make sure *Capture* (or *Mic*) is enabled
   (`Space`) and at about 70 percent, press `Esc`. On the HAT the microphones also need
   their boost switches on, which alsamixer hides in the capture view:
   ```bash
   amixer -c seeed2micvoicec sset 'Left Input Mixer Boost' on
   amixer -c seeed2micvoicec sset 'Right Input Mixer Boost' on
   amixer -c seeed2micvoicec sset 'Capture' 70% unmute
   ```
   Save everything with `sudo alsactl store`.
4. *Checkpoint:* record three seconds and play them back:
   ```bash
   arecord -d 3 -f S16_LE -r 16000 -c 1 test.wav && aplay test.wav
   ```
   You hear yourself. If recording is silent, check *Capture* in `alsamixer` and (HAT) the
   boost switches above; if playback is silent, check the speaker plug and the playback
   level.

### 7D. Install the client

```bash
sudo apt install -y python3-venv python3-pip libportaudio2 python3-lgpio
cd ~
git clone https://github.com/Jordantelder/my-website.git
cd my-website && git checkout claude/rinn-rag-model-clone-vph427 && cd ~
python3 -m venv --system-site-packages ~/voicebox-env
source ~/voicebox-env/bin/activate
pip install -e ~/my-website/rinn-ollama
pip install -e "$HOME/my-website/voicebox[device]"
```

`--system-site-packages` lets the environment see the Raspberry Pi OS packages for GPIO
(`gpiozero` and `lgpio` come with the OS). The install takes several minutes on the Zero.

- *Checkpoint:* `voicebox-device --list-devices` prints a device table that includes the HAT
  (or your USB headset) with inputs and outputs, and `default` entries.

### 7E. Connect it to your server

1. Join the Zero to your Tailscale network:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   It prints a login link; open it on the PC or phone and approve. From now on the Zero can
   reach `https://your-pc-name....ts.net` from any network.
   - *Checkpoint:* `curl https://your-pc-name.tail1234.ts.net/health` on the Zero prints the
     Voicebox health JSON (replace with your address from Step 5).
2. Create the client's settings file `nano ~/voicebox.env`:
   ```text
   VOICEBOX_URL=https://your-pc-name.tail1234.ts.net
   VOICEBOX_API_KEY=your-key-from-step-2
   VOICEBOX_SESSION=voicebox-1
   VOICEBOX_BUTTON_PIN=17
   ```
   Then load it into your shell for testing: `set -a; source ~/voicebox.env; set +a`.
3. *Checkpoint (text only):*
   ```bash
   voicebox-device --ask "Say hello in one sentence."
   ```
   It prints `server: https://... status=ok model=qwen3.8:27b`, then `voicebox: Hello ...`,
   and the sentence plays through the speaker.
4. *Checkpoint (microphone, no button yet):*
   ```bash
   voicebox-device --no-gpio
   ```
   Press `Enter`, ask a question out loud, press `Enter` again. You hear a short beep when
   recording starts, then the answer. `Ctrl+C` quits.
5. *Checkpoint (the real button):* run `voicebox-device` with no flags. It prints
   `ready: hold the button on GPIO 17 to talk` and plays a two-tone ready chime. Hold the
   button, speak, release. Pressing the button while an answer is playing cuts the answer
   off (it prints `(interrupted)`) and starts listening again.
   - Route 1's button goes between GPIO 17 (physical pin 11) and any GND pin (physical pin 9
     is next to it); no resistor is needed. Route 2's HAT button is already on GPIO 17.
     Change `VOICEBOX_BUTTON_PIN` if you used another pin. `--led-pin <n>` drives a status
     LED if you add one (on while listening, fast blink while thinking, slow blink while
     speaking).

### 7F. Start on boot

Create the service file `sudo nano /etc/systemd/system/voicebox-device.service`:

```ini
[Unit]
Description=Voicebox handheld client
After=network-online.target sound.target
Wants=network-online.target

[Service]
User=pi
EnvironmentFile=/home/pi/voicebox.env
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/pi/voicebox-env/bin/voicebox-device
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now voicebox-device
systemctl status voicebox-device --no-pager
```

- *Checkpoint:* the status shows `active (running)`; the ready chime plays about 30 seconds
  after power-on from then on. Logs: `journalctl -u voicebox-device -f`.
- If the network is not up yet when the service starts, the client warns and retries at the
  next button press; you do not need to restart anything.

### 7G. Battery and case

1. **PiSugar 3:** press it onto the back of the Zero so its spring pins meet the pads, fix it
   with the supplied screws, and charge it through its USB-C port. Its side button turns the
   handheld on and off; the Zero boots in about 30 seconds and plays the ready chime. Expect
   roughly 3 to 5 hours of use per charge (Wi-Fi on, mostly idle between questions); a 5000
   mAh power bank on the PWR IN port gives 12 hours or more.
   - Always shut down cleanly before cutting power when you can (`sudo poweroff`, or hold the
     button for 3 seconds if you enable PiSugar's software), to protect the SD card.
2. **Case:** the board stack is 65 × 30 mm; Pi plus HAT is about 20 mm tall, the PiSugar
   adds about 8 mm on the other side. Design for: a 12 mm hole for the talk button (Route 2:
   an opening over the HAT's button instead), holes over the microphones, a grille in front
   of the speaker, a slot for USB-C charging, and a window for the HAT's LEDs if you want
   them visible. For Route 1 the speakerphone sits in its own pocket of the shell with the
   Zero and battery behind it. Print the shell in two halves with screw posts, and keep the
   PiSugar's power button reachable.
3. **On the go:** the Zero only knows the Wi-Fi networks you have told it. Add your phone's
   hotspot as a saved network, while connected to the Zero over your home network (this
   command only stores the profile; it does not switch networks and drop your session):
   ```bash
   sudo nmcli connection add type wifi con-name phone-hotspot ifname wlan0 ssid "Your Phone Hotspot" -- wifi-sec.key-mgmt wpa-psk wifi-sec.psk "hotspot-password"
   ```
   Set the phone's hotspot to 2.4 GHz (iPhone: *Personal Hotspot > Maximize Compatibility*
   on; Android: hotspot *AP band 2.4 GHz*). Away from home, turn the hotspot on before the
   Zero boots (or keep the hotspot screen open so it broadcasts): the Zero joins whichever
   known network it sees, and Tailscale then works through the phone exactly as at home.

---

## Step 8: Keep the server running

1. Create `%USERPROFILE%\my-website\voicebox\start-voicebox.bat` with Notepad:
   ```bat
   @echo off
   cd /d %USERPROFILE%\my-website\rinn-ollama
   call .venv\Scripts\activate
   start "Speech server" cmd /k rinn-voice-server --backend kokoro --voice af_heart --stt large-v3-turbo --stt-prompt ""
   cd /d %USERPROFILE%\my-website\voicebox
   call .venv\Scripts\activate
   echo Waiting for the speech server to load its models...
   :wait
   curl -sf -o nul http://127.0.0.1:8880/health
   if errorlevel 1 (timeout /t 2 >nul & goto wait)
   voicebox-server
   pause
   ```
   Double-clicking it opens the speech server in its own window, waits for it, then starts
   Voicebox. When you switch to your cloned voice, replace the speech server line with the
   command from RINN voice plan Step 6.
2. Start it at sign-in: press `Win+R`, type `shell:startup`, Enter; right-click the `.bat`
   file, *Show more options* > *Create shortcut*, and drag the shortcut into that folder.
3. Stop the PC from sleeping: *Settings > System > Power > Screen and sleep*, set "When
   plugged in, put my device to sleep after" to **Never**. Tailscale and `tailscale serve`
   start on their own.
4. The model stays loaded for 30 minutes after each question (`VOICEBOX_KEEP_ALIVE=30m` in
   `.env`), so only the first question after a long pause waits for it to load. Raise it to
   `2h` if you have the GPU memory to spare and hate that first-question delay.
5. **Updating:** in each project folder run `git pull`, then `pip install -e .` again in its
   environment, then restart the servers. On the Zero: `cd ~/my-website && git pull`, then
   `~/voicebox-env/bin/pip install -e "$HOME/my-website/voicebox[device]"` and
   `sudo systemctl restart voicebox-device`.
6. **Backups:** copy `voicebox\knowledge\`, `voicebox\persona.md`, and `voicebox\.env`
   somewhere safe now and then. That is everything the assistant knows and is.

---

## Step 9: Running the server somewhere else (optional)

Voicebox does not care where the server is, only that Tailscale can reach it. If you move to a
rented GPU server (the earlier cost discussion applies: an RTX PRO 6000 or RTX 5090 machine
by the month), the steps are the same on Linux: install Ollama and pull the two models,
install the `rinn-ollama` project with its `server` and `kokoro` extras and run
`rinn-voice-server` as a systemd service, install Voicebox the same way and run
`voicebox-server` as a second service (set `VOICEBOX_HOST=127.0.0.1` and an API key), install
Tailscale and run `tailscale serve --bg 8800`. Put `knowledge/`, `persona.md`, and `.env` on
the server; the phone and the handheld only need the new `https://...ts.net` address. A
rented server needs an RTX-class GPU for the speech server and the model; Voicebox itself
would run on a Raspberry Pi.

---

## Verification checklist

Tick these after setup, and again after any update.

- [ ] `ollama list` shows `qwen3.8:27b` and `nomic-embed-text`.
- [ ] <http://127.0.0.1:8880/health> is `ok` with `"stt":true` (speech server).
- [ ] <http://127.0.0.1:8800/health> is `ok`, `speech_server` true, `warnings` empty.
- [ ] `voicebox ask "hello"` answers within 15 seconds.
- [ ] On the PC page, a spoken question is answered aloud within about 3 seconds.
- [ ] *"Remember that ..."* creates a file in `knowledge\notes\` and the next question uses it.
- [ ] `voicebox sync` after dropping a file lists it under `added`; `voicebox list` shows it.
- [ ] `tailscale serve status` shows the HTTPS address; `/health` opens on the phone.
- [ ] The phone page records and plays over mobile data, not only Wi-Fi.
- [ ] On the Zero, `arecord ... && aplay test.wav` plays your voice back.
- [ ] `voicebox-device --ask` speaks; `voicebox-device` answers a button press.
- [ ] After a reboot of the Zero the ready chime plays without anyone logging in.
- [ ] After a reboot of the PC, both server windows open by themselves and the phone works.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `voicebox-server` prints `configuration error: invalid model tag ...` and exits; or `voicebox health` warns `cannot reach Ollama at ...` and `voicebox ask` prints `[problem: cannot reach Ollama ...]` | Check `VOICEBOX_MODEL` in `.env` (tag exactly as in `ollama list`) and that the Ollama tray icon is running. Voicebox keeps running while Ollama is down and recovers by itself. |
| `/health` shows `"speech_server": false`; answers are text only | Window A is closed or still loading. Start `rinn-voice-server` (Step 0 item 5) and wait for `Uvicorn running`. Voicebox recovers on its own; no restart needed. |
| Turn ends with `could not transcribe: transcription failed (501): ... speech-to-text is not enabled` | The speech server was started without `--stt large-v3-turbo`. Restart it with that flag. |
| Phone: `The server wants an API key. Open Settings.`; tool: `error 401: {"detail":"missing or wrong API key"}` | The key in *Settings* differs from the server's `.env`: copy it again, no spaces. On an iPhone home-screen app, enter the key in its own Settings. For the `voicebox` tool: run it from the `voicebox` folder (it reads `.env` there) or set `VOICEBOX_API_KEY` in that window. |
| Phone: `Microphone access was refused` | The page is not on HTTPS. Use the `https://...ts.net` address from Step 5, not an IP. On iPhone check *Settings > Safari > Microphone*. |
| Phone: `Server error 415: cannot decode` | FFmpeg is missing from the server's PATH (Step 0 item 3). Open a new Command Prompt after installing it and restart `voicebox-server` from there. |
| Answers are slow to start (10 s or more) | Thinking mode is on: set `VOICEBOX_THINK=false`. Ollama unloaded the model after a long pause: raise `VOICEBOX_KEEP_ALIVE`. The speech server is on the CPU: check its startup lines say `cuda`. |
| A note exists but is never used | Check `voicebox list` shows it with chunks greater than 0 (a scanned PDF indexes as empty). Ask with the note's own words. Raise `VOICEBOX_TOP_K`. Check `/health` for an embedding-model warning. |
| `/health` warns `embedding model 'nomic-embed-text' is not available` | `ollama pull nomic-embed-text`, then restart `voicebox-server`. The index rebuilds automatically. |
| Voice notes contain the wrong numbers | Whisper heard digits as words or vice versa. Say digits one at a time, or add the note by typing (6B or 6D). |
| `tailscale serve status` shows nothing, or the URL gives a certificate error | HTTPS certificates are not enabled (Step 5 item 2), or MagicDNS is off. Enable both, then run `tailscale serve --bg 8800` again. |
| Zero: `ssh: Could not resolve hostname voicebox-1.local` | Use the IP from your router, or plug the Zero into a screen once and run `hostname -I`. Check the Wi-Fi name and password you typed in Imager (2.4 GHz network only). |
| Zero: `arecord -l` says `no soundcards found` and `aplay -l` shows only the HDMI card | Route 1: the speakerphone is in the wrong port (use the **USB** port, not PWR IN) or the OTG adapter is bad; `lsusb` must list it. Route 2: the overlay is not loaded. Check the `dtoverlay=respeaker-2mic-v1_0` line is at the end of `/boot/firmware/config.txt` and the `.dtbo` is in `/boot/firmware/overlays/`; `dmesg | grep -i wm8960` shows driver messages. A v2.0 board (TLV320AIC3104) will not work with this overlay (see 7A). |
| Zero: `cannot open microphone` / `Invalid number of channels` | The sound device is not the default. Create `/etc/asound.conf` as in 7C, or pass `--mic seeed --speaker seeed` (any part of the device name from `voicebox-device --list-devices`). |
| Zero: `sounddevice/PortAudio not available` | `sudo apt install libportaudio2`, then `pip install --force-reinstall sounddevice` inside `~/voicebox-env`. |
| Zero: `gpiozero is not installed` or a `PinFactory` error | The venv was created without `--system-site-packages`. Recreate it as in 7D, or `pip install gpiozero lgpio` inside it after `sudo apt install python3-dev swig liblgpio-dev`. |
| Zero: error tone on every press | The server is unreachable: `tailscale status` on the Zero must show the PC; `curl .../health` must answer. Check the URL and key in `~/voicebox.env`, then `sudo systemctl restart voicebox-device`. |
| Zero: the answer plays but is too quiet or distorted | `alsamixer`: *Speaker* and *Playback* levels; a 6 Ω, 2 W speaker or similar on the HAT; power the Zero from a good supply or the PiSugar (a weak charger causes crackle). |
| Zero: `[speaker: ... Invalid sample rate]` or `[speaker: ... Invalid number of channels]` printed after a turn | The output device rejects mono 24 kHz: make it the default through `plughw` as in 7C (the `plug` layer converts), or pass `--speaker` with the name of a `plughw`/`default` device from `--list-devices`. |
| Zero: HAT recordings are silent although `Capture` is up | The WM8960 input boost switches are off: run the three `amixer` commands in 7C item 3, then `sudo alsactl store`. |
| Zero: `(too short; hold the button while you speak)` | Keep holding while you speak; recordings under 0.4 s are ignored on purpose. |

---

## If you are not Claude: hand-off notes for another AI agent or helper

Paste this as your first message to the assistant you are using:

> I am setting up "Voicebox", a generic push-to-talk voice assistant that runs on my own
> hardware: Ollama (model `qwen3.8:27b` plus `nomic-embed-text`) and a speech server on a
> Windows 11 PC with an RTX 5090, a phone web page, and a Raspberry Pi Zero 2 W handheld. The
> code is the `voicebox` folder of the `Jordantelder/my-website` repository; it reuses engine
> modules from the sibling `rinn-ollama` folder but nothing of that project's own persona.
> `voicebox/docs/PLAN.md` is the plan; follow it step by step, run each Checkpoint, and if
> one fails use the Troubleshooting table and the module docstrings. Tests run with `pytest`
> in the `voicebox` folder and need no GPU, microphone, or server. Keep the project generic
> (no subject-specific prompts); the personality belongs in `persona.md` and knowledge in the
> `knowledge/` folder. Only fix what a checkpoint shows is broken.

Files that matter:

| File | Purpose |
| --- | --- |
| `voicebox/server.py` | `voicebox-server`: the HTTP API and the phone page. `Gate` checks the key and body size before parsing; startup wiring in `_startup`. |
| `voicebox/assistant.py` | One voice turn: transcript, "remember/forget" handling, notes lookup, streamed answer with sentence-by-sentence speech. `SessionStore` is the per-device memory. |
| `voicebox/knowledge.py` | The knowledge folder index: chunking, Ollama or hash embeddings, SQLite storage, `sync`, `add_note`, `search`. |
| `voicebox/speech.py` | Clients for the speech server's transcription and speech endpoints. |
| `voicebox/persona.py` | Default `persona.md` text and loading. |
| `voicebox/config.py` | `VOICEBOX_*` settings and `.env` loading. |
| `voicebox/web/index.html`, `manifest.webmanifest`, `icon-*.png` | The phone page: hold-to-talk with MediaRecorder, NDJSON reader, PCM playback, settings and notes dialogs; the manifest and icons make it installable. |
| `voicebox/device/pi_button.py` | `voicebox-device`: GPIO or keyboard button, WAV recording, streaming playback on a worker thread (a new press interrupts it), beeps, LED. |
| `voicebox/cli.py` | `voicebox`: health, list, sync, note, upload, remove, ask, reset. |
| `tests/` | The pytest suite (about 145 tests) with fakes for Ollama, the speech server, the sound card, and a live uvicorn streaming test. |

Server API (all under the Voicebox URL; every route except `/`, `/health`, the manifest and
the icons requires `Authorization: Bearer <key>` or `X-API-Key: <key>`, checked before the
request body is read):

| Route | Purpose |
| --- | --- |
| `POST /turn` (multipart: `audio` file or `text`, `session`, `speak`) | One turn. Streams NDJSON events: `transcript`, `text` (a fragment), `audio` (`pcm16` base64, 16-bit mono, `sample_rate`), `note_saved`, `error`, `done` (`answer`, `sources`, `seconds`). |
| `POST /session/{id}/reset` | Forget one device's conversation. |
| `GET /knowledge` | Stats plus every indexed source. |
| `POST /knowledge/sync?force=false` | Index new or changed files; `force=true` re-indexes all. |
| `POST /knowledge/notes` (`{"text","title"}`) | Add a note. |
| `POST /knowledge/files` (multipart `file`) | Upload a `.md`/`.txt`/`.pdf` into `knowledge/uploads/` and index it. |
| `DELETE /knowledge/{source}` | Remove a file and its index entries. |
| `GET /health` (public) | Readiness, model, speech server state, document and chunk counts. With the key: the knowledge folder path, warnings, and the startup error. |
| `GET /` | The phone page. |

Environment variables (`voicebox/.env`, all optional):

| Variable | Default | Meaning |
| --- | --- | --- |
| `VOICEBOX_MODEL` | `qwen3.8:27b` | Ollama chat model tag |
| `OLLAMA_HOST` / `VOICEBOX_OLLAMA_HOST` | `http://127.0.0.1:11434` | Where Ollama is; a listen address such as `0.0.0.0` is read as this PC |
| `VOICEBOX_THINK` | `false` | Thinking mode (leave off for voice) |
| `VOICEBOX_KEEP_ALIVE` | `30m` | How long Ollama keeps the model loaded after a question |
| `VOICEBOX_SPEECH_URL`, `VOICEBOX_SPEECH_API_KEY` | `http://127.0.0.1:8880/v1`, none | The speech server and its key if it has one |
| `VOICEBOX_SPEECH_TIMEOUT`, `VOICEBOX_TTS_MODEL` | `120`, `voicebox` | Seconds to wait for one transcription or one sentence of speech; the model name sent to the speech server (ignored by `rinn-voice-server`) |
| `VOICEBOX_VOICE` | `af_heart` | Voice id on the speech server (`clone` for F5-TTS) |
| `VOICEBOX_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model; blank for keyword-only search |
| `VOICEBOX_KNOWLEDGE_DIR`, `VOICEBOX_DATA_DIR`, `VOICEBOX_PERSONA_FILE` | `knowledge`, `data`, `persona.md` | Where things live |
| `VOICEBOX_TOP_K`, `VOICEBOX_MAX_HISTORY_TURNS` | `4`, `10` | Notes per question; remembered exchanges per device |
| `VOICEBOX_HOST`, `VOICEBOX_PORT`, `VOICEBOX_API_KEY` | `127.0.0.1`, `8800`, none | Bind address (keep loopback and let Tailscale expose it), port, and the key clients must send. A non-loopback bind without a key is refused. |

Client variables (`~/voicebox.env` on the Zero, or the shell): `VOICEBOX_URL`,
`VOICEBOX_API_KEY`, `VOICEBOX_SESSION` (device name; default the hostname),
`VOICEBOX_BUTTON_PIN` (default 17), `VOICEBOX_LED_PIN` (default none). The `voicebox` tool
also reads `VOICEBOX_URL` and `VOICEBOX_API_KEY` from a `.env` file in the current folder.

Timing to expect: the first spoken sentence about 3 seconds after the button is released with
Kokoro, 4 to 5 with a cloned voice, plus network. Text streams token by token; audio lags by
one sentence because a sentence must be complete before it can be synthesized.

---

## Sources used to build this plan

- Seeed Studio, *ReSpeaker 2-Mics Pi HAT* wiki (button on GPIO 17, WM8960 codec, overlay
  installation commands): <https://wiki.seeedstudio.com/ReSpeaker_2_Mics_Pi_HAT_Raspberry/>
- Seeed Studio, `seeed-linux-dtoverlays` repository: <https://github.com/Seeed-Studio/seeed-linux-dtoverlays>
- HinTak, `seeed-voicecard` fork for current kernels (fallback driver): <https://github.com/HinTak/seeed-voicecard>
- Raspberry Pi, *Raspberry Pi Zero 2 W* specifications (quad-core, 512 MB, 2.4 GHz only,
  unpopulated header): <https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/>
- Raspberry Pi, *Getting started* (Imager OS customisation, OS Lite 64-bit for headless use):
  <https://www.raspberrypi.com/documentation/computers/getting-started.html>
- Raspberry Pi, *Configuration* (`/boot/firmware/config.txt`, NetworkManager and `nmcli`):
  <https://www.raspberrypi.com/documentation/computers/configuration.html>
- gpiozero, *Installing* (pre-installed on Raspberry Pi OS, `--system-site-packages` venv,
  lgpio pin factory): <https://gpiozero.readthedocs.io/en/latest/installing.html>
- Tailscale, *Tailscale Serve* (`--bg`, `serve status`, `serve reset`):
  <https://tailscale.com/kb/1242/tailscale-serve>
- Tailscale, *Enabling HTTPS* (MagicDNS, "Enable HTTPS" on the DNS page):
  <https://tailscale.com/kb/1153/enabling-https>
- PiSugar, PiSugar 3 (1200 mAh, Pi Zero size): <https://www.pisugar.com/>
- Ollama, model library (`qwen3.8:27b`, `nomic-embed-text`): <https://ollama.com/library>
