# RINN Voice Assistant: Step-by-Step Plan

**Goal.** Ask RINN a question by speaking into a microphone (or typing), see the text answer
appear as it is generated, and hear it read aloud almost immediately, in either your cloned
voice or a chosen stock voice. Everything runs on your own Windows PC with the RTX 5090.
No cloud services are involved.

**Who this is for.** You, or any other AI agent or helper working on your PC without Claude.
Every step says exactly what to open, click, type, and what you should see. If a step's
*Checkpoint* fails, stop and use the *Troubleshooting* table at the end before moving on.

**Time.** About 2 hours for the stock voice (Steps 0 to 5). Add 30 to 60 minutes to switch to
your cloned voice (Step 6). Open WebUI (Step 7) is optional and takes about 30 minutes.

---

## How it fits together

```
 you speak ──► microphone ──► rinn-voice (Python, native Windows)
                                 │  1. records until you pause
                                 │  2. faster-whisper turns speech into text (GPU)
                                 │  3. sends the text to RINN (Ollama, model qwen3.8:27b)
                                 │  4. prints the answer as it streams
                                 │  5. cuts the stream into sentences
                                 ▼
                        rinn-voice-server (Python, native Windows, port 8880)
                                 │  turns each sentence into audio
                                 │  backend = kokoro (stock voice) or f5tts / qwen3tts (your clone)
                                 ▼
                             speakers  ◄── played in order while the next sentence is still being generated
```

Two independent programs, both from the `rinn-ollama` folder of your `my-website` repository:

| Program | Job | Start command |
| --- | --- | --- |
| `rinn-voice-server` | Speech server: text-to-speech (and optional speech-to-text) over an OpenAI-compatible HTTP API on `http://127.0.0.1:8880` | `rinn-voice-server --backend kokoro` |
| `rinn-voice` | The conversation loop: microphone, Whisper, RINN, streaming text, playback | `rinn-voice` |

Because the server speaks the OpenAI audio API, the same server also gives **Open WebUI** a
voice (Step 7), and the `rinn-voice` client also works with **Kokoro-FastAPI** if you prefer
that server.

**Two tracks.** Track B (terminal app, Steps 1 to 6) is the primary path and the one that
supports your cloned voice with the least friction. Track A (Open WebUI in the browser,
Step 7) gives you a chat window with a microphone button and hands-free "call" mode; it uses
the same server, so do Steps 1 to 4 first either way.

---

## Step 0: Prerequisites (do once)

Work on the Windows desktop, not inside WSL. Microphones are much simpler on native Windows,
and all the libraries used here have Windows wheels.

1. **Windows 11**, signed in as an administrator.
2. **NVIDIA driver.** Open *GeForce Experience* or *NVIDIA App* and update to the latest Game
   Ready or Studio driver (anything 570 or newer supports the RTX 5090). Reboot if it asks.
   - *Checkpoint:* press `Win`, type `cmd`, press Enter, then run `nvidia-smi`. You should
     see "NVIDIA GeForce RTX 5090" and a CUDA Version of 12.8 or higher.
3. **Python 3.11 or 3.12 from python.org** (not the Microsoft Store version).
   Download from <https://www.python.org/downloads/windows/>, run the installer, and tick
   **"Add python.exe to PATH"** before clicking *Install Now*.
   - *Checkpoint:* in a new Command Prompt, `python --version` prints `Python 3.11.x` or `3.12.x`.
4. **Git for Windows**: <https://git-scm.com/download/win>, defaults are fine.
5. **FFmpeg, shared build** (needed only for the cloned voice in Step 6A, harmless otherwise).
   F5-TTS reads audio through torchcodec, which needs FFmpeg's *shared* DLLs, not just
   `ffmpeg.exe`. In Command Prompt run `winget install --id Gyan.FFmpeg.Shared -e`. Then put
   its `bin` folder on your PATH: open a **new** Command Prompt and run
   `dir /s /b "%LOCALAPPDATA%\Microsoft\WinGet\Packages\avcodec*.dll"`; copy the folder part of
   the line it prints (it ends in `...\ffmpeg-<version>-full_build-shared\bin`). Press `Win`,
   type `environment variables`, open *Edit environment variables for your account*, select
   *Path* > *Edit...* > *New*, paste the folder, click *OK* on every dialog. Open another new
   Command Prompt and check `ffmpeg -version`.
