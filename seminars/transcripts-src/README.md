# Speaking transcripts: how they were produced

Full verbatim-read transcripts for all three seminars, written to be read from the page
with no improvisation, in the speaker's own documented style.

## Inputs

- Five of the speaker's own previously delivered transcripts, used only as a style corpus.
- For each deck: the on-screen text of every slide plus the speaker notes, extracted from
  the `.pptx`. The notes are the authoritative content; the on-screen text tells the
  drafter what the room is looking at.

## Pipeline

| Phase | Agents | What it did |
|---|---|---|
| Style | 4 + 1 | Four independent lenses on the corpus (syntax, discourse, lexicon, persona), then one synthesis into `style-spec.md` |
| Draft | 24 | One agent per five-slide chunk across the three decks, each given the style spec and its own slide content |
| Verify | 9 | Three critics per deck: style fidelity, content fidelity, continuity and speakability |
| Repair | 3 | One editor per deck, returning complete per-slide replacements; `repairs.json` |

`assemble.js` merges the chunk drafts, applies `repairs.json`, checks that every slide
number appears exactly once, and writes the `.docx` (matching the speaker's own file
format: "SLIDE n" bold 12pt, No Spacing style) plus a `.txt` twin.

To reproduce: `node assemble.js`. To re-run the agents, the workflow script is
`transcript-workflow.js`.

## Conventions the transcripts use

- `SLIDE n` on its own line, then the spoken prose. Nothing else on that line.
- These are workshops, not one-way webinars, and the style corpus offers no model for
  audience interaction. Where the speaker must stop reading, there is a stage direction
  in capitals inside square brackets on its own line — `[TABLE WORK - 10 MINUTES.
  CIRCULATE.]` — bolded in the `.docx` so it cannot be read aloud by mistake. These are
  never spoken.
- The greeting is the no-name form ("thank you for that introduction") so the line reads
  correctly whoever introduces the session. Inserting a name is a one-word edit.

## Known items for the speaker to decide

Recorded by the repair editors, not silently resolved:

- **Run time.** ISO 13485 runs ~94 minutes of speech and QMSR ~106, against 90-minute
  slots that also contain exercise time. Every candidate paragraph is sourced slide
  content, so the editors declined to cut and escalated instead. Each repair record names
  the cheapest cuts that lose no citation.
- **QMSR date order.** The editor converted spoken dates to month-day-year to match the
  corpus, while the slides print day-month. Reversible, but reverse it everywhere or
  nowhere.
- **Anecdotes.** The style corpus carries seven first-person consulting stories; these
  decks supply none, and the editors would not invent a client engagement. The repair
  records name the three slides where one would land best.
- **Slide placeholders.** Speaker name, title, date and venue are still bracketed on the
  title slides of the ISO 13485 and QMSR decks. The spoken text no longer depends on them.

`critiques.json` holds all 187 critic findings with the editors' accept/reject decisions.
