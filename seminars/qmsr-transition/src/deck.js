const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.author = 'Elder Consulting, LLC';
pres.company = 'Elder Consulting, LLC';
pres.title = 'QMSR Transition: strategic roadmap from Part 820 to the QMSR';
pres.subject = 'Medical Device Seminar - shifting from the FDA Quality System Regulation to the Quality Management System Regulation';

const C = {
  navy: '0F2A4A', navyDark: '0B1F38', gold: 'E0A126', goldDark: 'A8730F',
  ink: '1F2933', gray: '5A6B7B', lightGray: 'CBD2D9', tint: 'EAF0F6', tint2: 'F5F8FB',
  white: 'FFFFFF', red: '9E2F24', redTint: 'F9ECEA', green: '256B4F', greenTint: 'E8F3EE',
  goldTint: 'FBF2DE', paleText: 'C9D3DE'
};
const FH = 'Cambria', FB = 'Calibri';
const W = 10, H = 5.625, M = 0.5, CW = W - 2 * M;
const S = pres.ShapeType;
let n = 0;

// ---------- helpers ----------
function base(dark = false) {
  const s = pres.addSlide();
  n++;
  s.background = { color: dark ? C.navyDark : C.white };
  const fc = dark ? '8FA1B5' : C.gray;
  s.addText('QMSR Transition  |  Elder Consulting, LLC', { x: M, y: H - 0.36, w: 6.5, h: 0.22, fontFace: FB, fontSize: 9, color: fc, isTextBox: true, margin: 0, valign: 'middle' });
  s.addText(String(n), { x: W - M - 0.6, y: H - 0.36, w: 0.6, h: 0.22, fontFace: FB, fontSize: 9, color: fc, align: 'right', isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}
function content(section, title, notes) {
  const s = base();
  s.addText(section.toUpperCase(), { x: M, y: 0.3, w: CW, h: 0.24, fontFace: FB, fontSize: 10, color: C.goldDark, bold: true, charSpacing: 2, isTextBox: true, margin: 0, valign: 'middle' });
  s.addText(title, { x: M, y: 0.55, w: CW, h: 0.6, fontFace: FH, fontSize: 24, color: C.navy, bold: true, isTextBox: true, margin: 0, valign: 'top' });
  if (notes) s.addNotes(notes);
  return s;
}
function divider(num, title, sub, notes) {
  const s = base(true);
  s.addText('SECTION ' + num, { x: M, y: 1.55, w: CW, h: 0.35, fontFace: FB, fontSize: 13, color: C.gold, bold: true, charSpacing: 3, isTextBox: true, margin: 0 });
  s.addText(title, { x: M, y: 1.95, w: CW, h: 1.35, fontFace: FH, fontSize: 36, color: C.white, bold: true, isTextBox: true, margin: 0, valign: 'top' });
  s.addText(sub, { x: M, y: 3.4, w: 8.6, h: 1.0, fontFace: FB, fontSize: 16, color: C.paleText, isTextBox: true, margin: 0, valign: 'top' });
  if (notes) s.addNotes(notes);
  return s;
}
// rich-text bullet array. items: string | {text, bold?, sub?: string[]}
function bul(items, o = {}) {
  const arr = [];
  const fs = o.fontSize || 12;
  items.forEach(it => {
    if (typeof it === 'string') it = { text: it };
    arr.push({ text: it.text, options: { bullet: it.num ? { type: 'number' } : true, breakLine: true, paraSpaceAfter: o.gap == null ? 5 : o.gap, bold: !!it.bold, fontSize: fs, color: it.color || o.color || C.ink } });
    (it.sub || []).forEach(sb => arr.push({ text: sb, options: { bullet: true, indentLevel: 1, breakLine: true, paraSpaceAfter: 2, fontSize: fs - 1.5, color: o.color || C.ink } }));
  });
  arr[arr.length - 1].options.breakLine = false;
  return arr;
}
function txt(s, text, o) {
  s.addText(text, Object.assign({ fontFace: FB, fontSize: 12, color: C.ink, isTextBox: true, margin: 0, valign: 'top' }, o));
}
// card with optional number badge and title; body = string or rich array
function card(s, o) {
  const fill = o.fill || C.tint;
  s.addShape(S.roundRect, { x: o.x, y: o.y, w: o.w, h: o.h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.06 });
  const pad = 0.14;
  let tx = o.x + pad, tw = o.w - 2 * pad, ty = o.y + 0.1, th = o.titleH || 0.36;
  if (o.num != null) {
    const d = 0.34;
    s.addShape(S.ellipse, { x: o.x + pad, y: o.y + 0.12, w: d, h: d, fill: { color: o.badge || C.navy }, line: { color: o.badge || C.navy, width: 0 } });
    s.addText(String(o.num), { x: o.x + pad, y: o.y + 0.12, w: d, h: d, fontFace: FB, fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
    tx = o.x + pad + d + 0.1; tw = o.w - 2 * pad - d - 0.1;
  }
  if (o.kicker) {
    txt(s, o.kicker, { x: tx, y: ty, w: tw, h: 0.2, fontSize: 9, bold: true, color: C.goldDark, charSpacing: 1.5, valign: 'middle' });
    ty += 0.24;
  }
  if (o.title) txt(s, o.title, { x: tx, y: ty, w: tw, h: th, fontFace: FB, fontSize: o.titleSize || 12.5, bold: true, color: o.titleColor || C.navy, valign: 'middle' });
  const by = o.title ? ty + th + 0.04 : (o.kicker ? ty + 0.02 : o.y + pad);
  if (o.body != null) {
    const body = Array.isArray(o.body) ? bul(o.body, { fontSize: o.bodySize || 10, gap: o.gap == null ? 3 : o.gap }) : o.body;
    s.addText(body, { x: o.x + pad, y: by, w: o.w - 2 * pad, h: o.y + o.h - by - 0.1, fontFace: FB, fontSize: o.bodySize || 10, color: C.ink, valign: 'top', isTextBox: true, margin: 0 });
  }
}
function table(s, header, rows, o) {
  const fs = o.fontSize || 10;
  const head = header.map(h => ({ text: h, options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: fs, valign: 'middle', fontFace: FB } }));
  const body = rows.map((r, i) => r.map((c, j) => {
    const cell = (typeof c === 'string') ? { text: c, options: {} } : { text: c.text, options: Object.assign({}, c.options) };
    cell.options = Object.assign({ fill: { color: i % 2 ? C.white : C.tint2 }, fontSize: fs, color: C.ink, valign: 'top', fontFace: FB, bold: j === 0 && o.boldFirst !== false }, cell.options);
    return cell;
  }));
  s.addTable([head, ...body], { x: o.x == null ? M : o.x, y: o.y == null ? 1.3 : o.y, w: o.w || CW, colW: o.colW, fontFace: FB, border: { type: 'solid', color: C.lightGray, pt: 0.5 }, rowH: o.rowH || 0.28, autoPage: false, margin: 0.06 });
}
function band(s, text, o = {}) {
  const y = o.y == null ? 4.55 : o.y, h = o.h || 0.5;
  s.addShape(S.roundRect, { x: M, y, w: CW, h, fill: { color: o.fill || C.navy }, line: { color: o.fill || C.navy, width: 0 }, rectRadius: 0.06 });
  txt(s, text, { x: M + 0.2, y, w: CW - 0.4, h, fontSize: o.fontSize || 12.5, color: o.color || C.white, italic: o.italic !== false, valign: 'middle', bold: !!o.bold });
}

// ================= SLIDES =================
// 1 Title
{
  const s = base();
  s.addImage({ path: 'logo_small.png', x: M, y: 0.45, w: 4.15, h: 0.8 });
  txt(s, 'MEDICAL DEVICE SEMINAR', { x: M, y: 1.75, w: CW, h: 0.3, fontSize: 12, bold: true, color: C.goldDark, charSpacing: 3 });
  txt(s, 'QMSR Transition', { x: M, y: 2.0, w: CW, h: 0.8, fontFace: FH, fontSize: 36, bold: true, color: C.navy });
  txt(s, 'A strategic roadmap for shifting from FDA Part 820 to the Quality Management System Regulation', { x: M, y: 2.9, w: 8.6, h: 0.8, fontSize: 18, color: C.gray });
  txt(s, '90-minute seminar   |   Speaker: [Name, Title]   |   [Date]   |   [Venue / Event]', { x: M, y: 4.05, w: CW, h: 0.3, fontSize: 13, color: C.ink });
  txt(s, 'Speaker deck with notes. Companion materials: Participant Handout, Workshop Exercise Pack, Gap Assessment Workbook.', { x: M, y: 4.4, w: CW, h: 0.3, fontSize: 11, color: C.gray, italic: true });
  s.addNotes(
`[0:00 | 2 min]
Welcome the room. Introduce yourself in one line and say where you sit relative to this transition: which gap assessments, remediation programs or QMSR-era inspections you have been part of.
Frame the date. The Quality Management System Regulation has been in force since 2 February 2026. FDA has said the transition period is over, QSIT has been retired, and the first Warning Letters from QMSR inspections were issued in May and July 2026. So this is not a "what is coming" seminar. It is a roadmap for finishing the shift where it is unfinished, and for proving it on the first inspection under Compliance Program 7382.850.
The promise: you leave with (1) a clear picture of what actually changed and what did not, (2) the four FDA-specific provisions that decide most first inspections, (3) an understanding of how the new inspection process works, (4) an exposure-weighted gap-assessment method with a workbook, and (5) a phased roadmap with exit criteria, built at your table.
Point to the three materials: Participant Handout, Workshop Exercise Pack, and the electronic Gap Assessment Workbook.
Fill in the placeholders on this slide before presenting.`);
}

// 2 Agenda
{
  const s = content('Welcome', 'How the next 90 minutes run',
`[0:02 | 2 min]
Walk the agenda. Three table exercises carry most of the value: red-teaming newly inspectable records, gap triage, and the 90-day plan. Ask people to sit in tables of four to six now.
Every speaker note in this deck starts with a running clock. If you fall behind, the buffer is in Section 4 (compress the two crosswalk slides to headlines; the tables are in the handout) and in the debrief length of Exercise B.`);
  table(s, ['Time', 'Segment', 'Format'], [
    ['0:00 – 0:06', 'Welcome, objectives, room poll', 'Talk + show of hands'],
    ['0:06 – 0:20', 'What changed on 2 February 2026, and what did not', 'Talk + myth-or-fact'],
    ['0:20 – 0:30', 'The four load-bearing FDA-specific provisions', 'Talk + record spot check'],
    ['0:30 – 0:45', 'The inspection changed more than the regulation: CP 7382.850', 'Talk'],
    ['0:45 – 0:55', 'Exercise A: red-team the records, write the observation', 'Table work + debrief'],
    ['0:55 – 1:05', 'From crosswalk to gap assessment', 'Talk'],
    ['1:05 – 1:15', 'Exercise B: gap triage under time pressure', 'Table work + debrief'],
    ['1:15 – 1:23', 'The roadmap: five phases, two tracks, metrics', 'Talk'],
    ['1:23 – 1:30', 'Exercise C: 90-day plan, takeaways, Q&A', 'Individual + plenary'],
  ], { colW: [1.1, 3.9, 1.6], w: 6.6, fontSize: 10, rowH: 0.3 });
  card(s, { x: 7.35, y: 1.3, w: 2.15, h: 3.35, title: 'On your table', fill: C.goldTint, body: [
    { text: 'Participant Handout', bold: true }, 'Reference: what changed, 820.35/820.45 checklists, CP 7382.850 one-pager, crosswalk, roadmap',
    { text: 'Workshop Exercise Pack', bold: true }, 'Exercise materials, gap cards, plan card',
    { text: 'Gap Assessment Workbook', bold: true }, 'Spreadsheet: crosswalk, checklists, roadmap, metrics'
  ], bodySize: 9 });
}

// 3 Poll
{
  const s = content('Welcome', 'Three quick questions before we start',
`[0:04 | 2 min]
Three shows of hands; write rough counts on the flipchart. You will use the mix to weight the roadmap section: a room full of "complete and verified" firms wants Track A (verify and sustain); a room still closing gaps wants Track B (compress and prioritize).
Question 3 is the hook. It tests the single biggest behavioral change of the QMSR: the old 21 CFR 820.180(c) shield over management review, internal audit and supplier audit records is gone, and FDA's own FAQ says these records should be readily available upon inspection. Most rooms go quiet on the second half of the question.`);
  const qs = [
    ['Where are you', 'Is your QMSR transition complete and verified, complete but untested, still closing gaps, or not yet started in earnest?', 'Listen for: what "complete" meant at their firm, and who signed it off.'],
    ['Inspection', 'Has your firm hosted an FDA inspection, or received a records request, since 2 February 2026?', 'Listen for: what the investigator asked for first.'],
    ['The 15-minute test', 'Could you hand an investigator your last two management reviews and this year\'s internal audit reports within 15 minutes, and be comfortable while they read them?', 'This is the question the rest of the session is built around.'],
  ];
  qs.forEach((q, i) => card(s, { x: M, y: 1.3 + i * 1.25, w: CW, h: 1.18, num: i + 1, kicker: q[0], title: q[1], titleSize: 13.5, titleH: 0.5, body: q[2], bodySize: 10.5, fill: i === 2 ? C.goldTint : C.tint }));
}

// 4 Divider S1
divider(1, 'What changed on 2 February 2026, and what did not', 'The regulation text shrank. The inspection surface grew.',
`[0:06]
Transition: "Let us start by agreeing on the facts, because a surprising amount of what circulates about the QMSR is wrong, including a section number that does not exist."`);

// 5 Timeline
{
  const s = content('Section 1  |  What changed', 'The QMSR timeline, 2022 to 2026',
`[0:06 | 2 min]
Seven dates. Proposed rule 23 February 2022 (87 FR 10119). Final rule 2 February 2024 (89 FR 7496; the FAQ page describes it as issued 31 January 2024, the public-inspection date). A correction on 15 October 2024 restored the "batch or lot" definition that was left out of the codified text. Technical amendments on 4 December 2025 (90 FR 55978) re-pointed 179 sections in 18 CFR parts from old QSR citations to the QMSR: purely conforming, no new obligations. FDA ran a Key Takeaways webinar on 16 December 2025 and town halls on 14 January and 1 April 2026. On 2 February 2026 the rule took effect, QSIT was withdrawn, and Compliance Program 7382.850 replaced CP 7382.845 and CP 7383.001. Then the first Warning Letters from QMSR inspections: Linemaster Switch (27 May 2026), Koven Technologies (21 July) and Nipro Renal Solutions USA (24 July).
Note the CP date: the PDF cover says issued 2 February 2026; law firms report it was posted 30 January. Either way it applied from day one.`);
  const steps = [
    ['23 Feb 2022', 'Proposed rule published (87 FR 10119); comments closed 24 May 2022'],
    ['2 Feb 2024', 'Final rule published (89 FR 7496): ISO 13485:2016 incorporated by reference'],
    ['15 Oct 2024', 'Correction restores the omitted "batch or lot" definition in §820.3(a)'],
    ['4 Dec 2025', 'Technical amendments: 179 sections in 18 parts re-pointed to §820.35 and §820.10(c)'],
    ['Dec 2025 – Apr 2026', 'FDA webinar (16 Dec) and town halls (14 Jan, 1 Apr): risk, design, inspections'],
    ['2 Feb 2026', 'QMSR in force. QSIT withdrawn. CP 7382.850 replaces CP 7382.845 and 7383.001'],
    ['May – Jul 2026', 'First Warning Letters from QMSR inspections: Linemaster, Koven, Nipro'],
  ];
  const cw = (CW - 3 * 0.15) / 4, ch = 1.35;
  steps.forEach((st, i) => {
    const row = i < 4 ? 0 : 1, col = i < 4 ? i : i - 4;
    const x = M + col * (cw + 0.15) + (row === 1 ? (cw + 0.15) / 2 : 0);
    card(s, { x, y: 1.3 + row * (ch + 0.2), w: cw, h: ch, num: i + 1, title: st[0], titleSize: 11.5, titleH: 0.5, body: st[1], bodySize: 9.5, fill: i === 5 ? C.goldTint : C.tint });
  });
  band(s, 'FDA, 1 April 2026 town hall: "The transition period has ended ... companies need to be compliant with the QMSR now."', { y: 4.45, h: 0.5, fontSize: 12 });
}

// 6 New Part 820 on one slide
{
  const s = content('Section 1  |  What changed', 'The new Part 820 on one slide',
`[0:08 | 3 min]
The whole regulation is now six operative sections. Everything else is ISO 13485:2016, clauses 4 to 8, read with its Introduction (Clauses 0.1, 0.2 and 0.4 are incorporated too; ISO notes explain but do not add requirements).
Stress two things. First, 820.1(b): where an ISO clause conflicts with the FD&C Act or its regulations, the Act and regulations control. Second, there is no 820.15. The proposed rule had a "Clarification of concepts" section there; FDA deleted it and moved the clarifications into 820.3(b). If a procedure or a consultant cites 820.15 as current law, that is a red flag about the rest of their crosswalk.
Sources: eCFR Part 820 (September 2026); 89 FR 7496, section III.F and Comment 41.`);
  table(s, ['Section', 'What it does', 'What to check in your QMS'], [
    ['§820.1 Scope', 'Finished devices for human use, incl. HCT/Ps regulated as devices; components excluded. The FD&C Act and its regulations control over conflicting ISO clauses.', 'Manual scope cites 21 CFR 820 and ISO 13485:2016; the roles you perform are named'],
    ['§820.3 Definitions', 'ISO 13485 and ISO 9000 Clause 3 definitions apply. (a) six FDA-only terms. (b) FD&C Act §201 definitions prevail, plus five superseding terms.', 'A definitions table in the manual; no procedure relies on a dropped definition'],
    ['§820.7 Incorporation by reference', 'ISO 13485:2016(E), third edition; ISO 9000:2015 Clause 3. Read-only at the ANSI IBR portal at no cost.', 'A controlled copy reaches the people who need it'],
    ['§820.10 Requirements', '(a) Document a QMS complying with ISO 13485. (b) Hooks to Parts 830, 821, 803, 806. (c) Clause 7.3 for Class II, III and listed Class I. (d) Clause 7.5.9.2 for life-supporting devices. (e) Noncompliance = adulteration.', 'Procedure index mapped to ISO clauses and the 820.10(b) hooks; documented 7.3 decision'],
    ['§820.35 Control of records', 'Adds to Clause 4.2.5: complaint and servicing record content, UDI per device or batch, confidentiality marking.', 'Complaint and service templates carry every element'],
    ['§820.45 Labeling and packaging', 'Adds to Clause 7.5.1: documented procedures; five-point examination before release; documented release; mix-up prevention.', 'A signed, element-by-element label release record per lot'],
    ['Reserved', '§820.5, §§820.20–820.30, §820.40; Subparts C–O. Placeholders; no action.', 'Old citations to these sections in your procedures'],
  ], { colW: [1.6, 4.5, 2.9], fontSize: 8, rowH: 0.28 });
}

// 7 Definitions hierarchy
{
  const s = content('Section 1  |  What changed', 'Which definition wins',
`[0:11 | 2 min]
Four layers. FD&C Act section 201 definitions come first: "device" and "labeling" beat ISO's "medical device" and "labelling". Then the five superseding terms in 820.3(b). Then the six FDA-only terms in 820.3(a). Everything else is ISO 13485 Clause 3 and ISO 9000 Clause 3: customer, top management, nonconformity, verification, product, correction, corrective action, preventive action.
Two traps. "Organization" in the standard means "manufacturer" as FDA defines it, which includes contract sterilizers, relabelers, specification developers and initial distributors of foreign entities. And "safety and performance" is read as "safety and effectiveness" only in Clause 0.1 of the Introduction; FDA narrowed this in the final rule after commenters said the phrases are not interchangeable. In practice: do not rewrite your design inputs; do make sure your QMS demonstrably assures safety and effectiveness.
Source: 21 CFR 820.3 as in force; 89 FR 7496, Comments 22 to 29 and 51.`);
  const tiers = [
    ['1', 'FD&C Act §201 definitions', 'Device, labeling and every other statutory term prevail over the correlating ISO terms (medical device, labelling).'],
    ['2', '§820.3(b) superseding terms', 'Implantable medical device (= "implant", 21 CFR 860.3) · Manufacturer · Organization (= manufacturer) · Rework (before release for distribution; per the medical device file) · Safety and performance (= safety and effectiveness, Clause 0.1 only)'],
    ['3', '§820.3(a) FDA-only terms', 'Batch or lot · Component · Federal Food, Drug, and Cosmetic Act · Finished device · HCT/P regulated as a device · Remanufacturer'],
    ['4', 'ISO 13485 Clause 3 and ISO 9000:2015 Clause 3', 'Customer, top management, nonconformity, verification, validation, product, correction, corrective action, preventive action, risk, and the rest'],
  ];
  tiers.forEach((t, i) => {
    const y = 1.3 + i * 0.82;
    s.addShape(S.roundRect, { x: M, y, w: 6.1, h: 0.72, fill: { color: i === 1 ? C.goldTint : C.tint }, line: { color: i === 1 ? C.goldTint : C.tint, width: 0 }, rectRadius: 0.06 });
    txt(s, t[0], { x: M + 0.15, y: y + 0.08, w: 0.5, h: 0.56, fontFace: FH, fontSize: 24, bold: true, color: C.goldDark, valign: 'middle' });
    txt(s, t[1], { x: M + 0.7, y: y + 0.06, w: 5.25, h: 0.24, fontSize: 11, bold: true, color: C.navy, valign: 'middle' });
    txt(s, t[2], { x: M + 0.7, y: y + 0.31, w: 5.25, h: 0.4, fontSize: 8.5, color: C.ink, valign: 'top' });
  });
  card(s, { x: 6.8, y: 1.3, w: 2.7, h: 3.2, title: 'Dropped in the final rule', fill: C.navy, titleColor: C.white, body: [
    { text: 'Proposed §820.15 "Clarification of concepts" was deleted; its content moved into §820.3(b)', color: C.white },
    { text: 'Proposed definitions removed: customer, design validation, nonconformity, process agent, process validation, top management, verification. ISO definitions apply.', color: C.white },
    { text: 'The proposed requirement to sign and date every approved record was removed. Where ISO 13485 says "approved", that means signed and dated; electronic signatures are acceptable.', color: C.white }
  ], bodySize: 9, gap: 5 });
}

// 8 What disappeared
{
  const s = content('Section 1  |  What changed', 'What disappeared, and where it went',
`[0:13 | 3 min]
The record types went first: no more device master record, design history file, device history record or quality system record as defined terms. FDA's reasoning (Comment 31): the elements are already required by ISO 13485 Clause 4.2 and Clause 7. The DMR content lives in the medical device file (4.2.3); the DHF becomes the design and development file (7.3.10); the DHR content sits in the medical device or batch records under 7.5.1, with UDI now required by 820.35(c).
The exemption went next. Old 820.180(c) kept management review, quality audit and supplier audit reports out of routine FDA review. It is gone (Comment 55), and FDA's FAQ number 8 says plainly that FDA has authority to inspect them.
Smaller changes: the explicit independent design reviewer of old 820.30(e) is not carried over; Clause 7.3.5 governs. Statistical techniques became analysis of data (8.4). CAPA is two clauses again.
FDA's position on legacy documents (town hall, 1 April 2026): no need to revise or recreate pre-2026 records or scrub DHF and DMR terms; do a gap analysis and fix real process gaps.`);
  table(s, ['Gone from Part 820', 'Where the requirement lives now'], [
    ['Device master record (old §820.181)', 'Medical device file, ISO 13485 Clause 4.2.3: specifications, procedures and requirements current on the floor'],
    ['Design history file (old §820.30(j))', 'Design and development file, Clause 7.3.10'],
    ['Device history record (old §820.184)', 'Medical device or batch records under Clause 7.5.1 (with 7.5.8, 7.5.9); UDI recorded per §820.35(c)'],
    ['Quality system record (old §820.186)', 'QMS documentation, Clause 4.2 (quality manual 4.2.2, documents 4.2.4, records 4.2.5)'],
    ['"Management with executive responsibility"', '"Top management", ISO 9000 definition; the expectation of executive-led quality culture is unchanged'],
    ['Independent design reviewer (old §820.30(e))', 'Clause 7.3.5: representatives of functions concerned plus other specialist personnel'],
    ['§820.180(c) exemption for management review, quality audit and supplier audit reports', 'Removed. FDA may inspect these records (FAQ #8); expected in baseline surveillance and PMA preapproval inspections'],
    ['Statistical techniques (old §820.250); CAPA as one section (old §820.100)', 'Analysis of data, Clause 8.4; corrective action 8.5.2 and preventive action 8.5.3 under Improvement 8.5'],
    ['QSIT; CP 7382.845; CP 7383.001', 'Compliance Program 7382.850: six QMS Areas, four OAFRs, two inspection models'],
  ], { colW: [3.6, 5.4], fontSize: 9, rowH: 0.3 });
}

// 9 What did not change
{
  const s = content('Section 1  |  What changed', 'What did not change',
`[0:16 | 2 min]
Left column is the reassurance; right column is the warning.
Certification: FDA will not require ISO 13485 certificates, will not accept one in lieu of an inspection or an establishment inspection report, and will not issue certificates of conformity (Comments 79 to 81; FAQ #13). A notified body audit does not replace your internal audit under Clause 8.2.4 either (town hall, 1 April 2026).
MDSAP: FDA continues to use MDSAP audit reports in place of routine surveillance inspections; sites actively enrolled are not scheduled for surveillance inspections, but remain subject to for-cause, compliance follow-up, specific product risk and PMA inspections (CP 7382.850, Part I.9 and Figure 3).
The right column: the two-year transition is over. No phase-in, no grace period, every inspection since 2 February 2026 is to the QMSR, including compliance follow-ups after Warning Letters, and the threshold for compliance action has not changed.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.7, title: 'Still true', titleColor: C.green, fill: C.greenTint, body: [
    'FDA does not require ISO 13485 certification and will not accept a certificate in lieu of inspection, nor issue one (FAQ #13)',
    'MDSAP continues: audit reports substitute for routine surveillance inspections, but not for-cause, compliance follow-up, product-risk or PMA inspections',
    'Parts 803, 806, 821 and 830 are unchanged and now hooked into the QMS via §820.10(b); Part 11 untouched',
    'Scope of "manufacturer" unchanged: contract sterilizers, relabelers, specification developers, initial distributors of foreign entities',
    'Class I CGMP exemptions retained; exempt firms still keep complaint files and §820.35 records',
    'Design and development applicability preserved: Class II, III and the listed Class I devices'
  ], bodySize: 10, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.7, title: 'Over', titleColor: C.red, fill: C.redTint, body: [
    'The two-year transition: no phase-in, no grace period, no enforcement discretion announced',
    'Every inspection since 2 February 2026 is conducted to the QMSR, including compliance follow-ups after Warning Letters or consent decrees',
    'The compliance-action threshold has not changed; Situation 1 examples were updated for the QMSR',
    'Records created before 2 February 2026 are "fair game" if the inspection leads there',
    'Old QSR citations in procedures, audit checklists and 483 responses: investigators read them as an incomplete transition'
  ], bodySize: 10, gap: 4 });
}

// 10 Myth or fact
{
  const s = content('Section 1  |  What changed', 'Myth or fact',
`[0:18 | 2 min]
Rapid fire. Show the six statements; tables call myth or fact; give the one-line answer.
1. Myth. FAQ #13: a certificate does not exempt a manufacturer from inspection and FDA inspections will not follow the MDSAP audit plan.
2. Fact. FAQ #8: the 820.180(c) exceptions are not maintained; records should be readily available upon inspection.
3. Myth. FDA does not expect firms to revise pre-2026 records or remove terms such as design history file (town hall, 1 April 2026). Content matters, not titles.
4. Fact. Warning Letters to Linemaster and Koven cite "as required by ISO 13485:2016, Clause 7.1", and Koven also cites 21 CFR 820.35(a).
5. Myth. CP 7382.850 Part III.1.B(3): records are selected on identified product risk and investigator judgment; there are no sampling tables.
6. Myth, with a caveat. ISO 14971 is not incorporated by reference (Comment 9); but risk management throughout the QMS is required through ISO 13485 (Clauses 4.1, 7.1, 7.3, 7.4, 7.5, 7.6, 8.2), and FDA officials say arguing "14971 is not mandatory" fares poorly.`);
  const items = [
    'An ISO 13485 certificate shortens or replaces an FDA inspection.',
    'FDA investigators can now read our internal audit reports and management review minutes.',
    'We must rename the DHF to "design and development file" in records created before 2026.',
    'A Form 483 or Warning Letter can cite ISO 13485:2016 Clause 7.1 directly.',
    'Under the QMSR, statistical sampling tables decide how many records FDA pulls.',
    'ISO 14971 is now mandatory for FDA.',
  ];
  const cw = (CW - 0.4) / 3, ch = 1.55;
  items.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    card(s, { x: M + col * (cw + 0.2), y: 1.3 + row * (ch + 0.2), w: cw, h: ch, num: i + 1, title: t, titleSize: 11.5, titleH: 1.0, fill: C.tint });
  });
  band(s, 'Answers are in the speaker notes and the Facilitator Guide. Sources: FDA QMSR FAQ #8 and #13; 89 FR 7496; CP 7382.850; Warning Letters of 27 May and 21 July 2026.', { y: 4.85, h: 0.32, fontSize: 9.5, fill: C.goldTint, color: C.navy, italic: false });
}

// 11 Divider S2
divider(2, 'The four load-bearing FDA-specific provisions', 'Where ISO 13485 alone does not get you there: §820.10 hooks, §820.35 records, §820.45 labeling, §820.3 definitions',
`[0:20]
Transition: "FDA said compliance with ISO 13485 alone does not fully satisfy the QMSR (Comment 8). Here is exactly where the difference lives."`);

// 12 820.10 hooks
{
  const s = content('Section 2  |  Load-bearing provisions', '820.10: the hooks into the rest of Title 21',
`[0:20 | 2 min]
820.10(b) is the bridge between the standard's phrase "applicable regulatory requirements" and specific FDA regulations. FDA said the list is not comprehensive (Comment 44): you remain responsible for identifying every applicable requirement, including Part 807 registration and listing, which is not named here.
820.10(c) preserves the old design-control scope. Most Class I devices are outside Clause 7.3; document the exclusion and its justification in the quality manual, which FDA says is consistent with ISO 13485 Clause 1 (Comment 45). Devices under an investigational device exemption are not exempt from design and development.
820.10(d) extends implant traceability (Clause 7.5.9.2) to life-supporting and life-sustaining devices, replacing old 820.65.
820.10(e): failure to comply renders a device adulterated under section 501(h).`);
  table(s, ['ISO 13485 clause', 'QMSR hook', 'What the investigator will look for'], [
    ['7.5.8 Identification', '§820.10(b)(1): document a system to assign UDI per Part 830', 'UDI procedure; GUDID records match labels; UDI recorded per device or batch (§820.35(c))'],
    ['7.5.9.1 Traceability', '§820.10(b)(2): traceability procedures per Part 821, if a tracking order applies', 'Tracking procedures and records where Part 821 applies'],
    ['8.2.3 Reporting to regulatory authorities', '§820.10(b)(3): notify FDA of complaints meeting Part 803 criteria', 'MDR procedure (Part 803.17); documented reportability evaluations; on-time reports'],
    ['7.2.3, 8.2.3, 8.3.3 Advisory notices', '§820.10(b)(4): handle per Part 806', 'Corrections and removals procedure; reports and documented non-report decisions (806.20)'],
    ['7.3 Design and development', '§820.10(c): Class II, Class III, Class I devices automated with software, and five listed Class I types', 'Documented applicability decision; design and development files (7.3.10); IDE devices included'],
    ['7.5.9.2 Traceability for implantable devices', '§820.10(d): also devices that support or sustain life', 'Traceability records to the consignee for these devices'],
    ['All clauses', '§820.10(e): noncompliance renders the device adulterated (FD&C Act §501(h))', 'Every 483 and Warning Letter opens with this sentence'],
  ], { colW: [2.2, 3.5, 3.3], fontSize: 9, rowH: 0.36 });
}

// 13 820.35 records
{
  const s = content('Section 2  |  Load-bearing provisions', '820.35: records with FDA-specific content',
`[0:22 | 3 min]
820.35 sits on top of Clause 4.2.5. Read the complaint list against your complaint form: seven elements, and the rule also requires records of review, evaluation and investigation, or documented justification when a similar complaint was already investigated. The list applies to complaints that must be reported under Part 803, complaints you decide to investigate, and complaints you investigated anyway.
Servicing records: six elements; FDA clarified that test and inspection data are required only where your process generates them (Comment 54).
UDI for each device or batch is the item ISO-only firms most often missed; it is also embedded in the UDI OAFR review steps of the compliance program.
Confidentiality: mark records you consider confidential in advance to aid FDA's disclosure decisions under Part 20. Marking is not a shield against review.
What was dropped from the proposal: the signature-and-date-on-every-record requirement. FDA: "approved" means signed and dated; electronic methods acceptable.`);
  card(s, { x: M, y: 1.3, w: 3.0, h: 3.05, kicker: '§820.35(a)  COMPLAINT RECORDS', body: [
    'Name of the device', 'Date the complaint was received', 'Any UDI or UPC, and any other device identification', 'Name, address and phone number of the complainant', 'Nature and details of the complaint', 'Any correction or corrective action taken', 'Any reply to the complainant',
    { text: 'Plus: records of review, evaluation and investigation; documented justification when no new investigation is performed', bold: true }
  ], bodySize: 9, gap: 2 });
  card(s, { x: 3.65, y: 1.3, w: 2.85, h: 3.05, kicker: '§820.35(b)  SERVICING RECORDS', body: [
    'Name of the device serviced', 'Any UDI or UPC, and other device identification', 'Date of service', 'Individual(s) who serviced the device', 'Service performed', 'Any test and inspection data (where your process generates them)',
    { text: 'Clause 7.5.4: analyse servicing records to decide whether the information is a complaint', bold: true }
  ], bodySize: 9, gap: 2, fill: C.goldTint });
  card(s, { x: 6.65, y: 1.3, w: 2.85, h: 3.05, kicker: '§820.35(c) AND (d)', body: [
    { text: 'UDI recorded for each medical device or batch', bold: true }, 'In addition to Clauses 7.5.1, 7.5.8 and 7.5.9. Not required for devices under development.',
    { text: 'Confidentiality marking', bold: true }, 'Records deemed confidential may be marked to aid FDA disclosure decisions under Part 20. Mark before the inspection; never redact what you hand over.'
  ], bodySize: 9, gap: 3 });
  band(s, 'Koven Technologies Warning Letter, 21 July 2026: "Failure to maintain records of the review, evaluation, and investigation for any complaints ... as required by 21 CFR 820.35(a)."', { y: 4.5, h: 0.5, fontSize: 11 });
}

// 14 820.45 labeling
{
  const s = content('Section 2  |  Load-bearing provisions', '820.45: labeling and packaging controls',
`[0:25 | 2 min]
FDA kept this because ISO 13485 Clause 7.5.1(e) only says defined labeling and packaging operations shall be implemented, and because labeling and packaging errors drive recalls every year (Comment 60, 64).
Five things must be examined for accuracy before release or storage; the release of labeling must be documented under Clause 4.2.5; operations must prevent mix-ups, including inspection before use against the medical device file, with results documented.
Automation: FDA allows automated readers where the process is followed by human oversight, and a designated individual must examine at minimum a representative sample of labels checked by the reader (Comment 60; webinar, 16 December 2025).
Practice reports from 2026 gap assessments: certified-only firms often had no signed, element-by-element label release record; a single "labels verified" checkbox is the typical finding.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.1, kicker: '§820.45(a)  EXAMINE BEFORE RELEASE OR STORAGE', body: [
    'Correct UDI or UPC, or other device identification', 'Expiration date', 'Storage instructions', 'Handling instructions', 'Any additional processing instructions',
    { text: '§820.45(b): release of labeling documented per Clause 4.2.5', bold: true },
    { text: '§820.45(c): operations prevent mix-ups; labeling and packaging inspected before use against the medical device file; results documented', bold: true }
  ], bodySize: 10, gap: 3 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.1, title: 'What a compliant record shows', fill: C.goldTint, body: [
    'One line per lot: each of the five elements checked, by whom, when, against which revision of the medical device file',
    'Automated reader result plus the designated individual\'s examination of a representative sample',
    'Label stock reconciliation and controlled storage of labeling',
    'Change history: label content changes flow through design change control (7.3.9) and the medical device file',
    'Distribution evaluated through the initial consignee'
  ], bodySize: 10, gap: 4 });
  band(s, 'Words changed from the proposal: "establish" became "document"; "where appropriate" became "as appropriate"; "immediately" before use was removed. The substance is old §820.120 and §820.130.', { y: 4.55, h: 0.48, fontSize: 10.5 });
}

// 15 Special cases
{
  const s = content('Section 2  |  Load-bearing provisions', 'Special cases: Part 4, Class I, contract roles',
`[0:27 | 2 min]
Combination products: 21 CFR 4.4(b)(1) now lists ISO clauses instead of QSR sections for drug-led manufacturers using the streamlined approach, and the final rule added a sentence requiring documented risk management in product realization plus complaint handling under Clause 8.2.2 and 820.35(a). Combination products remain outside MDSAP for FDA.
Class I: most Class I devices are outside Clause 7.3 (820.10(c)); document the exclusion. CGMP-exempt devices still keep complaint files and 820.35 records, which is why the December 2025 technical amendments re-pointed 162 classification regulations to 820.35.
Contract roles: contract manufacturers, specification developers, relabelers and initial distributors of foreign entities are all "manufacturers". A contract manufacturer must document risk management in product realization under Clause 7.1 regardless of design responsibility (FDA town hall, 14 January 2026, as reported); an initial importer that does no design need not apply 7.3 but must handle complaints, MDR, distribution records and traceability.`);
  const cards = [
    ['Drug-led combination products (21 CFR 4.4(b)(1))', ['Clause 4.1, Clause 5 and subclauses, 6.1, plus §820.10', 'Clause 7.3 and subclauses, plus documented risk management in product realization with records', 'Clause 7.4 and subclauses', 'Clause 8.2.2 plus §820.35(a); Clauses 8.4 and 8.5', 'Clause 7.5.3; Clause 7.5.4 plus §820.35(b)', 'Outside MDSAP for FDA; device-led firms use the full QMSR']],
    ['Class I and CGMP-exempt devices', ['Clause 7.3 applies only to software-automated devices and five listed types; document the exclusion in the quality manual', 'Exempt devices still keep complaint files and §820.35 records; technical amendments re-pointed 162 classification regulations', 'Registration, listing, MDR, corrections and removals, UDI still apply', 'Lowest inspection priority, but for-cause and signal-driven inspections happen']],
    ['Contract manufacturers, specification developers, importers', ['All are "manufacturers" under §820.3(b)', 'Contract manufacturers: risk management in product realization (7.1) regardless of design ownership', 'Specification developers: design and development, supplier controls over the contract manufacturer', 'Initial importers without design: complaints, MDR, distribution records, traceability; no 7.3']],
  ];
  const cw = (CW - 0.4) / 3;
  cards.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 3.7, title: c[0], titleSize: 11.5, titleH: 0.5, body: c[1], bodySize: 9.5, gap: 4, fill: i === 0 ? C.goldTint : C.tint }));
}