6. **espeak-ng: nothing to install.** Kokoro brings its own copy through the `espeakng-loader`
   package. Skip any system installer or `PHONEMIZER_*` variables other guides mention.
7. **Microphone and speakers.** Right-click the speaker icon in the taskbar > *Sound settings*.
   Under *Input*, choose the microphone you will use and speak: the *Input volume* bar must
   move. Under *Output*, choose your speakers or headset. Also open *Settings > Privacy &
   security > Microphone* and make sure *Microphone access* and *Let desktop apps access your
   microphone* are **On**.
8. **Ollama for Windows**: download from <https://ollama.com/download/windows>, run the
   installer. It starts automatically and adds a llama icon in the system tray.
   - *Checkpoint:* `ollama --version` in Command Prompt prints a version.
9. **(Track A only) Docker Desktop**: <https://www.docker.com/products/docker-desktop/>.
   During setup keep *Use WSL 2* selected. After installing, open Docker Desktop once and
   wait until it says *Engine running*.

---

## Step 1: Get the RINN model into Ollama

1. Open Command Prompt and run:
   ```bat
   ollama pull qwen3.8:27b
   ```
   This downloads about 18 GB once. Wait for `success`.
2. Get the project onto the PC (skip if the `my-website` repository is already cloned):
   ```bat
   cd %USERPROFILE%
   git clone https://github.com/Jordantelder/my-website.git
   cd my-website
   git checkout claude/rinn-rag-model-clone-vph427
   cd rinn-ollama
   ```
   If the branch has since been merged, `git checkout main` instead. Every later command in
   this plan assumes you are inside `%USERPROFILE%\my-website\rinn-ollama`.
