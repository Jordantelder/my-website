# Risk Management Workshop (ISO 14971)

**ISO 14971 in practice: aligning risk files with EU MDR and FDA expectations**

A 90-minute speaker-facing workshop, of which 35 minutes are hands-on exercises.
Elder Consulting, LLC. Prepared September 2026.

## Materials

| File | What it is |
|---|---|
| `ISO-14971-Risk-Management-Workshop.pptx` | 39 slides, every one carrying timed speaker notes |
| `ISO-14971-Risk-Management-Participant-Handout.docx` | 15 pages: the reference, with the full source list |
| `ISO-14971-Risk-Management-Exercise-Pack.docx` | 7 pages: the three worksheets, printed single-sided |
| `ISO-14971-Risk-Management-Facilitator-Guide.docx` | 8 pages, **speaker copy**: model answers, the questions that come, a pre-delivery accuracy checklist |
| `ISO-14971-Risk-File-Toolkit.xlsx` | 10 sheets, 494 formulas: a working skeleton of a risk management file |

## Structure

| Time | Section |
|---|---|
| 0:00 – 0:05 | Opening: the asymmetry, objectives, room poll |
| 0:05 – 0:18 | 1. The file is the argument: what ISO 14971:2019 actually requires |
| 0:18 – 0:30 | 2. Two regulators, one standard: where EU and FDA expectations part |
| 0:30 – 0:45 | **Exercise A: repair the hazard chain** |
| 0:45 – 0:58 | 3. Risk control and residual risk that survive review |
| 0:58 – 1:12 | **Exercise B: red-team a risk file against the GSPRs** |
| 1:12 – 1:22 | 4. Closing the loop: production and post-production information |
| 1:22 – 1:30 | **Exercise C: your 30-day plan**, takeaways, Q&A |

## The toolkit

Ten sheets, mapped to the clauses: `RM Plan` (4.4) · `Scales` (4.4 d) · `Hazard Analysis`
(5.4, 5.5, 6, 7.1, 7.3, 7.6) · `Risk Controls` (7.1, 7.2, 7.5) · `Residual Risk` (8) ·
`Benefit-Risk` (7.4, 8) · `Prod & Post-Prod` (10.1–10.4) · `RM File Index` (4.5) ·
`Dashboard`, whose every figure is a formula over the others and which ends in six exit
criteria.

The severity and probability scales, the P1 × P2 combination table and the acceptability
matrix are **examples**, to be replaced. The combination table is derived from the decade
midpoints of the two probability scales and the derivation is shown on the sheet, so a
reviewer can audit it.

**The worked example is deliberately imperfect.** Sixteen example rows describe a
programmable ambulatory infusion pump for home use. Two rows carry seeded defects, one
risk control is missing both its effectiveness verification and its order-of-priority
justification, one justification rests on cost (which MDR Annex I point 2 does not admit),
and one post-production item has not yet updated the file. The Dashboard reports all of
them; the Facilitator Guide names each one. On delivery the exit criteria read one Yes and
five No — making them all read Yes is the follow-on exercise.

## Accuracy

Every factual claim was verified against a primary source in September 2026. Some claims
corrected earlier drafts of this material:

- **MDR Annex I Chapter I numbering.** Point 1 is benefit-risk and state of the art; point
  2 is the definition of "as far as possible"; point 3 is the risk management system and
  its iterative process (a) to (f); point 4 is the order of priority for risk control.
  Points 2 and 4 are commonly cited the other way round.
- **Annex ZA has no content deviations.** The seven content deviations still quoted in
  gap analyses belong to EN ISO 14971:**2012**, withdrawn, with conflicting national
  standards withdrawn by 30 June 2020. EN ISO 14971:2019/A11:2021 uses a correspondence
  table, and that table addresses only MDR Annex I Chapter I points 3, 4, 5, 8 and 9.
- **ISO 14971:2019 Clause 7 runs to 7.6**, not 7.5: 7.3 is residual risk evaluation, 7.5
  is risks arising from risk control measures, 7.6 is completeness of risk control.
- **Annex I Chapter II sub-points** were checked individually against the consolidated
  text; an infusion pump's central requirements are 21.1 and 21.2, not the point 4 that
  most files cite alone.

A later primary-source pass added, rather than corrected, the following:

- **FDA recognition number 5-125** for ISO 14971 Third edition 2019-12, extent of recognition
  the complete standard, from Recognition List Number 053 (85 FR 17584, 30 March 2020),
  confirmed unchanged in Recognition List Number 066 (24 August 2026).
- **Team-NB V4**, adopted 21 April 2026, supersedes the V3 of 9 April 2025 first cited here.
  V4 added a pitfall that is exactly this workshop's Exercise B finding: an instructions-for-use
  warning offered as a risk control with no usability evidence of its effectiveness. The
  handout now carries all five of Team-NB's named risk-management pitfalls.
- **The string "14971" appears nowhere** in the 78 pages of Compliance Program 7382.850.
- FDA confirmed at its 14 January 2026 town hall that there is **no requirement for a
  quantitative description of risk**, so the toolkit's scoring scheme is a justified choice
  rather than an inherited obligation.

One coverage gap, stated plainly: the research facet that was to verify the hazard-chain
mechanics, the P1/P2 decomposition, the order of priority and the Clause 10 loop failed on an
output-token limit. That material rests on the verified clause structure and definitions plus
a direct reading of the consolidated MDR text, not on a dedicated verification pass.

The Facilitator Guide carries a five-item pre-delivery checklist, because harmonised-standard
citations, MDCG guidance, Team-NB guidance versions and FDA recognition entries all age.

Not legal or regulatory advice.

## Rebuilding

```
cd src
npm install pptxgenjs docx          # once
node deck.js && python3 fix_notes.py out/ISO-14971-Risk-Management-Workshop.pptx
node docs.js
python3 workbook.py
```

`fix_notes.py` is required: pptxgenjs writes all speaker notes as a single run, so the
paragraph breaks vanish until the XML is rewritten.
