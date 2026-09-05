# RINN on Ollama

`rinn-ollama` is the model layer of **RINN** (Regulatory Intelligence Neural
Network), the FDA regulatory-affairs research assistant, rebuilt as a
standalone building block on [Ollama](https://ollama.com) with the
`qwen3.8:27b` model. It contains the RINN persona, an Ollama client wrapper,
a conversation-aware assistant, report export, and an Ollama `Modelfile`, so
that `ollama run rinn` and `python -m rinn` both behave like RINN.

It deliberately does **not** contain the FDA document corpus, the vector
index, the web-crawl database, or the Streamlit UI of the full RINN RAG
system. Retrieval plugs in through a small hook (see *Plugging retrieval
back in*).

## Where this came from

The original RINN code was developed in Claude sessions that ran on a local
workstation through Remote Control (for example "FDA product code web search
system", "RINN FDA product code search IP review", "Merge 5090 run",
"Harmonize dry run", and "Verify corpus extraction files before nightly
run"). Those files stayed on that machine; they are not in any GitHub
repository that Claude can reach, and none of them were moved, altered, or
deleted. This package was reconstructed from the RINN material that *is*
reachable:

| Evidence | What it contributed |
| --- | --- |
| Google Docs from Oct 2025 ("Now it seems that RINN has forgotten…", "So within my RINN model…", "Are there things I can do to improve…", "If I add a new document…") | The RINN `app.py` design: Streamlit + LangChain + `Ollama(model=..., temperature=0.4)` + Chroma with `all-mpnet-base-v2` embeddings, the ReAct agent with conversation memory, and the six-point `rinn_instructions` system prompt. |
| `RINN_answer.pdf` (June 2026) | The report layout (title, *Generated:* stamp, Question / Answer / Sources) and the verbatim disclaimer footer, plus the citation style `[K183256.pdf]` and `[WEB SOURCE: https://…]`. |
| `fda-corpus` Drive folder (`corpus.tar.zst`, `shards_5090/`, `db-backups/rinn_web-*.sqlite3`) and `RINN.pdf` | Confirmed that the production system has a large FDA corpus, sharded extraction, a weekly-backed-up web database, and a web dashboard. All of that is out of scope here. |
| ollama.com | `qwen3.8:27b` exists (18 GB default quantization, 256K context, thinking + tools + vision). "qwen3.8-27b" in the request was read as this tag. |

Anything the evidence did not settle (embedding model of the current build,
exact sampling parameters beyond `temperature=0.4`, UI details) is a default
here and is easy to change in `rinn/config.py` or `.env`.

## What is in the box

```
rinn-ollama/
├── Modelfile                 # ollama create rinn -f Modelfile  (generated, kept in sync by a test)
├── rinn/
│   ├── persona.py            # RINN system prompt, disclaimer, report title
│   ├── config.py             # Settings: model, host, sampling, thinking, history (env / .env)
│   ├── llm.py                # OllamaLLM: chat + streaming, thinking, clear errors
│   ├── assistant.py          # RinnAssistant: memory, ContextDoc grounding, source list
│   ├── export.py             # Markdown report in the RINN_answer layout
│   ├── modelfile.py          # renders the Modelfile from persona + settings
│   └── cli.py                # `rinn` / `python -m rinn`
├── scripts/
│   ├── create_model.sh       # pull base model, build `rinn` in Ollama
│   └── build_modelfile.py    # regenerate Modelfile (--check in CI)
├── tests/                    # pytest suite with a fake Ollama client (no server needed)
├── .env.example
├── pyproject.toml            # package metadata; `pip install -e ".[dev]"`
├── requirements.txt          # plain pip alternative
└── requirements-dev.txt
```

## Quick start

### Option A: Ollama only, no Python

```bash
ollama pull qwen3.8:27b
ollama create rinn -f Modelfile      # or: ./scripts/create_model.sh
ollama run rinn
```

### Option B: the Python assistant

```bash
cd rinn-ollama
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env                 # optional, all values have defaults

rinn --check                         # verifies the server and that qwen3.8:27b is pulled
rinn                                 # interactive session (/help for commands)
rinn --ask "What testing does a 510(k) for a single-use endoscope need?" \
     --context notes/K183256.txt --export exports/endoscope.md
```

The interactive session streams the answer, remembers the conversation (so a
one-word reply to a clarifying question works, as in the original ReAct
design), and offers `/context PATH`, `/export PATH`, `/reset`, `/quit`.

### Option C: from your own code

```python
from rinn import ContextDoc, OllamaLLM, RinnAssistant, Settings
from rinn.export import save_markdown

settings = Settings.from_env()                 # or Settings(model="qwen3.8:27b-q8_0")
assistant = RinnAssistant(OllamaLLM(settings))

docs = [ContextDoc("K183256.pdf", open("K183256.txt").read())]
answer = assistant.ask("Which bench tests were reported?", context=docs,
                       on_chunk=lambda c: print(c.text, end="") if c.kind == "content" else None)
save_markdown(answer, "exports/K183256.md")
```

## Configuration

Read from `.env` in the working directory, then the process environment, then
CLI flags. Every value is optional.

| Variable | Default | Meaning |
| --- | --- | --- |
| `RINN_MODEL` | `qwen3.8:27b` | Ollama model tag. Also `qwen3.8:27b-q8_0` (30 GB), `qwen3.8:27b-mlx` (Apple). |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server. `host:port` or a bare host is accepted; without a scheme the default port 11434 is assumed, exactly as `ollama` itself does. |
| `RINN_TEMPERATURE` | `0.4` | Same value the original `app.py` used. |
| `RINN_TOP_P` | `0.9` | Nucleus sampling. |
| `RINN_NUM_CTX` | `32768` | Context window. Lower it (e.g. `16384`) if the GPU runs out of memory. |
| `RINN_REPEAT_PENALTY` | `1.05` | Repetition penalty. |
| `RINN_NUM_PREDICT` | `-1` | Max tokens per answer; `-1` unlimited, `-2` fill the context. |
| `RINN_SEED` | unset | Fixed seed for reproducible answers. |
| `RINN_THINK` | `true` | Qwen3.8 thinking mode. `false` for faster, shallower answers. |
| `RINN_SHOW_THINKING` | `false` | Print the reasoning stream and include it in exports. |
| `RINN_KEEP_ALIVE` | `10m` | How long Ollama keeps the model loaded after a request. |
| `RINN_TIMEOUT` | `600` | Seconds to wait for a response. Connecting to the server is capped at 10 seconds so a wrong host fails fast. |
| `RINN_MAX_HISTORY_TURNS` | `20` | Question/answer pairs kept in the conversation. |
| `RINN_EXTRA_INSTRUCTIONS` | unset | Appended to the system prompt for a deployment. |

CLI flags `--model`, `--host`, `--temperature`, `--num-ctx`, `--no-think`,
`--show-thinking` override the corresponding variables for one run.

### Sources in reports

A report's **Sources** section lists only the documents that were actually
supplied as context (`--context`, `/context`, or `ContextDoc` objects), in the
order the answer cited them. Submission numbers or URLs the model wrote from
memory are collected under **Mentioned in answer (unverified)** instead, and
the system prompt tells the model to say when it is answering from general
knowledge. Pressing Ctrl-C while an answer streams aborts that answer without
adding it to the conversation.

If the model rejects the `think` parameter (a base model without a thinking
capability), the client retries once without it and keeps it off for the rest
of the session.

## Plugging retrieval back in

The original RINN fed retrieved chunks to the model through a LangChain
retriever tool. Here the caller passes them as `ContextDoc` values and the
assistant renders them under a *Provided context* heading with the same
citation tags the reports use. A retriever is therefore a few lines:

```python
def retrieve(question: str, k: int = 6) -> list[ContextDoc]:
    hits = my_index.similarity_search(question, k=k)        # Chroma, SQLite FTS, web search...
    return [ContextDoc(source=h.metadata["source_file"], text=h.page_content) for h in hits]

answer = assistant.ask(question, context=retrieve(question))
```

When the original RINN code is available again, its ingestion, Chroma index,
`rinn_web` database, and UI can sit next to this package unchanged and call
`RinnAssistant.ask` with the documents they retrieve.

## Hardware notes

`qwen3.8:27b` at the default quantization is an 18 GB download and needs a
GPU with roughly 24 GB of memory or more for comfortable use; a 32 GB card
(such as an RTX 5090) runs it with the default 32K context. Use
`qwen3.8:27b-q8_0` for higher fidelity if you have 40 GB or more, or reduce
`RINN_NUM_CTX` if loading fails.

## Development

```bash
pip install -e ".[dev]"
pytest                                     # no Ollama server required
python scripts/build_modelfile.py          # after editing persona.py or config defaults
python scripts/build_modelfile.py --check  # fails if Modelfile is stale
```

## Note on this repository

This project lives inside the `my-website` repository, whose Cloudflare
Workers configuration uploads the repository root as static assets. The root
`.assetsignore` excludes `rinn-ollama/` (and repository files such as `.git/`
and `wrangler.jsonc`) so nothing here is published with the website.