3. Create the `rinn` model (base model + RINN's persona and settings):
   ```bat
   ollama create rinn -f Modelfile
   ```
4. *Checkpoint:* run `ollama run rinn`, type `Who are you and what do you do?`, press Enter.
   The answer should introduce itself as RINN, the Regulatory Intelligence Neural Network.
   Type `/bye` to leave.

---

## Step 2: Install the Python project with the voice extras

1. Still in `rinn-ollama`, create and activate a virtual environment:
   ```bat
   python -m venv .venv
   .venv\Scripts\activate
   python -m pip install --upgrade pip
   ```
   Your prompt now starts with `(.venv)`. Every `pip` and `rinn-*` command below must be run
   with this prompt active (run `.venv\Scripts\activate` again in any new window).
2. Install PyTorch with CUDA **first** (the RTX 5090 needs the CUDA 12.8 build):
   ```bat
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
   *Checkpoint:* `python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"`
   prints `True NVIDIA GeForce RTX 5090`. If it prints `False`, redo this step and see
   Troubleshooting "no kernel image".
3. Install RINN with the voice client, the speech server, and the stock voice:
   ```bat
   pip install -e ".[voice,server,kokoro]"
   pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"
   ```
   The second line provides the CUDA libraries faster-whisper needs; `rinn-voice` adds them to
   the DLL search path automatically on Windows.
4. *Checkpoint:*
   ```bat
   rinn --check
   rinn-voice --list-devices
   ```
   The first prints `OK: Ollama at http://localhost:11434 has model qwen3.8:27b`. The second
   lists your audio devices; note the index number of your microphone (a line with `1 in`)
   and speakers (`2 out`). The device marked `>` / `<` is the Windows default, which is used
   unless you pass `--mic N` / `--speaker N`.

---

## Step 3: Start the speech server with a stock voice

Keep this window open for as long as you want to talk to RINN.

1. Open a **second** Command Prompt, go to the project, activate the environment:
   ```bat
   cd %USERPROFILE%\my-website\rinn-ollama
   .venv\Scripts\activate
   ```
2. Start the server with Kokoro and the local Whisper endpoint:
   ```bat
   rinn-voice-server --backend kokoro --voice af_bella --stt large-v3-turbo
   ```
   The first start downloads Kokoro (about 330 MB) and the Whisper model (about 1.6 GB).
   Wait for two lines: `TTS backend 'kokoro' ready; voices: ...` and `STT model 'large-v3-turbo' ready`,
   then `Uvicorn running on http://127.0.0.1:8880`.
   - Voices: `af_heart` (female, top grade A on Kokoro's voice card), `af_bella` (female, A-,
     the default here), `af_nicole`, `am_michael` / `am_fenrir` / `am_puck` (male), `bf_emma`
     (British female). Change with `--voice`.
   - Leave `--stt` out if you only want text-to-speech from the server (the `rinn-voice`
     client loads its own Whisper model anyway; the server's STT is what Open WebUI uses).
3. *Checkpoint:* in your browser open <http://127.0.0.1:8880/health>. You should see JSON with
   `"status":"ok"`, `"tts_backend":"kokoro"`. Then make a test file from the **first** window
   (PowerShell syntax; open PowerShell if you are in Command Prompt):
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8880/v1/audio/speech `
     -ContentType 'application/json' `
     -Body '{"input":"Hello, this is RINN. Your speech server is working.","voice":"af_bella","response_format":"wav"}' `
     -OutFile test.wav
   Start-Process test.wav
   ```
   Your default media player opens and you hear the sentence.

---

## Step 4: Talk to RINN

1. In the **first** window (environment active, inside `rinn-ollama`) run:
   ```bat
   rinn-voice
   ```
   It prints `speech: http://127.0.0.1:8880/v1 voice=af_bella`, loads the Whisper model
   (10 to 20 seconds the first time), then `RINN voice (qwen3.8:27b) ready. Press Enter to
   talk, or type a question. /quit to exit.`
2. Press **Enter**. You see `listening... (speak, then pause)`. Ask your question in a normal
   voice, for example *"What testing does a 510(k) for a single-use endoscope need?"*, then
   stop talking. After about 1.2 seconds of silence it prints `transcribing...`, then
   `you (heard): ...` with what it understood, then `rinn>` followed by the answer streaming
   in. The first sentence is spoken while the rest is still being written.
3. Follow-up questions keep the conversation: if RINN asks a clarifying question, just press
   Enter and answer with a word or two, exactly like the text version.
4. Useful keys and commands inside the session. The `you>` prompt comes back as soon as the
   answer text is complete, so RINN may still be talking while you read it:
   - **Enter** on an empty line: record a question (RINN goes quiet first, so the microphone
     does not pick up the speakers).
   - Type a question instead of speaking whenever you prefer; asking while RINN is still
     talking cuts that speech off.
   - `/stop`: silence RINN and drop whatever was still to be spoken.
   - `/reset`: forget the conversation.
   - `/quit`: exit. `Ctrl+C` while an answer is being written aborts that answer and silences
     RINN; at the prompt it exits.
5. Options you may want (add to the command in step 1):
   - `--silence 0.8` ends recording after a shorter pause; `--silence 2.0` lets you think mid-sentence.
   - `--mic 3 --speaker 5` selects devices by the index from `rinn-voice --list-devices`.
   - `--tts-voice af_heart` picks another stock voice; `--tts-speed 1.1` speaks slightly faster.
   - `--think` turns Qwen3.8's thinking mode on (better on hard questions, but the first
     spoken words arrive several seconds later). It is off by default for voice.
   - `--context "C:\path\to\notes.txt"` grounds answers in a document, with citations.
   - `--text-only` if you have no microphone; `--no-speak` for text only.
   - `--ask "your question"` answers one question aloud and exits (handy for shortcuts).
6. *Checkpoint:* you asked a question by voice, saw the transcript, saw the answer stream in,
   and heard it start within a few seconds. Latency guide on the RTX 5090 with thinking off:
   transcription about 1 second, first spoken sentence 2 to 4 seconds after you stop talking.

---

## Step 5: Make it convenient (optional)

1. Create `%USERPROFILE%\my-website\rinn-ollama\start-rinn-voice.bat` with Notepad:
   ```bat
   @echo off
   cd /d %USERPROFILE%\my-website\rinn-ollama
   call .venv\Scripts\activate
   start "RINN speech server" cmd /k rinn-voice-server --backend kokoro --voice af_bella --stt large-v3-turbo
   echo Waiting for the speech server to load its models...
   :wait
   curl -sf -o nul http://127.0.0.1:8880/health
   if errorlevel 1 (timeout /t 2 >nul & goto wait)
   rinn-voice
   pause
   ```
   Double-clicking it opens the server in its own window, waits until the server reports
   ready (the health check answers 503 while models load), then starts the voice session;
   `pause` keeps the window open so you can read any error. Once you switch to your cloned
   voice (Step 6), replace the server line with the command from that step.
2. Right-click the `.bat` file > *Show more options* > *Send to* > *Desktop (create shortcut)*.
3. To keep RINN's model loaded between questions, set `RINN_KEEP_ALIVE=30m` in
   `rinn-ollama\.env` (copy `.env.example` to `.env` first).

---

## Step 6: Switch to your cloned voice

Pick the path that matches the voice model you already have. All three run behind the same
server; `rinn-voice` does not change at all.

### 6A. Your F5-TTS fine-tune (the model from the September 2025 sessions)

1. Locate the checkpoint from that project. Typical locations: the `F5-TTS\ckpts\<project-name>\`
   folder next to the `generate.py` script you used then. You need two files:
   - `model_<step>.pt` or `model_<step>.safetensors` (the fine-tuned weights, usually the
     highest step number or the one you liked best), and
   - `vocab.txt` from the same folder (or from `F5-TTS\data\<project-name>_char\vocab.txt`).
2. Pick a reference clip of your voice: one WAV, **6 to 10 seconds**, clean, one sentence,
   no music. Any file from your 10-hour sliced dataset works. Write down its exact transcript
   (what is said, word for word, with punctuation). Copy the clip to
   `%USERPROFILE%\my-website\rinn-ollama\voice\ref.wav` (create the folder).
3. Install the backend in the environment and check that audio decoding works:
   ```bat
   pip install -e ".[f5tts]"
   python -c "import torch, torchaudio; from torchcodec.decoders import AudioDecoder; print(torch.__version__, torchaudio.__version__, 'decoding ok')"
   ```
   - *Checkpoint:* the last line prints the two versions and `decoding ok`. If it complains
     about FFmpeg or `libtorchcodec`, Step 0.5 was skipped or the `bin` folder is not on PATH.
     If it complains that torchcodec and torch versions do not match, install the torchcodec
     release listed for your torch version in the table at
     <https://github.com/pytorch/torchcodec#installing-torchcodec>, for example
     `pip install "torchcodec==0.9.*"`, and run the check again.
4. Stop the Kokoro server (`Ctrl+C` in its window) and start the F5-TTS server:
   ```bat
   rinn-voice-server --backend f5tts ^
     --f5-ckpt "C:\path\to\model_1200000.pt" --f5-vocab "C:\path\to\vocab.txt" ^
     --ref-audio voice\ref.wav --ref-text "Exact transcript of the reference clip." ^
     --stt large-v3-turbo
   ```
   Use the same architecture your fine-tune used: open `F5-TTS\ckpts\<project-name>\setting.json`
   (the fine-tune app writes it) and look at `exp_name`. `F5TTS_v1_Base` has been the default
   since March 2025 and needs no flag; if it says `F5TTS_Base`, add `--f5-model F5TTS_Base`.
   If the file is missing, start without the flag. A wrong choice usually still loads but
   sounds garbled, so if the checkpoint test below sounds wrong with a clean clip, try the
   other value. Wait for `TTS backend 'f5tts' ready; voices: clone`.
5. *Checkpoint:* repeat the PowerShell test from Step 3 with `"voice":"clone"` and listen.
   It should be your voice. If it sounds rushed or mumbled, use a different reference clip
   (shorter, clearer) and double-check the transcript matches it exactly.
6. Speed knob: F5-TTS generates a whole sentence before it can be played. On the 5090 a
   sentence takes roughly 0.5 to 1.5 seconds at 32 denoising steps. Add `--f5-nfe 16` for
   about twice the speed at slightly lower quality.
7. Run `rinn-voice --tts-voice clone` in the first window. Add `--tts-voice clone` to your
   `.bat` file too.

### 6B. A Qwen3-TTS fine-tune (the July 2026 recommendation for the 10-hour dataset)

1. Install: `pip install -e ".[qwen3tts]"` (FlashAttention is optional; skip it on Windows).
2. If you fine-tuned with the official `finetuning` scripts, you have a folder such as
   `output\checkpoint-epoch-2` and a speaker name you passed as `--speaker_name`. Start:
   ```bat
   rinn-voice-server --backend qwen3tts --qwen-model "C:\path\to\output\checkpoint-epoch-2" --qwen-speaker your_speaker_name --stt large-v3-turbo
   ```
3. Without a fine-tune you can still clone zero-shot from a reference clip with the Base model:
   ```bat
   rinn-voice-server --backend qwen3tts --qwen-model Qwen/Qwen3-TTS-12Hz-1.7B-Base --ref-audio voice\ref.wav --ref-text "Exact transcript." --stt large-v3-turbo
   ```
   The first run downloads the model (several GB).
4. *Checkpoint and use:* repeat the PowerShell test from Step 3 with `"voice":"clone"` for the
   zero-shot path, or your speaker name for the fine-tuned path. Then run
   `rinn-voice --tts-voice clone` (zero-shot) or `rinn-voice --tts-voice your_speaker_name`
   (fine-tuned; the same name you passed as `--qwen-speaker`).

### 6C. Fish Speech or another engine

Any server that implements `POST /v1/audio/speech` works. Start it, then run
`rinn-voice --tts-url http://127.0.0.1:PORT/v1 --tts-model MODEL --tts-voice VOICE` with the
values that server expects. Ask the server for WAV output; `rinn-voice` requests
`response_format: wav`.

---

## Step 7 (Track A): Voice chat in the browser with Open WebUI

This gives a chat page with a microphone button, read-aloud answers, and a hands-free call
mode, all backed by the same `rinn` model and the same speech server.

1. Make the speech server reachable from Docker: stop it and restart it with two extra
   flags, `--host 0.0.0.0` and `--api-key` followed by a password you choose (everything else
   unchanged), for example
   `rinn-voice-server --backend kokoro --voice af_bella --stt large-v3-turbo --host 0.0.0.0 --api-key rinn-local-2026`.
   **Warning:** `--host 0.0.0.0` makes the server reachable from every device on your network;
   the key is what stops them from using your GPU. When Windows shows a *Windows Security
   Alert* for `python.exe`, tick **Private networks** only and click *Allow access*. From now
   on `rinn-voice` needs the same key: run it as `rinn-voice --tts-api-key rinn-local-2026`
   (or put `RINN_TTS_API_KEY=rinn-local-2026` in `.env`) and update the `.bat` file.
   Also let Ollama accept connections from Docker: right-click the Ollama icon in the system
   tray > *Settings*, turn on **Expose Ollama to the network**, and save. (Older Ollama builds
   without that switch: add a **User** environment variable `OLLAMA_HOST` = `0.0.0.0`, then quit
   Ollama from the tray icon and start it again from the Start menu; `rinn` and `rinn-voice`
   treat that value as your own PC, so Track B keeps working.) Ollama has no password, so do
   this only on a home or office network you trust, and tick *Private networks* only in its
   firewall prompt as well.
2. Start Open WebUI (Docker Desktop must be running). In Command Prompt:
   ```bat
   docker run -d -p 127.0.0.1:3000:8080 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434 -v open-webui:/app/backend/data --name open-webui --restart always ghcr.io/open-webui/open-webui:main
   ```
   (`127.0.0.1:3000` keeps the chat page reachable only from this PC.)
3. Open <http://localhost:3000>. Click *Get started*, create the first account (it becomes the
   administrator).