// 16 Spot check
{
  const s = content('Section 2  |  Load-bearing provisions', 'Spot check: five complaint records',
`[0:29 | 1 min, then move on]
Rapid pace: show each snippet, tables vote compliant or gap, reveal in ten seconds each. Answers:
1. Gap: no UDI, UPC or other device identification (§820.35(a)(3)).
2. Gap: no documented evaluation against Part 803 reporting criteria (Clauses 8.2.2, 8.2.3; §820.10(b)(3)).
3. Gap: not investigated and no documented justification referencing the earlier investigation (§820.35(a)).
4. Gap: correction taken (replacement shipped) but no record of it or of the reply to the complainant (§820.35(a)(6), (a)(7)).
5. Gap: a service report describing a failure that could meet MDR criteria was not analysed as a possible complaint (Clause 7.5.4; §820.35(b)).
The same five-item checklist is in the handout, section 3.`);
  const snippets = [
    ['Record 1', 'Device: Model T-40 tray. Received 3 Mar 2026. Complainant: St. Anne Hospital, biomed dept. Latch failed to close after reprocessing. Investigation: spring fatigue. Corrective action: none. Reply: 10 Mar 2026.'],
    ['Record 2', 'Device: Bidirectional Doppler, UDI (01)0084…. Received 12 Apr 2026. Intermittent loss of signal during procedure; no patient harm reported. Investigation completed 30 Apr. Correction: firmware update. Reply sent.'],
    ['Record 3', 'Device: Infusion set, lot 24K07, UDI recorded. Received 2 May 2026. Kinked tubing. "Similar to complaint C-25-118; no investigation required." Reply sent 4 May.'],
    ['Record 4', 'Device: Foot pedal, UDI recorded. Received 19 May 2026. Pedal unresponsive; surgeon switched to manual control. Investigation: contaminated switch; root cause identified. MDR evaluation: not reportable, rationale attached.'],
    ['Service report', 'Device: Dialysis controller, UDI recorded. Service 6 Jun 2026 by technician J.R. Fault: alarm failed to sound during pressure excursion. Board replaced; tests passed. Filed in service log.'],
  ];
  const cw = (CW - 4 * 0.15) / 5;
  snippets.forEach((sn, i) => card(s, { x: M + i * (cw + 0.15), y: 1.3, w: cw, h: 3.1, num: i + 1, title: sn[0], titleSize: 11, titleH: 0.4, body: sn[1], bodySize: 8.5, fill: i === 4 ? C.goldTint : C.tint }));
  band(s, 'Vote: compliant or gap? Test each against §820.35(a) and (b), Clauses 8.2.2, 8.2.3 and 7.5.4, and §820.10(b)(3).', { y: 4.55, h: 0.45, fontSize: 11.5 });
}

