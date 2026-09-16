# QMSR Transition — Medical Device Seminar (90 minutes)

Speaker deck and companion materials for the seminar **"QMSR Transition: a strategic roadmap for shifting from FDA Part 820 to the Quality Management System Regulation."**

The Quality Management System Regulation took effect on **2 February 2026**. It replaced the Quality System Regulation, incorporated ISO 13485:2016 by reference, and reduced 21 CFR Part 820 to six operative sections. On the same day FDA withdrew the Quality System Inspection Technique and began inspecting under **Compliance Program 7382.850**. This material is written for the position that follows: finishing the transition where it is unfinished, and proving it on the first inspection under the new process.

## Files

| File | Purpose |
|---|---|
| `QMSR-Transition-Seminar.pptx` | 41-slide speaker deck. Every slide carries speaker notes with a running-clock cue (e.g. `[0:30 \| 3 min]`), talking points, source citations and facilitation prompts. |
| `QMSR-Transition-Participant-Handout.docx` | 19-page reference handout: the timeline, the new Part 820 section by section, the definitions hierarchy, what disappeared and where it went, the four FDA-specific provisions with field-level checklists, how an inspection runs, the QSR-to-QMSR crosswalk, the gap-assessment method, the roadmap, a 14-point self-test, a 30-60-90 plan, glossary and references. |
| `QMSR-Transition-Workshop-Exercise-Pack.docx` | Participant version of the three table exercises with the evidence packs, gap cards and plan card. No answers. |
| `QMSR-Transition-Facilitator-Guide.docx` | Speaker only. Run-of-show mapped to slide numbers, delivery notes, full answers for all three exercises, Q&A preparation, a pre-delivery accuracy checklist, statements to be careful with, and 60-minute / half-day / executive variants. |
| `QMSR-Gap-Assessment-Workbook.xlsx` | Working tool. Eight sheets: read me, a 58-row gap assessment covering every element of Compliance Program 7382.850, a formula-driven dashboard, the Model 2 minimum element list, §820.35 and §820.45 record checklists, the crosswalk, readiness metrics and the phased roadmap. |

## Session outline (90 minutes)

| Clock | Segment |
|---|---|
| 0:00 | Welcome, objectives, room poll |
| 0:06 | What changed on 2 February 2026, and what did not |
| 0:20 | The four load-bearing FDA-specific provisions |
| 0:30 | The inspection changed more than the regulation: Compliance Program 7382.850 |
| 0:45 | Exercise A: red-team the records, write the observation |
| 0:55 | From crosswalk to gap assessment |
| 1:05 | Exercise B: gap triage under time pressure |
| 1:15 | The roadmap: five phases, two tracks, metrics |
| 1:23 | Exercise C: 90-day plan, takeaways, Q&A |

## The argument the seminar makes

1. The regulation text shrank; the inspection surface grew.
2. ISO 13485 certification is not compliance. Four FDA-specific provisions carry the difference: the §820.10 hooks, §820.35 records, §820.45 labeling and packaging controls, and the §820.3 definitions.
3. The records that used to be shielded by §820.180(c) are now the first thing an investigator may read.
4. Renaming is not compliance; evidence is.

## Before presenting

1. Fill in the placeholders on slide 1 and slide 41, and on the title pages of the handout and exercise pack.
2. Work through **section 8 of the Facilitator Guide**, the accuracy checklist. Dates, citations and quotations were verified in September 2026 against the Federal Register, the CFR, FDA web pages, Compliance Program 7382.850, FDA webinar and town hall transcripts, published Warning Letters and FDA's inspection observation data. Regulations and FDA content change.
3. Note the statements flagged in the guide as needing care: the compliance program's issue date, the final rule date, the cost-savings figures (the final rule quotes two different numbers), vendor-compiled 2026 inspection statistics, and the Model 2 element counts.
4. The firms, records and findings in the exercises are fictional composites. The Warning Letter citations are real and quoted from the published letters.

## Regenerating the files

`src/` holds the generators (Node 18+ and Python 3):

```bash
cd src
npm install
pip install openpyxl
npm run build          # writes all five files to src/out/
```

`deck.js` builds the deck, `fix_notes.py` splits the speaker notes into proper paragraphs, `docs.js` builds the three Word documents and `workbook.py` builds the spreadsheet. Edit the text in those scripts and rebuild rather than editing the binaries, so changes stay reproducible.

After changing `workbook.py`, recalculate the spreadsheet so its formulas carry cached values:

```bash
python3 <skills>/xlsx/scripts/recalc.py out/QMSR-Gap-Assessment-Workbook.xlsx
```
