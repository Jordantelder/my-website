const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.author = 'Elder Consulting, LLC';
pres.company = 'Elder Consulting, LLC';
pres.title = 'ISO 13485 & Audit Readiness';
pres.subject = 'Medical Device Seminar - case studies on surviving unannounced audits and maintaining a global QMS';

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
  s.addText('ISO 13485 & Audit Readiness  |  Elder Consulting, LLC', { x: M, y: H - 0.36, w: 6.5, h: 0.22, fontFace: FB, fontSize: 9, color: fc, isTextBox: true, margin: 0, valign: 'middle' });
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
  txt(s, 'ISO 13485 & Audit Readiness', { x: M, y: 2.0, w: CW, h: 0.8, fontFace: FH, fontSize: 36, bold: true, color: C.navy });
  txt(s, 'Case studies on surviving unannounced audits and maintaining a global QMS', { x: M, y: 2.9, w: 8.6, h: 0.8, fontSize: 18, color: C.gray });
  txt(s, '90-minute seminar   |   Speaker: [Name, Title]   |   [Date]   |   [Venue / Event]', { x: M, y: 4.05, w: CW, h: 0.3, fontSize: 13, color: C.ink });
  txt(s, 'Speaker deck with notes. Companion materials: Participant Handout, Case Study Workshop Pack.', { x: M, y: 4.4, w: CW, h: 0.3, fontSize: 11, color: C.gray, italic: true });
  s.addNotes(
`[0:00 | 2 min]
Welcome the room and introduce yourself: your background in device quality and regulatory work, and the audits and inspections you have personally been through. One sentence on why this topic matters to you.
The promise for the next 90 minutes: you leave with (1) a first-hour protocol you can install at your site next week, (2) a ten-question readiness self-test, (3) a working model for running one QMS across several jurisdictions, and (4) four case studies to argue about at your table.
Point to the two documents on the tables: the Participant Handout (protocol, roles, checklists, reporting timelines, references) and the Case Study Workshop Pack (the four cases with discussion questions and space for notes).
Housekeeping: 90 minutes straight through, no formal break, so stretch during the case work. Questions are welcome at any time; if one belongs to a later section, park it on the flipchart and promise to come back.
Fill in the placeholders on this slide (speaker, date, venue) before presenting.`);
}

// 2 Agenda
{
  const s = content('Welcome', 'How the next 90 minutes run',
`[0:02 | 2 min]
Walk the agenda quickly. Stress that the case studies are the core of the session: nearly 30 minutes of table work, so people should sit in groups of four to six now if they have not already.
Time markers appear at the top of every speaker note in this deck. If you are running behind, the buffer is in Section 5 (compress the architecture and matrix slides to headlines) and in how many case-study questions you debrief in plenary.
Ask people to keep the Case Study Workshop Pack closed until Section 4 so the cases land fresh.`);
  table(s, ['Time', 'Segment', 'Format'], [
    ['0:00 – 0:08', 'Welcome, objectives, quick poll', 'Talk + show of hands'],
    ['0:08 – 0:20', 'Why readiness is now a permanent state: the 2026 landscape', 'Talk'],
    ['0:20 – 0:32', 'ISO 13485 as the backbone: the clauses that decide audits', 'Talk + questions'],
    ['0:32 – 0:47', 'Anatomy of an unannounced audit: the first 60 minutes and the next 72 hours', 'Protocol walk-through'],
    ['0:47 – 1:16', 'Four case studies', 'Table discussion + debrief'],
    ['1:16 – 1:26', 'Maintaining a global QMS: architecture, rhythm, readiness KPIs', 'Talk'],
    ['1:26 – 1:30', 'Takeaways, 30-60-90 day plan, Q&A', 'Discussion'],
  ], { colW: [1.1, 3.9, 1.6], w: 6.6, fontSize: 10.5, rowH: 0.36 });
  card(s, { x: 7.35, y: 1.3, w: 2.15, h: 2.95, title: 'On your table', fill: C.goldTint, body: [
    { text: 'Participant Handout', bold: true }, 'First-hour protocol, roles, do/don\'t list, reporting timelines, self-test, references',
    { text: 'Case Study Workshop Pack', bold: true }, 'Four composite cases, discussion questions, room for notes'
  ], bodySize: 9.5 });
}

// 3 Poll
{
  const s = content('Welcome', 'Three quick questions before we start',
`[0:04 | 4 min]
Three shows of hands. After each, pick one person for a one-sentence story; keep it moving.
Question 3 is the hook. In most rooms very few hands go up. Say: "That is the test an unannounced auditor runs in the first hour, whether or not they call it that."
Write the rough counts on the flipchart. You will come back to them at the readiness self-test near the end (slide 35) and ask whether anyone would change their answer.`);
  const qs = [
    ['Experience', 'Who here has lived through an unannounced audit or an FDA inspection?', 'Listen for: how they found out the auditors were on site, and how long it took to get organized.'],
    ['Footprint', 'Who ships into three or more regulatory jurisdictions?', 'Listen for: how many separate procedures or "local versions" they maintain today.'],
    ['The 30-minute test', 'Who could hand an auditor the complete DHR and full traceability for any lot shipped last month, within 30 minutes?', 'This is the question the rest of the session is built around.'],
  ];
  qs.forEach((q, i) => {
    card(s, { x: M, y: 1.3 + i * 1.25, w: CW, h: 1.18, num: i + 1, kicker: q[0], title: q[1], titleSize: 13.5, titleH: 0.5, body: q[2], bodySize: 10.5, fill: i === 2 ? C.goldTint : C.tint });
  });
}

// 4 Divider S1
divider(1, 'Why readiness is now a permanent state', 'Unannounced audits, converging regulations, and what auditors actually test',
`[0:08]
Transition: "For twenty years most of us prepared for audits. The calendar told us when. That model is gone."`);

// 5 Who can arrive
{
  const s = content('Section 1  |  Why readiness is permanent', 'Who can arrive without warning',
`[0:08 | 4 min]
History in one breath: the PIP breast-implant scandal exposed how little a scheduled surveillance audit could see. The Commission's Recommendation 2013/473/EU asked notified bodies to audit unannounced at least every three years; the MDR then wrote unannounced audits into law (Annex IX, section 3.4) with a five-year minimum and an explicit right to visit critical suppliers and subcontractors. The notified body must keep a plan for these audits and must not disclose it to you.
FDA: domestic inspections have always been unannounced for routine and for-cause work. What changed in 2025 is the announced expansion of unannounced inspections at foreign sites; the old assumption that "overseas means pre-announced" no longer holds.
MDSAP: normally announced, but the program allows special and unannounced audits when a regulator asks for one or when serious signals appear.
Land the point: the "prepare for the audit" model is dead. The only workable posture is to be ready every day.`);
  table(s, ['Regime', 'Who audits', 'Advance notice', 'Basis and cadence'], [
    ['EU MDR / IVDR', 'Notified body', 'None', 'Annex IX §3.4: unannounced audit at least once every 5 years per manufacturer; may extend to critical suppliers and subcontractors; the plan is never disclosed'],
    ['US FDA', 'FDA investigator', 'None for domestic routine and for-cause inspections; foreign inspections increasingly unannounced since 2025', 'FD&C Act §704 inspection authority; QMSR (21 CFR 820) in force since 2 Feb 2026'],
    ['MDSAP (AU, BR, CA, JP, US)', 'Auditing organization', 'Normally announced; special or unannounced audits possible when a regulator requests or serious signals appear', '3-year cycle: initial certification, two surveillance audits, recertification'],
    ['Competent authorities and other regulators', 'e.g., EU member-state authorities, ANVISA, TGA, PMDA', 'Varies; for-cause visits are often unannounced', 'Market surveillance, vigilance signals, complaints, recalls'],
    ['Customers and distributors', 'Customer quality', 'Usually announced', 'Quality agreements'],
  ], { colW: [1.7, 1.6, 2.5, 3.2], fontSize: 10, rowH: 0.5 });
}