// 17 Divider S3
divider(3, 'The inspection changed more than the regulation', 'Compliance Program 7382.850, the first QMSR inspections, and how observations read now',
`[0:30]
Transition: "FDA declined to describe the new inspection approach in the rule itself. Then, three days before the effective date, it published the whole thing. Most firms still have not read it."`);

// 18 QSIT vs CP
{
  const s = content('Section 3  |  The inspection', 'QSIT is gone: what replaced it',
`[0:30 | 3 min]
QSIT ran from 1999 to 1 February 2026: four subsystems, a top-down approach, sampling tables, and the 820.180(c) records exemption written into the guide.
CP 7382.850 (implementation date 2 February 2026) supersedes CP 7382.845 and the PMA inspection program CP 7383.001, so PMA preapproval and postmarket inspections now run under the same process. It is a total-product-life-cycle program. Its stated goal: evaluate whether the QMS meets FDA requirements and gives reasonable assurance of safe and effective devices, and whether risk management and risk-based decision making are effectively used.
Two structural changes: six QMS Areas plus four Other Applicable FDA Requirements replace the subsystems, and record review is driven by identified product risk and investigator judgment rather than sampling tables. Investigators are told that evaluating one requirement may require evaluating others elsewhere in the QMS; they are expected to go beyond the minimum.
Also new in the program: cybersecurity for cyber devices under FD&C Act 524B, and Remote Regulatory Assessments under section 704(a)(4).`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.35, title: 'QSIT (1999 – 1 Feb 2026)', body: [
    'Four subsystems: Management Controls, Design Controls, CAPA, Production and Process Controls',
    '"Top-down" approach; Level 1 abbreviated and Level 2 comprehensive inspections',
    'Sampling tables prescribed how many records to pull',
    'Management review, internal audit and supplier audit reports exempt from review (old §820.180(c))',
    'Separate program for PMA inspections (CP 7383.001)'
  ], bodySize: 10, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.35, title: 'CP 7382.850 (from 2 Feb 2026)', fill: C.goldTint, body: [
    'Six QMS Areas and four Other Applicable FDA Requirements (OAFRs); total product life cycle',
    'Risk management documentation reviewed throughout to select elements; "critical thinking", no fixed order',
    'Records selected on product risk and judgment; no sampling tables; "multiple records" in most cases',
    'Management review, internal audit and supplier audit records in scope',
    'Two models: Model 1 (one element per area minimum) and Model 2 (prescribed elements); PMA inspections included; cybersecurity (524B) and Remote Regulatory Assessments'
  ], bodySize: 10, gap: 4 });
  band(s, 'Stated goal: does the QMS provide reasonable assurance that devices will be safe and effective, and are risk management and risk-based decision making effectively used?', { y: 4.75, h: 0.42, fontSize: 10.5 });
}

