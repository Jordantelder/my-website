# ISO 13485 & Audit Readiness — Medical Device Seminar (90 minutes)

Speaker deck and companion materials for the seminar **"ISO 13485 & Audit Readiness: case studies on surviving unannounced audits and maintaining a global QMS."**

## Files

| File | Purpose |
|---|---|
| `ISO-13485-Audit-Readiness-Seminar.pptx` | 40-slide speaker deck. Every slide carries speaker notes with a running-clock cue (e.g. `[0:36 | 4 min]`), talking points and facilitation prompts. |
| `ISO-13485-Audit-Readiness-Participant-Handout.docx` | Participant handout: who audits unannounced, the 2026 regulatory snapshot, audit-critical ISO 13485 clauses, first-60-minutes protocol, roles and deputies, do/don't, 72-hour plan, global QMS architecture, vigilance timelines, readiness self-test, 30-60-90 plan, response-plan template, glossary, references. |
| `ISO-13485-Audit-Readiness-Case-Study-Workshop-Pack.docx` | Participant version of the four composite case studies, each with a timeline, three document exhibits, discussion questions and note space. No answers. |
| `ISO-13485-Audit-Readiness-Facilitator-Guide.docx` | Speaker only. Run-of-show mapped to slide numbers, delivery notes, model answers for every case question, Q&A preparation, a pre-delivery accuracy checklist, and 60-minute / half-day variants. |

## Session outline (90 minutes)

| Clock | Segment |
|---|---|
| 0:00 | Welcome, objectives, quick poll |
| 0:08 | Why readiness is now a permanent state: the 2026 landscape |
| 0:20 | ISO 13485 as the backbone: the clauses that decide audits |
| 0:32 | Anatomy of an unannounced audit: the first 60 minutes and the next 72 hours |
| 0:47 | Four case studies (table discussion and debrief) |
| 1:16 | Maintaining a global QMS: architecture, rhythm, readiness KPIs |
| 1:26 | Takeaways, 30-60-90 day plan, Q&A |

## Before presenting

1. Fill in the placeholders on slide 1 and slide 40 (speaker, date, venue, contact, handout link) and on the title pages of the handout and case pack.
2. Work through Section 8 of the Facilitator Guide. Regulatory dates, MDSAP rules and the vigilance-timeline table are current as of September 2026 and must be re-verified against primary sources before each delivery.
3. The four case studies are composites. Companies, people, places, products and document excerpts are fictional.

## Regenerating the files

The `src/` folder holds the generators (Node 18+ and Python 3):

```bash
cd src
npm install
npm run build          # writes the .pptx and .docx files to src/out/
```

`deck.js` builds the deck, `fix_notes.py` splits speaker notes into proper paragraphs, and `docs.js` builds the three Word documents. Edit the text in those scripts and rebuild rather than editing the binaries when you want a reproducible change.