// 6 Snapshot
{
  const s = content('Section 1  |  Why readiness is permanent', 'The 2026 regulatory snapshot',
`[0:12 | 5 min]
Six things to hold in your head this year. Spend most of the time on the first two.
FDA QMSR: the Quality System Regulation was replaced on 2 February 2026 by the Quality Management System Regulation, which incorporates ISO 13485:2016 by reference and adds a small number of FDA-specific requirements: 820.10 (general), 820.35 (records, including complaint and servicing records with UDI), 820.45 (labeling and packaging controls). QSIT is retired. The old 820.180(c) exemption that kept management review, internal audit and supplier audit records out of routine FDA review did not carry over; plan for investigators to ask for them.
EU: the extended MDR and IVDR transition dates keep many legacy devices in scope for years; unannounced audits continue regardless of transition status.
MDSAP: one audit, five regulators, and a grading system that escalates automatically.
UK: CE marks accepted to 2028 or 2030 depending on the certificate; new post-market surveillance requirements since June 2025.
ISO 13485: still the 2016 edition (plus the 2024 climate-change amendment), harmonised for the MDR/IVDR as EN ISO 13485:2016+A11:2021; a revision is in progress in ISO/TC 210, so build a transition plan when the draft stabilizes.
Housekeeping for you as speaker: verify every date on this slide the week before you present; this snapshot is as of September 2026.`);
  const cards = [
    ['FDA QMSR', 'In force 2 Feb 2026. ISO 13485:2016 incorporated into 21 CFR 820; QSIT retired. Additions: 820.10, 820.35 (complaint and servicing records incl. UDI), 820.45 (labeling and packaging). Management review and internal/supplier audit records are now reviewable.'],
    ['EU MDR / IVDR', 'Transition extended: MDR legacy devices to end-2027/2028 (Reg. 2023/607); IVDR to 2027–2029 (Reg. 2024/1860). Annex IX §3.4 unannounced audits at least every 5 years. PRRC, PMS and PSUR duties, EUDAMED phased roll-out.'],
    ['MDSAP', 'One audit for Australia, Brazil, Canada, Japan and the USA; further jurisdictions participate as affiliates. Mandatory for Health Canada Class II–IV licences. Nonconformities graded 1–5; grades 4–5 escalated to regulators within 5 business days.'],
    ['United Kingdom', 'UK MDR 2002 (as amended). CE marking accepted to 30 Jun 2028 (MDD/AIMDD/IVDD) or 30 Jun 2030 (MDR/IVDR). New post-market surveillance regulations in force since 16 Jun 2025. UK Responsible Person for non-UK manufacturers.'],
    ['ISO 13485', '2016 edition remains current, plus Amd 1:2024 (climate-change considerations). EN ISO 13485:2016+A11:2021 harmonised under MDR/IVDR. Revision under way in ISO/TC 210: track the draft stages and expect a transition period.'],
    ['Other major markets', 'Brazil RDC 665/2022 (BGMP), Japan MHLW Ordinance 169, China NMPA GMP, Korea KGMP, Saudi SFDA, India MDR 2017. Largely aligned with ISO 13485, each with local deltas on registration, records, language and reporting.'],
  ];
  const cw = (CW - 0.4) / 3, ch = 1.78;
  cards.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    card(s, { x: M + col * (cw + 0.2), y: 1.3 + row * (ch + 0.18), w: cw, h: ch, title: c[0], body: c[1], bodySize: 9.5, fill: i === 0 ? C.goldTint : C.tint });
  });
}

// 7 What auditors test
{
  const s = content('Section 1  |  Why readiness is permanent', 'What auditors actually test',
`[0:17 | 3 min]
Left side: every auditor, whatever the badge, asks the same three questions in sequence. Show me the procedure. Show me the records that prove you follow it. Now show me it happening, on the floor, with the people who do the work. Most QMS failures live between question two and question three.
Right side: the areas where findings cluster year after year, whether you read FDA 483 data, notified body nonconformity summaries or MDSAP reports. The order shifts; the list does not. CAPA and complaint handling have led for more than a decade.
Do not quote numbers unless you have pulled the latest FDA 483 observation data; the pattern is the point.`);
  const q = [
    ['Show me the procedure', 'Is there a documented process, and does it meet the standard and the regulations that apply?'],
    ['Show me the records', 'Do the records prove the procedure is followed every time, not just when someone is watching?'],
    ['Show me it happening', 'Walk the floor. Interview operators. Pick a unit and follow it. Does practice match paper?'],
  ];
  q.forEach((it, i) => card(s, { x: M, y: 1.3 + i * 1.15, w: 3.9, h: 1.03, num: i + 1, title: it[0], titleSize: 13, body: it[1], bodySize: 10 }));
  card(s, { x: 4.7, y: 1.3, w: 4.8, h: 3.33, title: 'Where findings cluster, year after year', fill: C.goldTint, body: [
    'CAPA: root cause, effectiveness (8.5.2)', 'Complaint handling and reporting to regulators (8.2.2, 8.2.3)', 'Purchasing and supplier controls (7.4)',
    'Process validation and revalidation (7.5.6)', 'Design controls and design changes (7.3)', 'Nonconforming product and rework (8.3)',
    'Document and record control (4.2.4, 4.2.5)', 'Management review effectiveness (5.6)', 'Competence, training and its effectiveness (6.2)'
  ], bodySize: 11, gap: 4 });
}

// 8 Divider S2
divider(2, 'ISO 13485 as the backbone', 'The clauses that decide audits, and the evidence chain behind them',
`[0:20]
Transition: "Every regime we just looked at either adopts ISO 13485 outright or sits on top of it. So the standard is the spine of readiness."`);

// 9 Clause map
{
  const s = content('Section 2  |  ISO 13485 as the backbone', 'ISO 13485:2016 on one slide',
`[0:20 | 3 min]
A fast orientation for mixed audiences; experts will know this, newcomers need it for the case studies.
Five clauses of requirements. The thread running through all of them is the risk-based approach to processes (4.1.2) and the phrase "applicable regulatory requirements", which appears dozens of times and is exactly what lets regulators adopt the standard: the QMSR incorporates it, MDSAP audits against it, and the MDR grants a presumption of conformity through the harmonised EN version.
Highlight the sub-clauses in bold on the following two slides: they are the ones auditors spend their time on.`);
  const cols = [
    ['4', 'Quality management system', ['4.1 Risk-based processes; outsourced processes (4.1.5); QMS software validation (4.1.6)', '4.2 Quality manual; medical device file (4.2.3); documents (4.2.4); records (4.2.5)']],
    ['5', 'Management responsibility', ['5.1–5.3 Commitment, customer focus, quality policy', '5.4 Planning, quality objectives', '5.5 Responsibility, authority, management representative', '5.6 Management review: inputs and outputs']],
    ['6', 'Resource management', ['6.2 Human resources: competence, training, effectiveness', '6.3 Infrastructure and maintenance', '6.4 Work environment and contamination control']],
    ['7', 'Product realization', ['7.1 Planning and risk management', '7.3 Design and development', '7.4 Purchasing', '7.5 Production and service: validation (7.5.6), sterile (7.5.7), traceability (7.5.9)', '7.6 Measuring equipment']],
    ['8', 'Measurement and improvement', ['8.2.1–8.2.3 Feedback, complaints, reporting to regulators', '8.2.4 Internal audit', '8.2.5–8.2.6 Process and product monitoring', '8.3 Nonconforming product', '8.4 Analysis of data', '8.5 Improvement: CAPA']],
  ];
  const cw = (CW - 4 * 0.14) / 5;
  cols.forEach((c, i) => {
    const x = M + i * (cw + 0.14);
    s.addShape(S.roundRect, { x, y: 1.3, w: cw, h: 3.2, fill: { color: C.tint }, line: { color: C.tint, width: 0 }, rectRadius: 0.06 });
    txt(s, c[0], { x: x + 0.12, y: 1.36, w: 0.5, h: 0.45, fontFace: FH, fontSize: 24, bold: true, color: C.goldDark, valign: 'middle' });
    txt(s, c[1], { x: x + 0.12, y: 1.82, w: cw - 0.24, h: 0.45, fontSize: 11, bold: true, color: C.navy, valign: 'top' });
    s.addText(bul(c[2], { fontSize: 8.5, gap: 3 }), { x: x + 0.12, y: 2.3, w: cw - 0.24, h: 2.1, fontFace: FB, fontSize: 8.5, color: C.ink, valign: 'top', isTextBox: true, margin: 0 });
  });
  band(s, 'Risk-based approach to every process (4.1.2)  •  "Applicable regulatory requirements" woven through every clause  •  Written so regulators can adopt it: QMSR, MDSAP, MDR presumption of conformity via EN ISO 13485:2016+A11:2021', { y: 4.6, h: 0.45, fontSize: 10 });
}

// 10 Audit-critical clauses A
{
  const s = content('Section 2  |  ISO 13485 as the backbone', 'The audit-critical clauses (1 of 2)',
`[0:23 | 3 min]
Read the middle column as the auditor's request list. Every item is something you should be able to produce within minutes for the product the auditor has just picked up.
The right column is the pattern of failure we see repeatedly. Ask the room which row they recognise. Suppliers and change control usually get the most nods, and both come back in the case studies.`);
  table(s, ['Clause', 'What the auditor asks for', 'How it typically fails'], [
    ['4.1.5 / 7.4  Outsourced processes and suppliers', 'Approved supplier list, evaluations, quality agreements, incoming inspection records for the components in the sampled unit', 'Evaluations years old; agreements silent on change notification and regulator access; scorecards nobody verifies'],
    ['4.2.3  Medical device file (DMR)', 'The current file for the sampled device: specifications, drawings, labeling, IFU, process specifications, acceptance criteria', 'Uncontrolled drawings on the floor; file does not match what is being built today'],
    ['4.2.4 / 4.2.5  Documents and records', 'Revision history, obsolete-document control, DHR completeness, record retention and legibility', 'Handwritten "corrections" without initials and date; missing signatures; unapproved forms in use'],
    ['5.6  Management review', 'Inputs required by 5.6.2 (audits, complaints, regulatory reporting, suppliers), decisions, resource actions and follow-up', 'Slide decks with no decisions; overdue actions; regulatory reporting never discussed'],
    ['6.2  Competence and training', 'Training matrix and effectiveness evaluation for the operators the auditor just interviewed', 'Operators trained on a superseded revision; "read and understood" with no effectiveness check'],
    ['7.3  Design and development', 'Design changes (7.3.9), verification and validation, risk management file, design transfer evidence', 'Production or supplier changes made with no design or risk impact assessment'],
  ], { colW: [2.3, 3.6, 3.1], fontSize: 9.5, rowH: 0.5 });
}