4. Check the model connection: click your name (bottom left) > *Admin Panel* > *Settings* >
   *Connections*. The Ollama URL should read `http://host.docker.internal:11434`; click the
   refresh icon next to it and you should see a success toast. Back in the chat, the model
   picker at the top lists `rinn:latest`. Select it.
5. Configure speech: *Admin Panel* > *Settings* > *Audio*.
   - **STT Settings**: *Speech-to-Text Engine* = `OpenAI`; *API Base URL* =
     `http://host.docker.internal:8880/v1`; *API Key* = the key you chose in 7.1
     (`rinn-local-2026` in the example); *STT Model* = `whisper-1`.
     (Alternative with zero setup: *Web API*, which uses the browser's built-in recognition;
     note that Chrome and Edge send that audio to Google or Microsoft.)
   - **TTS Settings**: *Text-to-Speech Engine* = `OpenAI`; *API Base URL* =
     `http://host.docker.internal:8880/v1`; *API Key* = the same key; *TTS Model* = `rinn`;
     *TTS Voice* = `af_bella` (or `clone` / your speaker name when the server runs your voice).
   - Click *Save*.
6. Turn on read-aloud for yourself: click your name > *Settings* > *Audio* > enable
   *Auto-playback response*. Save.
7. Use it: in the chat box, click the **microphone** icon, speak, click it again (or wait) to
   send; the answer is read aloud as it arrives. The **headphones/call** icon next to it starts
   hands-free *Call* mode, where you talk and listen continuously. Allow the microphone when the
   browser asks (this works on `localhost` without HTTPS; from another PC you would need HTTPS).