// 19 Six areas
{
  const s = content('Section 3  |  The inspection', 'Six QMS Areas and four OAFRs',
`[0:33 | 3 min]
Read the table as the investigator's menu. Management Oversight is the largest area, and FDA deliberately placed the risk-based approach (Clause 4.1.2 b) and planning of product realization (Clause 7.1, where risk management in product realization lives) inside it: top management owns risk.
Note where 820.35 and 820.45 appear: in Control of Documents and Records, Complaint Handling, Control of Production and Service Provision, Installation and Servicing, and Identification and Traceability. Note that Change Control and Outsourcing and Purchasing are first-class areas now, not sub-bullets of production.
The four OAFRs are evaluated in every risk-based inspection except PMA preapproval (tracking only where an order exists). UDI is an OAFR and ranked fourth in early 483 observations.
Source: CP 7382.850, Attachment A.`);
  table(s, ['QMS Area', 'Purpose (abridged)', 'Elements and requirements'], [
    ['Management Oversight (14 elements)', 'Top management plans and maintains the QMS and uses risk-based decisions', '4.1.1–4.1.4; risk-based approach 4.1.2 b); QMS software validation 4.1.6; quality manual 4.2.2; medical device file 4.2.3; documents and records 4.2.1, 4.2.4, 4.2.5 with §820.35, §820.45; 5.1–5.6; 6.1; 6.2; product realization planning 7.1'],
    ['Design and Development (12)', 'Design results in a safe and effective device meeting its intended use', 'Customer-related processes 7.2.1–7.2.3 with §820.10(b)(4); 7.3.1–7.3.10: planning, inputs, outputs, review, verification, validation, software validation, transfer, changes, files'],
    ['Production and Service Provision (11)', 'Planning, monitoring and control of production and service', '6.3; 6.4.1–6.4.2; 7.5.1 with §820.35, §820.45; 7.5.2; 7.5.3–7.5.4 with §820.35; 7.5.6; 7.5.5, 7.5.7; 7.5.8, 7.5.9 with §820.10(b)(1)(2); 7.5.10; 7.5.11; 7.6'],
    ['Measurement, Analysis and Improvement (10)', 'Monitoring and improvement reduce risks to product and QMS', '8.1, 8.5.1; feedback 8.2.1; complaint handling 8.2.2–8.2.3 with §820.10(b)(3)(4), §820.35; internal audits 8.2.4; 8.2.5; 8.2.6; nonconforming product 8.3.1–8.3.4; analysis of data 8.4; corrective action 8.5.2; preventive action 8.5.3'],
    ['Outsourcing and Purchasing (3)', 'Outsourced processes and purchased product are controlled', 'Outsourcing 4.1.5; purchasing process 7.4.1; purchasing information and purchased product 7.4.2, 7.4.3'],
    ['Change Control (4)', 'Changes are evaluated for risk and impact before implementation', 'QMS changes (4.1.4, 4.2.4, 4.2.5, 5.4.2, 5.6, 8.5.1); software changes (4.1.6, 7.5.6, 7.6); product and process changes (4.1.4, 7.2.2, 7.3.9, 7.3.10, 7.5.6, 7.5.7); purchasing changes (7.4.2, 7.4.3)'],
    ['Four OAFRs', 'Evaluated in every risk-based inspection except PMA preapproval', 'Medical Device Reporting (Part 803) · Corrections and Removals (Part 806) · Tracking (Part 821) · UDI (Part 830, §820.45), each hooked via §820.10(b)'],
  ], { colW: [1.9, 2.6, 4.5], fontSize: 8, rowH: 0.28 });
}