// 11 Audit-critical clauses B
{
  const s = content('Section 2  |  ISO 13485 as the backbone', 'The audit-critical clauses (2 of 2)',
`[0:26 | 3 min]
Traceability (7.5.9) is the row that decides unannounced audits, because the auditor has product in hand. If you cannot reconstruct the lot on the day, everything else is theory.
Complaints and CAPA: point out that the failure mode is usually not the absence of a system but an undocumented decision: no rationale for "not reportable", no data behind "effective".
Bridge to the next slide: "Here is how those rows connect when an auditor follows a unit backwards through your QMS."`);
  table(s, ['Clause', 'What the auditor asks for', 'How it typically fails'], [
    ['7.5.6  Process validation', 'IQ/OQ/PQ for the process being observed; revalidation triggers; software validation for automated equipment', 'New equipment or software running on the old validation; no defined revalidation criteria'],
    ['7.5.9  Traceability', 'Full trace of the sampled lot: components and lots in, build records, test results, release, distribution', 'Lot cannot be reconstructed within the audit day; distribution records incomplete'],
    ['7.6  Monitoring and measuring equipment', 'Calibration status and records for every gauge and tool the auditor sees in use', 'Overdue calibration with no product impact assessment; uncalibrated "reference only" tools used for acceptance'],
    ['8.2.2 / 8.2.3  Complaints and reporting', 'Complaint log, investigation records, reportability decisions with rationale, submission timelines', 'Late or undocumented reportability decisions; complaints closed without investigation'],
    ['8.3  Nonconforming product', 'NCR log, dispositions, rework instructions (8.3.4) and re-verification, concession records', '"Use as is" without risk rationale; rework without re-verification; repeat NCRs never trended into CAPA'],
    ['8.5.2  Corrective action', 'Open and closed CAPAs, root cause analysis, action plans, effectiveness verification', 'Symptom fixes; "training" as the universal corrective action; CAPAs open more than a year without justification'],
  ], { colW: [2.3, 3.6, 3.1], fontSize: 9.5, rowH: 0.5 });
}

// 12 Evidence chain
{
  const s = content('Section 2  |  ISO 13485 as the backbone', 'Auditors follow product, not your manual',
`[0:29 | 2 min]
This is the mental model for the whole session. An unannounced auditor walks onto the floor and picks up a unit. From that unit they pull the thread backwards: the build record, the specification it was built to, the design evidence behind that specification, the suppliers of its critical parts, the complaint and CAPA history of its product family, and forwards to release, labeling and where it was shipped.
Every box is a place where readiness is either real or not. The test at the bottom is literal: pick a random lot, start the clock, and see whether the records and the people arrive within an hour.`);
  const steps = [
    ['A unit on the line', 'Auditor selects finished or in-process product, or a lot in stock'],
    ['DHR / batch record', 'Build, inspection and test records; who did what, with which tools, when'],
    ['Medical device file (DMR)', 'Specifications, drawings, labeling and process specs the unit should meet'],
    ['Design evidence', 'Verification and validation, risk management file, change history'],
    ['Critical suppliers', 'Approvals, agreements, incoming inspection for the components inside'],
    ['Complaints, NCRs, CAPAs', 'History of the product family and whether it fed back into risk and design'],
    ['Release and distribution', 'Release decision, labeling and UDI, where every unit went'],
  ];
  const cw = (CW - 3 * 0.15) / 4, ch = 1.3;
  steps.forEach((st, i) => {
    const row = i < 4 ? 0 : 1, col = i < 4 ? i : i - 4;
    const x = M + col * (cw + 0.15) + (row === 1 ? (cw + 0.15) / 2 : 0);
    card(s, { x, y: 1.3 + row * (ch + 0.2), w: cw, h: ch, num: i + 1, title: st[0], titleSize: 11.5, titleH: 0.5, body: st[1], bodySize: 9.5, fill: i === 0 ? C.goldTint : C.tint });
  });
  band(s, 'Readiness test: reconstruct any lot end-to-end in 60 minutes, with the people who did the work available to explain it.', { y: 4.4, h: 0.55, fontSize: 12.5 });
}

// 13 Overlays
{
  const s = content('Section 2  |  ISO 13485 as the backbone', 'What sits on top of ISO 13485 in each regime',
`[0:31 | 2 min]
Keep this to headlines; the Participant Handout carries the detail. The message: ISO 13485 is necessary but never sufficient. Each regime adds documents, roles and reporting duties, and each audit "bites" in a characteristic place.
For FDA, stress that the newly reviewable records (management review, internal audits, supplier audits) change how those records should be written. For the EU, stress that the unannounced audit compares the product on the line with the technical documentation. For MDSAP, the country chapters and reporting timelines are where multi-site companies stumble; that is Case 4.`);
  table(s, ['Regime', 'Added on top of ISO 13485', 'Where the audit bites'], [
    ['FDA QMSR (21 CFR 820)', '820.10 general requirements; 820.35 records (complaint and servicing records with UDI, link to Part 803 decisions); 820.45 labeling and packaging controls; plus Parts 803 (MDR), 806 (corrections and removals), 807 (registration and listing), 830 (UDI)', 'Complaint files and reportability decisions; labeling inspection records; CAPA; management review and internal audit records now open to review'],
    ['EU MDR 2017/745', 'Technical documentation (Annexes II–III); PMS plan and PSUR (Art. 83–86); vigilance (Art. 87–92); PRRC (Art. 15); UDI and EUDAMED; economic operator duties (Art. 10–14); Annex IX QMS assessment including unannounced audits', 'Product sampled on the line versus technical documentation; control of critical suppliers; PMS data actually feeding risk management and design'],
    ['MDSAP', 'Country-specific chapters: Health Canada licensing; ANVISA RDC 665/2022; Japan MHLW Ordinance 169; TGA conformity assessment; FDA registration, listing and reporting', 'Adverse-event reporting timelines per jurisdiction; marketing authorization records; automatic grading escalations'],
    ['United Kingdom', 'UK MDR 2002 (as amended); PMS regulations 2025; UK Responsible Person; CE recognition to 2028/2030', 'Vigilance to MHRA; UKRP obligations; UK-specific labeling'],
  ], { colW: [1.6, 4.5, 2.9], fontSize: 9.5, rowH: 0.7 });
}

// 14 Divider S3
divider(3, 'Anatomy of an unannounced audit', 'Who shows up, what they do on the day, and how to run the first 60 minutes and the next 72 hours',
`[0:32]
Transition: "Let us make this concrete. It is 08:10 on a Tuesday. Two people you have never met are standing at reception."`);

