const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, LevelFormat, PageBreak, Footer, PageNumber, VerticalAlign } = D;
const fs = require('fs');

const NAVY = '0F2A4A', GOLD = 'A8730F', GRAY = '5A6B7B', TINT = 'EAF0F6', TINT2 = 'F5F8FB', LINE = 'CBD2D9', GOLDTINT = 'FBF2DE', REDTINT = 'F9ECEA', GREENTINT = 'E8F3EE', INK = '1F2933';
const CONTENT_W = 12240 - 2 * 1080; // US Letter, 0.75in margins => 10080 DXA

// ---------- helpers ----------
function runs(text, o = {}) {
  if (Array.isArray(text)) return text.flatMap(t => runs(t, o));
  if (typeof text !== 'string') text = String(text ?? '');
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(s => s.length);
  if (!parts.length) return [new TextRun({ text: '', size: o.size || 21 })];
  return parts.map(part => {
    const bold = part.startsWith('**') && part.endsWith('**');
    return new TextRun({ text: bold ? part.slice(2, -2) : part, bold: bold || !!o.bold, italics: !!o.italic, color: o.color, size: o.size || 21, font: o.font });
  });
}
const p = (text, o = {}) => new Paragraph({ children: runs(text, o), spacing: { after: o.after == null ? 120 : o.after, before: o.before || 0 }, alignment: o.align, keepNext: o.keepNext });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const small = (t, o = {}) => p(t, Object.assign({ size: 17, color: GRAY, italic: true }, o));
const bullets = (items, o = {}) => items.map(t => new Paragraph({ numbering: { reference: 'bullets', level: o.level || 0 }, spacing: { after: 60 }, children: runs(t, o) }));
const checks = items => items.map(t => new Paragraph({ numbering: { reference: 'checks', level: 0 }, spacing: { after: 80 }, children: runs(t) }));
let numCounter = 0;
const numbered = items => { const ref = 'num' + (numCounter++); return items.map(t => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: runs(t) })); };
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const lines = (n) => {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const rule = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    borders: { top: none, left: none, right: none, bottom: rule, insideHorizontal: rule, insideVertical: none },
    rows: Array.from({ length: n }, () => new TableRow({ height: { value: 420, rule: D.HeightRule.ATLEAST }, children: [new TableCell({ width: { size: CONTENT_W, type: WidthType.DXA }, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })] })] })) }), spacer(60)];
};

function makeNumbering() {
  const cfg = [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } }] },
    { reference: 'checks', levels: [{ level: 0, format: LevelFormat.BULLET, text: '☐', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ];
  for (let i = 0; i < 80; i++) cfg.push({ reference: 'num' + i, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return { config: cfg };
}

function cell(text, w, o = {}) {
  const items = Array.isArray(text) ? text : [text];
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    verticalAlign: VerticalAlign.TOP,
    children: items.map(t => new Paragraph({ spacing: { after: 40 }, children: runs(t, { bold: o.bold, color: o.color, size: o.size || 19 }) })),
  });
}
function table(header, rows, widths, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const out = [];
  if (header) out.push(new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], { fill: NAVY, bold: true, color: 'FFFFFF', size: o.size })) }));
  rows.forEach((r, ri) => out.push(new TableRow({ children: r.map((c, i) => cell(c, widths[i], { fill: o.plain ? undefined : (ri % 2 === 0 ? TINT2 : 'FFFFFF'), bold: i === 0 && o.boldFirst !== false, size: o.size })) })));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }, rows: out });
}
function callout(text, fill = GOLDTINT) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const items = Array.isArray(text) ? text : [text];
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W], borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }, rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: CONTENT_W, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR, color: 'auto' }, margins: { top: 140, bottom: 140, left: 200, right: 200 }, children: items.map(t => new Paragraph({ spacing: { after: 60 }, children: runs(t, { size: 20 }) })) })] })] });
}
function exhibit(label, title, body, fill = 'FFFFFF') {
  const b = { style: BorderStyle.SINGLE, size: 6, color: GOLD };
  const items = Array.isArray(body) ? body : [body];
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W], borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }, rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: CONTENT_W, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR, color: 'auto' }, margins: { top: 120, bottom: 120, left: 200, right: 200 }, children: [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: label.toUpperCase() + '   ', bold: true, color: GOLD, size: 16 }), new TextRun({ text: title, bold: true, color: NAVY, size: 20 })] }),
    ...items.map(t => new Paragraph({ spacing: { after: 40 }, children: runs(t, { size: 19, font: 'Courier New' }) })),
  ] })] })] });
}
const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [new TextRun('')] });

function titleBlock(kicker, title, subtitle, meta) {
  return [
    new Paragraph({ spacing: { before: 600, after: 60 }, children: [new TextRun({ text: kicker, bold: true, color: GOLD, size: 20, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: title, bold: true, color: NAVY, size: 52, font: 'Cambria' })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: subtitle, color: GRAY, size: 26 })] }),
    ...meta.map(m => new Paragraph({ spacing: { after: 60 }, children: runs(m, { size: 21 }) })),
    new Paragraph({ spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 8 } }, children: [new TextRun('')] }),
  ];
}
function makeDoc(title, footerLabel, children) {
  numCounter = 0;
  return new Document({
    creator: 'Elder Consulting, LLC', title, description: 'ISO 13485 & Audit Readiness seminar material',
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: INK } } }, paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Cambria', size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 400, after: 140 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Cambria', size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 22, bold: true, color: GOLD }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
    ] },
    numbering: makeNumbering(),
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: footerLabel + '   |   Page ', size: 16, color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY })] })] }) },
      children,
    }],
  });
}

// ---------- shared content ----------
const AGENDA = [
  ['0:00 – 0:08', 'Welcome, objectives, quick poll'],
  ['0:08 – 0:20', 'Why readiness is now a permanent state: the 2026 landscape'],
  ['0:20 – 0:32', 'ISO 13485 as the backbone: the clauses that decide audits'],
  ['0:32 – 0:47', 'Anatomy of an unannounced audit: the first 60 minutes and the next 72 hours'],
  ['0:47 – 1:16', 'Four case studies (table discussion and debrief)'],
  ['1:16 – 1:26', 'Maintaining a global QMS: architecture, rhythm, readiness KPIs'],
  ['1:26 – 1:30', 'Takeaways, 30-60-90 day plan, Q&A'],
];
const VIGILANCE = [
  ['USA: FDA (21 CFR 803)', '30 calendar days', '30 calendar days (reportable malfunctions)', '5 work days if remedial action is needed to prevent an unreasonable risk of substantial harm'],
  ['EU: competent authorities (MDR Art. 87)', '10 days: death or unanticipated serious deterioration', '15 days: other serious incidents', '2 days'],
  ['UK: MHRA', '10 days', '15 days', '2 days'],
  ['Canada: Health Canada (SOR/98-282 s.59–61)', '10 days', '30 days: could lead to death or serious deterioration if it recurred', 'Not separately defined'],
  ['Australia: TGA', '10 days: death or serious injury', '30 days: near-adverse events', '48 hours'],
  ['Japan: MHLW / PMDA', '15 days', '30 days', 'Not separately defined'],
  ['Brazil: ANVISA (RDC 551/2021)', '72 hours: death; 10 days: serious injury', '30 days', '72 hours'],
];
const VIG_CAVEAT = 'Day counts are as written in each regulation; calendar and working days differ. This table is a teaching aid current as of September 2026. Verify against the current regulatory text before relying on any cell.';
const SELFTEST = [
  'Reception has a written script and the 24/7 roster, including deputies and shutdown periods.',
  'Your notified body knows when your lines will not be running.',
  'You can produce the complete DHR and traceability for any lot within 30 minutes.',
  'Every critical supplier agreement grants unannounced access to your notified body and regulators, and requires deviation notification.',
  'No equipment in use is past its calibration due date.',
  'Every production or supplier change in the last year has a documented design and risk impact assessment.',
  'No CAPA is open beyond 12 months without a documented, approved justification.',
  'Your management review records could be handed to an FDA investigator today.',
  'Every site assesses complaint reportability with the same decision tree and all market timelines.',
  'You have run a mock unannounced audit in the last 12 months.',
];