8. *Checkpoint:* you asked by voice in the browser and heard the reply. To stop everything
   later: `docker stop open-webui`; to start again: `docker start open-webui`.

---

## Verification checklist

Tick all of these and the system is complete:

- [ ] `nvidia-smi` shows the RTX 5090 with CUDA 12.8 or newer.
- [ ] `rinn --check` reports the `qwen3.8:27b` model.
- [ ] `ollama run rinn` introduces itself as RINN.
- [ ] `http://127.0.0.1:8880/health` shows `"status":"ok"`.
- [ ] The PowerShell speech test produced a `test.wav` you could hear.
- [ ] `rinn-voice` transcribed a spoken question correctly and spoke the answer.
- [ ] (Cloned voice) the `clone` voice test sounds like you.
- [ ] (Open WebUI) the microphone button in the browser produces a spoken answer.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `no kernel image is available for execution on the device` or `torch.cuda.is_available()` is `False` | PyTorch build without Blackwell (RTX 5090) support. Run `pip uninstall torch torchaudio` then `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128`. Docker images with old PyTorch (some Kokoro-FastAPI GPU images) have the same problem; use the native `rinn-voice-server` instead. |
| `Could not locate cublas64_12.dll` / `cudnn_ops64_9.dll` when Whisper loads | Run `pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"` inside the venv. If it persists, download the DLL bundle from <https://github.com/Purfview/whisper-standalone-win/releases/tag/libs> and unzip the DLLs next to `.venv\Scripts\python.exe`. Or use `--stt-device cpu --stt-model small.en` temporarily. |
| `cannot open microphone` or `PortAudio library not found` | On Windows the `sounddevice` wheel bundles PortAudio, so reinstall: `pip install --force-reinstall sounddevice`. Check *Settings > Privacy & security > Microphone*. Run `rinn-voice --list-devices` and pass `--mic N` with your microphone's index. |
| `(heard nothing)` every time | The microphone level is too low or the wrong device is default. In Windows *Sound settings* raise *Input volume* until the bar moves while you speak; or pass `--mic N`. Wait for the `listening...` line, then start speaking; talk at a normal volume from within a metre of the microphone. |
| Transcript is wrong for regulatory terms | Use `--stt-model large-v3-turbo` (default) rather than `small`; speak numbers as words ("five ten k"); the model is already primed with FDA vocabulary. |
| `no TTS server at http://127.0.0.1:8880/v1` | The server window is closed or still loading. Start it (Step 3) and wait for `Uvicorn running`. |
| Kokoro fails with `espeak` / `phonemizer` errors | The bundled espeak-ng did not install cleanly. In the venv run `pip install --force-reinstall espeakng-loader "misaki[en]"` and retry; no system espeak-ng or `PHONEMIZER_*` variables are involved. |
| F5-TTS output is mumbled, rushed, or in the wrong voice | Reference clip longer than 12 s, noisy, or its transcript does not match: use a 6 to 10 s clean clip and the exact words. If the clip is fine, `--f5-model` does not match the checkpoint's `exp_name` (Step 6A.4): try the other value. Also try a different checkpoint step. |
| F5-TTS fails with `size mismatch` / `Missing key(s)` when loading | The `--f5-model` architecture does not match the checkpoint. Switch between `F5TTS_v1_Base` (no flag) and `--f5-model F5TTS_Base`. |
| F5-TTS says `ffmpeg`, `libtorchcodec`, `TorchCodec is required`, or `avcodec` cannot be found | torchaudio decodes audio through torchcodec, which needs the FFmpeg *shared* DLLs on PATH (Step 0.5, `Gyan.FFmpeg.Shared`, `bin` folder added to *Path*), and a torchcodec release matching your torch version (Step 6A.3). Open a new Command Prompt after changing PATH. |
| Speech starts late (10 s or more) | Thinking mode is on (`--think`); leave it off for voice. Ollama unloaded the model after idle time: set `RINN_KEEP_ALIVE=30m`. F5-TTS at 32 steps: try `--f5-nfe 16`. |
| Sentences are cut oddly or citations are read aloud | The server strips Markdown and `[K123456.pdf]` tags; if you use another TTS server, `rinn-voice` strips them before sending. Report any leftover pattern so the filter can be extended. |
| Open WebUI cannot reach Ollama (`Connection error`) | Ollama must listen on all interfaces (Settings > *Expose Ollama to the network*, or `OLLAMA_HOST=0.0.0.0`, then quit and restart Ollama), and the URL must be `http://host.docker.internal:11434`. |
| Open WebUI TTS/STT fails, or shows `401` | The speech server must run with `--host 0.0.0.0 --api-key ...`, the URL in Open WebUI must be `http://host.docker.internal:8880/v1`, and the *API Key* fields must hold the same key. Test it from the browser: <http://127.0.0.1:8880/docs>. |
| `rinn-voice` says `401 missing or wrong API key` | The server was started with `--api-key`; pass the same value with `--tts-api-key` or `RINN_TTS_API_KEY`. |
| Browser never asks for microphone permission | Use `http://localhost:3000`, not the PC's IP; browsers require HTTPS for microphones except on localhost. |
| `ollama pull` is slow or fails | Retry; it resumes. Check free disk space (about 20 GB needed for the model, plus 5 GB for speech models). |