// 15 NB mechanics
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'What a notified body does on the day',
`[0:33 | 3 min]
Mechanics first. Typically two auditors, at least one day, arriving at the manufacturing site or at a critical supplier or subcontractor named in your technical documentation. No agenda in advance. They expect to be admitted immediately; delay is recorded, refusal is grounds for certificate suspension.
You are expected to have told the notified body when your lines will not be running (holiday shutdowns, campaign manufacturing) so they can plan around it. If they arrive and nothing is being made, that is a wasted audit day for them and a problem for you.
Focus second: they want to see the device that is on the certificate being made the way the technical documentation says. Product from the line or from stock, checked against the file; witnessed tests or samples taken away; traceability of critical components; recent changes and whether you told the notified body; validation of what is actually running; conversations with the people at the bench.
Close with the callout at the bottom.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.0, title: 'The mechanics', body: [
    'Typically two auditors; at least one audit day', 'At the manufacturing site, or at a critical supplier or subcontractor', 'No agenda in advance; immediate access expected',
    'You must have told the notified body about planned production stoppages', 'Delay is written into the report; refusal is grounds for certificate suspension', 'Product may be tested on site or taken away for testing'
  ], bodySize: 10.5, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.0, title: 'The focus', fill: C.goldTint, body: [
    'Is the certified device being made here, as certified?', 'Sampled units checked against the technical documentation', 'Traceability of critical components and materials',
    'Recent design, process or supplier changes, and whether the notified body was notified', 'Validation status of the processes running that day', 'Interviews with production and inspection staff'
  ], bodySize: 10.5, gap: 4 });
  band(s, 'They are not there to read your quality manual. They are there to see whether the product being built today matches the product you certified.', { y: 4.45, h: 0.55, fontSize: 12.5 });
}

// 16 First 60 minutes
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'The first 60 minutes: a protocol',
`[0:36 | 4 min]
Walk the four phases left to right; this is the protocol reproduced in the Participant Handout.
Reception: identity check (ID, credentials, Form FDA 482 for FDA), one call to the Audit Response Lead or the named deputy from the 24/7 roster, auditors never left alone, never refused, never stalled. Reception owns the first five minutes; a laminated script is the cheapest readiness investment you will ever make.
Mobilize: the audit room, notifications (site head, QA/RA leadership, corporate quality, legal), the request log opened, scribe and runner assigned, back room stood up.
Opening meeting: confirm scope, standard and regulation, the auditors' plan; give the site overview and the EHS or gowning briefing; agree logistics including your photo and sample policy; agree how requests and findings will be communicated during the day.
On the floor: log every sample and every document request with a timestamp; subject matter experts answer only what is asked; the scribe records every statement; runners fetch records; factual errors are corrected on the spot, politely.
Foreshadow Case 1: a 50-minute delay in the lobby.`);
  const phases = [
    ['0–5 MIN', 'Reception', ['Verify identity: ID, agency or notified body credentials, Form FDA 482 for FDA', 'Call the Audit Response Lead or named deputy from the 24/7 roster', 'Never leave auditors unattended; never refuse or stall']],
    ['5–15 MIN', 'Mobilize', ['Escort to the audit room; offer water, wifi as per policy', 'Notify site head, QA/RA leadership, corporate quality, legal', 'Open the request log; assign scribe, runner, SMEs; stand up the back room']],
    ['15–30 MIN', 'Opening meeting', ['Confirm scope, standard and regulation, sites, the auditors\' plan', 'Site overview; EHS and gowning briefing', 'Agree logistics: rooms, printing, system access, photo and sample policy, how findings are communicated']],
    ['30–60 MIN', 'On the floor', ['Auditors select product; every sample and request logged with a timestamp', 'SMEs answer what is asked, then stop; the scribe records everything', 'Runners retrieve DHR, DMR and validation records; factual errors corrected immediately']],
  ];
  const cw = (CW - 3 * 0.15) / 4;
  s.addShape(S.line, { x: M + cw / 2, y: 1.55, w: CW - cw, h: 0, line: { color: C.lightGray, width: 1.5 } });
  phases.forEach((p, i) => {
    const x = M + i * (cw + 0.15);
    s.addShape(S.ellipse, { x: x + cw / 2 - 0.16, y: 1.39, w: 0.32, h: 0.32, fill: { color: i === 0 ? C.gold : C.navy }, line: { color: C.white, width: 1.5 } });
    txt(s, p[0], { x, y: 1.8, w: cw, h: 0.24, fontSize: 10, bold: true, color: C.goldDark, align: 'center', charSpacing: 1.5 });
    txt(s, p[1], { x, y: 2.04, w: cw, h: 0.32, fontSize: 14, bold: true, color: C.navy, align: 'center' });
    s.addShape(S.roundRect, { x, y: 2.42, w: cw, h: 2.55, fill: { color: C.tint }, line: { color: C.tint, width: 0 }, rectRadius: 0.06 });
    s.addText(bul(p[2], { fontSize: 9.5, gap: 4 }), { x: x + 0.12, y: 2.52, w: cw - 0.24, h: 2.35, fontFace: FB, fontSize: 9.5, color: C.ink, valign: 'top', isTextBox: true, margin: 0 });
  });
}

// 17 Roles
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'Audit response roles: everyone has a deputy',
`[0:40 | 2 min]
Eight roles; in a small company one person may hold two, but every role has a name and a named deputy, and the roster covers nights, weekends and holiday shutdowns.
Emphasize the front-room / back-room split: nothing goes into the front room unreviewed, and the back room is where issues are spotted and SMEs are prepared before they walk in.
The scribe is the most under-rated role. A verbatim log of questions, answers and documents shown is what lets you challenge a finding accurately at the closing meeting and write a precise response afterwards.`);
  const roles = [
    ['Audit Response Lead', 'Owns the audit; the single voice to the auditors; decides what is provided and when'],
    ['Site Head', 'Resources and decisions; visible at the opening and closing meetings'],
    ['Front-room SMEs', 'Production, QC, engineering, supplier quality, RA; answer what is asked, nothing more'],
    ['Scribe', 'Verbatim log of questions, answers, documents shown and samples taken'],
    ['Runners', 'Retrieve records; nothing reaches the front room unreviewed'],
    ['Back-room coordinator', 'Reviews every document before it goes in; spots issues; prepares SMEs'],
    ['Document control and IT', 'System access, controlled copies, record retrieval, printing'],
    ['Reception and security', 'The script, the roster, badges and escort; the first five minutes'],
  ];
  const cw = (CW - 3 * 0.15) / 4, ch = 1.5;
  roles.forEach((r, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    card(s, { x: M + col * (cw + 0.15), y: 1.3 + row * (ch + 0.15), w: cw, h: ch, title: r[0], titleSize: 11.5, titleH: 0.5, body: r[1], bodySize: 9.5, fill: i === 0 ? C.goldTint : C.tint });
  });
  band(s, 'Every role has a named deputy. The roster covers nights, weekends and holiday shutdowns, and reception has it on paper.', { y: 4.55, h: 0.45, fontSize: 11.5 });
}

// 18 Do and don't
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'On the day: do and don\'t',
`[0:42 | 2 min]
Read a few from each side; the full list is in the handout.
Two to stress. First: never correct, backdate or create a record while auditors are on site. A finding is a finding; falsification is a career and a company event. Second: "I don't know, I will find out" is a complete and respected answer, and it must be followed by actually finding out.
On signatures: FDA investigators may ask for affidavits or signed statements. Company policy should be clear in advance, agreed with regulatory and legal counsel, and known to the Audit Response Lead.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.7, title: 'Do', titleColor: C.green, fill: C.greenTint, body: [
    'Give exactly what is asked, when it is asked', 'Keep a copy of everything you hand over', 'Answer the question, then stop',
    'Say "I don\'t know, I will find out", then find out', 'Challenge factual errors at the time, with evidence', 'Take your own notes on every potential finding',
    'Prepare operators to answer normally; they can and will be interviewed', 'Treat every finding as a free consultancy report'
  ], bodySize: 10.5, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.7, title: 'Don\'t', titleColor: C.red, fill: C.redTint, body: [
    'Refuse, stall, or "lose" documents', 'Volunteer unrelated information or unrequested tours', 'Guess, speculate, or say "we usually..."',
    'Correct, backdate or create records during the audit', 'Argue grading in the room; respond in writing instead', 'Sign statements without RA and legal review',
    'Leave auditors unescorted or with open system access', 'Offer gifts or hospitality beyond basic courtesy'
  ], bodySize: 10.5, gap: 4 });
}

// 19 After they leave
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'After they leave: the 72-hour plan',
`[0:44 | 2 min]
Day zero: debrief within two hours while memories are fresh; reconcile the request log with the auditors' list of findings, verbatim; secure copies of everything provided; brief senior management; make any notifications your procedures or contracts require (corporate, PRRC, other sites).
Day one: classify each finding, name owners, contain anything that touches product or patient safety. For FDA, the clock on the Form 483 response is 15 business days if you want FDA to consider it before deciding on a Warning Letter.
Days two and three: root cause, not symptom fixes; distinguish correction from corrective action; define effectiveness criteria before you act; draft the response plan to the notified body within its stated window (check your contract; for MDSAP, expect around 15 calendar days for the plan).
Then execute, evidence closure, verify effectiveness, and put the whole thing through management review.`);
  const cols = [
    ['DAY 0', 'Same day', ['Debrief within 2 hours', 'Reconcile the request log with the findings list, verbatim', 'Secure copies of everything provided', 'Brief senior management; make required notifications (corporate, PRRC, other sites)']],
    ['DAY 1', 'Classify and contain', ['Classify each finding; assign owners and dates', 'Containment for any product or safety issue', 'FDA: start the Form 483 response; 15 business days for FDA to consider it before a Warning Letter decision']],
    ['DAYS 2–3', 'Root cause and plan', ['Root cause analysis, not symptom fixes', 'Correction versus corrective action; effectiveness criteria defined up front', 'Response plan to the notified body within its window (MDSAP: typically 15 calendar days)']],
    ['THEN', 'Execute and verify', ['Implement; collect objective evidence of closure', 'Verify effectiveness with data', 'Feed findings, trends and lessons into management review and the next internal audit plan']],
  ];
  const cw = (CW - 3 * 0.15) / 4;
  cols.forEach((c, i) => card(s, { x: M + i * (cw + 0.15), y: 1.3, w: cw, h: 3.7, kicker: c[0], title: c[1], titleSize: 12.5, titleH: 0.5, body: c[2], bodySize: 9.5, gap: 4, fill: i === 3 ? C.goldTint : C.tint }));
}