// =====================================================================
// 1. PARTICIPANT HANDOUT
// =====================================================================
function handout() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  PARTICIPANT HANDOUT', 'ISO 13485 & Audit Readiness', 'Case studies on surviving unannounced audits and maintaining a global QMS',
    ['**Format:** 90-minute seminar with table-based case studies', '**Presented by:** Elder Consulting, LLC   ·   **Speaker:** ____________________   ·   **Date:** ____________', '**Companion document:** Case Study Workshop Pack']));

  c.push(h1('1. About this session'));
  c.push(p('Audits used to be scheduled events with a preparation window. Under the EU MDR, notified bodies must audit unannounced; FDA inspections are unannounced by default and increasingly so abroad; MDSAP grades every finding and escalates the serious ones to five regulators within days. Readiness is no longer a project. It is a state your QMS is either in or not.'));
  c.push(h3('By the end of the session you will be able to'));
  c.push(...bullets([
    'Explain who can audit your sites and suppliers without notice, and on what legal basis.',
    'Run the first 60 minutes of an unannounced audit with a written protocol, named roles and deputies.',
    'Map the audit-critical clauses of ISO 13485:2016 to the evidence an auditor will pull, and reconstruct any lot end-to-end.',
    'Apply a 72-hour post-audit plan that produces root causes rather than paperwork.',
    'Describe the core-plus-annex model for a global QMS and the regulatory requirements matrix that keeps it current.',
    'Score your own site with a ten-question readiness self-test and leave with a 30-60-90 day plan.',
  ]));
  c.push(h3('Agenda'));
  c.push(table(['Time', 'Segment'], AGENDA, [1700, 8380]));

  c.push(h1('2. Why readiness is now a permanent state'));
  c.push(h2('2.1 Who can arrive without warning'));
  c.push(table(['Regime', 'Who audits', 'Advance notice', 'Basis and cadence'], [
    ['EU MDR / IVDR', 'Notified body', 'None', 'MDR Annex IX §3.4: an unannounced audit at least once every five years per manufacturer, which may extend to critical suppliers and subcontractors. The notified body keeps a plan for these audits and must not disclose it. Origin: Commission Recommendation 2013/473/EU after the PIP breast-implant scandal.'],
    ['US FDA', 'FDA investigator', 'None for domestic routine and for-cause inspections. Foreign inspections have been increasingly unannounced since FDA announced the expansion in 2025.', 'FD&C Act §704 inspection authority. Quality Management System Regulation (QMSR, 21 CFR 820) in force since 2 February 2026.'],
    ['MDSAP (Australia, Brazil, Canada, Japan, USA)', 'MDSAP auditing organization', 'Normally announced. Special or unannounced audits are possible when a participating regulator requests one or serious signals appear.', 'Three-year cycle: initial certification, two annual surveillance audits, recertification. Mandatory for Health Canada Class II–IV licences.'],
    ['Competent authorities and other regulators', 'e.g., EU member-state authorities, ANVISA, TGA, PMDA', 'Varies; for-cause visits are often unannounced.', 'Market surveillance, vigilance signals, complaints, recalls.'],
    ['Customers and distributors', 'Customer quality functions', 'Usually announced.', 'Quality agreements.'],
  ], [1800, 1700, 2700, 3880]));
  c.push(h2('2.2 The 2026 regulatory snapshot'));
  c.push(...bullets([
    '**FDA QMSR.** In force since 2 February 2026. ISO 13485:2016 is incorporated by reference into 21 CFR Part 820; QSIT is retired. FDA-specific additions sit in 820.10 (general), 820.35 (records, including complaint and servicing records with UDI) and 820.45 (labeling and packaging controls). The former 820.180(c) exemption that kept management review, internal audit and supplier audit records out of routine FDA review did not carry over: plan for investigators to request them.',
    '**EU MDR / IVDR.** Transition periods were extended by Regulation (EU) 2023/607 (MDR legacy devices to the end of 2027 or 2028, subject to conditions) and Regulation (EU) 2024/1860 (IVDR, 2027–2029). Unannounced audits under Annex IX §3.4 continue regardless of transition status. PRRC, post-market surveillance, PSUR and EUDAMED duties apply.',
    '**MDSAP.** One audit covering Australia, Brazil, Canada, Japan and the USA; further jurisdictions participate as affiliates and observers. Nonconformities are graded 1–5 (GHTF/SG3/N19); grades 4 and 5 are notified to the regulators within five business days.',
    '**United Kingdom.** UK Medical Devices Regulations 2002 (as amended). CE marking accepted to 30 June 2028 for MDD/AIMDD/IVDD devices and to 30 June 2030 for MDR/IVDR devices. New post-market surveillance regulations in force since 16 June 2025. A UK Responsible Person is required for non-UK manufacturers.',
    '**ISO 13485.** The 2016 edition remains current, plus Amendment 1:2024 (climate-change considerations). EN ISO 13485:2016+A11:2021 is harmonised under the MDR/IVDR. A revision is under way in ISO/TC 210; track the draft stages and expect a transition period.',
    '**Other major markets.** Brazil RDC 665/2022 (BGMP), Japan MHLW Ordinance 169, China NMPA GMP, Korea KGMP, Saudi SFDA, India MDR 2017. Largely aligned with ISO 13485, each with local deltas on registration, records, language and reporting.',
  ]));
  c.push(small('Dates and references are current as of September 2026; confirm against the primary sources before relying on them.'));

  c.push(h1('3. ISO 13485 as the backbone'));
  c.push(p('Every regime in Section 2 either adopts ISO 13485:2016 outright or sits on top of it. Two threads run through the standard: the risk-based approach to processes (4.1.2) and the phrase "applicable regulatory requirements", which appears throughout and is what lets regulators adopt it. Auditors of every kind ask the same three questions in sequence: show me the procedure; show me the records; show me it happening on the floor.'));
  c.push(h2('3.1 The audit-critical clauses'));
  c.push(table(['Clause', 'What the auditor asks for', 'How it typically fails'], [
    ['4.1.5 / 7.4  Outsourced processes and suppliers', 'Approved supplier list, evaluations, quality agreements, incoming inspection records for the components in the sampled unit', 'Evaluations years old; agreements silent on change notification and regulator access; scorecards nobody verifies'],
    ['4.2.3  Medical device file (DMR)', 'The current file for the sampled device: specifications, drawings, labeling, IFU, process specifications, acceptance criteria', 'Uncontrolled drawings on the floor; file does not match what is being built today'],
    ['4.2.4 / 4.2.5  Documents and records', 'Revision history, obsolete-document control, DHR completeness, record retention and legibility', 'Handwritten corrections without initials and date; missing signatures; unapproved forms in use'],
    ['5.6  Management review', 'Inputs required by 5.6.2 (audits, complaints, regulatory reporting, suppliers), decisions, resource actions, follow-up', 'Slide decks with no decisions; overdue actions; regulatory reporting never discussed'],
    ['6.2  Competence and training', 'Training matrix and effectiveness evaluation for the operators the auditor just interviewed', 'Operators trained on a superseded revision; "read and understood" with no effectiveness check'],
    ['7.3  Design and development', 'Design changes (7.3.9), verification and validation, risk management file, design transfer evidence', 'Production or supplier changes made with no design or risk impact assessment'],
    ['7.5.6  Process validation', 'IQ/OQ/PQ for the process being observed; revalidation triggers; software validation for automated equipment', 'New equipment or software running on the old validation; no defined revalidation criteria'],
    ['7.5.9  Traceability', 'Full trace of the sampled lot: components and lots in, build records, test results, release, distribution', 'Lot cannot be reconstructed within the audit day; distribution records incomplete'],
    ['7.6  Monitoring and measuring equipment', 'Calibration status and records for every gauge and tool the auditor sees in use', 'Overdue calibration with no product impact assessment; "reference only" tools used for acceptance'],
    ['8.2.2 / 8.2.3  Complaints and reporting', 'Complaint log, investigation records, reportability decisions with rationale, submission timelines', 'Late or undocumented reportability decisions; complaints closed without investigation'],
    ['8.3  Nonconforming product', 'NCR log, dispositions, rework instructions (8.3.4) and re-verification, concession records', '"Use as is" without risk rationale; rework without re-verification; repeat NCRs never trended into CAPA'],
    ['8.5.2  Corrective action', 'Open and closed CAPAs, root cause analysis, action plans, effectiveness verification', 'Symptom fixes; "training" as the universal corrective action; CAPAs open more than a year without justification'],
  ], [2600, 3900, 3580], { size: 18 }));
  c.push(h2('3.2 The evidence chain: auditors follow product'));
  c.push(p('An unannounced auditor walks onto the floor, picks up a unit, and pulls the thread backwards and forwards:'));
  c.push(...numbered([
    '**A unit on the line.** Finished or in-process product, or a lot in stock.',
    '**DHR / batch record.** Build, inspection and test records: who did what, with which tools, when.',
    '**Medical device file (DMR).** The specifications, drawings, labeling and process specifications the unit should meet.',
    '**Design evidence.** Verification and validation, the risk management file, change history.',
    '**Critical suppliers.** Approvals, agreements, incoming inspection for the components inside.',
    '**Complaints, NCRs, CAPAs.** The history of the product family and whether it fed back into risk and design.',
    '**Release and distribution.** The release decision, labeling and UDI, and where every unit went.',
  ]));
  c.push(callout('**The 60-minute test.** Pick a random lot, start the clock, and see whether the complete records and the people who did the work arrive within an hour. If they do not, that is your first readiness finding.'));

  c.push(h1('4. The unannounced audit protocol'));
  c.push(h2('4.1 The first 60 minutes'));
  c.push(table(['Phase', 'Time', 'Actions', 'Owner'], [
    ['Reception', '0–5 min', ['Verify identity: photo ID, agency or notified body credentials, Form FDA 482 for FDA.', 'Call the Audit Response Lead or the named deputy from the 24/7 roster.', 'Seat the auditors in the lobby or a meeting room; never leave them unattended; never refuse or stall.'], 'Reception / security'],
    ['Mobilize', '5–15 min', ['Escort to the audit room; offer water and wifi per policy.', 'Notify the site head, QA/RA leadership, corporate quality and legal.', 'Open the request log; assign scribe, runner and SMEs; stand up the back room.'], 'Audit Response Lead'],
    ['Opening meeting', '15–30 min', ['Confirm scope, standard and regulation, sites and the auditors\' plan for the day.', 'Give the site overview and the EHS or gowning briefing.', 'Agree logistics: rooms, printing, system access, photo and sample policy, how requests and findings will be communicated.'], 'Audit Response Lead, site head'],
    ['On the floor', '30–60 min', ['Auditors select product; every sample and document request is logged with a timestamp.', 'SMEs answer what is asked, then stop; the scribe records every question and answer.', 'Runners retrieve DHR, DMR and validation records via the back room; factual errors are corrected immediately and politely.'], 'SMEs, scribe, runners'],
  ], [1500, 1100, 5480, 2000]));
  c.push(h2('4.2 Roles and deputies'));
  c.push(p('Fill in the names for your site. Every role has a deputy, and the roster covers nights, weekends and holiday shutdowns.'));
  c.push(table(['Role', 'Responsibilities', 'Primary', 'Deputy'], [
    ['Audit Response Lead', 'Owns the audit; the single voice to the auditors; decides what is provided and when', '', ''],
    ['Site Head', 'Resources and decisions; visible at the opening and closing meetings', '', ''],
    ['Front-room SMEs', 'Production, QC, engineering, supplier quality, RA; answer what is asked, nothing more', '', ''],
    ['Scribe', 'Verbatim log of questions, answers, documents shown and samples taken', '', ''],
    ['Runners', 'Retrieve records; nothing reaches the front room unreviewed', '', ''],
    ['Back-room coordinator', 'Reviews every document before it goes in; spots issues; prepares SMEs', '', ''],
    ['Document control and IT', 'System access, controlled copies, record retrieval, printing', '', ''],
    ['Reception and security', 'The script, the roster, badges and escort; the first five minutes', '', ''],
  ], [2100, 4380, 1800, 1800]));
  c.push(h2('4.3 On the day: do and don\'t'));
  c.push(table(['Do', 'Don\'t'], [
    [['Give exactly what is asked, when it is asked.', 'Keep a copy of everything you hand over.', 'Answer the question, then stop.', 'Say "I don\'t know, I will find out", then find out.', 'Challenge factual errors at the time, with evidence.', 'Take your own notes on every potential finding.', 'Prepare operators to answer normally; they can and will be interviewed.', 'Treat every finding as a free consultancy report.'],
     ['Refuse, stall, or "lose" documents.', 'Volunteer unrelated information or unrequested tours.', 'Guess, speculate, or say "we usually...".', 'Correct, backdate or create records during the audit. Falsification is worse than any finding.', 'Argue grading in the room; respond in writing instead.', 'Sign statements without RA and legal review (FDA affidavits in particular).', 'Leave auditors unescorted or with open system access.', 'Offer gifts or hospitality beyond basic courtesy.']],
  ], [5040, 5040], { boldFirst: false }));
  c.push(h2('4.4 After they leave: the 72-hour plan'));
  c.push(table(['When', 'Actions'], [
    ['Day 0 (same day)', ['Debrief within two hours while memories are fresh.', 'Reconcile the request log with the auditors\' list of findings, verbatim.', 'Secure copies of everything provided.', 'Brief senior management; make required notifications (corporate, PRRC, other sites, contractual notifications).']],
    ['Day 1', ['Classify each finding; assign owners and dates.', 'Containment for any product or patient-safety issue.', 'FDA: start the Form 483 response. FDA considers responses received within 15 business days before deciding on a Warning Letter.']],
    ['Days 2–3', ['Root cause analysis (5 Whys, fishbone), not symptom fixes.', 'Distinguish correction from corrective action; define effectiveness criteria before acting.', 'Draft the response plan to the notified body within its stated window (check your contract; for MDSAP expect around 15 calendar days for the plan).']],
    ['Then', ['Implement; collect objective evidence of closure.', 'Verify effectiveness with data.', 'Feed findings, trends and lessons into management review and the next internal audit plan.']],
  ], [1900, 8180]));
  c.push(h2('4.5 Findings and consequences by regime'));
  c.push(table(['Regime', 'How findings are expressed', 'What escalates'], [
    ['FDA', 'Form FDA 483 inspectional observations; inspection classified NAI / VAI / OAI; Warning Letter; then seizure, injunction, consent decree; import alert for foreign sites', 'Repeat observations, an inadequate 483 response, data integrity problems, failures to report'],
    ['Notified body (MDR)', 'Minor and major nonconformities (definitions per notified body and MDCG guidance); corrective action plans; certificate suspension or withdrawal', 'Systemic majors, refusal of access, unreported significant changes, nonconformity found on sampled product'],
    ['MDSAP', 'Grades 1–5 per GHTF/SG3/N19: direct-impact clauses start at 3, indirect at 1; +1 for no documented process; +1 for a repeat; capped at 5', 'Grade 4 or 5: the auditing organization notifies the participating regulators within 5 business days; regulators may act independently'],
  ], [1700, 4680, 3700]));

  c.push(h1('5. Maintaining a global QMS'));
  c.push(h2('5.1 Core-plus-annex architecture'));
  c.push(table(['Tier', 'Contents', 'Owner'], [
    ['Tier 1: Global Quality Manual and policies', 'One scope, one process map, one site register. ISO 13485 as the spine; regulatory requirements referenced, not copied.', 'Global Quality'],
    ['Tier 2: Global procedures', 'One procedure per process with a named global process owner: complaints, CAPA, change control, supplier controls, design controls, document control, training, management review, internal audit.', 'Global process owners'],
    ['Tier 3: Site work instructions and Country Regulatory Annexes', 'How the work is physically done at each site; one annex per market listing the deltas: timelines, forms, authorities, language, roles.', 'Site quality heads; Regional RA'],
    ['Tier 4: Records and forms', 'One form per process globally; local-language versions controlled as translations, never as variants.', 'Document control'],
  ], [2900, 5180, 2000]));
  c.push(h3('Governance that stops the architecture decaying'));
  c.push(...bullets(['Global process owners with authority over their procedure at every site.', 'Site quality heads accountable for Tier 3 and for local execution.', 'Regulatory intelligence wired into change control: impact assessed within 30 days of a regulatory change.', 'A quarterly global quality council; global management review with site KPIs.', 'Annual review of QMS scope, the site register and the regulatory requirements matrix.']));
  c.push(h2('5.2 Regulatory requirements matrix: starter structure'));
  c.push(p('One row per requirement area, the deltas by market, a named owner, where the requirement lives in the QMS, and the trigger that forces a review. Owned by Global RA, reviewed annually, and every regulatory change runs through it via change control. A real matrix has forty to eighty rows.'));
  c.push(table(['Requirement area', 'What differs by market', 'Owner', 'Lives in', 'Review trigger'], [
    ['Adverse event and vigilance reporting', 'Definitions, timelines (2–30 days), forms, portals, foreign-event rules', 'Global RA', 'Vigilance SOP + country annex', 'Regulation change; new market'],
    ['Field actions and recalls', 'Notification timing, classification schemes, customer letter content', 'Global RA / Quality', 'Field action SOP + annex', 'Regulation change'],
    ['Registration, listing and licensing', 'Establishment registration, device listing, licences, agents and representatives', 'Regional RA', 'RA register + annex', 'New product, site or market'],
    ['Labeling and UDI', 'Languages, symbols, UDI issuing agencies, databases (GUDID, EUDAMED)', 'RA / Labeling', 'Labeling SOP + annex', 'New market; database go-live'],
    ['Complaint and servicing records', 'Required data fields (e.g., UDI under 820.35), retention periods', 'Global Quality', 'Complaint SOP', 'Regulation change'],
    ['Responsible persons', 'Management representative, PRRC (EU), UK Responsible Person, US Agent, MAH (Japan)', 'RA / HR', 'Quality manual + annex', 'Organization change'],
  ], [2200, 3080, 1400, 1900, 1500], { size: 18 }));
  c.push(h2('5.3 Vigilance reporting timelines by market'));
  c.push(table(['Jurisdiction (authority, basis)', 'Death or serious deterioration', 'Other reportable events', 'Serious public-health threat'], VIGILANCE, [2700, 2400, 2600, 2380], { size: 18 }));
  c.push(small(VIG_CAVEAT));
  c.push(h2('5.4 Operating rhythm and readiness KPIs'));
  c.push(table(['Cadence', 'Routine'], [
    ['Daily', 'Supervisor floor walks; DHR checks at the point of work'],
    ['Weekly', 'CAPA and complaint review; overdue actions chased'],
    ['Monthly', 'Site quality council: KPIs, audits, changes, suppliers'],
    ['Quarterly', 'Global management review; supplier performance; regulatory-intelligence review'],
    ['Annually', 'Full internal audit cycle; mock unannounced audit per site and at top critical suppliers; requirements matrix review'],
  ], [1700, 8380]));
  c.push(spacer(80));
  c.push(table(['Readiness KPI', 'Target', 'Your site today'], [
    ['Time to produce the full DHR and traceability for a random lot', '30 minutes or less', ''],
    ['Procedures past their periodic review date', '0', ''],
    ['Equipment in use past calibration due date', '0', ''],
    ['CAPAs open more than 12 months without approved justification', '0', ''],
    ['Staff trained on the current revision before performing the task', '100%', ''],
    ['Vigilance reports submitted on time', '100%', ''],
    ['Supplier audit plan adherence', '95% or more', ''],
    ['Reception script and 24/7 roster verified', 'Quarterly', ''],
  ], [5280, 2200, 2600], { boldFirst: false }));
  c.push(h2('5.5 Mock unannounced audits that count'));
  c.push(...numbered([
    '**Sponsor secretly.** Only the site head and the lead know the date. No "tidy-up" week beforehand.',
    '**Use an outsider.** Corporate quality from another site, or a consultant. Notified-body format: two auditors, one day.',
    '**Follow product.** Reception, opening meeting, sample from the line, DHR and DMR trace, supplier file, complaint and CAPA history.',
    '**Grade honestly.** Notified body or MDSAP definitions. Time every retrieval. Interview operators.',
    '**Debrief and track.** Findings into CAPA; readiness KPIs into management review; repeat yearly per site and at top critical suppliers.',
  ]));

  c.push(h1('6. Readiness self-test'));
  c.push(p('If auditors arrived tomorrow at 08:00, which of these statements would be true of your site? Tick each one you can say yes to without hesitation.'));
  c.push(...checks(SELFTEST));
  c.push(callout(['**Score 9–10:** ready; keep drilling.', '**Score 6–8:** exposed, and you know exactly where.', '**Score 5 or fewer:** start Monday with the reception script and the roster. They cost nothing and buy you the first hour.']));

  c.push(h1('7. Your 30-60-90 day plan'));
  c.push(table(['Window', 'Action', 'Owner', 'Due'], [
    ['First 30 days', 'Write the reception script and the 24/7 roster with deputies', '', ''],
    ['', 'Build the audit go-kit (see Appendix A.3)', '', ''],
    ['', 'Inventory quality agreements for access and notification clauses', '', ''],
    ['', 'Tell your notified body your shutdown and campaign calendar', '', ''],
    ['Days 31–60', 'Run the 30-minute DHR and traceability drill; fix what breaks', '', ''],
    ['', 'Complete a QMSR and MDR overlay gap check against your procedure index', '', ''],
    ['', 'Fix calibration recall and the change-impact assessment form', '', ''],
    ['', 'Build version 1 of the regulatory requirements matrix', '', ''],
    ['Days 61–90', 'Run a mock unannounced audit at one site and one critical supplier', '', ''],
    ['', 'Add readiness KPIs to management review', '', ''],
    ['', 'Retire duplicate site procedures onto the global tier', '', ''],
    ['', 'Schedule the next drill and the annual cycle', '', ''],
  ], [1700, 5180, 1800, 1400]));

  c.push(h1('Appendix A. Unannounced audit response plan template'));
  c.push(h2('A.1  24/7 contact roster'));
  c.push(table(['Role', 'Primary (name)', 'Phone', 'Deputy (name)', 'Phone'], Array.from({ length: 8 }, (_, i) => [['Audit Response Lead', 'Site Head', 'QA/RA leadership', 'Back-room coordinator', 'Document control', 'IT / system access', 'Corporate quality', 'Legal / regulatory counsel'][i], '', '', '', '']), [2300, 2100, 1700, 2100, 1880]));
  c.push(small('Review quarterly and before every holiday shutdown. Keep a paper copy at reception and at security.'));
  c.push(h2('A.2  Reception script'));
  c.push(...numbered([
    'Greet the visitors. Ask for photo identification and the credentials of the agency or notified body. For FDA, expect a Form FDA 482 (Notice of Inspection).',
    'Say: "Thank you. Our procedure is to contact our Audit Response Lead immediately. Please take a seat; someone will be with you within a few minutes." Do not ask them to come back later, and do not ask for the purpose of the visit beyond what they volunteer.',
    'Call the Audit Response Lead. No answer within two minutes: call the deputy. No answer: call the Site Head. Keep calling down the roster until someone confirms they are on the way.',
    'Offer water. Stay with the visitors or have security stay with them. Do not leave them alone and do not let them walk into the plant unescorted.',
    'Record the arrival time and the names of the auditors on the visitor log. Hand the log to the Audit Response Lead when they arrive.',
  ]));
  c.push(h2('A.3  Audit go-kit checklist'));
  c.push(...checks([
    'Current certificates (ISO 13485, MDSAP, MDR) and the scope statements',
    'Organization chart with the management representative and PRRC identified',
    'Site map, process flow and list of outsourced processes and critical suppliers',
    'Procedure index cross-referenced to ISO 13485 clauses, the QMSR and other applicable regulations',
    'Contact list: notified body, regulatory counsel, corporate quality, PRRC, UK Responsible Person, US Agent',
    'Blank request log and finding log (see A.4); visitor and confidentiality forms',
    'Photo, sample and signature policy agreed in advance with RA and legal',
    'Latest management review minutes, internal audit schedule and status, CAPA and complaint summary',
    'Production schedule for the week and the notified body notification of shutdown periods',
  ]));
  c.push(h2('A.4  Request log'));
  c.push(table(['No.', 'Time', 'Requested by', 'Item requested', 'Provided (time)', 'Provided by', 'Notes / potential finding'], Array.from({ length: 6 }, () => ['', '', '', '', '', '', '']), [600, 900, 1500, 2800, 1300, 1300, 1680], { boldFirst: false }));
  c.push(h2('A.5  Standing notifications to the notified body'));
  c.push(...bullets(['Planned production stoppages and campaign manufacturing calendars, so an unannounced audit does not arrive when nothing is being made.', 'Significant changes to the QMS, the device or critical suppliers, per your certification agreement.', 'Changes to the sites named in the technical documentation, including critical subcontractors.']));

  c.push(h1('Appendix B. Glossary'));
  c.push(table(['Term', 'Meaning'], [
    ['482 / 483', 'Form FDA 482, Notice of Inspection; Form FDA 483, Inspectional Observations issued at the close of an inspection'],
    ['AO', 'Auditing organization recognized under MDSAP'],
    ['ASL', 'Approved supplier list'],
    ['CAPA', 'Corrective and preventive action (ISO 13485 §8.5.2, §8.5.3)'],
    ['DHR / DMR', 'Device history record (the build record of a lot) and device master record; ISO 13485 calls the latter the medical device file (§4.2.3)'],
    ['FSCA / FSN', 'Field safety corrective action and field safety notice (EU vigilance)'],
    ['MDSAP', 'Medical Device Single Audit Program: one audit recognized by Australia, Brazil, Canada, Japan and the USA'],
    ['NAI / VAI / OAI', 'FDA inspection classifications: No Action Indicated, Voluntary Action Indicated, Official Action Indicated'],
    ['NB', 'Notified body designated under the EU MDR or IVDR'],
    ['NC', 'Nonconformity (minor or major for notified bodies; graded 1–5 under MDSAP)'],
    ['PRRC', 'Person responsible for regulatory compliance (MDR Art. 15)'],
    ['PSUR', 'Periodic safety update report (MDR Art. 86)'],
    ['QMSR / QSIT', 'FDA Quality Management System Regulation (21 CFR 820, effective 2 Feb 2026) and the retired Quality System Inspection Technique'],
    ['UDI', 'Unique device identification'],
    ['UKRP', 'UK Responsible Person'],
  ], [2000, 8080]));

  c.push(h1('Appendix C. References'));
  c.push(h3('Standards'));
  c.push(...bullets(['ISO 13485:2016 Medical devices — Quality management systems — Requirements for regulatory purposes, plus Amendment 1:2024', 'EN ISO 13485:2016+A11:2021 (harmonised standard with Annexes ZA/ZB for the MDR and IVDR)', 'ISO 14971:2019 Application of risk management to medical devices; ISO/TR 24971:2020 guidance', 'ISO 19011:2018 Guidelines for auditing management systems', 'IEC 62304 (software life cycle), ISO 11607 (packaging), ISO 14155 (clinical investigation), ISO 10993 series (biological evaluation)']));
  c.push(h3('Regulations and guidance'));
  c.push(...bullets(['21 CFR Part 820 Quality Management System Regulation (effective 2 February 2026); Parts 803 (medical device reporting), 806 (corrections and removals), 807 (registration and listing), 830 (UDI)', 'FDA Compliance Program 7382.845, Inspection of Medical Device Manufacturers', 'Regulation (EU) 2017/745 (MDR) and 2017/746 (IVDR), in particular MDR Annex IX §3.4; Regulations (EU) 2023/607 and 2024/1860 (transition extensions)', 'Commission Recommendation 2013/473/EU on audits and assessments performed by notified bodies', 'MDCG guidance documents (European Commission, medical devices sector)', 'MDSAP Audit Approach (MDSAP AU P0002) and MDSAP Companion Document (MDSAP AU G0002); GHTF/SG3/N19:2012 Nonconformity grading system', 'UK Medical Devices Regulations 2002 (SI 2002/618, as amended) and the 2024 post-market surveillance amendment regulations', 'Health Canada Medical Devices Regulations SOR/98-282']));
  c.push(h1('Notes'));
  c.push(...lines(6));
  return c;
}