---

## If you are not Claude: hand-off notes for another AI agent or helper

Paste the following as your first message to the assistant you are using:

> I am setting up a local voice interface for "RINN", a regulatory-affairs assistant that runs
> on Ollama (model `qwen3.8:27b`, persona in `rinn-ollama/Modelfile`) on a Windows 11 PC with an
> RTX 5090. The code is in the `rinn-ollama` folder of the `Jordantelder/my-website` repository.
> `rinn-ollama/docs/VOICE_ASSISTANT_PLAN.md` is the plan; follow it step by step, run each
> Checkpoint, and if one fails use the Troubleshooting table and the module docstrings under
> `rinn-ollama/rinn/voice/`. The relevant commands are `rinn-voice-server` (speech server,
> `rinn/voice/server.py`) and `rinn-voice` (microphone conversation loop, `rinn/voice/cli.py`).
> Tests run with `pytest` and do not need a GPU or microphone. Do not change the RINN persona
> or the Ollama model; only fix what the checkpoint shows is broken.

Files that matter:

| File | Purpose |
| --- | --- |
| `rinn/voice/cli.py` | `rinn-voice` command: options, device selection, startup checks |
| `rinn/voice/loop.py` | Listen, ask RINN, print and speak sentences as they stream |
| `rinn/voice/chunker.py` | Sentence splitting for streaming speech; Markdown/citation removal |
| `rinn/voice/audio.py` | Microphone capture with silence detection, playback queue, WAV helpers |
| `rinn/voice/stt.py` | faster-whisper wrapper (adds CUDA DLL paths on Windows) |
| `rinn/voice/tts_client.py` | Client for the OpenAI-compatible speech API |
| `rinn/voice/server.py` | `rinn-voice-server`: `/v1/audio/speech`, `/v1/audio/transcriptions`, `/health` |
| `rinn/voice/tts_backends.py` | Kokoro, F5-TTS, Qwen3-TTS backends and their environment variables |
| `Modelfile`, `rinn/persona.py` | The RINN persona used by both `ollama run rinn` and the Python client |