// 20 Findings and consequences
{
  const s = content('Section 3  |  Anatomy of an unannounced audit', 'Findings and consequences by regime',
`[0:46 | 1 min]
One minute: the vocabulary you need for the case studies. FDA works in observations, then Warning Letters, then enforcement. Notified bodies work in minor and major nonconformities and hold the certificate over your head. MDSAP grades every nonconformity from 1 to 5 using the GHTF/SG3/N19 method: direct-impact clauses start at grade 3, indirect at 1, plus one for a missing documented process, plus one for a repeat, capped at 5. Grades 4 and 5 are reported to all five regulators within five business days. Case 4 lands on a grade 4.`);
  table(s, ['Regime', 'How findings are expressed', 'What escalates'], [
    ['FDA', 'Form FDA 483 inspectional observations; inspection classified NAI / VAI / OAI; Warning Letter; then seizure, injunction, consent decree; import alert for foreign sites', 'Repeat observations, an inadequate 483 response, data integrity problems, failures to report'],
    ['Notified body (MDR)', 'Minor and major nonconformities (definitions per notified body and MDCG guidance); corrective action plans; certificate suspension or withdrawal', 'Systemic majors, refusal of access, unreported significant changes, nonconformity found on sampled product'],
    ['MDSAP', 'Grades 1–5 per GHTF/SG3/N19: direct-impact clauses start at 3, indirect at 1; +1 for no documented process; +1 for a repeat; capped at 5', 'Grade 4 or 5: the auditing organization notifies the participating regulators within 5 business days; regulators may act independently'],
  ], { colW: [1.6, 4.4, 3.0], fontSize: 10, rowH: 0.8 });
}

// 21 Divider S4
divider(4, 'Case studies', 'Four composite cases drawn from real audits; names, places and details changed. At your table: 2 minutes to read, 3 to discuss, then a 2-minute plenary debrief.',
`[0:47 | 1 min]
Open the Case Study Workshop Pack now. Explain the rhythm: read, discuss, debrief. Each case is 7 minutes; be strict, and use the timer on your phone visibly.
The cases are composites built from real audits and inspections; every identifying detail has been changed. If someone recognises "their" story, that is the point.
If you are behind schedule, run Cases 1, 3 and 4 and assign Case 2 as homework.`);

// case helpers
function caseSituation(num, title, setup, happened, discuss, notes) {
  const s = content('Section 4  |  Case study ' + num, title, notes);
  card(s, { x: M, y: 1.3, w: 2.75, h: 2.85, kicker: 'THE SETUP', body: setup, bodySize: 9.5, gap: 4 });
  s.addShape(S.roundRect, { x: 3.4, y: 1.3, w: 6.1, h: 2.85, fill: { color: C.white }, line: { color: C.lightGray, width: 1 }, rectRadius: 0.06 });
  txt(s, 'WHAT HAPPENED', { x: 3.55, y: 1.4, w: 5.8, h: 0.2, fontSize: 9, bold: true, color: C.goldDark, charSpacing: 1.5, valign: 'middle' });
  s.addText(bul(happened, { fontSize: 9.5, gap: 3 }), { x: 3.55, y: 1.64, w: 5.8, h: 2.45, fontFace: FB, fontSize: 9.5, color: C.ink, valign: 'top', isTextBox: true, margin: 0 });
  s.addShape(S.roundRect, { x: M, y: 4.28, w: CW, h: 0.75, fill: { color: C.goldTint }, line: { color: C.goldTint, width: 0 }, rectRadius: 0.06 });
  txt(s, 'DISCUSS AT YOUR TABLE', { x: M + 0.15, y: 4.33, w: 3, h: 0.2, fontSize: 9, bold: true, color: C.goldDark, charSpacing: 1.5, valign: 'middle' });
  s.addText(bul(discuss.map(d => ({ text: d, num: true })), { fontSize: 10, gap: 1 }), { x: M + 0.15, y: 4.53, w: CW - 0.3, h: 0.48, fontFace: FB, fontSize: 10, color: C.ink, valign: 'top', isTextBox: true, margin: 0 });
  return s;
}
function caseOutcome(num, title, findings, changed, lesson, notes) {
  const s = content('Section 4  |  Case study ' + num + '  |  Outcome', title, notes);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.05, kicker: 'FINDINGS', body: findings, bodySize: 9.5, gap: 4, fill: C.redTint });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.05, kicker: 'WHAT THEY CHANGED', body: changed, bodySize: 9.5, gap: 4, fill: C.greenTint });
  band(s, lesson, { y: 4.5, h: 0.52, fontSize: 12.5 });
  return s;
}

// 22-23 Case 1
caseSituation(1, 'Case 1: The Tuesday morning knock',
  ['Legal manufacturer, Germany', 'Class IIb powered surgical instruments', 'About 220 staff, one manufacturing site', 'MDR certificate via a notified body', 'QA Director on leave; no deputy named in the reception instructions'],
  ['08:10  Two notified body auditors present credentials at reception. Reception calls HR, then the QA Director\'s mobile: voicemail.',
   '09:00  The Production Manager finally takes the auditors in. The 50-minute delay is written into the report.',
   '09:15  Opening meeting. The auditors announce they will sample from final assembly.',
   '09:40  Three finished units selected. Requests: the DHRs, the current DMR, and the calibration status of the torque tools on the line.',
   'One torque driver is three weeks past its calibration due date and still in use. No impact assessment.',
   'Validation of a dispensing station installed four months ago: IQ/OQ/PQ exists, but the change record has no design or risk impact assessment.',
   'PCB supplier file: approved; last audit four years ago; the quality agreement is silent on notified body access and change notification.'],
  ['What should the first 30 minutes have looked like?', 'Rank the three findings: which is most serious, and why?', 'What did the 50-minute delay tell the auditors before they saw a single record?'],
`[0:48 | 5 min: 2 read, 3 discuss]
Set the scene in one breath, then let the tables read. Do not narrate the bullets; they have them in the pack.
While they discuss, listen for the question-2 debate: most tables pick the calibration finding as most serious because product has shipped. Some pick the supplier agreement because it goes to the heart of MDR supplier oversight. Both are defensible; the notified body chose calibration.
Time check at 3 minutes of discussion; move to the outcome slide.`);
caseOutcome(1, 'Case 1: Findings and what changed',
  [{ text: 'MAJOR  |  7.6', bold: true }, 'Out-of-calibration equipment in use; no assessment of product built since the due date',
   { text: 'MINOR  |  7.3.9 / 7.5.6', bold: true }, 'Process change not assessed for design and risk impact',
   { text: 'MINOR  |  7.4.1', bold: true }, 'Supplier evaluation not maintained; agreement lacks access and change-notification clauses',
   { text: 'OBSERVATION', bold: true }, 'Delayed access recorded; the notified body reminded the firm that refusal is grounds for suspension'],
  ['Reception script on a laminated card; 24/7 roster with named deputies, covering shutdowns',
   'Calibration recall: equipment tagged and quarantined on the due date, no exceptions',
   'Change-control form with a mandatory design and risk impact section signed by the design authority',
   'Supplier agreement template: unannounced access, change notification, deviation reporting',
   'Annual mock unannounced audit, sponsored by the site head'],
  'The auditors formed their view of the QMS in the lobby. Everything after that confirmed it.',
`[0:53 | 2 min debrief]
Take two answers from the room, then show the outcome. The major was calibration because product had shipped and nobody had asked what that meant for patients. The two minors both trace back to change: a process change nobody assessed against the design, and a supplier relationship nobody re-evaluated.
The observation about access is the one to dwell on for ten seconds: the notified body put in writing that refusal would have meant suspension. The 50 minutes were not refusal, but they set the tone.
Transferable lesson on the band. Move on.`);

// 24-25 Case 2
caseSituation(2, 'Case 2: The supplier they visited first',
  ['Legal manufacturer, Netherlands', 'Class IIa sterile single-use devices', 'Final assembly, packaging and sterilization release outsourced to a contract manufacturer in Malaysia: a critical subcontractor named in the technical documentation', 'MDR Annex IX certificate'],
  ['09:00 local  Notified body auditors arrive unannounced at the subcontractor\'s gate in Penang. Security refuses entry: no appointment, no visitor request in the system.',
   'The subcontractor\'s QA calls the manufacturer\'s RA lead in the Netherlands. It is 03:00 there. No answer until 08:00 CET. Three hours of delay recorded.',
   'The manufacturer\'s device is not in production that week (campaign manufacturing). The auditors sample from finished-goods stock instead.',
   'DHR review: four deviations closed locally in six months, none reported to the manufacturer. The quality agreement requires notification within 5 days.',
   'One deviation is a seal-temperature excursion on a pouch sealer, dispositioned "use as is" without the manufacturer\'s involvement.',
   'The manufacturer\'s supplier scorecard rates the subcontractor "green" for the entire period.'],
  ['Whose audit was this, really?', 'What does ISO 13485 §4.1.5 (control of outsourced processes) require of the manufacturer here?', 'How should production calendars and site access be arranged with the notified body?'],
`[0:55 | 5 min: 2 read, 3 discuss]
Set-up line: "Annex IX 3.4 says the notified body may audit your suppliers and subcontractors unannounced. This company had read that sentence. Its subcontractor had not."
Listen for tables that blame the subcontractor. Steer gently: the certificate holder is the legal manufacturer, and 4.1.5 makes the manufacturer responsible for controlling outsourced processes in proportion to risk. The scorecard is the tell: green because nobody verified the underlying data.`);
caseOutcome(2, 'Case 2: Findings and what changed',
  [{ text: 'MAJOR  |  4.1.5 / 7.4  (to the legal manufacturer)', bold: true }, 'Inadequate control of an outsourced process: deviations not communicated; oversight relied on a scorecard nobody verified',
   { text: 'MINOR  |  7.5.6', bold: true }, 'Sealing excursion not evaluated for revalidation; affected lots not assessed',
   { text: 'CONDITION', bold: true }, 'Retrospective review of all lots from the affected period required before the certificate was maintained'],
  ['Quality agreement rewritten: unannounced access for the notified body and regulators, cooperation duties, 24-hour deviation notification, escalation contacts in both time zones',
   'Notified body informed of the subcontractor\'s production calendar for this device',
   'Supplier oversight became data verification: a quarterly sample of DHRs and deviation logs, not scorecards alone',
   'Joint mock unannounced audit at the subcontractor; its front-desk protocol now names the notified body'],
  'Your certificate travels to your critical suppliers. So does your audit.',
`[1:00 | 2 min debrief]
The major went to the manufacturer, not the subcontractor: that surprises some people and is the whole lesson. The minor about the sealing excursion matters because sterile barrier integrity is a patient-safety issue and "use as is" was decided by the wrong party.
Ask: "Who in this room has a quality agreement that gives your notified body the right to walk into your supplier unannounced, and gives the supplier a name to call at 3 a.m.?" Usually few hands.`);

