# Software Validation & Cybersecurity — Medical Device Seminar

Addressing the challenges of connected devices and Software as a Medical Device (SaMD).

Designed as a **90-minute seminar** with two facilitated working sessions.

## Files

| File | What it is |
|---|---|
| `Software_Validation_and_Cybersecurity_Seminar.pptx` | 52-slide deck. Every slide carries speaker notes — the argument to make, what to emphasise, what to cut, and clock checkpoints. |
| `Participant_Workbook.docx` | 18 pages. Note pages keyed to each section, both exercise worksheets, a 12-item readiness self-assessment, reference checklists, a 30-term glossary, an annotated standards list, and an action-plan page. Print double-sided, one per attendee. |
| `Facilitator_Guide.docx` | 7 pages. Run of show with clock times, ranked cut list, answer keys for both working sessions, expected questions with suggested handling, and a materials checklist. |
| `Quick_Reference_Card.docx` | 2 pages. Print double-sided on card: side 1 validation (classification, safety class, documentation level, requirements test, traceability), side 2 cybersecurity (524B, threat modelling, controls, architecture views, SBOM, vulnerability loop, testing). |

## Structure

| Clock | Slides | Segment |
|---|---|---|
| 0:00 | 1–4 | Open, objectives, room calibration poll |
| 0:09 | 5–11 | Part 1 — The new operating environment |
| 0:31 | 12–28 | Part 2 — Software validation |
| 1:21 | 29 | **Working session 1** — Classify and scope (12 min) |
| 1:33 | 30–44 | Part 3 — Cybersecurity |
| 2:17 | 45 | **Working session 2** — Tabletop (15 min) |
| 2:32 | 46–51 | Part 4 — Making it work |
| 2:45 | 52 | Discussion |

## Before you present

**Verify guidance currency.** Citations were checked against fda.gov when this was prepared
(September 2026), but FDA reissues guidance — re-check before presenting. The two that moved
most recently:

- **Premarket cybersecurity guidance** — current edition **27 June 2025**, retitled
  *Cybersecurity in Medical Devices: Quality Management System Considerations and Content of
  Premarket Submissions*. It supersedes the September 2023 edition and adds a section
  addressing FD&C Act s.524B directly.
- **Computer Software Assurance** — finalised **24 September 2025** as *Computer Software
  Assurance for Production and Quality Management System Software*. It supersedes Section 6 of
  the General Principles of Software Validation.

Also note: the AI-enabled device software functions *lifecycle management* guidance (January
2025) is still a **draft**; the AI **PCCP** guidance (December 2024) is final.

Slide 51 lists every source cited. The workbook repeats the list with a note on what each
document is actually useful for.

## Cross-references

The deck points attendees at workbook pages 5 (working session 1) and 7 (working session 2).
If the workbook is re-edited its pagination will move, so re-check those two references in the
deck. The workbook's own contents page is generated from the rendered document rather than
hand-maintained.

## Rebuilding

Sources are not kept in this repository — these are the finished deliverables. The deck was
generated with `pptxgenjs` and the handouts with `python-docx`.