Environment variables (all optional; flags override them):

| Variable | Used by | Meaning |
| --- | --- | --- |
| `RINN_TTS_URL`, `RINN_TTS_VOICE`, `RINN_TTS_MODEL`, `RINN_TTS_SPEED`, `RINN_TTS_API_KEY` | `rinn-voice` | Where the speech server is, which voice to ask for, and its key if one is set |
| `RINN_TTS_BACKEND` | server | `kokoro`, `f5tts`, `qwen3tts` |
| `RINN_VOICE_SERVER_HOST`, `RINN_VOICE_SERVER_PORT`, `RINN_VOICE_SERVER_API_KEY` | server | Bind address (default `127.0.0.1`), port (`8880`), and the optional key that protects the `/v1` routes |
| `RINN_STT_MODEL`, `RINN_STT_DEVICE`, `RINN_STT_COMPUTE` | server | Enable and configure the transcription endpoint |
| `RINN_F5_CKPT`, `RINN_F5_VOCAB`, `RINN_F5_MODEL`, `RINN_F5_REF_AUDIO`, `RINN_F5_REF_TEXT`, `RINN_F5_NFE`, `RINN_F5_SEED` | server | F5-TTS clone |
| `RINN_QWEN_TTS_MODEL`, `RINN_QWEN_TTS_SPEAKER`, `RINN_QWEN_TTS_REF_AUDIO`, `RINN_QWEN_TTS_REF_TEXT`, `RINN_QWEN_TTS_LANGUAGE` | server | Qwen3-TTS clone |
| `RINN_MODEL`, `OLLAMA_HOST` / `RINN_OLLAMA_HOST`, `RINN_THINK`, `RINN_KEEP_ALIVE` | both | RINN model settings (see the project README). `RINN_OLLAMA_HOST` wins over `OLLAMA_HOST`, and a bind address such as `0.0.0.0` is read as this PC. |