// 26-27 Case 3
caseSituation(3, 'Case 3: The first inspection under the QMSR',
  ['US manufacturer, Indiana', 'Class II reusable orthopedic instruments and sterilization trays', 'About 400 staff; ISO 13485 certified for 10 years; MDSAP for Canada', 'Last FDA inspection 2021: NAI', 'March 2026, 09:00: an FDA investigator presents credentials and Form FDA 482'],
  ['The investigator asks for the procedure index cross-referenced to ISO 13485 clauses and to the QMSR. The firm has an ISO index only.',
   'Requests the last two management reviews and the internal audit results. The firm\'s policy still cites the retired 820.180(c) exemption; 40 minutes with corporate RA before the records appear.',
   'Management review minutes: no regulatory-reporting metrics; two actions from 2024 still open.',
   'Complaints: 6 of 20 sampled files have no documented MDR reportability decision; complaint records do not capture UDI (820.35(a)).',
   'Labeling: label and IFU inspection records for one tray family show no verification of content (820.45).',
   'CAPA: two CAPAs for the same cleaning-validation issue, both "closed – effective", with no effectiveness data.'],
  ['What mindset caused the 40-minute standoff?', 'Which observations are QMSR-specific, and which are plain ISO 13485 failures?', 'Draft the first paragraph of the 483 response to the CAPA observation.'],
`[1:02 | 5 min: 2 read, 3 discuss]
Set-up line: "This is the inspection every US site will have between now and 2028. The company had a certificate, a clean 2021 inspection, and a gap assessment that said 'nothing changes'."
Question 2 is the teaching point: only the UDI field and the labeling record are genuinely QMSR-specific. Reportability decisions, CAPA effectiveness and management review are ISO 13485 requirements the firm was already certified against. The certificate did not make them true.
Question 3: ask one table to read their paragraph aloud during the debrief.`);
caseOutcome(3, 'Case 3: Findings and what changed',
  [{ text: 'FORM FDA 483  |  four observations', bold: true },
   'Complaint handling: reportability decisions not documented; records incomplete (ISO 13485 §8.2.2; 820.35(a))',
   'CAPA: effectiveness not verified (§8.5.2)',
   'Management review: inputs incomplete; actions overdue (§5.6)',
   'Labeling controls: content verification not documented (820.45)',
   { text: 'OUTCOME', bold: true }, 'Response filed in 12 business days; inspection classified VAI'],
  ['QMSR gap assessment done properly: crosswalk of ISO clauses plus 820.10 / 820.35 / 820.45 and Parts 803, 806, 830',
   'Inspection-readiness procedure rewritten: management review, internal audit and supplier audit records producible on request, and written to be read',
   'Complaint form: UDI field, reportability decision tree, mandatory rationale',
   'CAPA effectiveness requires data and independent sign-off',
   'Mock FDA inspection structured around the QMSR, not QSIT'],
  '"We are ISO certified, nothing changes" was the most expensive sentence of the year.',
`[1:07 | 2 min debrief]
Hear one table's 483 response paragraph. Good answers acknowledge the observation, describe the correction (reopen both CAPAs), the corrective action (effectiveness criteria and independent verification built into the CAPA procedure) and the systemic check (review all CAPAs closed in the last 24 months), with dates.
On the records point: "written to be read" does not mean sanitized. It means management review and internal audit records that show real problems, real decisions and real follow-up. An investigator who sees a candid record with closed actions is reassured; one who sees a glossy record with nothing in it is not.`);

// 28-29 Case 4
caseSituation(4, 'Case 4: Three sites, one certificate',
  ['Multinational; US headquarters with design and manufacturing', 'German site acquired 2023 (legacy MDD manufacturer)', 'High-volume plant in Costa Rica', 'One MDSAP certificate covering all three sites; MDR certificate; Health Canada licences', 'About 1,800 staff'],
  ['MDSAP surveillance audit at the German site. A complaint from a Canadian hospital (serious deterioration in health) arrived via the distributor.',
   'Assessed under the German legacy complaint procedure: the reportability decision took 14 days; the report reached Health Canada on day 22. The Canadian limit is 10 days.',
   'The headquarters procedure would have flagged it within 48 hours. Neither site knew the other\'s process.',
   'Three versions of the complaint form in use across the company; German trend data never reached global management review.',
   'The previous audit had raised inconsistent complaint intake as a grade 2 nonconformity. It was closed with "training".'],
  ['Why did "training" fail as a corrective action?', 'What must a single global complaint process contain to work in Germany, Costa Rica and the US?', 'Who owns the regulatory requirements matrix, and who owns keeping it current?'],
`[1:09 | 5 min: 2 read, 3 discuss]
Set-up line: "Three good sites, three honest procedures, one certificate. The gap was between them."
Listen for question 1: training failed because the root cause was structural (three procedures, no single decision tree, no shared timelines), not a knowledge gap. The corrective action addressed the symptom at the individual level.
Question 3 tends to expose real organizational arguments in the room; let them run for a moment, then note that in the case the answer was Global RA with a change-control link.`);
caseOutcome(4, 'Case 4: Findings and what changed',
  [{ text: 'GRADE 4  |  8.2.3 reporting to regulatory authorities', bold: true }, 'Direct-impact clause (grade 3) plus one for a repeat of the previous finding',
   { text: 'ESCALATION', bold: true }, 'The auditing organization notified the MDSAP regulators within 5 business days',
   { text: 'FOLLOW-UP', bold: true }, 'Health Canada requested a corrective action plan; the notified body asked for a 24-month retrospective review of German-site complaints'],
  ['Global QMS architecture: Tier 1 global manual and policies; Tier 2 global procedures with named process owners; Tier 3 site work instructions plus a Country Regulatory Annex per market',
   'One complaint system: single intake, a global reportability decision tree carrying every market\'s timelines, 48-hour triage',
   'Regulatory requirements matrix owned by Global RA and linked to change control',
   'Global management review with site KPIs: on-time reporting, CAPA age, audit findings',
   'Internal audits that test the interfaces between sites; legacy procedures retired on a 12-month plan'],
  'Harmonize the process, localize the annex, govern the interfaces.',
`[1:14 | 2 min debrief]
The grade-4 mechanics: reporting to regulators is a direct-impact clause, so the nonconformity starts at grade 3; because the previous audit had flagged complaint intake and the fix had not worked, it is a repeat, plus one. Grade 4 means every MDSAP regulator hears about it within five business days.
Land the three-part lesson on the band; it is the frame for Section 5.
If time is short, this debrief can be 60 seconds: grade, escalation, lesson.`);

// 30 Divider S5
divider(5, 'Maintaining a global QMS', 'One process, local annexes, governed interfaces, and audit-ready every day',
`[1:16]
Transition: "Case 4 gives us the frame. Ten minutes on how to build and run it."`);