// 20 Inspection types and models
{
  const s = content('Section 3  |  The inspection', 'Seven inspection types, two models',
`[0:36 | 2 min]
Figure 3 of the compliance program. Most firms in this room will be inspected under Model 1: at least one element from each of the six areas, the four OAFRs as applicable, plus general items (registration and listing, marketing authorizations, prior 483s). New sites and PMA preapproval inspections get Model 2: a prescribed minimum list of 22 elements (23 for sterile product), which includes management review, internal audits, complaint handling, CAPA, design and development inputs through transfer, process validation, and outsourcing.
Watch the OAFR split on Model 2, because the crosswalks you will read online get this wrong. Model 2 has only two uses. On baseline surveillance the four OAFRs come with it. On PMA preapproval they do not: Part III.D.1 to 4 each say evaluate during all risk-based inspections except PMA preapproval, and Part III.C tells the investigator to exclude the OAFR elements where the subject device is not yet on the US market. So Model 2 is 22 or 23 elements plus four OAFRs, or 22 or 23 plus none, depending on which of its two uses you drew.
FDA's own words at the April town hall: both models are "minimum" and "flexible"; investigators routinely cover more. A prior MDSAP audit classified NAI or VAI counts like a prior FDA inspection for choosing the type; sites actively enrolled in MDSAP are not scheduled for surveillance inspections at all.`);
  table(s, ['Inspection type', 'When it is used', 'Model'], [
    ['Non-baseline surveillance', 'Prior FDA inspection or MDSAP audit classified NAI or VAI; not enrolled in MDSAP', '1'],
    ['Baseline surveillance', 'No FDA inspection or MDSAP audit history, or risk factors indicate a need', '2'],
    ['Compliance follow-up', 'A prior inspection or MDSAP audit led to regulatory action', '1'],
    ['For-cause', 'A signal, issue or complaint: recalls, MDRs, prior observations, RRA follow-up', '1'],
    ['Specific Product Risk Assignment', 'A specific product risk identified by FDA', '1'],
    ['PMA preapproval', 'PMA application; validations must be complete first', '2'],
    ['PMA postmarket', 'Eight to twelve months after approval', '1'],
  ], { colW: [1.75, 3.55, 0.6], fontSize: 8.5, rowH: 0.3 });
  card(s, { x: 6.65, y: 1.3, w: 2.85, h: 3.5, title: 'Model 1 vs Model 2', fill: C.goldTint, body: [
    { text: 'Model 1', bold: true }, 'At least one element per QMS Area, chosen by product risk; the four OAFRs as applicable; general items',
    { text: 'Model 2', bold: true }, 'Prescribed minimum: 22 elements (23 for sterile), including management review, internal audits, complaint handling, corrective and preventive action, design inputs through transfer, process validation, outsourcing; plus general items. OAFRs on baseline surveillance, but excluded on PMA preapproval',
    { text: 'Both are "minimum" and "flexible"', bold: true }
  ], bodySize: 9, gap: 3 });
}

// 21 Risk roadmap
{
  const s = content('Section 3  |  The inspection', 'Risk management is the roadmap',
`[0:38 | 3 min]
The mechanics of a QMSR inspection. Before arriving, the investigator reviews MDRs, corrections and removals, GUDID records, complaints, the TPLC report and FDA's compliance system. On site, they ask for risk management documentation early and use it to pick which elements to test, following the thread from a product risk into complaint handling, change control, purchasing, production and management review.
Situation 1 (the OAI examples) was rewritten for the QMSR: no process for risk management in product realization; failure to use feedback and postmarket data as risk inputs; changes not evaluated for risk before implementation; failure to correct prior deficiencies. Changes that appear to need a new 510(k) or PMA trigger an OAI recommendation.
FDA officials since February: "Risk, risk, risk, risk. That is the fundamental change to QMSR." Recurring deficiencies named at MedCon: procedures that regurgitate the standard, vague or missing risk controls, inconsistent scoring across departments, hazard and harm confused, risk analyses never updated with post-market data.
Relief: FDA does not expect separate risk assessments for administrative processes such as document control or training; reference product risk documentation and document your decisions.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.1, title: 'What the investigator does', body: [
    { text: 'Before arrival', bold: true }, 'MDRs, corrections and removals, GUDID entries, complaints, TPLC report, compliance history, prior 483s',
    { text: 'On arrival', bold: true }, 'Roles, products, processes; then the risk management documentation',
    { text: 'Then', bold: true }, 'Pick product risks that could harm patients or users; select elements; pull the thread across areas: complaint → risk file → change → supplier → CAPA → management review'
  ], bodySize: 10, gap: 3 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.1, title: 'Situation 1 (OAI) examples, rewritten for the QMSR', fill: C.redTint, titleColor: C.red, body: [
    'No documented process for risk management in product realization (Clause 7.1)',
    'Feedback and postmarket surveillance not used as inputs to risk management',
    'Design, process or supplier changes not evaluated for risk and impact before implementation',
    'Same or similar significant deficiencies not corrected since the last inspection',
    'Nonconforming product distributed with injury potential and no effective mitigation'
  ], bodySize: 10, gap: 4 });
  band(s, '"Show me how risk informed this decision" has a three-part answer: the risk identified, the record where the decision lives, the evidence the control worked.', { y: 4.55, h: 0.5, fontSize: 12 });
}

// 22 Records shield
{
  const s = content('Section 3  |  The inspection', 'The old records shield is gone',
`[0:41 | 2 min]
Read FAQ #8 aloud; it is unambiguous. Then the town-hall detail (1 April 2026): these processes are expected to be reviewed in baseline surveillance and PMA preapproval inspections and may be reviewed in any other inspection depending on focus. Records made before 2 February 2026 need not be rewritten, but they are fair game.
Practical consequences on the right. The worst response is to sanitize: empty minutes and audits that never find anything are a Management Oversight observation waiting to happen, and FDA's compliance program lists "failure to correct the same or similar deficiencies" and "feedback not used as risk input" among its OAI examples. The right response is decision-quality records: every 5.6.2 input present, decisions and resource commitments recorded (5.6.3), actions tracked to closure.
Also: a notified body ISO 13485 audit does not replace your internal audit under Clause 8.2.4, and remote records must be producible by the next working day or two (Comment 58).`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.2, kicker: 'FDA QMSR FAQ #8 (VERBATIM)', body: '"Yes. The QMSR gives the FDA the authority to inspect management review, quality audits, and supplier audit reports. The exceptions that existed in the QS regulation at § 820.180(c) are not maintained in the QMSR. ... Such records are maintained in the regular course of business and should be readily available upon inspection."', bodySize: 11, fill: C.goldTint });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.2, title: 'What to do about it', body: [
    'Management review minutes with every Clause 5.6.2 input, real decisions, resource commitments and follow-up of prior actions (5.6.3)',
    'Internal audits scoped to product risk and to the six QMS Areas; findings with evidence trails and closure; retire the Part 820 checklist',
    'Supplier audit reports with follow-up; re-approval never "based on scorecard" alone',
    'Do not sanitize; write candidly and close the loop. Do not redact what you hand over',
    'Mark genuinely confidential records under §820.35(d) before the inspection',
    'Records at remote locations: producible by the next working day or two'
  ], bodySize: 9.5, gap: 3 });
  band(s, 'Keisha Thomas, CDRH, 1 April 2026: pre-2026 records "are still fair game for us to look at if the inspection direction leads us there."', { y: 4.62, h: 0.42, fontSize: 10.5 });
}

// 23 How a 483 reads
{
  const s = content('Section 3  |  The inspection', 'How an observation reads now',
`[0:43 | 1 min]
Two verbatim excerpts from the first Warning Letters issued after QMSR inspections. Notice the format: "as required by ISO 13485:2016, Clause X", the firm's own procedure quoted back, and where an FDA-specific provision applies, a direct CFR citation such as 21 CFR 820.35(a). Every device 483 now also carries the standard statement that observations are not exhaustive and the firm is responsible for self-audits.
Brief your leadership on this format before it lands on your own form; a 483 written in ISO clauses is not "worse" than one written in QSR sections, but it reads differently. Respond in the same vocabulary, within 15 business days.`);
  const ex = (x, y, w, h, label, title, body) => {
    s.addShape(S.roundRect, { x, y, w, h, fill: { color: C.white }, line: { color: C.gold, width: 1.25 }, rectRadius: 0.06 });
    txt(s, label, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.2, fontSize: 9, bold: true, color: C.goldDark, charSpacing: 1.5, valign: 'middle' });
    txt(s, title, { x: x + 0.15, y: y + 0.32, w: w - 0.3, h: 0.3, fontSize: 11, bold: true, color: C.navy, valign: 'middle' });
    txt(s, body, { x: x + 0.15, y: y + 0.65, w: w - 0.3, h: h - 0.75, fontSize: 9.5, color: C.ink, valign: 'top', fontFace: 'Courier New' });
  };
  ex(M, 1.3, 4.4, 3.2, 'WARNING LETTER, 27 MAY 2026', 'Linemaster Switch Corporation (inspection 4 Feb – 6 Mar 2026)',
    '"2. Failure to document one or more processes for risk management in product realization, as required by ISO 13485:2016, Clause 7.1. ... b. Your firm\'s Risk Management procedure TM-112 does not define how risk management activities are performed and documented, who is responsible for conducting and approving risk management activities, when risk management documentation must be updated, and how post-market feedback data (including complaints, adverse events, and recalls) is incorporated into risk management."');
  ex(5.1, 1.3, 4.4, 3.2, 'WARNING LETTER, 21 JULY 2026', 'Koven Technologies, Inc. (inspection 2 – 6 Feb 2026)',
    '"3. Failure to establish criteria for the evaluation and selection of suppliers, as required by ISO 13485:2016 Clause 7.4.1. ... There is no documentation that a site assessment (supplier audit) has been conducted for the contract manufacturer, a (b)(4) supplier which your firm\'s procedure defines as \'Highest/Critical Impact.\'"\n\n"4. Failure to maintain records of the review, evaluation, and investigation for any complaints ... as required by 21 CFR 820.35(a)."');
  band(s, 'Both letters open with the same sentence: devices are adulterated under FD&C Act §501(h) because methods, facilities or controls do not conform to the QMSR at 21 CFR Part 820.', { y: 4.62, h: 0.42, fontSize: 10.5 });
}

// 24 Early enforcement
{
  const s = content('Section 3  |  The inspection', 'The first seven months of QMSR enforcement',
`[0:44 | 1 min]
What FDA officials have said on the record: roughly 100 QMSR inspections by the end of March (MedCon, April 2026) and "just north of 100" by 6 May (FDLI). Top 483 observation areas for February to mid-April, in Keisha Thomas's ranking: risk management by a wide margin, then outsourcing and purchasing, complaint handling and feedback, UDI, and corrective action. Her summary at the June RAPS Quality Conference: largely the same citations as before the QMSR, reordered.
The FY2025 baseline for comparison, from FDA's own 483 spreadsheet: 791 system-generated device 483s; top citations CAPA procedures (820.100(a), 279), complaint procedures (820.198(a), 211), purchasing controls (115), nonconforming product (95), process validation (93).
Caveat for the room: percentages such as "about 90 percent of observations cite ISO clauses" and "almost all classified VAI" come from vendor compilations of FDA databases, not from an FDA publication. Quote FDA officials; treat vendor numbers as indicative.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.2, title: 'On the record from FDA', body: [
    'About 100 QMSR inspections by 31 March 2026; "just north of 100" by 6 May',
    { text: 'Top 483 areas, Feb to mid-April 2026:', bold: true },
    '1  Risk management (by a wide margin)', '2  Outsourcing and purchasing', '3  Complaint handling and feedback', '4  Unique device identification', '5  Corrective action',
    'Three Warning Letters from QMSR inspections by August 2026 (Linemaster, Koven, Nipro Renal Solutions USA); all cite Clause 7.1'
  ], bodySize: 9.5, gap: 2 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.2, title: 'Recurring deficiencies FDA officials described', fill: C.goldTint, body: [
    'Procedures that "regurgitate the regulation or the standard" and never say what or when',
    'Risk controls vague, missing or hard to interpret; hazards confused with harms',
    'Inconsistent risk scoring between departments; risk analyses not updated with complaints, MDRs, recalls',
    'Supplier controls not aligned with the product risk assessment; identical controls for critical and trivial suppliers',
    'Same problems as under the QSR, in a new vocabulary: CAPA, complaints, purchasing, validation'
  ], bodySize: 9.5, gap: 3 });
  band(s, 'FY2025 baseline (FDA 483 data): 791 device 483s; top cites CAPA, complaint procedures, purchasing, nonconforming product, process validation. Vendor-compiled 2026 percentages are indicative only.', { y: 4.62, h: 0.42, fontSize: 9.5 });
}