What "real time" means here: the text is printed token by token as Ollama produces it; the
audio lags by about one sentence because a sentence must be complete before it can be
synthesized. With the stock voice on the 5090 that lag is 1 to 3 seconds; with F5-TTS at
16 steps about the same; with Qwen3-TTS 1.7B roughly 1 to 2 seconds per sentence.

---

## Sources used to build this plan

- Ollama model tags: <https://ollama.com/library/qwen3.8/tags>
- faster-whisper (models and CUDA requirements): <https://github.com/SYSTRAN/faster-whisper>
- Kokoro-82M and voice grades: <https://github.com/hexgrad/kokoro>, <https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md>
- Kokoro-FastAPI (alternative TTS server): <https://github.com/remsky/Kokoro-FastAPI>
- F5-TTS API: <https://github.com/SWivid/F5-TTS>
- Qwen3-TTS inference and fine-tuning: <https://github.com/QwenLM/Qwen3-TTS>
- Open WebUI quick start and Kokoro/OpenAI audio settings: <https://docs.openwebui.com/getting-started/quick-start/>, <https://docs.openwebui.com/features/chat-conversations/audio/text-to-speech/Kokoro-FastAPI-integration/>, <https://docs.openwebui.com/troubleshooting/audio/>
- Your July 2026 voice-model analysis (Google Drive, "Voice Cloning Software Analysis") and the September 2025 F5-TTS sessions.