// 31 Architecture
{
  const s = content('Section 5  |  Maintaining a global QMS', 'Global QMS architecture: core plus annex',
`[1:16 | 2 min]
Four tiers. Tier 1 is the global quality manual and policies: one scope statement, one process map, one site register, ISO 13485 as the spine. Tier 2 is one global procedure per process, each with a named global process owner: complaints, CAPA, change control, supplier controls, design controls, document control, training, management review, internal audit. Tier 3 is where locality lives: site work instructions for how the work is physically done, and a Country Regulatory Annex per market that lists the deltas: timelines, forms, authorities, language, roles. Tier 4 is records and forms: one form per process globally, with controlled translations rather than local variants.
Governance on the right is what stops the architecture decaying: process owners, site quality heads, a regulatory-intelligence feed wired into change control with a 30-day impact assessment, a quarterly global quality council, and an annual review of scope and the requirements matrix.`);
  const tiers = [
    ['TIER 1', 'Global Quality Manual and policies', 'One scope, one process map, one site register. ISO 13485 as the spine; regulatory requirements referenced, not copied.'],
    ['TIER 2', 'Global procedures, one owner per process', 'Complaints, CAPA, change control, supplier controls, design controls, document control, training, management review, internal audit.'],
    ['TIER 3', 'Site work instructions + Country Regulatory Annexes', 'How the work is physically done at each site; one annex per market listing the deltas: timelines, forms, authorities, language, roles.'],
    ['TIER 4', 'Records and forms', 'One form per process globally; local-language versions controlled as translations, never as variants.'],
  ];
  tiers.forEach((t, i) => {
    const y = 1.3 + i * 0.82;
    s.addShape(S.roundRect, { x: M, y, w: 6.1, h: 0.72, fill: { color: i === 2 ? C.goldTint : C.tint }, line: { color: i === 2 ? C.goldTint : C.tint, width: 0 }, rectRadius: 0.06 });
    txt(s, t[0], { x: M + 0.15, y: y + 0.08, w: 0.85, h: 0.56, fontSize: 10, bold: true, color: C.goldDark, valign: 'middle', charSpacing: 1 });
    txt(s, t[1], { x: M + 1.0, y: y + 0.06, w: 4.95, h: 0.26, fontSize: 11.5, bold: true, color: C.navy, valign: 'middle' });
    txt(s, t[2], { x: M + 1.0, y: y + 0.33, w: 4.95, h: 0.36, fontSize: 9.5, color: C.ink, valign: 'top' });
  });
  card(s, { x: 6.8, y: 1.3, w: 2.7, h: 3.2, title: 'Governance', fill: C.navy, titleColor: C.white, body: [
    { text: 'Global process owners', color: C.white }, { text: 'Site quality heads accountable for Tier 3', color: C.white },
    { text: 'Regulatory intelligence wired to change control: impact assessed within 30 days', color: C.white },
    { text: 'Quarterly global quality council', color: C.white }, { text: 'Annual review of scope, site register and the requirements matrix', color: C.white }
  ], bodySize: 10, gap: 5 });
}

// 32 Vigilance timelines
{
  const s = content('Section 5  |  Maintaining a global QMS', 'Vigilance reporting timelines by market',
`[1:18 | 2 min]
This is the table Case 4 needed. Read across one row: the same event triggers different clocks in every market, and some clocks are calendar days while others are working days. A single global decision tree has to carry all of them, and the shortest clock wins for triage: that is why 48-hour triage is the design rule.
Important: this is a teaching aid current as of the seminar date. Tell the room, and remind yourself, to verify against the current regulatory text before relying on any cell. The Participant Handout repeats the caveat.`);
  txt(s, 'Day counts as written in each regulation; calendar and working days differ. Teaching aid as of September 2026: verify against the current regulatory text before relying on any cell.', { x: M, y: 1.17, w: CW, h: 0.22, fontSize: 8.5, italic: true, color: C.gray, valign: 'middle' });
  table(s, ['Jurisdiction (authority, basis)', 'Death or serious deterioration', 'Other reportable events', 'Serious public-health threat'], [
    ['USA: FDA (21 CFR 803)', '30 calendar days', '30 calendar days (malfunctions)', '5 work days if remedial action is needed to prevent an unreasonable risk of substantial harm'],
    ['EU: competent authorities (MDR Art. 87)', '10 days: death or unanticipated serious deterioration', '15 days: other serious incidents', '2 days'],
    ['UK: MHRA', '10 days', '15 days', '2 days'],
    ['Canada: Health Canada (SOR/98-282 s.59–61)', '10 days', '30 days: could lead to death or serious deterioration if it recurred', 'Not separately defined'],
    ['Australia: TGA', '10 days: death or serious injury', '30 days: near-adverse events', '48 hours'],
    ['Japan: MHLW / PMDA', '15 days', '30 days', 'Not separately defined'],
    ['Brazil: ANVISA (RDC 551/2021)', '72 hours: death; 10 days: serious injury', '30 days', '72 hours'],
  ], { y: 1.45, colW: [2.5, 2.1, 2.3, 2.1], fontSize: 9, rowH: 0.3 });
}

// 33 Requirements matrix
{
  const s = content('Section 5  |  Maintaining a global QMS', 'The regulatory requirements matrix',
`[1:20 | 1.5 min]
The matrix is the operating tool behind the annexes: one row per requirement area, the deltas by market, a named owner, where the requirement lives in the QMS, and the trigger that forces a review. It is owned by Global RA, reviewed annually, and every regulatory change runs through it via change control.
Six rows shown; a real matrix has forty to eighty. Point people to the handout for a starter structure.`);
  table(s, ['Requirement area', 'What differs by market', 'Owner', 'Lives in', 'Review trigger'], [
    ['Adverse event and vigilance reporting', 'Definitions, timelines (2–30 days), forms, portals, foreign-event rules', 'Global RA', 'Vigilance SOP + country annex', 'Regulation change; new market'],
    ['Field actions and recalls', 'Notification timing, classification schemes, customer letter content', 'Global RA / Quality', 'Field action SOP + annex', 'Regulation change'],
    ['Registration, listing and licensing', 'Establishment registration, device listing, licences, agents and representatives', 'Regional RA', 'RA register + annex', 'New product, site or market'],
    ['Labeling and UDI', 'Languages, symbols, UDI issuing agencies, databases (GUDID, EUDAMED)', 'RA / Labeling', 'Labeling SOP + annex', 'New market; database go-live'],
    ['Complaint and servicing records', 'Required data fields (e.g., UDI under 820.35), retention periods', 'Global Quality', 'Complaint SOP', 'Regulation change'],
    ['Responsible persons', 'Management representative, PRRC (EU), UK Responsible Person, US Agent, MAH (Japan)', 'RA / HR', 'Quality manual + annex', 'Organization change'],
  ], { colW: [2.0, 3.0, 1.2, 1.6, 1.2], fontSize: 9.5, rowH: 0.42 });
}

// 34 Rhythm and KPIs
{
  const s = content('Section 5  |  Maintaining a global QMS', 'Operating rhythm and readiness KPIs',
`[1:21 | 1.5 min]
Left: the rhythm. Readiness is produced by routines, not by heroics. Daily floor walks and record checks by supervisors; weekly CAPA and complaint reviews; a monthly site quality council; quarterly global management review and supplier performance; annually a full internal audit cycle, a mock unannounced audit at each site and at the top critical suppliers, and a review of the requirements matrix.
Right: KPIs that measure readiness rather than compliance theatre. The first row is the one from the opening poll. Put these in management review and watch them move.`);
  card(s, { x: M, y: 1.3, w: 4.1, h: 3.7, title: 'Operating rhythm', body: [
    { text: 'Daily', bold: true }, 'Supervisor floor walks; DHR checks at the point of work',
    { text: 'Weekly', bold: true }, 'CAPA and complaint review; overdue actions chased',
    { text: 'Monthly', bold: true }, 'Site quality council: KPIs, audits, changes, suppliers',
    { text: 'Quarterly', bold: true }, 'Global management review; supplier performance; regulatory-intelligence review',
    { text: 'Annually', bold: true }, 'Full internal audit cycle; mock unannounced audit per site and top critical suppliers; requirements matrix review'
  ], bodySize: 10, gap: 3 });
  table(s, ['Readiness KPI', 'Target'], [
    ['Time to produce the full DHR and traceability for a random lot', '30 minutes or less'],
    ['Procedures past their periodic review date', '0'],
    ['Equipment in use past calibration due date', '0'],
    ['CAPAs open more than 12 months without approved justification', '0'],
    ['Staff trained on the current revision before performing the task', '100%'],
    ['Vigilance reports submitted on time', '100%'],
    ['Supplier audit plan adherence', '95% or more'],
    ['Reception script and 24/7 roster verified', 'Quarterly'],
  ], { x: 4.85, y: 1.3, w: 4.65, colW: [3.35, 1.3], fontSize: 9.5, rowH: 0.36, boldFirst: false });
}