// 25 Exercise A
{
  const s = content('Exercise A  |  10 minutes', 'Exercise A: red-team the records',
`[0:45 | 10 min: 6 table work, 4 debrief]
Open the Workshop Exercise Pack, Exercise A: one page of Q2 2026 management review minutes, an internal audit summary and a supplier audit excerpt from a fictional firm, Brightwater Instruments. Tables read as the investigator under CP 7382.850.
Tasks: (1) the three questions you would ask first and the element you would go dig into; (2) one observation written in QMSR style: the clause, the specific record, the specific failure; (3) swap sheets with the neighboring table and draft the response skeleton: correction, root cause, systemic action, evidence date, effectiveness metric.
Debrief: hear one observation and one response; ask the room whether the response would close it. Model observations are in the Facilitator Guide. Land the message: fix the process and close the loop; do not sanitize the minutes.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.2, title: 'Your task (6 minutes)', body: [
    { text: 'Read', bold: true }, 'Brightwater Instruments: Q2 2026 management review minutes, internal audit summary, supplier audit excerpt (Exercise Pack, Exercise A)',
    { text: 'As the investigator', bold: true }, 'Write the three questions you would ask first and the element you would go dig into',
    { text: 'Write one observation', bold: true }, 'ISO 13485:2016 clause or QMSR section, the specific record, the specific failure',
    { text: 'Swap and respond', bold: true }, 'Draft the response skeleton for the neighboring table\'s observation: correction, root cause, systemic action, evidence date, effectiveness metric'
  ], bodySize: 10, gap: 3 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.2, title: 'Rules of the game', fill: C.goldTint, body: [
    'An observation needs a record, a clause and a failure. "Management review is weak" is not an observation.',
    'A response needs containment, a system fix and a way to prove it worked. "We retrained" is not a response.',
    'Sanitizing the minutes is not an option on the table.',
    'Debrief: two tables, 90 seconds each; the room votes on whether the response would close the observation'
  ], bodySize: 10.5, gap: 5 });
  band(s, 'Timer: 6 minutes of table work, then 4 minutes of debrief. Model answers are in the Facilitator Guide.', { y: 4.62, h: 0.42, fontSize: 11 });
}

// 26 Divider S4
divider(4, 'From crosswalk to gap assessment', 'Why FDA refused to publish a crosswalk, and what to build instead',
`[0:55]
Transition: "FDA said a one-to-one comparison would be cumbersome and not useful (Comment 18). It was half right. A crosswalk is where you start, not where you finish."`);

// 27 Crosswalk 1
{
  const s = content('Section 4  |  From crosswalk to roadmap', 'Crosswalk: QSR to QMSR (1 of 2)',
`[0:55 | 2 min]
Headlines only; the full tables are in the handout and the workbook. The point of the two crosswalk slides is the fourth column: the substantive delta, which is what your gap assessment must test with evidence.
Remind the room that FDA declined to publish a crosswalk (Comment 18) and that every clause-level crosswalk in circulation, this one included, is industry-authored. FDA's QMSR page does list AAMI TIR102:2019, which maps the old Part 820 to ISO 13485:2016 and predates the QMSR.`);
  table(s, ['Old QSR section', 'ISO 13485:2016 clause(s)', 'QMSR supplement', 'Substantive delta to test'], [
    ['820.5 Quality system', '4.1 QMS general', '§820.10(a) document a QMS complying with ISO 13485', 'Risk-based approach to QMS processes (4.1.2 b); outsourced processes (4.1.5); QMS software validation (4.1.6)'],
    ['820.20 Management responsibility', '5.1–5.6', '—', '"Top management" replaces "management with executive responsibility"; management review inputs per 5.6.2 now inspectable'],
    ['820.22 Quality audit', '8.2.4 Internal audit', '—', 'Audit reports reviewable; audit program should cover the six QMS Areas and risk integration'],
    ['820.25 Personnel', '6.2 Human resources', '—', 'Competence, training effectiveness proportionate to risk, records'],
    ['820.30 Design controls', '7.3.1–7.3.10', '§820.10(c) applicability by class', 'Design and development file (7.3.10); independent reviewer not mandated (7.3.5); usability explicit in inputs; risk management in 7.1'],
    ['820.40 Document controls', '4.2.4 (records 4.2.5)', '§820.35', '"Document" means establish, implement, maintain (Clause 0.2); records readily identifiable and retrievable'],
    ['820.50 Purchasing controls', '7.4.1–7.4.3', '—', 'Risk-proportionate criteria, monitoring and re-evaluation; supplier audit reports reviewable; 4.1.5 outsourced processes'],
    ['820.60 / 820.65 Identification, traceability', '7.5.8, 7.5.9.1, 7.5.9.2', '§820.10(b)(1)(2), §820.10(d), §820.35(c)', 'UDI system per Part 830; UDI recorded per device or batch; 7.5.9.2 extended to life-supporting devices'],
    ['820.70 Production and process controls', '7.5.1, 6.3, 6.4.1, 6.4.2, 7.5.2', '§820.45', 'Contamination control (6.4.2); process agents (7.5.2); software validation (4.1.6, 7.5.6, 7.6)'],
  ], { colW: [1.85, 1.6, 2.05, 3.5], fontSize: 7.5, rowH: 0.26 });
}

// 28 Crosswalk 2
{
  const s = content('Section 4  |  From crosswalk to roadmap', 'Crosswalk: QSR to QMSR (2 of 2)',
`[0:57 | 2 min]
Point out three rows. Process validation: ISO 7.5.6 carries the requirement and 7.5.7 adds explicit sterilization and sterile-barrier validation; the QMSR does not define "process validation" any more. Nonconforming product: concessions under 8.3.2 need justification and approval, and FDA kept its own "rework" definition so that post-distribution actions are corrections and removals under Part 806. Complaints: three clauses plus 820.35(a) plus the MDR hook.
Then the row that matters most for this session: 820.180 to 4.2.5 plus 820.35, with the (c) exemption gone.`);
  table(s, ['Old QSR section', 'ISO 13485:2016 clause(s)', 'QMSR supplement', 'Substantive delta to test'], [
    ['820.72 Measuring equipment', '7.6', '—', 'Software used for monitoring and measurement must be validated'],
    ['820.75 Process validation', '7.5.6; 7.5.7 sterilization', '—', 'No FDA definition of process validation; revalidation criteria defined'],
    ['820.80 / 820.86 Acceptance', '7.4.3, 8.2.6, 7.5.8', '—', 'Purchased product verification proportionate to risk; status identification'],
    ['820.90 Nonconforming product', '8.3.1–8.3.4', '§820.3(b) rework; §820.10(b)(4)', 'Concessions need justification and approval; rework only before distribution'],
    ['820.100 CAPA', '8.5.2, 8.5.3 (with 8.4, 8.2.1)', '—', 'Correction, corrective and preventive action split; effectiveness verified'],
    ['820.120 / 820.130 Labeling', '7.5.1', '§820.45', 'Five-point examination, documented release, mix-up prevention'],
    ['820.140–820.160 Handling, storage', '7.5.11; 7.5.9.2', '§820.10(d)', 'Risk-based preservation; consignee records where 7.5.9.2 applies'],
    ['820.170 / 820.200 Servicing', '7.5.3; 7.5.4', '§820.35(b)', 'Six servicing record elements incl. UDI; service records analysed'],
    ['820.180/181/184/186 Records', '4.2.5; 4.2.3; 7.5.1; 4.2', '§820.35(a)–(d)', '§820.180(c) exemption removed; UDI in records; confidentiality marking'],
    ['820.198 Complaint files', '8.2.1, 8.2.2, 8.2.3', '§820.35(a); §820.10(b)(3)', 'Seven record elements; justification when not investigating; MDR evaluation'],
    ['820.250 Statistical techniques', '8.4 Analysis of data', '—', 'Documented analysis of data; quantitative evidence commensurate with risk'],
  ], { colW: [1.85, 1.6, 2.05, 3.5], fontSize: 7.5, rowH: 0.24 });
}

// 29 Terminology
{
  const s = content('Section 4  |  From crosswalk to roadmap', 'Terminology: old words, new words',
`[0:59 | 1 min]
The decision every firm faces: rename or bridge. FDA's position is that content matters, legacy names may stay in old records, and no scrubbing is expected. Practice reports say procedures still built on the QSR subpart structure and citing "21 CFR 820.50" were flagged early in 2026 inspections as signs of an incomplete transition.
Recommended: new records in ISO terms; a one-page mapping card for everyone who may sit in front of an investigator; and a controlled definitions table in the quality manual.`);
  table(s, ['QSR term', 'QMSR / ISO 13485 term', 'Note'], [
    ['Quality system regulation; quality system', 'Quality management system regulation; quality management system', 'Rename the manual scope; cite 21 CFR 820 and ISO 13485:2016'],
    ['Management with executive responsibility', 'Top management (ISO 9000)', 'Same expectation of executive-led quality culture'],
    ['Establish (define, document, implement)', 'Document (establish, implement, maintain), Clause 0.2', 'FDA: "document" is the broader word'],
    ['Device master record (DMR)', 'Medical device file (4.2.3)', 'Rework definition and §820.45(c) reference the MDF'],
    ['Design history file (DHF)', 'Design and development file (7.3.10)', 'Legacy files need not be retitled'],
    ['Device history record (DHR)', 'Medical device or batch records (7.5.1); UDI per §820.35(c)', 'No defined term; content still required'],
    ['Manufacturing material', 'Process agent (7.5.2)', 'Assess and control commensurate with risk'],
    ['Nonconformance', 'Nonconformity (ISO 9000)', ''],
    ['CAPA', 'Correction; corrective action (8.5.2); preventive action (8.5.3)', 'Separate triggers and records'],
    ['Complaint files', 'Feedback (8.2.1); complaint handling (8.2.2); reporting to regulatory authorities (8.2.3)', 'Plus §820.35(a) record content'],
    ['Statistical techniques', 'Analysis of data (8.4)', ''],
    ['Reasonably accessible; readily available', 'Readily identifiable and retrievable (4.2.5)', 'Remote records: next working day or two'],
  ], { colW: [2.8, 3.3, 2.9], fontSize: 8, rowH: 0.24 });
}

// 30 Gap assessment method
{
  const s = content('Section 4  |  From crosswalk to roadmap', 'A gap assessment that survives an inspection',
`[1:00 | 3 min]
The flat crosswalk produces two hundred rows with no priority. The version that works scores every requirement on three things: is there a true regulatory gap; how exposed is it (would an investigator read this record on day one; is it in Model 2's minimum list; is it one of the top-cited areas); and how much effort will it take. Sort by exposure. The top fifteen rows are the transition.
The other rule: evidence, not procedures. The column that matters is "record sampled and what it lacked", because CP 7382.850 tests whether the process works. The workbook on your table is built this way: one row per compliance-program element with its ISO clause and QMSR hook, legacy QSR section, current procedure, evidence sampled, gap, exposure, effort, a computed priority, owner, due date and verification method, with a dashboard by QMS Area.
Where certified firms fooled themselves: they assumed the notified body or MDSAP auditor had tested these areas at FDA depth, that complaint and service templates already carried UDI, that label release was a signed element-by-element check, and that audit reports would stay private.`);
  table(s, ['Requirement (CP element)', 'Evidence sampled', 'Reg. gap', 'Exposure', 'Effort', 'Priority'], [
    ['Complaint handling: 8.2.2, 8.2.3, §820.35(a)', '20 complaint records; 6 lack UDI, 4 lack a reportability evaluation', 'Yes', 'High', 'S', '1'],
    ['Management review: 5.6.1–5.6.3', 'Last two reviews: no complaint trends, no regulatory reporting, no decisions recorded', 'Yes', 'High', 'M', '2'],
    ['Planning of product realization: 7.1 (risk management)', 'Risk file unchanged since 2021 transfer despite 14 complaints and 2 design changes', 'Yes', 'High', 'L', '3'],
    ['Purchasing process: 7.4.1', 'Same questionnaire for contract sterilizer and office supplies; critical supplier re-approved on scorecard', 'Yes', 'High', 'M', '4'],
    ['Documents: procedures cite "21 CFR 820.30" and "DHF"', '40 procedures; content compliant', 'No', 'Medium', 'M', '9'],
  ], { colW: [2.6, 3.4, 0.7, 0.9, 0.7, 0.7], fontSize: 8.5, rowH: 0.3, boldFirst: false });
  card(s, { x: M, y: 3.55, w: CW, h: 1.45, title: 'Where certified firms fooled themselves', fill: C.goldTint, body: [
    'Assumed the notified body or MDSAP auditor had tested these areas at FDA depth   •   Assumed complaint and service templates already carried UDI and a Part 803 evaluation   •   Assumed label release was a signed, element-by-element record   •   Assumed audit reports and management review minutes would stay private   •   Measured "procedure updated" instead of "record produced"'
  ], bodySize: 9.5 });
}

// 31 Common gaps
{
  const s = content('Section 4  |  From crosswalk to roadmap', 'What 2026 gap assessments keep finding',
`[1:03 | 2 min]
A composite from consultancy reports, FDA officials' remarks and the first Warning Letters, grouped by the compliance program's areas. Say clearly that the consultancy items are practice reports, not FDA data; the Warning Letter items are verbatim citations.
Ask tables to tick which three they recognise; that primes Exercise B.`);
  const cols = [
    ['MANAGEMENT OVERSIGHT', ['Risk management confined to design; production, purchasing, complaints never reference the risk file', 'Management review = operational metrics, no decisions, no follow-up', 'Internal audits still run on Part 820 checklists', 'QMS software validated once, years ago; upgrades never revalidated (4.1.6)', 'Quality manual still organized by QSR subparts']],
    ['MEASUREMENT, ANALYSIS, IMPROVEMENT', ['Complaint records without UDI or a documented Part 803 evaluation', 'CAPAs closed on the immediate fix; no root cause, no effectiveness data', 'Service reports never analysed for complaints', 'Feedback and postmarket data not fed back into risk (a Situation 1 example)', 'Corrective action procedure silent on cause determination and effectiveness (Linemaster, Clause 8.5.2)']],
    ['PURCHASING, PRODUCTION, DESIGN', ['Supplier controls by purchasing category, not risk; no supplier audit of a critical contract manufacturer (Koven, 7.4.1)', 'No signed element-by-element label release (§820.45)', 'Design changes without significance assessment or regulatory evaluation (Koven, 7.3.9)', 'Rework performed without documented procedures (Linemaster, 8.3.4)', 'Monitoring and measurement software not validated (Linemaster, 7.6)']],
  ];
  const cw = (CW - 0.4) / 3;
  cols.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 3.7, kicker: c[0], body: c[1], bodySize: 9.5, gap: 4, fill: i === 1 ? C.goldTint : C.tint }));
}