// =====================================================================
// 2. CASE STUDY WORKSHOP PACK (participant version)
// =====================================================================
function casePack() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  CASE STUDY WORKSHOP PACK', 'ISO 13485 & Audit Readiness', 'Four composite cases on surviving unannounced audits and maintaining a global QMS',
    ['**Presented by:** Elder Consulting, LLC   ·   **Table number:** ______   ·   **Date:** ____________', '**Companion document:** Participant Handout']));
  c.push(h1('How to use this pack'));
  c.push(p('The four cases are composites built from real audits and inspections. Names, places, products and details have been changed; the mechanics have not. Each case runs for about seven minutes: two minutes to read, three to discuss at your table, and two for a plenary debrief. The exhibits are short excerpts from the kind of documents the auditors saw. Read them as an auditor would.'));
  c.push(...bullets(['There is no single right answer; there are answers that hold up in an audit and answers that do not.', 'Appoint a spokesperson for each case so the debrief moves quickly.', 'At the end of every case, write down one thing you would change at your own site. That list is the real output of the session.']));
  c.push(h3('Grading vocabulary you will need'));
  c.push(table(['Regime', 'How findings are expressed'], [
    ['Notified body (EU MDR)', 'Minor and major nonconformities; certificate suspension or withdrawal for refusal of access or systemic failures'],
    ['FDA', 'Form FDA 483 observations; inspection classified NAI / VAI / OAI; Warning Letter if the response is inadequate'],
    ['MDSAP', 'Grades 1–5: direct-impact clauses start at 3, indirect at 1; +1 for no documented process; +1 for a repeat; grades 4–5 notified to all regulators within 5 business days'],
  ], [2600, 7480]));

  // ---- Case 1
  c.push(pageBreak());
  c.push(h1('Case 1: The Tuesday morning knock'));
  c.push(h2('Background'));
  c.push(...bullets(['Legal manufacturer in Germany; Class IIb powered surgical instruments.', 'About 220 staff on a single manufacturing site; MDR certificate issued by a notified body.', 'The QA Director is on leave for two weeks. The reception instructions name no deputy.']));
  c.push(h2('The day'));
  c.push(table(['Time', 'What happened'], [
    ['08:10', 'Two notified body auditors present credentials at reception and state they are conducting an unannounced audit under MDR Annex IX. Reception calls HR, then the QA Director\'s mobile. Voicemail.'],
    ['09:00', 'The Production Manager, alerted by a colleague, takes the auditors to a meeting room. The 50-minute delay is written into the audit report.'],
    ['09:15', 'Opening meeting. The auditors state they will sample from final assembly and trace the sampled units through the QMS.'],
    ['09:40', 'Three finished units are selected. The auditors request the DHRs, the current DMR and the calibration status of the torque tools on the line.'],
    ['10:30', 'One torque driver is three weeks past its calibration due date and still in use. No impact assessment exists.'],
    ['11:15', 'The auditors ask for the validation of an automated dispensing station installed four months earlier. IQ/OQ/PQ exists; the change record has no design or risk impact assessment.'],
    ['13:40', 'PCB supplier file: approved; last audit four years ago; the quality agreement is silent on notified body access and change notification.'],
  ], [1100, 8980]));
  c.push(h2('Exhibits'));
  c.push(exhibit('Exhibit 1A', 'Reception desk instruction (excerpt)', ['Visitors without an appointment: ask the visitor to wait in the lobby and contact the host department.', 'Auditors and inspectors: contact the QA Director (ext. 210).']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 1B', 'Calibration register (excerpt, audit date 8 September)', ['Asset TQ-017 | Torque driver 0.5–5 Nm | Final assembly, station 3', 'Last calibration: 14 May | Due: 14 August | Status: IN USE', 'Recall action: none recorded']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 1C', 'Change record CR-24-118 (excerpt)', ['Description: install automated adhesive dispensing station replacing manual syringe dispensing at station 5.', 'Validation: IQ/OQ/PQ per VAL-118 - complete.', 'Design impact assessment: [blank]', 'Risk management file update: [blank]', 'Notified body notification assessed: [blank]']));
  c.push(h2('Discuss at your table'));
  c.push(...numbered(['What should the first 30 minutes have looked like? Write the sequence of calls and actions.', 'Rank the three findings from most to least serious, and explain your ranking. Which would you expect the notified body to grade as major?', 'What did the 50-minute delay tell the auditors before they saw a single record?', 'Exhibit 1C: who should have been required to sign the blank fields, and what would have happened to the change if they had?']));
  c.push(h3('Table notes')); c.push(...lines(5));
  c.push(h3('One thing I will change at my site')); c.push(...lines(2));

  // ---- Case 2
  c.push(pageBreak());
  c.push(h1('Case 2: The supplier they visited first'));
  c.push(h2('Background'));
  c.push(...bullets(['Legal manufacturer in the Netherlands; Class IIa sterile single-use devices; MDR Annex IX certificate.', 'Final assembly, packaging and sterilization release are outsourced to a contract manufacturer in Penang, Malaysia, named in the technical documentation as a critical subcontractor.', 'The device is manufactured in campaigns of two to three weeks, several times a year.']));
  c.push(h2('The day'));
  c.push(table(['Time', 'What happened'], [
    ['09:00 (Penang)', 'Two notified body auditors arrive unannounced at the subcontractor\'s gate. Security refuses entry: no appointment, no visitor request in the system.'],
    ['09:20', 'The subcontractor\'s QA manager calls the manufacturer\'s RA lead in the Netherlands. It is 03:20 there. No answer.'],
    ['12:05', 'Contact is made with the manufacturer at 08:00 CET. Access is authorized. Three hours of delay are recorded in the report.'],
    ['12:30', 'The manufacturer\'s device is not in production that week. The auditors sample from finished-goods stock and review the DHRs of the last two campaigns.'],
    ['14:15', 'Four deviations closed locally in the last six months; none was reported to the manufacturer. The quality agreement requires notification within five days.'],
    ['15:00', 'One deviation is a seal-temperature excursion on a pouch sealer, dispositioned "use as is" by the subcontractor without the manufacturer\'s involvement.'],
    ['16:30', 'Closing meeting by video with the manufacturer. The manufacturer\'s supplier scorecard, shown on request, rates the subcontractor "green" for the entire period.'],
  ], [1500, 8580]));
  c.push(h2('Exhibits'));
  c.push(exhibit('Exhibit 2A', 'Quality agreement, clause 7.2 (as signed)', ['The Supplier shall permit the Manufacturer to audit the Supplier\'s facilities upon thirty (30) days\' written notice, not more than once per calendar year.']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 2B', 'Supplier scorecard, Q1-Q2 (manufacturer\'s record)', ['On-time delivery: 98% - GREEN', 'Incoming inspection rejects: 0.2% - GREEN', 'Deviations reported to manufacturer: 0 - GREEN', 'Complaints attributable to supplier: 0 - GREEN']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 2C', 'Subcontractor deviation DEV-0231 (excerpt)', ['Event: seal temperature recorded at 168 C against a validated range of 175-185 C for approximately 40 minutes during lot 24K07.', 'Investigation: seal strength samples (n=5) from the affected period passed.', 'Disposition: use as is. Approved: Production Supervisor; QA Officer (site).', 'Customer notification: not required.']));
  c.push(h2('Discuss at your table'));
  c.push(...numbered(['Whose audit was this, really, and who received the findings?', 'What does ISO 13485 §4.1.5 (control of outsourced processes) require of the manufacturer here, and where exactly did the manufacturer\'s control fail?', 'Exhibit 2B: why did a scorecard with four green cells hide the problem? What would you measure instead?', 'How should production calendars and site access be arranged with the notified body for a campaign-manufactured device?', 'Rewrite clause 7.2 of the quality agreement in two or three sentences.']));
  c.push(h3('Table notes')); c.push(...lines(5));
  c.push(h3('One thing I will change at my site')); c.push(...lines(2));

  // ---- Case 3
  c.push(pageBreak());
  c.push(h1('Case 3: The first inspection under the QMSR'));
  c.push(h2('Background'));
  c.push(...bullets(['US manufacturer in Indiana; Class II reusable orthopedic instruments and sterilization trays; about 400 staff.', 'ISO 13485 certified for ten years; MDSAP certificate for the Canadian market. Last FDA inspection 2021, classified NAI.', 'The QMSR gap assessment completed in 2025 concluded: "We are ISO 13485 certified; no procedural changes required."']));
  c.push(h2('The day'));
  c.push(table(['Time', 'What happened'], [
    ['09:00', 'An FDA investigator presents credentials and Form FDA 482. The inspection follows the QMSR structure, not QSIT.'],
    ['09:20', 'The investigator asks for the procedure index cross-referenced to ISO 13485 clauses and to the QMSR. The firm has an ISO index only.'],
    ['09:45', 'Request for the last two management reviews and the internal audit schedule and results. The firm\'s readiness procedure still cites the retired 820.180(c) exemption. Forty minutes pass in calls with corporate RA before the records are provided.'],
    ['11:00', 'Management review minutes contain no regulatory-reporting metrics; two actions from 2024 are still open.'],
    ['Day 2', 'Complaints: 6 of 20 sampled files have no documented MDR reportability decision; complaint records do not capture the UDI (820.35(a)).'],
    ['Day 2', 'Labeling: label and IFU inspection records for one tray family show no verification of label content (820.45).'],
    ['Day 3', 'CAPA: two CAPAs for the same cleaning-validation issue, both "closed - effective" with no effectiveness data.'],
  ], [1100, 8980]));
  c.push(h2('Exhibits'));
  c.push(exhibit('Exhibit 3A', 'Inspection readiness procedure QP-015 rev C (excerpt, effective 2019)', ['Per 21 CFR 820.180(c), records of management review, internal quality audits and supplier audits are exempt from FDA review. The FDA investigator shall be informed that such audits have been performed and shall be shown the certification of completion only.']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 3B', 'Complaint record CMP-25-0417 (fields as completed)', ['Product: tray system model T-40 | Lot / UDI: [blank]', 'Complaint: "Instrument tray latch failed to close during reprocessing; tray sent for service."', 'Investigation: latch spring fatigue; spring replaced under service.', 'MDR reportability decision: [blank] | Rationale: [blank]', 'Reply to complainant: yes, 14 March.']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 3C', 'CAPA-24-031 closure statement', ['Root cause: operator did not follow cleaning validation protocol.', 'Corrective action: retraining completed 12 November 2024.', 'Effectiveness: verified - no recurrence observed at closure. Closure date: 15 November 2024.']));
  c.push(h2('Discuss at your table'));
  c.push(...numbered(['What mindset caused the 40-minute standoff over the management review records, and what did it cost the firm?', 'Which of the eventual observations are QMSR-specific, and which are plain ISO 13485 failures the firm was already certified against?', 'Exhibit 3C: list everything wrong with this closure statement. What would an acceptable effectiveness check look like?', 'Draft the first paragraph of the Form 483 response to the CAPA observation. Include correction, corrective action and a systemic check.']));
  c.push(h3('Table notes')); c.push(...lines(5));
  c.push(h3('One thing I will change at my site')); c.push(...lines(2));

  // ---- Case 4
  c.push(pageBreak());
  c.push(h1('Case 4: Three sites, three QMSs, one certificate'));
  c.push(h2('Background'));
  c.push(...bullets(['Multinational with US headquarters (design and manufacturing), a German site acquired in 2023 (legacy MDD manufacturer) and a high-volume plant in Costa Rica; about 1,800 staff.', 'One MDSAP certificate covers all three sites; MDR certificate; Health Canada licences.', 'Integration of the German site\'s QMS was planned "after the MDR transition".']));
  c.push(h2('The audit'));
  c.push(table(['When', 'What happened'], [
    ['Surveillance audit, German site', 'The MDSAP auditor samples complaints received in the previous 12 months. One complaint from a Canadian hospital reports a serious deterioration in a patient\'s health associated with the device. It arrived at the German site via the distributor.'],
    ['Same day', 'The complaint was assessed under the German legacy complaint procedure. The reportability decision took 14 days; the report reached Health Canada on day 22. The Canadian limit is 10 days.'],
    ['Same day', 'The headquarters procedure would have flagged the complaint for a 48-hour reportability triage. Neither site knew the other\'s process in detail.'],
    ['Day 2', 'Three versions of the complaint form are in use across the company. German trend data has never reached global management review.'],
    ['Day 2', 'The previous audit raised inconsistent complaint intake as a grade 2 nonconformity. The CAPA was closed with "training".'],
  ], [2300, 7780]));
  c.push(h2('Exhibits'));
  c.push(exhibit('Exhibit 4A', 'German site complaint procedure QM-WA-08 (excerpt, translated)', ['Reportability to authorities is assessed in the monthly complaint review meeting, using the criteria of MEDDEV 2.12/1 and the Medical Devices Act (MPG).']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 4B', 'Previous MDSAP audit, nonconformity 3 (grade 2) and CAPA closure', ['Finding: complaint intake forms differ between sites and do not consistently capture the country in which the event occurred.', 'Corrective action: complaint handling training delivered to the German site team (attendance 18/18).', 'Effectiveness: training records verified. Status: CLOSED.']));
  c.push(spacer(100));
  c.push(exhibit('Exhibit 4C', 'Global complaint KPI dashboard (Q2)', ['On-time reportability decisions (within 48 h):', '  Headquarters (US): 97%', '  Costa Rica: 95%', '  Germany: n/a - not tracked']));
  c.push(pageBreak());
  c.push(h2('Discuss at your table'));
  c.push(...numbered(['Why did "training" fail as a corrective action? What was the actual root cause?', 'What must a single global complaint process contain to work in Germany, Costa Rica and the US at the same time?', 'Exhibit 4A: identify every element of this clause that is incompatible with a multi-market QMS in 2026.', 'Who should own the regulatory requirements matrix, and who should own keeping it current? What is the change-control link?', 'Work out the MDSAP grade for the reporting nonconformity using the rules on page 1, and explain who hears about it and when.']));
  c.push(h3('Table notes')); c.push(...lines(5));
  c.push(h3('One thing I will change at my site')); c.push(...lines(2));

  c.push(pageBreak());
  c.push(h1('Across the four cases'));
  c.push(p('Look back at all four cases before the closing section of the seminar.'));
  c.push(...numbered(['Which failure appears, in some form, in every case?', 'In each case, where was the earliest moment the outcome could have been changed, and who had the authority to change it?', 'Which of the four companies would you least like to be, and why?', 'Rank your own site\'s exposure to each of the four scenarios: low, medium, high.']));
  c.push(table(['Case', 'Exposure at my site (low / medium / high)', 'First action'], [
    ['1. Unannounced notified body audit at the main site', '', ''],
    ['2. Unannounced audit at a critical supplier or subcontractor', '', ''],
    ['3. First FDA inspection under the QMSR', '', ''],
    ['4. Multi-site complaint handling and reporting', '', ''],
  ], [4200, 2600, 3280]));
  c.push(h3('My list of things to change')); c.push(...lines(8));
  return c;
}

// =====================================================================
// 3. FACILITATOR GUIDE
// =====================================================================
function facilitator() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  FACILITATOR GUIDE', 'ISO 13485 & Audit Readiness', 'Run-of-show, delivery notes, case study model answers and Q&A preparation',
    ['**For the speaker only.** Do not distribute to participants.', '**Materials:** Speaker deck (40 slides with notes), Participant Handout, Case Study Workshop Pack']));
  c.push(h1('1. Purpose and learning objectives'));
  c.push(p('A 90-minute seminar for medical device quality and regulatory professionals. Assume a mixed room: some have lived through unannounced audits and FDA inspections; others have never been in the front room. The design keeps experts engaged through the case studies while giving newcomers the vocabulary and a protocol they can install.'));
  c.push(...bullets(['Explain who can audit without notice and on what legal basis (EU MDR Annex IX §3.4; FDA; MDSAP).', 'Run the first 60 minutes with a written protocol, named roles and deputies.', 'Map audit-critical ISO 13485 clauses to evidence and reconstruct a lot end-to-end.', 'Apply a 72-hour post-audit plan focused on root cause.', 'Describe the core-plus-annex global QMS model and the regulatory requirements matrix.', 'Score their site with the ten-question self-test and leave with a 30-60-90 plan.']));
  c.push(h1('2. Room, materials and set-up'));
  c.push(...bullets(['Tables of four to six; cabaret style. The case studies do not work in theatre seating. If the room is fixed, pair rows and shorten discussion to two minutes.', 'One Participant Handout and one Case Study Workshop Pack per person; pens; a flipchart or whiteboard for the opening poll counts and parked questions.', 'Visible timer (phone or slide clock) for the case study rounds.', 'Fill in the title slide and the closing slide placeholders (speaker, date, venue, contact, handout link or QR code) before the session.', 'Verify the dates on slide 6 and the vigilance table on slide 32 the week before; see Section 8.']));

  c.push(h1('3. Run-of-show'));
  c.push(table(['Clock', 'Slides', 'Segment', 'Facilitation notes'], [
    ['0:00', '1', 'Welcome', 'Introduce yourself in one minute; state the four things people leave with. Point to the two handouts.'],
    ['0:02', '2', 'Agenda', 'Ask people to sit in tables of 4–6 now. Case pack stays closed until Section 4.'],
    ['0:04', '3', 'Poll', 'Three shows of hands; write the counts on the flipchart. Question 3 is the hook.'],
    ['0:08', '4–7', 'Section 1: why readiness is permanent', 'Slide 5 table: who arrives unannounced. Slide 6: the 2026 snapshot, spend most time on QMSR and MDR. Slide 7: three auditor questions; the finding clusters.'],
    ['0:20', '8–13', 'Section 2: ISO 13485 backbone', 'Slide 9 fast orientation. Slides 10–11 read the middle column as the request list. Slide 12 evidence chain is the mental model for the whole session. Slide 13 headlines only.'],
    ['0:32', '14–20', 'Section 3: anatomy of an unannounced audit', 'Slide 16 is the protocol; walk it left to right. Slide 17 roles and deputies. Slide 18 stress: never alter records; "I don\'t know, I will find out". Slides 19–20 the 72-hour plan and grading vocabulary.'],
    ['0:47', '21', 'Case study divider', 'Open the case pack. Explain the rhythm: 2 read, 3 discuss, 2 debrief. Start the timer visibly.'],
    ['0:48', '22–23', 'Case 1', 'Debrief: ranking of findings; the lobby set the tone.'],
    ['0:55', '24–25', 'Case 2', 'Debrief: the major went to the legal manufacturer; quality agreement clause.'],
    ['1:02', '26–27', 'Case 3', 'Debrief: hear one table\'s 483 response paragraph.'],
    ['1:09', '28–29', 'Case 4', 'Debrief: grade 4 mechanics; the three-part lesson frames Section 5.'],
    ['1:16', '30–36', 'Section 5: maintaining a global QMS', 'Architecture, vigilance timelines, matrix, rhythm and KPIs, self-test (compare with poll counts), mock audits. Compress here if behind.'],
    ['1:26', '37–39', 'Close', 'Five takeaways slowly; 30-60-90 plan; point to references without reading them.'],
    ['1:28', '40', 'Q&A', 'Open with the question on the slide. Seed questions in Section 7.'],
  ], [800, 900, 2600, 5780], { size: 18 }));
  c.push(h3('If you are running behind'));
  c.push(...bullets(['Skip slide 13 (overlays) and slide 33 (matrix); both are in the handout.', 'Run Cases 1, 3 and 4 and assign Case 2 as homework; or cut each debrief to 60 seconds: grade, escalation, lesson.', 'The self-test (slide 35) can be done silently in 60 seconds: ask only for the 9–10 hands.']));
  c.push(h3('If you have extra time'));
  c.push(...bullets(['Let the Case 4 question on matrix ownership run; it exposes real organizational debates.', 'Ask a volunteer to walk through their own site\'s first 30 minutes against slide 16.']));

  c.push(h1('4. Delivery notes by section'));
  c.push(h2('Section 1: Why readiness is permanent (slides 4–7)'));
  c.push(...bullets(['History in one breath: PIP exposed the limits of scheduled surveillance; Recommendation 2013/473/EU introduced unannounced audits at least every three years; the MDR wrote them into law with a five-year minimum and explicit reach to critical suppliers and subcontractors. The notified body must keep its plan secret.', 'FDA: domestic inspections were always unannounced; the 2025 expansion of unannounced foreign inspections removed the last comfortable assumption.', 'The QMSR change most rooms have not internalized: management review, internal audit and supplier audit records are now reviewable in routine inspections. This is Case 3.', 'Do not quote 483 statistics unless you have pulled the current FDA data; the pattern of clusters is the point.']));
  c.push(h2('Section 2: ISO 13485 backbone (slides 8–13)'));
  c.push(...bullets(['Slide 12 (evidence chain) is the one slide to make the room remember. Say it as a story: the auditor picks up a unit and pulls the thread.', 'Traceability (7.5.9) decides unannounced audits because the auditor has product in hand.', 'Complaints and CAPA fail through undocumented decisions, not absent systems: no rationale for "not reportable", no data behind "effective".']));
  c.push(h2('Section 3: Anatomy of an unannounced audit (slides 14–20)'));
  c.push(...bullets(['Mechanics: typically two auditors, at least one day, at the site or a critical supplier; you are expected to have told the notified body about shutdowns and campaign calendars.', 'The protocol on slide 16 is reproduced in the handout (4.1) with an owner column. Point to it.', 'Roles: the scribe is under-rated; a verbatim log is what lets you contest a finding accurately at the closing meeting.', 'Do and don\'t: stress the two absolutes: never alter, backdate or create records during an audit; and "I don\'t know, I will find out" is a complete answer that must be followed through.', 'Signatures and affidavits: policy must be agreed with RA and legal before the day.']));
  c.push(h2('Section 5: Maintaining a global QMS (slides 30–36)'));
  c.push(...bullets(['Architecture: one process, local annexes, governed interfaces. Tier 3 is where locality lives.', 'Vigilance table: read one row across to show the same event triggers different clocks; the shortest clock wins for triage, hence 48-hour triage. State the caveat aloud: teaching aid, verify against current text.', 'Readiness KPIs: the first row is the opening poll question. Ask who would add it to management review.', 'Self-test: compare the 9–10 hands with the flipchart counts from the poll.']));

  c.push(h1('5. Case study facilitation and model answers'));
  c.push(p('Timing per case: 2 minutes reading, 3 minutes discussion, 2 minutes debrief. Show the situation slide during reading and discussion; switch to the outcome slide only after you have heard at least two tables. Model answers below are for you; the participant pack does not contain them.'));

  c.push(h2('Case 1: The Tuesday morning knock'));
  c.push(p('**Set-up line.** "It is 08:10 on a Tuesday. Two people you have never met are standing at reception, and the only name on the reception card is on holiday."'));
  c.push(h3('Model answers'));
  c.push(...numbered([
    '**First 30 minutes.** Reception verifies credentials, calls the Audit Response Lead, then the deputy, then the Site Head, and stays with the auditors. Within 15 minutes: audit room, notifications (site head, QA/RA, corporate, legal), request log open, scribe and runner assigned, back room stood up. Opening meeting by minute 30. In the case, none of this existed because the reception instruction (Exhibit 1A) named one person and no deputy.',
    '**Ranking.** The notified body graded calibration (7.6) as major because product had shipped after the due date with no assessment of what an out-of-tolerance torque could mean for patients. The change-control gap (7.3.9 / 7.5.6) and the supplier gap (7.4.1) were minors, but both trace to the same root: change without assessment. A table that ranks the supplier agreement first is defensible; steer to why the notified body chose calibration: shipped product.',
    '**The delay.** It told the auditors the QMS depends on individuals, not a system; that the site had never rehearsed; and that reception was not part of the QMS. The report recorded the delay and reminded the firm that refusal is grounds for suspension. Fifty minutes was not refusal, but it framed everything that followed.',
    '**Exhibit 1C.** The design authority (or design owner) and the risk management owner should have been mandatory signatures; the RA function should have assessed whether the change was significant under the notified body agreement. With those signatures required, the change could not have been closed with blank fields, and the dispensing process would have been assessed for design and risk impact before release.',
  ]));
  c.push(p('**Actual outcome.** Major: 7.6. Minor: 7.3.9 / 7.5.6. Minor: 7.4.1. Observation on delayed access. Corrective actions: reception script and 24/7 roster with deputies; calibration recall with quarantine at due date; change-control form with mandatory design and risk impact section; supplier agreement template with access, change notification and deviation reporting clauses; annual mock unannounced audit.'));
  c.push(p('**Lesson to land.** The auditors formed their view of the QMS in the lobby. Everything after that confirmed it.'));
  c.push(p('**If the room is quiet.** Ask: "Who has a deputy named at reception today? Who has checked it since the last holiday shutdown?"'));

  c.push(h2('Case 2: The supplier they visited first'));
  c.push(p('**Set-up line.** "Annex IX §3.4 says the notified body may audit your suppliers and subcontractors unannounced. This company had read that sentence. Its subcontractor had not."'));
  c.push(h3('Model answers'));
  c.push(...numbered([
    '**Whose audit.** The legal manufacturer\'s. The certificate holder is audited wherever its device is made; the findings were issued to the manufacturer, not the subcontractor. Tables that blame the subcontractor need to be steered: the subcontractor behaved exactly as its contract (Exhibit 2A) told it to.',
    '**4.1.5.** The manufacturer must control outsourced processes in proportion to risk and retain responsibility for conformity; the controls are documented in quality agreements and verified. Control failed at three points: the agreement did not require unannounced access or prompt deviation reporting in practice; the manufacturer never verified the deviation logs; and the manufacturer had not arranged notified body access or informed the notified body of the campaign calendar.',
    '**Exhibit 2B.** "Deviations reported: 0" was read as good news when it was an absence of data. A scorecard only measures what the supplier sends. Measure instead: deviations raised at the supplier (from their log, sampled quarterly), time from deviation to manufacturer notification, DHR review findings, and audit findings, with the manufacturer pulling the data rather than receiving it.',
    '**Calendars and access.** Inform the notified body of the campaign calendar and shutdown periods for each named site; ensure the subcontractor\'s gate protocol names the notified body and the manufacturer\'s 24/7 contacts in both time zones; agree in the quality agreement that the subcontractor admits the notified body and regulators without notice.',
    '**Rewritten clause 7.2.** Something like: "The Supplier shall grant the Manufacturer, the Manufacturer\'s notified body and any competent regulatory authority access to its facilities, records and personnel relating to the Products at any time during operating hours, with or without notice. The Supplier shall notify the Manufacturer of any deviation, nonconformity or change affecting the Products within 24 hours of identification and shall not disposition affected product without the Manufacturer\'s written approval."',
  ]));
  c.push(p('**Actual outcome.** Major to the manufacturer: 4.1.5 / 7.4. Minor: 7.5.6 (seal excursion not evaluated for revalidation, affected lots not assessed). Condition: retrospective review of all lots from the affected period before the certificate was maintained. Corrective actions: quality agreement rewritten; notified body informed of the production calendar; supplier oversight changed to quarterly data verification; joint mock unannounced audit at the subcontractor; subcontractor front-desk protocol names the notified body.'));
  c.push(p('**Lesson to land.** Your certificate travels to your critical suppliers. So does your audit.'));
  c.push(p('**If the room is quiet.** Ask: "Who has a quality agreement that lets your notified body walk into your supplier unannounced, and gives the supplier a name to call at 3 a.m.?"'));

  c.push(h2('Case 3: The first inspection under the QMSR'));
  c.push(p('**Set-up line.** "This is the inspection every US site will have between now and 2028. The company had a certificate, a clean 2021 inspection, and a gap assessment that said nothing changes."'));
  c.push(h3('Model answers'));
  c.push(...numbered([
    '**The mindset.** "We are certified, therefore we are compliant" plus a procedure frozen in 2019 (Exhibit 3A). The standoff cost forty minutes of goodwill and put the investigator on notice that the firm\'s procedures were out of date; it also meant the records were produced under pressure rather than presented with context.',
    '**QMSR-specific versus ISO.** Genuinely QMSR-specific: the UDI field in complaint records (820.35(a)) and the labeling content verification record (820.45). Plain ISO 13485 failures the firm was already certified against: undocumented reportability decisions (8.2.2 / 8.2.3), CAPA effectiveness (8.5.2), management review inputs and overdue actions (5.6). The certificate did not make them true; the notified body had simply not sampled them.',
    '**Exhibit 3C.** Root cause is a person, not a system ("operator did not follow"); no why. The corrective action is retraining alone. Effectiveness was declared three days after training with no data, no defined criteria and no observation period. An acceptable check: defined criteria (e.g., zero cleaning-validation deviations over 90 days and two consecutive successful audits of the process), a defined date, data attached, and independent sign-off by someone other than the CAPA owner.',
    '**483 response paragraph.** Acceptable answers acknowledge the observation without argument; state the correction (reopen CAPA-24-031 and the second CAPA; perform a proper root cause analysis of the cleaning-validation failures); state the corrective action (revise the CAPA procedure so that effectiveness requires defined criteria, an observation period, data and independent verification); state the systemic check (review all CAPAs closed in the past 24 months against the new criteria, with a completion date); and commit to providing evidence by a date. Hear one table read theirs aloud.',
  ]));
  c.push(p('**Actual outcome.** Form FDA 483 with four observations: complaint handling (reportability decisions not documented; records incomplete; 8.2.2 and 820.35(a)); CAPA effectiveness not verified (8.5.2); management review inputs incomplete and actions overdue (5.6); labeling content verification not documented (820.45). Response filed in 12 business days; inspection classified VAI. Corrective actions: proper QMSR crosswalk; inspection-readiness procedure rewritten so that management review, internal audit and supplier audit records are producible and written to be read; complaint form with UDI, decision tree and mandatory rationale; CAPA effectiveness with data and independent sign-off; mock FDA inspection structured around the QMSR.'));
  c.push(p('**Lesson to land.** "We are ISO certified, nothing changes" was the most expensive sentence of the year. Add: "written to be read" does not mean sanitized; candid records with closed actions reassure an investigator, glossy empty ones do not.'));

  c.push(h2('Case 4: Three sites, three QMSs, one certificate'));
  c.push(p('**Set-up line.** "Three good sites, three honest procedures, one certificate. The gap was between them."'));
  c.push(h3('Model answers'));
  c.push(...numbered([
    '**Why training failed.** The root cause was structural: three procedures, no single reportability decision tree, no shared timelines, a monthly review meeting incompatible with 10-day clocks (Exhibit 4A), and no global KPI for the German site (Exhibit 4C). Training addressed individual knowledge; the system made the late report inevitable regardless of how well-trained the individuals were.',
    '**A single global complaint process needs:** one intake channel and one form; a reportability decision tree that carries every market\'s definitions and clocks; 48-hour triage so the shortest clock is always met; a country annex per market for authority, form and portal; one complaint system of record with global KPIs; defined roles including who signs reportability decisions at each site; and translation handled as controlled translations, not local variants.',
    '**Exhibit 4A.** Monthly assessment cadence (incompatible with 2-, 10- and 15-day clocks); reference to MEDDEV 2.12/1 (MDD-era guidance, superseded by MDR vigilance requirements and MDCG guidance); reference to the MPG (replaced in Germany by the MPDG in 2021); no mention of non-EU markets at all; no named decision authority.',
    '**Matrix ownership.** Global RA owns the matrix and its annual review; each row has a named owner for the requirement itself; the link to change control is that every regulatory-intelligence item generates a change request whose impact assessment must be completed within 30 days and must update the matrix, the annex and the procedure together.',
    '**Grade.** Reporting to regulatory authorities (8.2.3) is a direct-impact clause: grade 3. The previous audit had raised complaint intake as a nonconformity and the corrective action had not worked, so it is a repeat: +1 = grade 4. A documented process did exist, so no further escalation. Grade 4 means the auditing organization notifies all five MDSAP regulators within five business days, and each may act independently.',
  ]));
  c.push(p('**Actual outcome.** Grade 4 nonconformity against 8.2.3; the auditing organization notified the MDSAP regulators within five business days; Health Canada requested a corrective action plan; the notified body asked for a 24-month retrospective review of German-site complaints. Corrective actions: core-plus-annex architecture; one complaint system with a global decision tree and 48-hour triage; regulatory requirements matrix owned by Global RA and linked to change control; global management review with site KPIs; internal audits testing the interfaces between sites; legacy procedures retired on a 12-month plan.'));
  c.push(p('**Lesson to land.** Harmonize the process, localize the annex, govern the interfaces.'));

  c.push(h2('Across the four cases (case pack, last page)'));
  c.push(...bullets(['The failure in every case: a decision nobody documented or a control nobody verified, discovered when an auditor followed product or a complaint through the system.', 'The earliest moment: Case 1, writing the reception instruction; Case 2, signing clause 7.2; Case 3, the 2025 gap assessment; Case 4, closing the grade 2 finding with training.']));

  c.push(h1('6. The poll and the self-test'));
  c.push(...bullets(['Poll (slide 3): three shows of hands; write counts on the flipchart. After question 3 say: "That is the test an unannounced auditor runs in the first hour, whether or not they call it that."', 'Self-test (slide 35): silent scoring; ask for 9–10 hands only; compare to the poll. Do not ask for low scores publicly.', 'Close the loop: "Would anyone change their answer to question 3 now?"']));

  c.push(h1('7. Q&A preparation'));
  c.push(table(['Likely question', 'Suggested answer'], [
    ['Can we refuse or postpone an unannounced notified body audit?', 'Refusal or obstruction is grounds for certificate suspension under the certification agreement and the MDR. Delay is recorded and read as concealment. You can and should insist on identity verification, EHS briefing and escort; you cannot insist on a different day.'],
    ['Do we have to let FDA take photographs?', 'FDA asserts authority to take photographs during inspections and firms generally allow it, sometimes with agreed restrictions (e.g., no proprietary equipment). Agree your position with regulatory counsel before the day and record every photograph taken.'],
    ['Should we show an auditor a record we know is deficient?', 'Yes, if it is requested. Provide it, note the deficiency yourself, and describe what you are doing about it. Withholding or altering records converts a finding into a data integrity issue, which is far worse.'],
    ['How do we keep a global complaint process fast enough for 48-hour triage?', 'Single intake, a trained triage role on every site with a deputy, a decision tree with the shortest clock as the default, and a KPI for time to decision reviewed weekly.'],
    ['Are management review records really open to FDA now?', 'The QMSR did not carry over the former 820.180(c) exemption; plan for investigators to request management review, internal audit and supplier audit records. Confirm current FDA inspection guidance before you present.'],
    ['What does an unannounced MDSAP audit look like?', 'Rare, and normally for cause: a regulator request or serious signals. Announced surveillance is the norm. The readiness posture is the same either way.'],
    ['When will the revised ISO 13485 be published?', 'The revision is under way in ISO/TC 210. Give the current draft stage and expected timeline only if you have checked it that month; otherwise say a transition period is expected and to watch the draft stages.'],
  ], [3600, 6480], { size: 18 }));

  c.push(h1('8. Accuracy checklist before each delivery'));
  c.push(p('The deck and handout are current as of September 2026. Verify the following against primary sources the week before you present, and update slide 6, slide 32 and handout sections 2.2 and 5.3 if anything has moved.'));
  c.push(...checks([
    'FDA QMSR: effective date (2 Feb 2026) and any new FDA inspection guidance or compliance program revisions.',
    'EU MDR/IVDR transition dates (Regulations 2023/607 and 2024/1860) and EUDAMED module status.',
    'UK CE recognition dates (30 Jun 2028 / 30 Jun 2030) and post-market surveillance regulation status.',
    'MDSAP participating and affiliate jurisdictions; grading and escalation rules (GHTF/SG3/N19; MDSAP procedures).',
    'Vigilance timelines for each jurisdiction in the table (slide 32, handout 5.3), including calendar versus working days.',
    'ISO 13485 revision status in ISO/TC 210 and the status of Amendment 1:2024.',
    'Latest FDA 483 observation data if you intend to quote numbers on slide 7.',
    'Brazil (RDC 665/2022, RDC 551/2021) and other market references named on slide 6.',
  ]));

  c.push(h1('9. Variants'));
  c.push(h2('60-minute version'));
  c.push(...bullets(['Cut slides 9, 13, 20, 33 and 36. Run Cases 1 and 3 only (14 minutes). Section 5 becomes slides 31, 32 and 35 in six minutes.']));
  c.push(h2('Half-day workshop (3 hours)'));
  c.push(...bullets(['Add a 20-minute exercise after Section 3: tables write their own reception script and roster using handout Appendix A.', 'Run all four cases at 12 minutes each, with each table presenting one case.', 'Add a 30-minute exercise after Section 5: tables draft five rows of a regulatory requirements matrix for their own products.', 'Close with participants completing the 30-60-90 plan with owners and dates.']));
  return c;
}

// ---------- build ----------
(async () => {
  const outputs = [
    ['out/ISO-13485-Audit-Readiness-Participant-Handout.docx', 'ISO 13485 & Audit Readiness: Participant Handout', 'ISO 13485 & Audit Readiness  ·  Participant Handout  ·  Elder Consulting, LLC', handout],
    ['out/ISO-13485-Audit-Readiness-Case-Study-Workshop-Pack.docx', 'ISO 13485 & Audit Readiness: Case Study Workshop Pack', 'ISO 13485 & Audit Readiness  ·  Case Study Workshop Pack  ·  Elder Consulting, LLC', casePack],
    ['out/ISO-13485-Audit-Readiness-Facilitator-Guide.docx', 'ISO 13485 & Audit Readiness: Facilitator Guide', 'ISO 13485 & Audit Readiness  ·  Facilitator Guide (speaker only)  ·  Elder Consulting, LLC', facilitator],
  ];
  for (const [file, title, footer, fn] of outputs) {
    const doc = makeDoc(title, footer, fn());
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(file, buf);
    console.log('wrote', file, buf.length, 'bytes');
  }
})();