// 35 Self-test
{
  const s = content('Section 5  |  Maintaining a global QMS', 'Readiness self-test: ten questions',
`[1:23 | 2 min]
Ask everyone to score themselves silently on the ten statements; the same list is in the handout with tick boxes. Then: "Hands up if you scored nine or ten." Compare with the flipchart counts from the opening poll.
Nine to ten: ready, keep drilling. Six to eight: exposed, and you know exactly where. Five or fewer: start Monday with the reception script and the roster, because those two cost nothing and buy the first hour.`);
  const items = [
    'Reception has a written script and the 24/7 roster, including deputies and shutdown periods',
    'Your notified body knows when your lines will not be running',
    'You can produce the complete DHR and traceability for any lot within 30 minutes',
    'Every critical supplier agreement grants unannounced access to your notified body and regulators, and requires deviation notification',
    'No equipment in use is past its calibration due date',
    'Every production or supplier change in the last year has a documented design and risk impact assessment',
    'No CAPA is open beyond 12 months without a documented, approved justification',
    'Your management review records could be handed to an FDA investigator today',
    'Every site assesses complaint reportability with the same decision tree and all market timelines',
    'You have run a mock unannounced audit in the last 12 months',
  ];
  const half = 5, cw = (CW - 0.2) / 2;
  for (let c = 0; c < 2; c++) {
    const list = items.slice(c * half, c * half + half);
    list.forEach((t, i) => {
      const y = 1.3 + i * 0.6;
      const x = M + c * (cw + 0.2);
      s.addShape(S.ellipse, { x, y: y + 0.08, w: 0.34, h: 0.34, fill: { color: C.navy }, line: { color: C.navy, width: 0 } });
      txt(s, String(c * half + i + 1), { x, y: y + 0.08, w: 0.34, h: 0.34, fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle' });
      txt(s, t, { x: x + 0.45, y, w: cw - 0.45, h: 0.52, fontSize: 10.5, color: C.ink, valign: 'middle' });
    });
  }
  band(s, 'Score: 9–10 ready, keep drilling   |   6–8 exposed, and you know where   |   5 or fewer: start Monday with the reception script and the roster', { y: 4.4, h: 0.5, fontSize: 11.5, fill: C.goldTint, color: C.navy, italic: false, bold: true });
}

// 36 Mock audits
{
  const s = content('Section 5  |  Maintaining a global QMS', 'Mock unannounced audits that count',
`[1:25 | 1 min]
Five steps. The date is known only to the sponsor (site head) and the person running it. Use an outsider: corporate quality from another site or a consultant, in notified-body format with two auditors and one day. Follow product exactly as a notified body would: reception, opening meeting, sample from the line, trace the DHR and DMR, pull a supplier file, pull the complaint and CAPA history. Grade honestly using notified body or MDSAP definitions and time every retrieval. Debrief within a day, put the readiness KPIs into management review, and repeat annually at every site and at the top critical suppliers.`);
  const steps = [
    ['Sponsor secretly', 'Only the site head and the lead know the date. No "tidy-up" week beforehand.'],
    ['Use an outsider', 'Corporate quality from another site, or a consultant. Notified-body format: two auditors, one day.'],
    ['Follow product', 'Reception, opening meeting, sample from the line, DHR and DMR trace, supplier file, complaint and CAPA history.'],
    ['Grade honestly', 'Notified body or MDSAP definitions. Time every retrieval. Interview operators.'],
    ['Debrief and track', 'Findings into CAPA; readiness KPIs into management review; repeat yearly per site and at top critical suppliers.'],
  ];
  const cw = (CW - 4 * 0.15) / 5;
  steps.forEach((st, i) => card(s, { x: M + i * (cw + 0.15), y: 1.3, w: cw, h: 2.9, num: i + 1, title: st[0], titleSize: 11.5, titleH: 0.5, body: st[1], bodySize: 9.5, fill: i === 2 ? C.goldTint : C.tint }));
  band(s, 'The first mock audit is always humbling. That is the point: better a humbling Tuesday you chose than one your notified body chose.', { y: 4.4, h: 0.55, fontSize: 12 });
}

// 37 Takeaways
{
  const s = content('Close', 'Five things to take back to your site',
`[1:26 | 1 min]
Read the five slowly. These are the sentences you want repeated in the car park.`);
  const t = [
    ['Readiness is a state, not an event', 'Assume auditors arrive tomorrow at 08:00. Build routines, not preparation projects.'],
    ['Auditors follow product', 'Master the evidence chain from a unit on the line back to design and suppliers, and forward to the patient.'],
    ['The first hour sets the verdict', 'Script, roster, roles, deputies. Reception is part of your QMS.'],
    ['Findings are root-cause problems', 'Fix the system, verify effectiveness with data, and write records to be read.'],
    ['A global QMS is one process with local annexes', 'Harmonize the process, localize the annex, govern the interfaces.'],
  ];
  t.forEach((it, i) => {
    const y = 1.3 + i * 0.72;
    txt(s, String(i + 1), { x: M, y, w: 0.6, h: 0.6, fontFace: FH, fontSize: 30, bold: true, color: C.gold, valign: 'middle' });
    txt(s, it[0], { x: M + 0.7, y: y + 0.02, w: 8.3, h: 0.3, fontSize: 14, bold: true, color: C.navy, valign: 'middle' });
    txt(s, it[1], { x: M + 0.7, y: y + 0.32, w: 8.3, h: 0.3, fontSize: 11, color: C.ink, valign: 'top' });
  });
}

// 38 30-60-90
{
  const s = content('Close', 'Your 30-60-90 day plan',
`[1:27 | 1 min]
Concrete and cheap first: script, roster, go-kit, agreements, shutdown calendar. Then the drills and gap checks. Then the mock audit and the KPIs. Everything on this slide is in the handout with space to assign owners.
The audit go-kit: certificates, organization chart, site map, procedure index cross-referenced to ISO clauses and each regulation, contact list, blank request log, visitor and confidentiality forms, and the photo and sample policy.`);
  const cols = [
    ['FIRST 30 DAYS', 'Cheap and immediate', ['Write the reception script and the 24/7 roster with deputies', 'Build the audit go-kit: certificates, org chart, site map, procedure index, contact list, request log', 'Inventory quality agreements for access and notification clauses', 'Tell your notified body your shutdown calendar']],
    ['DAYS 31–60', 'Drill and check', ['Run the 30-minute DHR and traceability drill; fix what breaks', 'Complete a QMSR and MDR overlay gap check against your procedure index', 'Fix calibration recall and the change-impact form', 'Build version 1 of the regulatory requirements matrix']],
    ['DAYS 61–90', 'Prove it', ['Run a mock unannounced audit at one site and one critical supplier', 'Add readiness KPIs to management review', 'Retire duplicate site procedures onto the global tier', 'Schedule the next drill and the annual cycle']],
  ];
  const cw = (CW - 2 * 0.2) / 3;
  cols.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 3.7, kicker: c[0], title: c[1], titleSize: 13, body: c[2], bodySize: 10.5, gap: 5, fill: i === 0 ? C.goldTint : C.tint }));
}

// 39 References
{
  const s = content('Close', 'References and resources',
`[1:28 | 30 sec]
Do not read this slide. Point to it, note that the handout carries the same list with links, and move to questions.`);
  card(s, { x: M, y: 1.3, w: 4.4, h: 3.7, title: 'Standards', body: [
    'ISO 13485:2016 Medical devices — Quality management systems, plus Amd 1:2024', 'EN ISO 13485:2016+A11:2021 (harmonised, MDR/IVDR Annexes ZA/ZB)',
    'ISO 14971:2019 Risk management; ISO/TR 24971:2020 guidance', 'ISO 19011:2018 Guidelines for auditing management systems',
    'IEC 62304 (software), ISO 11607 (packaging), ISO 14155 (clinical), ISO 10993 (biocompatibility)'
  ], bodySize: 10, gap: 4 });
  card(s, { x: 5.1, y: 1.3, w: 4.4, h: 3.7, title: 'Regulations and guidance', fill: C.goldTint, body: [
    '21 CFR Part 820 (QMSR, effective 2 Feb 2026); Parts 803, 806, 807, 830', 'FDA Compliance Program 7382.845, Inspection of Medical Device Manufacturers',
    'EU MDR 2017/745 and IVDR 2017/746; Annex IX §3.4; Commission Recommendation 2013/473/EU; MDCG guidance documents',
    'MDSAP Audit Approach (MDSAP AU P0002) and Companion Document (MDSAP AU G0002); GHTF/SG3/N19:2012 nonconformity grading',
    'UK Medical Devices Regulations 2002 (as amended); Health Canada Medical Devices Regulations SOR/98-282'
  ], bodySize: 10, gap: 4 });
}

// 40 Q&A
{
  const s = base(true);
  txt(s, 'Questions', { x: M, y: 1.7, w: CW, h: 0.9, fontFace: FH, fontSize: 44, bold: true, color: C.white });
  txt(s, 'What would break first if they knocked tomorrow at 08:00?', { x: M, y: 2.65, w: 8.5, h: 0.5, fontSize: 18, color: C.gold, italic: true });
  txt(s, '[Speaker name]   |   [email]   |   Elder Consulting, LLC', { x: M, y: 3.7, w: CW, h: 0.3, fontSize: 13, color: C.white });
  txt(s, 'Participant Handout and Case Study Workshop Pack: [link or QR code]', { x: M, y: 4.05, w: CW, h: 0.3, fontSize: 11, color: C.paleText });
  s.addNotes(
`[1:28 – 1:30 and overflow]
Open with the question on the slide if the room is quiet: "What would break first at your site?" One or two answers will start the discussion.
Seed questions if needed: How do you handle FDA requests for photographs? What do you do when an auditor asks to see a record you know is deficient? How do you keep a global complaint process fast enough for the 48-hour triage?
Close: thank the room, point to the handout and the 30-60-90 plan, and give your contact details.
Fill in the placeholders before presenting.`);
}

pres.writeFile({ fileName: 'out/ISO-13485-Audit-Readiness-Seminar.pptx' }).then(f => console.log('wrote', f, 'slides:', n));