// 32 Exercise B
{
  const s = content('Exercise B  |  10 minutes', 'Exercise B: gap triage under time pressure',
`[1:05 | 10 min: 6 table work, 4 debrief]
Exercise Pack, Exercise B: eight gap cards drawn from real 2026 findings and a one-page triage grid. Tables score each card (true regulatory gap yes or no; inspection exposure high, medium or low; effort small, medium or large), sort by exposure, name an owner role and write a first-30-day action for the top three.
Two cards are deliberately arguable: the forty procedures that still say DHF and cite 21 CFR 820.30, and the internal audit report that calls the CAPA process a "systemic failure" with no evidence trail. Let the argument run for a minute; the answers are in the Facilitator Guide.
Debrief: two tables give their top three and the first action. Then reveal the pattern: most firms over-invest in terminology housekeeping and under-invest in the records an investigator reads on day one.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.2, title: 'Your task (6 minutes)', body: [
    'Eight gap cards, one triage grid (Exercise Pack, Exercise B)',
    { text: 'Score each card', bold: true }, 'True regulatory gap? (Y/N)  ·  Inspection exposure (H/M/L)  ·  Effort (S/M/L)',
    { text: 'Sort by exposure first', bold: true }, 'Name an owner role and a first-30-day action for the top three',
    { text: 'Record your position', bold: true }, 'on the two arguable cards: legacy terminology in 40 procedures; the audit report that says "systemic failure"'
  ], bodySize: 10.5, gap: 3 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.2, title: 'Scoring guide', fill: C.goldTint, body: [
    { text: 'Exposure High', bold: true }, 'An investigator reads this record on day one; it is in Model 2\'s minimum list; it is a top-five cited area',
    { text: 'Exposure Medium', bold: true }, 'Reached when a thread leads there',
    { text: 'Exposure Low', bold: true }, 'Housekeeping; investigators judge content, not titles',
    { text: 'Effort', bold: true }, 'S: a form or a clause. M: a procedure and training. L: a system, a validation or a file rebuild'
  ], bodySize: 10, gap: 3 });
  band(s, 'Timer: 6 minutes, then two tables report their top three in 90 seconds each.', { y: 4.62, h: 0.42, fontSize: 11 });
}

// 33 Divider S5
divider(5, 'The roadmap: five phases, two tracks', 'Deliverables and exit criteria for firms that have finished and firms still closing gaps',
`[1:15]
Transition: "Everything so far becomes a plan on the next four slides. The plan has exit criteria, because 'we updated the procedures' is not a finish line."`);

// 34 Phased roadmap
{
  const s = content('Section 5  |  The roadmap', 'Five phases, two tracks',
`[1:15 | 3 min]
Walk the phases with their deliverables and exit criteria. The exit criterion is what you tell top management when a phase is done.
Track A, firms that finished the transition: enter at Phase 4 now. Run a mock inspection under the model that applies to you (Model 1 for most; Model 2 if you have never been inspected or have a PMA), starting from the risk file and pulling one thread end to end, and move readiness metrics into management review.
Track B, firms still closing gaps: compress Phases 1 to 4 into 90 days, load-bearing provisions first: 820.35 and 820.45 records, risk-file linkage, management review and internal audit evidence, supplier controls. Stop polishing the quality manual until those are done.
Sequencing rule from real programs: records an investigator reads on day one before terminology; evidence before procedures.`);
  table(s, ['Phase', 'Deliverable', 'Exit criterion', 'Track A (finished)', 'Track B (closing)'], [
    ['0  Mobilize', 'Charter, executive sponsor, scope and applicability statement (products, sites, Part 4, Class I exclusions), one owner per process', '100% of QMS processes have a named owner', 'Confirm owners; refresh applicability', 'Week 1'],
    ['1  Assess', 'Evidence-based gap workbook: every CP 7382.850 element sampled; exposure-weighted heat map', 'Every requirement sampled with at least one record; heat map approved by top management', 'Re-run on high-exposure rows only', 'Weeks 1–3'],
    ['2  Design', 'Document architecture decision (rewrite, bridge or hybrid); definitions table; template changes: complaint, service, label release, supplier file, management review agenda', 'Every gap linked to a change with an owner and a date', 'Confirm templates carry §820.35 and §820.45 elements', 'Weeks 3–5'],
    ['3  Implement and train', 'Procedures effective; templates live; competence verified proportionate to risk (6.2)', '% procedures effective; % staff competence-verified; % new records on new templates', 'Refresh training for front-room staff', 'Weeks 5–9'],
    ['4  Verify', 'Internal audit the way CP 7382.850 would; record-retrieval drills; mock inspection under your Model', 'Zero inspection-critical findings open; median retrieval under 15 minutes; mock 483 closed with evidence', 'Enter here now', 'Weeks 9–13'],
    ['5  Sustain', 'Metrics in management review; quarterly drills; watch list monitored; risk file updated on every trigger', 'Metrics green two quarters running; every complaint, change and CAPA visibly updates the risk file', 'Ongoing', 'After week 13'],
  ], { colW: [1.2, 3.1, 2.3, 1.3, 1.1], fontSize: 8, rowH: 0.38 });
}

// 35 Sizing
{
  const s = content('Section 5  |  The roadmap', 'Sizing the roadmap to your firm',
`[1:18 | 2 min]
Three archetypes. A small Class I or exempt firm does not need a two-hundred-procedure program: a scoped applicability statement, compliant complaint and 820.35 records, label controls, a handful of revised forms and one retrieval drill. A certified Class II or III firm is closing the last twenty percent: the records FDA now reads, the 820.35 and 820.45 records, risk linkage across processes, and internal audits mapped to the compliance program. A drug-led combination product manufacturer maps the 4.4(b)(1) clauses inside the pharma quality system with evidence, and adds documented risk management in product realization and complaint handling under 8.2.2 plus 820.35(a).`);
  const cards = [
    ['Small Class I or CGMP-exempt firm', ['Two-page applicability statement: what applies, what is excluded and why (7.3 exclusion documented)', 'Complaint records per §820.35(a); MDR and Part 806 procedures; UDI', 'Label release record per §820.45', 'Three revised forms, one retrieval drill, one management review with the new inputs']],
    ['Certified Class II / III firm (ISO 13485, MDSAP)', ['The last 20%: §820.35 and §820.45 record content; UDI in records', 'Management review, internal audit and supplier audit records written to be read', 'Risk linkage: complaint → risk file → change → supplier → management review', 'Internal audit program restructured to the six QMS Areas; mock inspection under Model 1']],
    ['Drug-led combination product manufacturer', ['Map 21 CFR 4.4(b)(1) clauses inside the pharma QMS with evidence: 4.1, 5, 6.1, 7.3, 7.4, 8.2.2, 8.4, 8.5, 7.5.3, 7.5.4', 'Documented risk management in product realization with records', 'Complaint handling per 8.2.2 and §820.35(a); servicing per §820.35(b)', 'Verify contract manufacturers\' alignment; no MDSAP route']],
  ];
  const cw = (CW - 0.4) / 3;
  cards.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 3.7, title: c[0], titleSize: 11.5, titleH: 0.5, body: c[1], bodySize: 9.5, gap: 4, fill: i === 1 ? C.goldTint : C.tint }));
}

// 36 Metrics
{
  const s = content('Section 5  |  The roadmap', 'Metrics that belong in management review',
`[1:20 | 2 min]
Twelve candidate metrics with targets. Pick five. Each one measures readiness for the inspection process as it actually runs, not compliance theatre: evidence coverage of compliance-program elements, record completeness against 820.35 and 820.45, retrieval time, and whether risk files move when complaints, CAPAs and changes happen.
The workbook has a metrics sheet with a red-amber-green status column. Put it in management review; FDA reads the minutes.`);
  table(s, ['Readiness metric', 'Target', 'Data source'], [
    ['CP 7382.850 elements with evidence sampled in the last 12 months', '100%', 'Gap workbook'],
    ['Open inspection-critical gaps (high exposure, true regulatory gap)', '0', 'Gap workbook'],
    ['Median time to produce a requested record', '15 minutes or less', 'Retrieval drills'],
    ['Complaint records complete against §820.35(a) elements', '100%', 'Complaint system audit'],
    ['Servicing records with UDI and required elements', '100%', 'Service records audit'],
    ['Lots with a documented five-point label examination and release', '100%', 'Batch records'],
    ['Risk files updated after complaint, CAPA or change triggers', '100% within defined time', 'Risk management system'],
    ['CAPAs closed with effectiveness data', '100%', 'CAPA system'],
    ['Suppliers with risk-tiered controls and a current evaluation', '100% of critical suppliers', 'Supplier files'],
    ['Internal audit coverage of the six QMS Areas and four OAFRs', 'All areas each cycle', 'Audit program'],
    ['Management review actions closed on time', '95% or more', 'Management review log'],
    ['Competence verified for high-risk processes (beyond read-and-sign)', '100%', 'Training records'],
  ], { colW: [5.2, 1.9, 1.9], fontSize: 8.5, rowH: 0.24, boldFirst: false });
}

// 37 Watch list
{
  const s = content('Section 5  |  The roadmap', 'Watch list and resources',
`[1:22 | 1 min]
Where to keep checking. FDA's QMSR page and FAQ (thirteen questions as of February 2026), the compliance program itself, the seven CDRH Learn QMSR modules, and the Warning Letters database. ISO 13485:2016 was confirmed in its 2025 systematic review; FDA staff said it will not be revised before at least April 2030, and any future edition would need rulemaking to enter the QMSR. The MDSAP Audit Approach was revised in February 2026 to cite the QMSR. Items marked "reported" come from secondary sources; verify before you rely on them.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.7, title: 'Primary sources to read yourself', body: [
    'Final rule, 89 FR 7496 (2 Feb 2024), especially the preamble responses to Comments 8, 18, 31, 51, 55, 79–81',
    'FDA QMSR page and FAQ (13 questions, current as of 2 Feb 2026)',
    'Compliance Program 7382.850, Inspection of Medical Device Manufacturers (78 pages), Attachment A',
    'CDRH Learn: seven QMSR modules incl. the 14 Jan and 1 Apr 2026 town halls',
    'Warning Letters: Linemaster (27 May 2026), Koven (21 Jul 2026), Nipro Renal Solutions USA (24 Jul 2026)',
    'ISO 13485:2016 read-only at the ANSI IBR portal; AAMI TIR102:2019 crosswalk (old Part 820 to ISO)'
  ], bodySize: 9.5, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.7, title: 'Watch list, autumn 2026', fill: C.goldTint, body: [
    'ISO 13485:2016 confirmed in 2025; no revision before at least 2030 per FDA staff; ISO/TS 23485 application guideline in development',
    'MDSAP Audit Approach revised Feb 2026 (P0002.010, reported) to cite §820.10, §820.35, §820.45',
    'Draft guidance: QMS Information for Certain Premarket Submission Reviews (Nov 2025); finalization pending',
    'Computer Software Assurance guidance (Sep 2025; QMSR-aligned update Feb 2026, reported)',
    'Human factors guidance revision aligned to ISO 13485 terminology (Aug 2026, reported)',
    'FDA\'s FY2026 483 citation spreadsheet (due after 30 Sep 2026): the first official QMSR citation data'
  ], bodySize: 9.5, gap: 4 });
}

// 38 Exercise C
{
  const s = content('Exercise C  |  5 minutes', 'Exercise C: your 90-day plan',
`[1:23 | 5 min: 3 solo, 2 read-outs]
Exercise Pack, Exercise C: one card per participant. Three minutes solo, then each table reads out one commitment in a single sentence.
The card asks for: your track; the three records you will fix first (from Exercises A and B); the mock inspection you will run and under which model; one behavior you will train (the three-part risk answer, producing newly inspectable records without stalling); one owner and date per item; and the public-footprint check you will do this month (registration and listing, MDR history, recalls, prior 483s).`);
  card(s, { x: M, y: 1.3, w: CW, h: 3.2, title: 'The card (Exercise Pack, Exercise C)', body: [
    { text: 'Track', bold: true }, 'A (finished: verify and sustain) or B (closing gaps: compress and prioritize)',
    { text: 'Three records to fix first', bold: true }, 'Drawn from what you saw in Exercises A and B; each with an owner and a date',
    { text: 'The mock inspection', bold: true }, 'Date, model (1 or 2), who plays the investigator, which product risk the thread starts from',
    { text: 'One behavior to train', bold: true }, 'The three-part risk answer; handing over management review and audit records without stalling; no QSR vocabulary in the front room',
    { text: 'One public-footprint check this month', bold: true }, 'Registration and listing, MDR history, recalls, prior 483s, GUDID entries versus labels'
  ], bodySize: 10.5, gap: 4 });
  band(s, 'Three minutes solo. Then one sentence per table: "By [date], we will ..."', { y: 4.62, h: 0.42, fontSize: 11.5 });
}

// 39 Takeaways
{
  const s = content('Close', 'Five things to take back to your site',
`[1:28 | 1 min]
Read the five slowly. Then to questions.`);
  const t = [
    ['Renaming is not compliance; evidence is', 'FDA does not care what you call the file. It cares whether the record exists, holds the required content, and shows the process worked.'],
    ['Four provisions decide most first inspections', '§820.10 hooks, §820.35 records, §820.45 labeling, §820.3 definitions. ISO 13485 alone does not get you there.'],
    ['The investigator opens your risk file, not your manual', 'Six QMS Areas, four OAFRs, records chosen by product risk. Every process must show how risk informed its decisions.'],
    ['Management review and audit records are inspection documents now', 'Write them to be read: inputs, decisions, resources, follow-up. Never sanitize; close the loop.'],
    ['Five phases, two tracks, exit criteria, a mock inspection', 'Load-bearing provisions first; a mock inspection under your model before FDA runs the real one.'],
  ];
  t.forEach((it, i) => {
    const y = 1.3 + i * 0.72;
    txt(s, String(i + 1), { x: M, y, w: 0.6, h: 0.6, fontFace: FH, fontSize: 30, bold: true, color: C.gold, valign: 'middle' });
    txt(s, it[0], { x: M + 0.7, y: y + 0.02, w: 8.3, h: 0.3, fontSize: 14, bold: true, color: C.navy, valign: 'middle' });
    txt(s, it[1], { x: M + 0.7, y: y + 0.32, w: 8.3, h: 0.3, fontSize: 11, color: C.ink, valign: 'top' });
  });
}

// 40 References
{
  const s = content('Close', 'References',
`[1:29 | 30 sec]
Point to the slide; the handout carries the same list with links. Move to questions.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.7, title: 'Regulation and rulemaking', body: [
    '21 CFR Part 820, Quality Management System Regulation (eCFR, as in force from 2 Feb 2026)',
    'Final rule: Medical Devices; Quality System Regulation Amendments, 89 FR 7496 (2 Feb 2024); correction 89 FR 82945 (15 Oct 2024)',
    'Proposed rule, 87 FR 10119 (23 Feb 2022)',
    'Technical amendments, 90 FR 55978 (4 Dec 2025)',
    '21 CFR 4.4 (combination products); Parts 803, 806, 821, 830; Part 11',
    'ISO 13485:2016; ISO 9000:2015 Clause 3 (read-only at ibr.ansi.org)'
  ], bodySize: 9.5, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.7, title: 'FDA implementation and enforcement', fill: C.goldTint, body: [
    'FDA QMSR page and QMSR Frequently Asked Questions (fda.gov)',
    'Compliance Program 7382.850, Inspection of Medical Device Manufacturers (implementation 2 Feb 2026)',
    'CDRH webinar (16 Dec 2025) and town halls (14 Jan 2026; 1 Apr 2026): slides and transcripts on CDRH Learn',
    'Warning Letters: Linemaster Switch Corp. (27 May 2026); Koven Technologies (21 Jul 2026); Nipro Renal Solutions USA (24 Jul 2026)',
    'FDA Inspection Observations data, FY2025 (fda.gov)',
    'AAMI TIR102:2019 mapping of 21 CFR to ISO 13485:2016 (listed on FDA\'s QMSR page)'
  ], bodySize: 9.5, gap: 4 });
}

// 41 Q&A
{
  const s = base(true);
  txt(s, 'Questions', { x: M, y: 1.7, w: CW, h: 0.9, fontFace: FH, fontSize: 44, bold: true, color: C.white });
  txt(s, 'If an investigator opened your risk file tomorrow and picked one high-severity hazard, could your people walk them to a complaint, a change, a supplier control and a management review decision in ten minutes?', { x: M, y: 2.65, w: 9, h: 0.9, fontSize: 16, color: C.gold, italic: true });
  txt(s, '[Speaker name]   |   [email]   |   Elder Consulting, LLC', { x: M, y: 3.85, w: CW, h: 0.3, fontSize: 13, color: C.white });
  txt(s, 'Participant Handout, Workshop Exercise Pack and Gap Assessment Workbook: [link or QR code]', { x: M, y: 4.2, w: CW, h: 0.3, fontSize: 11, color: C.paleText });
  s.addNotes(
`[1:29 – 1:30 and overflow]
Open with the question on the slide if the room is quiet. Seed questions and suggested answers are in the Facilitator Guide, section 7: certificates and MDSAP credit; keeping DHF/DMR names; redacting or refusing audit records; ISO 14971; Model 1 versus Model 2; 820.45 and automated inspection; how to write the 483 response; Part 11.
Close: thank the room; point to the handout, the exercise pack and the workbook; give your contact details.
Fill in the placeholders before presenting.`);
}

pres.writeFile({ fileName: 'out/QMSR-Transition-Seminar.pptx' }).then(f => console.log('wrote', f, 'slides:', n));
