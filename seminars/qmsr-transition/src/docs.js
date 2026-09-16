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
  ['0:00 – 0:06', 'Welcome, objectives, room poll'],
  ['0:06 – 0:20', 'What changed on 2 February 2026, and what did not'],
  ['0:20 – 0:30', 'The four load-bearing FDA-specific provisions'],
  ['0:30 – 0:45', 'The inspection changed more than the regulation: Compliance Program 7382.850'],
  ['0:45 – 0:55', 'Exercise A: red-team the records, write the observation'],
  ['0:55 – 1:05', 'From crosswalk to gap assessment'],
  ['1:05 – 1:15', 'Exercise B: gap triage under time pressure'],
  ['1:15 – 1:23', 'The roadmap: five phases, two tracks, metrics'],
  ['1:23 – 1:30', 'Exercise C: 90-day plan, takeaways, Q&A'],
];

const CROSSWALK = [
  ['820.5 Quality system', '4.1 QMS general', '§820.10(a): document a QMS complying with ISO 13485', 'Risk-based approach to QMS processes (4.1.2 b); outsourced processes (4.1.5); QMS software validation (4.1.6)'],
  ['820.20 Management responsibility', '5.1–5.6', '—', '"Top management" replaces "management with executive responsibility"; management review inputs (5.6.2) now inspectable'],
  ['820.22 Quality audit', '8.2.4 Internal audit', '—', 'Audit reports reviewable by FDA; the audit programme should cover the six QMS Areas and risk integration'],
  ['820.25 Personnel', '6.2 Human resources', '—', 'Competence on education, training, skills and experience; training effectiveness proportionate to risk; records'],
  ['820.30 Design controls', '7.3.1–7.3.10', '§820.10(c) applicability by class', 'Design and development file (7.3.10); the explicit independent reviewer of 820.30(e) is not carried over (7.3.5); risk management in 7.1'],
  ['820.40 Document controls', '4.2.4 (records 4.2.5)', '§820.35', '"Document" means establish, implement and maintain (Clause 0.2); records readily identifiable and retrievable'],
  ['820.50 Purchasing controls', '7.4.1–7.4.3', '—', 'Evaluation criteria, monitoring and re-evaluation proportionate to risk; supplier audit reports reviewable; outsourced processes under 4.1.5'],
  ['820.60 Identification', '7.5.8', '§820.10(b)(1)', 'UDI system documented per Part 830; UDI recorded per device or batch (§820.35(c))'],
  ['820.65 Traceability', '7.5.9.1, 7.5.9.2', '§820.10(b)(2), §820.10(d)', 'Old 820.65 withdrawn; implant traceability (7.5.9.2) extended to life-supporting and life-sustaining devices'],
  ['820.70 Production and process controls', '7.5.1, 6.3, 6.4.1, 6.4.2, 7.5.2', '§820.45', 'Contamination control (6.4.2); process agents (7.5.2); software validation (4.1.6, 7.5.6, 7.6)'],
  ['820.72 Inspection, measuring and test equipment', '7.6', '—', 'Also requires validation of software used for monitoring and measurement (cited in the Linemaster Warning Letter)'],
  ['820.75 Process validation', '7.5.6; 7.5.7 sterilization and sterile barrier systems', '—', 'The QMSR does not define "process validation"; revalidation criteria must be defined; 7.5.7 is explicit for sterile devices'],
  ['820.80 / 820.86 Acceptance activities and status', '7.4.3, 8.2.6, 7.5.8', '—', 'Purchased product verification proportionate to risk; product status identification'],
  ['820.90 Nonconforming product', '8.3.1–8.3.4', '§820.3(b) rework definition; §820.10(b)(4)', 'Concessions need justification and approval (8.3.2); rework only before release for distribution; post-distribution actions are Part 806'],
  ['820.100 Corrective and preventive action', '8.5.1, 8.5.2, 8.5.3 (with 8.4, 8.2.1)', '—', 'Correction, corrective action and preventive action are distinct (ISO 9000); effectiveness verified; feedback as an input'],
  ['820.120 / 820.130 Device labeling and packaging', '7.5.1', '§820.45', 'Five-point examination before release or storage; documented release; mix-up prevention; human oversight of automated readers'],
  ['820.140 / 820.150 / 820.160 Handling, storage, distribution', '7.5.11; 7.5.9.2', '§820.10(d)', 'Risk-based preservation of product; consignee distribution records where 7.5.9.2 applies; obsolete product covered by 7.5.11'],
  ['820.170 Installation', '7.5.3', '—', 'No FDA supplement'],
  ['820.180 Records, general requirements', '4.2.5', '§820.35(a)–(d)', 'The §820.180(c) exemption for management review, quality audit and supplier audit reports is removed; confidentiality marking retained in §820.35(d)'],
  ['820.181 Device master record', '4.2.3 Medical device file', '—', 'Specifications, production, measuring, monitoring and servicing procedures and installation requirements now live in the medical device file'],
  ['820.184 Device history record', '7.5.1 (with 7.5.8, 7.5.9)', '§820.35(c)', 'No defined record type; content required in the medical device or batch record; UDI recorded per device or batch'],
  ['820.186 Quality system record', '4.2 QMS documentation', '—', 'No defined record type; quality manual (4.2.2), documents (4.2.4) and records (4.2.5)'],
  ['820.198 Complaint files', '8.2.1 feedback, 8.2.2 complaint handling, 8.2.3 reporting', '§820.35(a); §820.10(b)(3)', 'Seven record elements; documented justification when a similar complaint was already investigated; MDR evaluation under Part 803'],
  ['820.200 Servicing', '7.5.4', '§820.35(b)', 'Six servicing record elements including UDI; servicing records analysed to decide whether the information is a complaint'],
  ['820.250 Statistical techniques', '8.4 Analysis of data', '—', 'Documented procedures for analysis of data; FDA recommends quantitative data commensurate with risk'],
];

const TERMS = [
  ['Quality System Regulation; quality system', 'Quality Management System Regulation; quality management system', 'Rename the manual scope; cite 21 CFR 820 and ISO 13485:2016'],
  ['Management with executive responsibility', 'Top management (ISO 9000 definition)', 'The expectation of executive-led quality culture is unchanged'],
  ['Establish (define, document, implement)', 'Document (establish, implement, maintain), Clause 0.2', 'FDA treats "document" as the broader word'],
  ['Device master record (DMR)', 'Medical device file (4.2.3)', 'The rework definition and §820.45(c) both reference the medical device file'],
  ['Design history file (DHF)', 'Design and development file (7.3.10)', 'Legacy files need not be retitled'],
  ['Device history record (DHR)', 'Medical device or batch record (7.5.1); UDI per §820.35(c)', 'No defined term; the content is still required'],
  ['Quality system record', 'QMS documentation (4.2)', 'No defined term'],
  ['Manufacturing material', 'Process agent (7.5.2)', 'Assess and control commensurate with risk; removal expected where it affects product'],
  ['Nonconformance', 'Nonconformity (ISO 9000)', ''],
  ['Corrective and preventive action (CAPA)', 'Correction; corrective action (8.5.2); preventive action (8.5.3) under Improvement (8.5)', 'Separate clauses, separate triggers and records'],
  ['Complaint files', 'Feedback (8.2.1); complaint handling (8.2.2); reporting to regulatory authorities (8.2.3)', 'Plus the §820.35(a) record content'],
  ['Statistical techniques', 'Analysis of data (8.4)', ''],
  ['Reasonably accessible; readily available', 'Readily identifiable and retrievable (4.2.5)', 'Remote records: producible by the next working day or two'],
  ['Risk analysis (old 820.30(g))', 'Risk management throughout the QMS (4.1.2, 7.1, 7.3, 7.4, 7.5, 7.6, 8.2)', 'ISO 14971 is not incorporated by reference'],
];

const AREAS = [
  ['Management Oversight', '14', 'QMS 4.1.1–4.1.4 · risk-based approach 4.1.2 b) · QMS software validation 4.1.6 · quality manual 4.2.2 · medical device file 4.2.3 · control of documents and records 4.2.1, 4.2.4, 4.2.5 with §820.35 and §820.45 · management commitment 5.1 · customer focus 5.2 · quality policy, objectives and planning 5.3, 5.4.1, 5.4.2 · responsibility, authority and communication 5.5.1–5.5.3 · management review 5.6.1–5.6.3 · provision of resources 6.1 · human resources 6.2 · planning of product realization 7.1'],
  ['Design and Development', '12', 'Customer-related processes 7.2.1–7.2.3 with §820.10(b)(4) · general 7.3.1 · planning 7.3.2 · inputs 7.3.3 · outputs 7.3.4 · review 7.3.5 · verification 7.3.6 · software validation and validation 7.3.7 · transfer 7.3.8 · control of changes 7.3.9 · files 7.3.10'],
  ['Production and Service Provision', '11', 'Infrastructure and maintenance 6.3 · work environment and contamination control 6.4.1, 6.4.2 · control of production and service provision 7.5.1 with §820.35 and §820.45 · cleanliness of product 7.5.2 · installation and servicing 7.5.3, 7.5.4 with §820.35 · validation of processes 7.5.6 · sterile devices and sterilization validation 7.5.5, 7.5.7 · identification and traceability 7.5.8, 7.5.9.1, 7.5.9.2 with §820.10(b)(1)(2), §820.35, §820.45 · customer property 7.5.10 · preservation of product 7.5.11 · monitoring and measuring equipment 7.6'],
  ['Measurement, Analysis and Improvement', '10', 'General 8.1, 8.5.1 · feedback 8.2.1 · complaint handling 8.2.2, 8.2.3 with §820.10(b)(3)(4) and §820.35 · internal audits 8.2.4 · monitoring and measurement of processes 8.2.5 · of product 8.2.6 · control of nonconforming product 8.3.1–8.3.4 with §820.10(b)(4) · analysis of data 8.4 · corrective action 8.5.2 · preventive action 8.5.3'],
  ['Outsourcing and Purchasing', '3', 'Outsourcing 4.1.5 · purchasing process 7.4.1 · purchasing information and purchased product 7.4.2, 7.4.3'],
  ['Change Control', '4', 'QMS changes 4.1.4, 4.2.4, 4.2.5, 5.4.2, 5.6.1–5.6.3, 8.5.1 · software changes 4.1.6, 7.5.6, 7.6 · product and process changes 4.1.4, 7.2.2, 7.3.9, 7.3.10, 7.5.6, 7.5.7 · purchasing changes 7.4.2, 7.4.3'],
];

const OAFRS = [
  ['Medical Device Reporting', '21 CFR 803; §820.10(b)(3)', 'Device-related deaths, serious injuries and malfunctions identified, investigated, reported and documented on time'],
  ['Reports of Corrections and Removals', '21 CFR 806; §820.10(b)(4)', 'FDA promptly notified of corrections and removals that reduce a risk to health or remedy a violation'],
  ['Medical Device Tracking', '21 CFR 821; §820.10(b)(2)', 'Tracked devices can be located and removed, and patients notified; evaluated where a tracking order was issued'],
  ['Unique Device Identification', '21 CFR 830; §820.45; §820.10(b)(1)', 'UDI assigned as required and device information correctly submitted and recorded in GUDID'],
];

const METRICS = [
  ['CP 7382.850 elements with evidence sampled in the last 12 months', '100%', 'Gap workbook'],
  ['Open inspection-critical gaps (high exposure, true regulatory gap)', '0', 'Gap workbook'],
  ['Median time to produce a requested record', '15 minutes or less', 'Retrieval drills'],
  ['Complaint records complete against the §820.35(a) elements', '100%', 'Complaint system audit'],
  ['Servicing records with UDI and all required elements', '100%', 'Service records audit'],
  ['Lots with a documented five-point label examination and release', '100%', 'Batch records'],
  ['Risk files updated after complaint, CAPA or change triggers', '100% within the defined time', 'Risk management system'],
  ['CAPAs closed with effectiveness data', '100%', 'CAPA system'],
  ['Critical suppliers with risk-tiered controls and a current evaluation', '100%', 'Supplier files'],
  ['Internal audit coverage of the six QMS Areas and four OAFRs', 'All areas each cycle', 'Audit programme'],
  ['Management review actions closed on time', '95% or more', 'Management review log'],
  ['Competence verified for high-risk processes (beyond read-and-sign)', '100%', 'Training records'],
];

const SELFTEST = [
  'Your quality manual scope cites 21 CFR 820 (QMSR) and ISO 13485:2016, and names the roles you perform.',
  'No procedure, form or audit checklist cites a section that no longer exists (820.30, 820.50, 820.100, 820.180, 820.198) as current law.',
  'Every complaint record carries all seven §820.35(a) elements, including UDI, and a documented Part 803 reportability evaluation.',
  'Every servicing record carries the six §820.35(b) elements, and servicing records are analysed for complaints.',
  'Each lot has a signed, element-by-element label examination and a documented labeling release under §820.45.',
  'The UDI is recorded for each device or batch, and GUDID entries match the labels in use.',
  'Your last two management reviews contain every Clause 5.6.2 input, recorded decisions, resource commitments and follow-up of prior actions.',
  'Your internal audit programme covers the six QMS Areas and four OAFRs, and tests how risk management is integrated.',
  'Supplier controls are tiered by risk, and each critical supplier has a current evaluation with monitoring evidence.',
  'Every complaint, CAPA and change in the last year shows a documented update to, or assessment against, the risk file.',
  'Your documented design and development applicability decision under §820.10(c) is current for every product family.',
  'You can produce any requested record within 15 minutes, including records created before 2 February 2026.',
  'You have run a mock inspection under the model that applies to you (Model 1, or Model 2 for a first-time site or PMA).',
  'Front-room staff can answer "show me how risk informed this decision" in three parts without reciting a procedure number.',
];

const REFS_REG = [
  '21 CFR Part 820, Quality Management System Regulation (as in force from 2 February 2026): §820.1, §820.3, §820.7, §820.10, §820.35, §820.45',
  'Final rule: Medical Devices; Quality System Regulation Amendments, 89 FR 7496 (2 February 2024), Docket FDA-2021-N-0507, RIN 0910-AH99',
  'Correction, 89 FR 82945 (15 October 2024): restores the "batch or lot" definition in §820.3(a)',
  'Proposed rule, 87 FR 10119 (23 February 2022), including Table 1, FDA\'s only official subpart-level mapping',
  'Medical Devices; Quality Management System Regulation Technical Amendments, 90 FR 55978 (4 December 2025): 179 sections in 18 parts',
  '21 CFR 4.2 and 4.4 (combination products); 21 CFR Parts 803, 806, 821, 830; 21 CFR Part 11',
  'ISO 13485:2016(E), third edition; ISO 9000:2015(E) Clause 3 (read-only at no cost via the ANSI IBR portal, ibr.ansi.org)',
];
const REFS_FDA = [
  'FDA, Quality Management System Regulation (QMSR) web page, and Quality Management System Regulation Frequently Asked Questions (13 questions; content current as of 2 February 2026)',
  'Compliance Program 7382.850, Inspection of Medical Device Manufacturers (implementation date 2 February 2026), including Attachment A (QMS Areas, OAFRs, elements and requirements) and Attachment B (Remote Regulatory Assessments)',
  'CDRH webinar, Quality Management System Regulation: Key Takeaways (16 December 2025); town halls on Risk and Design and Development (14 January 2026) and Medical Device Risk-Based Inspections (1 April 2026): slides and transcripts on CDRH Learn',
  'Warning Letters from QMSR-era inspections: Linemaster Switch Corporation (27 May 2026); Koven Technologies, Inc. (21 July 2026); Nipro Renal Solutions USA (24 July 2026)',
  'FDA Inspection Observations data, FY2025 (fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations)',
  'AAMI TIR102:2019, U.S. FDA 21 CFR mapping to the applicable regulatory requirement references in ISO 13485:2016 (listed on FDA\'s QMSR page; maps the former Part 820)',
];

// =====================================================================
// 1. PARTICIPANT HANDOUT
// =====================================================================
function handout() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  PARTICIPANT HANDOUT', 'QMSR Transition', 'A strategic roadmap for shifting from FDA Part 820 to the Quality Management System Regulation',
    ['**Format:** 90-minute seminar with table exercises', '**Presented by:** Elder Consulting, LLC   ·   **Speaker:** ____________________   ·   **Date:** ____________', '**Companion documents:** Workshop Exercise Pack; Gap Assessment Workbook (spreadsheet)']));

  c.push(h1('1. About this session'));
  c.push(p('The Quality Management System Regulation took effect on 2 February 2026. It replaced the Quality System Regulation, incorporated ISO 13485:2016 by reference, and reduced Part 820 to six operative sections. On the same day FDA withdrew the Quality System Inspection Technique and began inspecting under Compliance Program 7382.850. FDA has said the transition period has ended and that it will enforce the QMSR; there is no phase-in and no announced enforcement discretion.'));
  c.push(p('This seminar is therefore not about what is coming. It is about finishing the transition where it is unfinished and proving it on the first inspection under the new process. The first Warning Letters from QMSR inspections were issued in May and July 2026, and every one of them cites ISO 13485:2016 Clause 7.1, risk management in product realization.'));
  c.push(h3('By the end of the session you will be able to'));
  c.push(...bullets([
    'State precisely what changed in the regulation, what did not, and which widely repeated claims are wrong.',
    'Apply the four FDA-specific provisions that ISO 13485 alone does not satisfy: the §820.10 hooks, §820.35 records, §820.45 labeling and packaging controls, and the §820.3 definitions.',
    'Describe how an inspection now runs: six QMS Areas, four Other Applicable FDA Requirements, two inspection models, no sampling tables, risk management as the roadmap.',
    'Write management review, internal audit and supplier audit records knowing FDA may read them.',
    'Run an exposure-weighted, evidence-based gap assessment instead of a flat crosswalk.',
    'Build a phased roadmap with deliverables, exit criteria and five metrics for management review.',
  ]));
  c.push(h3('Agenda'));
  c.push(table(['Time', 'Segment'], AGENDA, [1700, 8380]));
  c.push(small('This handout states dates, citations and quotations as verified in September 2026. Regulations, guidance and FDA web content change; verify against the primary sources before relying on any statement here.'));

  c.push(h1('2. What changed on 2 February 2026'));
  c.push(h2('2.1 Timeline'));
  c.push(table(['Date', 'Event'], [
    ['23 February 2022', 'Proposed rule published, 87 FR 10119; comment period closed 24 May 2022. FDA received fewer than 100 timely comments.'],
    ['2 February 2024', 'Final rule published, 89 FR 7496 (codified text at 89 FR 7523). FDA\'s FAQ page describes the rule as issued on 31 January 2024, the public-inspection date.'],
    ['15 October 2024', 'Correction, 89 FR 82945: the "batch or lot" definition, omitted from the codified text, is restored to §820.3(a).'],
    ['4 December 2025', 'Technical amendments, 90 FR 55978: 179 sections across 18 CFR parts re-pointed from §820.180, §820.198 and §820.30 to §820.35 and §820.10(c). Editorial only; no new requirements.'],
    ['16 December 2025', 'CDRH webinar, Quality Management System Regulation: Key Takeaways.'],
    ['14 January 2026', 'CDRH town hall on risk and design and development.'],
    ['2 February 2026', 'The QMSR takes effect. QSIT is withdrawn. Compliance Program 7382.850 supersedes CP 7382.845 and CP 7383.001.'],
    ['1 April 2026', 'CDRH town hall on medical device risk-based inspections. FDA: "the transition period has ended ... companies need to be compliant with the QMSR now."'],
    ['May – July 2026', 'First Warning Letters from QMSR-era inspections: Linemaster Switch Corporation (27 May), Koven Technologies (21 July), Nipro Renal Solutions USA (24 July).'],
  ], [1900, 8180]));

  c.push(h2('2.2 The new Part 820'));
  c.push(p('Part 820 now has two active subparts. Subpart A contains §820.1 Scope, §820.3 Definitions, §820.5 [Reserved], §820.7 Incorporation by reference and §820.10 Requirements for a quality management system. Subpart B contains §§820.20–820.30 [Reserved], §820.35 Control of records, §820.40 [Reserved] and §820.45 Device labeling and packaging controls. Subparts C through O are reserved.'));
  c.push(table(['Section', 'What it does', 'What to check in your QMS'], [
    ['§820.1 Scope', 'CGMP requirements for the design, manufacture, packaging, labeling, storage, installation and servicing of finished devices for human use. Components and blood components are excluded; HCT/Ps regulated as devices are included. Where ISO 13485 clauses conflict with the FD&C Act or its other implementing regulations, the Act and regulations control. A manufacturer engaged in only some operations need comply only with the requirements applicable to those operations.', 'The quality manual scope statement cites 21 CFR 820 and ISO 13485:2016, and names the roles you perform (specification developer, relabeler, contract sterilizer, initial distributor of a foreign entity).'],
    ['§820.3 Definitions', 'ISO 13485 and ISO 9000 Clause 3 definitions apply, except as specified. Paragraph (a) adds six FDA-only terms. Paragraph (b) makes FD&C Act §201 definitions prevail and supersedes five ISO terms.', 'A controlled definitions table; no procedure depends on a definition FDA dropped (design validation, process validation, process agent, top management as a QSR term).'],
    ['§820.7 Incorporation by reference', 'ISO 13485:2016(E), third edition, 1 March 2016 (for §§820.1, 820.3, 820.10, 820.35 and 820.45); ISO 9000:2015(E) Clause 3 (for §820.3).', 'A controlled copy is available to the people who need it. Read-only access is free at the ANSI IBR portal.'],
    ['§820.10 Requirements', '(a) Document a QMS complying with the applicable requirements of ISO 13485 and this part. (b) Comply with other applicable requirements in Title 21, including Parts 830, 821, 803 and 806. (c) Design and development (Clause 7.3) for Class II, Class III and listed Class I devices. (d) Clause 7.5.9.2 traceability for devices that support or sustain life. (e) Noncompliance renders a device adulterated under FD&C Act §501(h).', 'A procedure index cross-referenced to ISO clauses and the §820.10(b) hooks, plus a documented Clause 7.3 applicability decision per product family.'],
    ['§820.35 Control of records', 'Adds FDA-specific content to Clause 4.2.5: complaint records, servicing records, UDI recording, confidentiality marking.', 'Complaint and service record templates carry every element (see section 3.1).'],
    ['§820.45 Device labeling and packaging controls', 'Adds to Clause 7.5.1: documented procedures; five-point examination before release or storage; documented release of labeling; mix-up prevention with documented inspection before use.', 'A signed, element-by-element label examination and release record per lot (see section 3.2).'],
  ], [1900, 4380, 3800], { size: 18 }));

  c.push(h3('There is no §820.15'));
  c.push(p('The 2022 proposed rule contained a §820.15 "Clarification of concepts". FDA deleted it in the final rule and moved the clarifications into §820.3(b), keeping "organization" and "safety and performance" but dropping the "validation of processes" clarification. Any procedure, checklist or crosswalk that cites §820.15 as current law is out of date.'));

  c.push(h2('2.3 Which definition wins'));
  c.push(table(['Priority', 'Source', 'Terms'], [
    ['1', 'FD&C Act section 201', 'Device, labeling and every other statutory term prevail over the correlating ISO 13485 terms (medical device, labelling).'],
    ['2', '§820.3(b) superseding terms', 'Implantable medical device (the meaning of "implant" in 21 CFR 860.3) · Manufacturer · Organization (means manufacturer) · Rework (action on nonconforming product so it will meet the specified requirements in the medical device file before release for distribution) · Safety and Performance (the meaning of "safety and effectiveness" in Clause 0.1 of ISO 13485 only)'],
    ['3', '§820.3(a) FDA-only terms', 'Batch or lot · Component · Federal Food, Drug, and Cosmetic Act · Finished device · HCT/P regulated as a device · Remanufacturer'],
    ['4', 'ISO 13485 Clause 3 and ISO 9000:2015 Clause 3', 'Customer, top management, nonconformity, verification, validation, product, correction, corrective action, preventive action, risk and the rest'],
  ], [1000, 2800, 6280]));
  c.push(small('FDA narrowed the "safety and performance" clarification in the final rule after commenters observed that the phrases are not interchangeable: it now applies only within Clause 0.1 of the ISO 13485 Introduction. §820.1(a) states that the use of other terminology does not change the statutory safety-and-effectiveness standard.'));

  c.push(h2('2.4 What disappeared, and where the requirement lives now'));
  c.push(table(['Gone from Part 820', 'Where the requirement lives now'], [
    ['Device master record (§820.181)', 'Medical device file, Clause 4.2.3: the procedures and specifications current on the manufacturing floor. FDA: the final design output forms the basis or starting point for the medical device file.'],
    ['Design history file (§820.30(j))', 'Design and development file, Clause 7.3.10.'],
    ['Device history record (§820.184)', 'Medical device or batch records, Clause 7.5.1 (with 7.5.8 and 7.5.9); UDI recorded per §820.35(c).'],
    ['Quality system record (§820.186)', 'QMS documentation, Clause 4.2 (quality manual 4.2.2, documents 4.2.4, records 4.2.5).'],
    ['"Management with executive responsibility" (§820.3(n))', '"Top management", ISO 9000 definition. FDA still expects a quality culture led by individuals with executive responsibility.'],
    ['Independent design reviewer (§820.30(e))', 'Clause 7.3.5: representatives of the functions concerned with the stage under review, plus other specialist personnel. FDA considers this adequate flexibility.'],
    ['§820.180(c) exemption for management review, quality audit and supplier audit reports', 'Removed. FDA may inspect these records. They are expected to be reviewed in baseline surveillance and PMA preapproval inspections and may be reviewed in any other inspection.'],
    ['Statistical techniques (§820.250)', 'Analysis of data, Clause 8.4.'],
    ['CAPA as a single section (§820.100)', 'Corrective action (8.5.2) and preventive action (8.5.3) under Improvement (8.5).'],
    ['Traceability control numbers (§820.65)', 'Clause 7.5.9.1 and 7.5.9.2, extended by §820.10(d) to devices that support or sustain life.'],
    ['QSIT; Compliance Program 7382.845; CP 7383.001', 'Compliance Program 7382.850: six QMS Areas, four OAFRs, two inspection models, PMA inspections included.'],
  ], [3400, 6680]));

  c.push(h2('2.5 What did not change'));
  c.push(table(['Still true', 'Over'], [
    [['FDA does not require ISO 13485 certification, will not accept a certificate in lieu of an inspection or an establishment inspection report, and will not issue certificates of conformity.', 'A notified body ISO 13485 audit does not satisfy the internal audit requirement of Clause 8.2.4, though findings may supplement it.', 'MDSAP continues. FDA uses MDSAP audit reports in place of routine surveillance inspections; sites actively enrolled are not scheduled for surveillance inspections.', 'Parts 803, 806, 821 and 830 are unchanged and are now hooked into the QMS through §820.10(b). Part 11 was not amended.', 'The scope of "manufacturer" is unchanged, including contract sterilizers, relabelers, remanufacturers, specification developers and initial distributors of foreign entities.', 'Class I CGMP exemptions are retained; exempt manufacturers still keep complaint files and §820.35 records.', 'Design and development applicability is preserved: Class II, Class III and the listed Class I devices.'],
     ['The two-year transition. There is no phase-in, no grace period and no announced enforcement discretion.', 'Every inspection since 2 February 2026 is conducted to the QMSR, including compliance follow-ups after a Warning Letter or consent decree.', 'The threshold for compliance action is unchanged, but the Situation 1 (OAI) examples were rewritten around risk management.', 'The idea that pre-2026 records are out of scope. FDA does not expect them to be revised or recreated, but they may be reviewed if the inspection leads there.', 'Old QSR citations in procedures, audit checklists and 483 responses. Practice reports from 2026 inspections describe firms still using the QSR subpart structure being flagged early.', 'The assumption that management review and audit records are private.']],
  ], [5040, 5040], { boldFirst: false }));

  c.push(h1('3. The four load-bearing FDA-specific provisions'));
  c.push(p('FDA stated in the final rule that compliance with ISO 13485 alone does not fully satisfy the QMSR, and that compliance with the QMSR will largely satisfy ISO 13485. The difference lives in four places.'));
  c.push(h2('3.1 §820.35 Control of records'));
  c.push(p('In addition to Clause 4.2.5, the manufacturer must include specified information in certain records. Use this as a field-level checklist against your templates.'));
  c.push(table(['Paragraph', 'Requirement'], [
    ['(a) Records of complaints', ['In addition to Clause 8.2.2, maintain records of the review, evaluation and investigation of any complaint involving the possible failure of a device, labeling or packaging to meet any of its specifications.', 'If an investigation has already been performed for a similar complaint, another is not necessary, but records documenting the justification for not investigating must be maintained.', 'For complaints reportable under Part 803, complaints the manufacturer determines must be investigated, and complaints investigated regardless, record: (1) the name of the device; (2) the date the complaint was received; (3) any UDI or UPC and any other device identification; (4) the name, address and phone number of the complainant; (5) the nature and details of the complaint; (6) any correction or corrective action taken; (7) any reply to the complainant.']],
    ['(b) Records of servicing activities', ['In adhering to Clause 7.5.4, record at a minimum: (1) the name of the device serviced; (2) any UDI or UPC and other device identification; (3) the date of service; (4) the individual(s) who serviced the device; (5) the service performed; (6) any test and inspection data.', 'FDA clarified that (b)(6) applies where the QMS generates such data as part of servicing, not to all servicing activities.']],
    ['(c) Unique Device Identification', ['In addition to Clauses 7.5.1, 7.5.8 and 7.5.9, the UDI must be recorded for each medical device or batch of medical devices.', 'FDA does not read this to require a UDI for devices under development, because Part 830 applies to devices in commercial distribution.']],
    ['(d) Confidentiality', ['Records deemed confidential by the manufacturer may be marked to aid FDA in determining whether information may be disclosed under Part 20.', 'Marking aids disclosure decisions; it is not a bar to review. Mark before an inspection, and do not redact records handed over.']],
  ], [2100, 7980]));
  c.push(small('FDA removed from the proposed §820.35 the requirement to obtain the signature and date of each approver on every record. Where ISO 13485 uses "approved", FDA takes that to mean the document or record carries a signature and date; electronic methods that meet FDA\'s electronic-signature requirements are acceptable.'));

  c.push(h2('3.2 §820.45 Device labeling and packaging controls'));
  c.push(p('In addition to Clause 7.5.1, each manufacturer must document and maintain procedures giving a detailed description of the activities that ensure the integrity, inspection, storage and operations for labeling and packaging during the customary conditions of processing, storage, handling, distribution and, as appropriate, use of the device.'));
  c.push(...checks([
    'Labeling and packaging examined for accuracy prior to release or storage, covering: the correct UDI or UPC or other device identification; expiration date; storage instructions; handling instructions; any additional processing instructions.',
    'The release of the labeling for use documented in accordance with Clause 4.2.5.',
    'Labeling and packaging operations established and maintained to prevent mix-ups, including inspection of the labeling and packaging before use to assure that all devices have correct labeling and packaging as specified in the medical device file.',
    'Results of that labeling inspection documented in accordance with Clause 4.2.5.',
    'Where automated readers are used, a designated individual examines at a minimum a representative sample of the labels checked.',
    'Label stock stored under control; label content changes flow through design change control (7.3.9) and the medical device file.',
  ]));
  c.push(small('FDA retained these controls because Clause 7.5.1(e) only requires that defined labeling and packaging operations be implemented and does not address inspection of labeling, and because many device recalls relate to labeling and packaging. Wording changed from the proposal: "establish" became "document", "where appropriate" became "as appropriate", and "immediately" before use was removed.'));

  c.push(h2('3.3 §820.10(b) hooks into the rest of Title 21'));
  c.push(table(['ISO 13485 clause', 'QMSR hook', 'What to have ready'], [
    ['7.5.8 Identification', '§820.10(b)(1): document a system to assign UDI per Part 830', 'UDI procedure; GUDID records that match labels in use; UDI recorded per device or batch'],
    ['7.5.9.1 Traceability, general', '§820.10(b)(2): traceability procedures per Part 821, if applicable', 'Tracking procedures and records where a tracking order applies'],
    ['8.2.3 Reporting to regulatory authorities', '§820.10(b)(3): notify FDA of complaints meeting the Part 803 reporting criteria', 'MDR procedures (Part 803.17); documented reportability evaluations with rationale; submission timeliness'],
    ['7.2.3, 8.2.3, 8.3.3 Advisory notices', '§820.10(b)(4): handle advisory notices per Part 806', 'Corrections and removals procedure; Part 806 reports and documented decisions not to report'],
  ], [2300, 3500, 4280]));
  c.push(small('FDA said the §820.10(b) list is not comprehensive: manufacturers remain responsible for identifying and meeting every applicable requirement, including Part 807 registration and listing, which is not named in §820.10.'));

  c.push(h2('3.4 Special cases'));
  c.push(table(['Situation', 'What applies'], [
    ['Drug-led combination products using the streamlined approach (21 CFR 4.4(b)(1))', 'ISO 13485 Clause 4.1, Clause 5 and its subclauses, Clause 6.1, plus §820.10; Clause 7.3 and its subclauses plus documented processes for risk management in product realization with records maintained; Clause 7.4 and subclauses; Clause 8.2.2 and §820.35(a), Clause 8.4 and Clause 8.5 and subclauses; Clause 7.5.3; Clause 7.5.4 and §820.35(b). A device constituent part is a finished device under the QMSR. Combination products are outside MDSAP for FDA.'],
    ['Class I and CGMP-exempt devices', 'Clause 7.3 applies only to Class I devices automated with computer software and the five device types listed in §820.10(c)(2). Document the exclusion and its justification. Exemption from CGMP does not exempt a manufacturer from complaint files or the records required by §820.35. Devices under an investigational device exemption are not exempt from design and development.'],
    ['Contract manufacturers, specification developers, importers', 'All are "manufacturers" under §820.3(b). A contract manufacturer is expected to document risk management in product realization under Clause 7.1 regardless of who owns the design. A specification developer applies design and development and supplier controls over the contract manufacturer. An initial importer that performs no design need not apply Clause 7.3 but must handle complaints, MDR, distribution records and traceability.'],
  ], [3000, 7080]));

  c.push(h1('4. How an inspection runs now'));
  c.push(h2('4.1 What replaced QSIT'));
  c.push(table(['QSIT (1999 – 1 February 2026)', 'Compliance Program 7382.850 (from 2 February 2026)'], [
    [['Four subsystems: Management Controls, Design Controls, CAPA, Production and Process Controls.', 'A "top-down" approach; Level 1 abbreviated and Level 2 comprehensive inspections.', 'Sampling tables prescribed how many records to review.', 'Management review, internal audit and supplier audit reports exempt from review.', 'A separate compliance program for PMA inspections.'],
     ['Six QMS Areas and four Other Applicable FDA Requirements; a total product life cycle assessment.', 'The investigator reviews risk management documentation throughout and uses critical thinking to select elements; the areas need not be evaluated in any order.', 'No sampling tables. Records are selected on identified product risks and the investigator\'s experience and professional knowledge; in most cases multiple records are reviewed.', 'Management review, quality audit and supplier audit records are in scope.', 'Two inspection models and seven inspection types, including PMA preapproval and postmarket. Cybersecurity for cyber devices and Remote Regulatory Assessments are addressed.']],
  ], [5040, 5040], { boldFirst: false }));
  c.push(p('The stated goal of an FDA device inspection is to evaluate whether the manufacturer\'s QMS meets FDA requirements and provides reasonable assurance that devices will be safe and effective, and whether risk management and risk-based decision making are effectively used in the QMS.'));

  c.push(h2('4.2 The six QMS Areas'));
  c.push(table(['QMS Area', 'Elements', 'Requirements (ISO 13485 clauses and QMSR sections)'], AREAS.map(a => [a[0], a[1], a[2]]), [2100, 900, 7080], { size: 17 }));
  c.push(h3('The four Other Applicable FDA Requirements'));
  c.push(table(['OAFR', 'Requirements', 'Purpose'], OAFRS, [2400, 2600, 5080]));
  c.push(small('The OAFRs are evaluated during all risk-based inspections except PMA preapproval inspections (tracking only where a tracking order was issued). All four must be reviewed during a PMA postmarket inspection.'));

  c.push(h2('4.3 Inspection types and models'));
  c.push(table(['Inspection type', 'Situation', 'Model'], [
    ['Non-baseline surveillance', 'The most recent FDA device inspection or MDSAP audit was classified NAI or VAI; the site is not currently enrolled in MDSAP', '1'],
    ['Baseline surveillance', 'No FDA device inspection or MDSAP audit history, or risk factors indicate a need; not currently enrolled in MDSAP', '2'],
    ['Compliance follow-up', 'A previous FDA inspection or MDSAP audit resulted in regulatory action; includes monitoring of post-injunction activities', '1'],
    ['For-cause', 'A signal, issue or complaint: prior observations, recalls and removals, MDRs, follow-up to a Remote Regulatory Assessment, MDSAP regulatory audit review', '1'],
    ['Specific Product Risk Assignment', 'A specific product risk identified by FDA', '1'],
    ['PMA preapproval', 'A PMA application; if required validations are incomplete the inspection should be delayed', '2'],
    ['PMA postmarket', 'Eight to twelve months after approval', '1'],
  ], [2300, 6980, 800]));
  c.push(h3('Model 1'));
  c.push(p('Identify product risks that could adversely affect patients or users, then select a minimum of one element to evaluate requirements in each of the six QMS Areas, plus all four OAFRs, plus the general items: registration and listing, marketing authorizations, previous 483 and compliance issues, and any areas defined in the assignment.'));
  c.push(h3('Model 2'));
  c.push(p('Evaluate a prescribed minimum list of elements: Product and Process Changes; the design and development elements from inputs through transfer, including software validation; Management Review, Medical Device File and Planning of Product Realization; Analysis of Data, Control of Nonconforming Product, Complaint Handling, Feedback, Internal Audits, Corrective Action and Preventive Action; Validation of Processes, Control of Production and Service Provision, Identification and Traceability, and, for sterile product, Sterile Medical Devices and Validation of Processes for Sterilization and Sterile Barrier Systems; Outsourcing; plus all four OAFRs. That is 22 elements, or 23 for sterile product.'));
  c.push(small('FDA has stressed that both models define minimum requirements and are intentionally flexible: it is normal and expected for investigators to examine additional elements. Surveillance inspections are not conducted at sites actively enrolled in MDSAP, but MDSAP participants may be inspected under compliance follow-up, for-cause and Specific Product Risk Assignment assignments.'));

  c.push(h2('4.4 Risk management as the roadmap'));
  c.push(...bullets([
    '**Before the inspection** the investigator may review MDRs, reports of corrections and removals, Device Identifier records in GUDID, consumer and trade complaints, the Total Product Lifecycle report and FDA\'s compliance management system.',
    '**During the inspection** the sources are complaints and customer feedback, postmarket surveillance, risk management documentation, monitoring and measurement of product and processes, process and product trends, and servicing data.',
    '**The thread**: from an identified product risk into complaint handling, change control, purchasing and outsourcing, production controls, CAPA and management review. Evaluating one requirement may require evaluating others in different areas.',
    '**Administrative processes**: FDA has said manufacturers need not create separate risk assessments for processes such as document control or training. Reference the product risk documentation and document the decision.',
  ]));
  c.push(h3('Situation 1 (OAI) examples, as rewritten for the QMSR'));
  c.push(...bullets([
    'Failure to establish, implement or maintain one or more elements of the QMS Areas or OAFRs.',
    'Distribution of nonconforming product that has caused or may result in injury or death without effective mitigation or adequate corrective action.',
    'Failure to establish, implement or maintain one or more processes for risk management in product realization.',
    'Failure to monitor, measure, analyse and improve processes that have demonstrated adverse impact on the finished product or patient safety.',
    'Failure to analyse data adequately, or to use current risk information, resulting in a decision not to investigate or take corrective action.',
    'Failure to correct the same or similar significant deficiencies from previous inspections.',
    'Feedback or postmarket surveillance information not used as an input to risk management.',
    'Failure to control design and development, including not adequately evaluating changes for risk and impact before implementation.',
    'Failure to ensure processes, including changes, are monitored, controlled or evaluated for risk and impact before implementation.',
  ]));
  c.push(callout('Changes that appear to warrant a new 510(k) or PMA where no submission was made should result in an initial OAI classification. Corrections and corrective action plans, with evidence of corrections implemented, are expected in writing within 15 business days after the inspection closes.'));

  c.push(h2('4.5 The records that are no longer shielded'));
  c.push(p('FDA\'s QMSR FAQ, question 8, asks whether FDA intends to review records previously exempt under §820.180(c). The answer: "Yes. The QMSR gives the FDA the authority to inspect management review, quality audits, and supplier audit reports. The exceptions that existed in the QS regulation at § 820.180(c) are not maintained in the QMSR. ... Such records are maintained in the regular course of business and should be readily available upon inspection."'));
  c.push(table(['Record', 'What makes it defensible'], [
    ['Management review minutes', 'Every Clause 5.6.2 input present, including complaint and feedback trends, regulatory reporting, internal and external audit results, supplier performance, process and product monitoring, and CAPA status; decisions and resource commitments recorded (5.6.3); prior actions followed to closure; risk-based prioritisation visible.'],
    ['Internal audit reports', 'Scope tied to product risk and mapped to the six QMS Areas and four OAFRs; findings with an evidence trail; nonconformities linked to CAPA; closure evidence; a programme that finds real problems. Audits that find nothing invite deeper review.'],
    ['Supplier audit reports', 'Scope proportionate to supplier criticality; follow-up on findings; re-evaluation evidence beyond a scorecard; alignment between the product risk assessment and the controls applied.'],
  ], [2400, 7680]));
  c.push(callout(['**Do not sanitize.** FDA emphasised that robust management review and internal and supplier audit programmes are fundamental to a culture of quality. Records that show real problems, real decisions and real follow-through are protective. Empty records are a Management Oversight observation.', '**Do** mark genuinely confidential records under §820.35(d) before an inspection, and produce records promptly. Records kept at remote locations should be produced by the next working day or two.'], GOLDTINT));

  c.push(h2('4.6 How an observation reads'));
  c.push(p('Both early Warning Letters open with the same adulteration sentence and then cite the standard. Linemaster Switch Corporation (27 May 2026, inspection 4 February to 6 March 2026): "Failure to document one or more processes for risk management in product realization, as required by ISO 13485:2016, Clause 7.1. ... Your firm\'s Risk Management procedure TM-112 does not define how risk management activities are performed and documented, who is responsible for conducting and approving risk management activities, when risk management documentation must be updated, and how post-market feedback data (including complaints, adverse events, and recalls) is incorporated into risk management." The same letter also cites Clauses 8.3.4, 8.5.2, 6.4.1 and 7.6.'));
  c.push(p('Koven Technologies (21 July 2026, inspection 2 to 6 February 2026) cites Clauses 7.3.9, 7.1 and 7.4.1, and then a QMSR section directly: "Failure to maintain records of the review, evaluation, and investigation for any complaints involving the possible failure of a device, labeling, or packaging to meet any of its specifications, as required by 21 CFR 820.35(a)."'));
  c.push(small('Every device Form 483 also carries the statement that the observations are not an exhaustive listing of objectionable conditions and that the firm is responsible for conducting internal self-audits. Annotation of the 483 is offered on all device inspections.'));

  c.push(h2('4.7 Early enforcement, on the record'));
  c.push(...bullets([
    'FDA officials reported about 100 QMSR inspections between 2 February and 31 March 2026, and "just north of 100" by 6 May 2026.',
    'The ranked top Form 483 observation areas for February to mid-April 2026: risk management by a wide margin, then outsourcing and purchasing, complaint handling and feedback, unique device identification, and corrective action.',
    'By June 2026 FDA described largely the same citation categories as before the QMSR, reordered.',
    'Recurring deficiencies described by FDA officials: procedures that restate the regulation or the standard without saying what or when; vague or missing risk controls; inconsistent risk scoring between departments; hazards confused with harms; risk analyses not updated with complaint, MDR and recall data; supplier controls not aligned with the product risk assessment.',
    'For comparison, FDA\'s FY2025 inspection observation data record 791 system-generated device Form 483s, with the most cited areas being CAPA procedures (§820.100(a), 279 citations), complaint procedures (§820.198(a), 211), purchasing controls (§820.50, 115), nonconforming product (§820.90(a), 95) and process validation (§820.75(a), 93).',
  ]));
  c.push(small('Percentages in circulation, such as the share of 2026 observations citing ISO clauses or the proportion classified VAI, come from vendor compilations of FDA databases rather than an FDA publication. FDA posts its own fiscal-year citation spreadsheet after the fiscal year ends, so the first official QMSR citation data is expected after 30 September 2026.'));

  c.push(h1('5. From crosswalk to gap assessment'));
  c.push(p('FDA declined to publish a mapping of the QS regulation to the QMSR, saying a one-to-one comparison would be cumbersome and not a useful tool. The only official mapping is the subpart-level Table 1 in the 2022 proposed rule. Every clause-level crosswalk in circulation, including the one below, is industry-authored. Use it to orient, not as evidence.'));
  c.push(h2('5.1 Crosswalk: former QSR section to ISO 13485 clause and QMSR supplement'));
  c.push(table(['Former QSR section', 'ISO 13485:2016 clause(s)', 'QMSR supplement', 'Substantive delta to test with evidence'], CROSSWALK, [2200, 1900, 2200, 3780], { size: 16 }));
  c.push(h2('5.2 Terminology'));
  c.push(table(['QSR term', 'QMSR / ISO 13485 term', 'Note'], TERMS, [2900, 3400, 3780], { size: 17 }));
  c.push(small('FDA does not expect pre-2026 records to be revised, recreated or scrubbed of terms such as design history file or device master record. Practice reports from 2026 inspections, however, describe procedures still organised by QSR subpart and citing repealed sections being read as signs of an incomplete transition. The workable answer is new records in the new vocabulary, a controlled definitions table, and a mapping card for anyone who may sit in front of an investigator.'));

  c.push(h2('5.3 A gap assessment that survives an inspection'));
  c.push(p('A flat crosswalk produces a long, unprioritised list. Score each requirement on three axes instead, and sort by exposure.'));
  c.push(table(['Axis', 'Question', 'Scoring'], [
    ['Regulatory gap', 'Is there a requirement we do not meet?', 'Yes / No'],
    ['Inspection exposure', 'Would an investigator read this record early? Is the element in Model 2\'s minimum list? Is it one of the top-cited areas (risk management, purchasing and outsourcing, complaint handling, UDI, corrective action)?', 'High / Medium / Low'],
    ['Effort', 'What does closure take?', 'S: a form or a clause. M: a procedure and training. L: a system, a validation or a file rebuild'],
  ], [2000, 6280, 1800]));
  c.push(h3('The rule that matters: evidence, not procedures'));
  c.push(p('Because the inspection process tests whether the process works, the decisive column is "record sampled and what it lacked". A row that says "procedure updated" proves nothing. The Gap Assessment Workbook on your table is built this way: one row per Compliance Program element with its ISO clause and QMSR hook, the former QSR section, the current procedure, the evidence sampled, the gap, exposure, effort, a computed priority, owner, due date and verification method, with a dashboard by QMS Area.'));
  c.push(h3('Where certified firms fooled themselves'));
  c.push(...bullets([
    'Assuming the notified body or MDSAP auditing organization had already tested these areas at FDA depth.',
    'Assuming complaint and service templates already carried the UDI and a documented Part 803 evaluation.',
    'Assuming the label release step was already a signed, element-by-element record.',
    'Assuming management review minutes and audit reports would stay private.',
    'Measuring "procedures updated" instead of "records produced".',
  ]));

  c.push(h2('5.4 What 2026 gap assessments keep finding'));
  c.push(table(['Area', 'Recurring finding'], [
    ['Management Oversight', 'Risk management confined to design, with production, purchasing and complaint processes never referencing the risk file. Management review recorded as operational metrics with no decisions and no follow-up. Internal audits still run on Part 820 checklists. QMS software validated once, years ago, with upgrades never revalidated (Clause 4.1.6). Quality manual still organised by QSR subparts.'],
    ['Measurement, Analysis and Improvement', 'Complaint records without UDI or a documented Part 803 evaluation. CAPAs closed on the immediate fix, with no root cause and no effectiveness data. Service reports never analysed for complaints. Feedback and postmarket data not fed back into risk, which is an explicit Situation 1 example. Corrective action procedures that do not define cause determination or effectiveness review (cited in the Linemaster letter, Clause 8.5.2).'],
    ['Outsourcing, Production, Design', 'Supplier controls tiered by purchasing category rather than risk, and no supplier audit of a critical contract manufacturer (cited in the Koven letter, Clause 7.4.1). No signed element-by-element label release record (§820.45). Design changes without a documented significance and regulatory assessment (Koven, Clause 7.3.9). Rework performed without documented procedures (Linemaster, Clause 8.3.4). Software used for monitoring and measurement not validated (Linemaster, Clause 7.6).'],
  ], [2300, 7780]));

  c.push(h1('6. The roadmap'));
  c.push(h2('6.1 Five phases with deliverables and exit criteria'));
  c.push(table(['Phase', 'Deliverable', 'Exit criterion'], [
    ['0  Mobilize', 'Charter, executive sponsor, scope and applicability statement (products, sites, Part 4 applicability, Class I exclusions), one named owner per QMS process', '100% of QMS processes have a named owner'],
    ['1  Assess', 'Evidence-based gap workbook covering every Compliance Program 7382.850 element, with an exposure-weighted heat map', 'Every requirement sampled with at least one record; heat map reviewed and approved by top management'],
    ['2  Design', 'Document architecture decision (rewrite, bridge or hybrid); controlled definitions table; procedure change list; template changes for complaint, service, label release, supplier file and management review agenda', 'Every gap linked to a specific change with an owner and a date'],
    ['3  Implement and train', 'Revised procedures effective; templates live; competence verified with methods proportionate to risk (Clause 6.2)', 'Percentage of procedures effective; percentage of staff competence-verified; percentage of new records created on the new templates in the first 30 days'],
    ['4  Verify', 'Internal audit conducted the way Compliance Program 7382.850 would; record-retrieval drills; mock inspection under the applicable model', 'Zero inspection-critical findings open; median record retrieval under 15 minutes; every mock 483 item closed with evidence'],
    ['5  Sustain', 'Readiness metrics in management review; quarterly retrieval drills; watch list monitored; risk file updated on every trigger', 'Metrics green two quarters running; every complaint, change and CAPA visibly updates the risk file'],
  ], [1400, 4300, 4380]));
  c.push(h3('Two tracks'));
  c.push(table(['Track', 'Who', 'What to do'], [
    ['A', 'Transition complete; awaiting the first QMSR inspection', 'Enter at Phase 4 now. Run a mock inspection under the model that applies: Model 1 for most sites, Model 2 if the site has never been inspected or has a PMA. Start from the risk file and pull one thread end to end. Move readiness metrics into management review.'],
    ['B', 'Still closing gaps', 'Compress Phases 1 to 4 into 90 days and sequence by exposure: §820.35 and §820.45 record content first, then risk-file linkage, then management review and internal audit evidence, then supplier controls. Stop polishing the quality manual until those are done.'],
  ], [700, 3000, 6380]));
  c.push(h2('6.2 Sizing the roadmap'));
  c.push(table(['Firm type', 'A proportionate programme'], [
    ['Small Class I or CGMP-exempt manufacturer', 'A two-page applicability statement recording what applies, what is excluded and why, including the documented Clause 7.3 exclusion; complaint records meeting §820.35(a); MDR and Part 806 procedures; UDI; a label release record meeting §820.45; three revised forms; one retrieval drill; one management review using the new inputs.'],
    ['Certified Class II or III manufacturer (ISO 13485, MDSAP)', 'The last twenty percent: §820.35 and §820.45 record content and UDI in records; management review, internal audit and supplier audit records written to be read; demonstrated risk linkage from complaint to risk file to change to supplier control to management review; an internal audit programme restructured to the six QMS Areas; a mock inspection under Model 1.'],
    ['Drug-led combination product manufacturer', 'Map the 21 CFR 4.4(b)(1) clauses inside the pharmaceutical quality system with evidence; add documented processes for risk management in product realization with records; complaint handling under Clause 8.2.2 and §820.35(a); servicing records under §820.35(b); verify contract manufacturers\' alignment. MDSAP is not available for combination products.'],
  ], [2600, 7480]));
  c.push(h2('6.3 Metrics for management review'));
  c.push(p('Choose five. Each measures readiness for the inspection process as it actually runs.'));
  c.push(table(['Readiness metric', 'Target', 'Data source', 'Your site'], METRICS.map(m => [m[0], m[1], m[2], '']), [4400, 1900, 2000, 1780], { boldFirst: false }));

  c.push(h1('7. Readiness self-test'));
  c.push(p('Tick each statement you can say yes to without hesitation.'));
  c.push(...checks(SELFTEST));
  c.push(callout(['**12–14:** ready; run the mock inspection and move to metrics.', '**8–11:** exposed, and you know where. Work the unticked items by exposure.', '**7 or fewer:** start with §820.35 and §820.45 record content and the management review and internal audit records. Those are what the first inspection will read.']));

  c.push(h1('8. Your 30-60-90 day plan'));
  c.push(table(['Window', 'Action', 'Owner', 'Due'], [
    ['First 30 days', 'Fix complaint and service record templates to carry every §820.35 element, including UDI and the documented Part 803 evaluation', '', ''],
    ['', 'Add a signed, element-by-element label examination and release record under §820.45', '', ''],
    ['', 'Sweep procedures, forms and audit checklists for citations to repealed sections; correct the citations without rewriting content', '', ''],
    ['', 'Rewrite the management review agenda to the Clause 5.6.2 inputs, with decisions and resource commitments recorded', '', ''],
    ['Days 31–60', 'Run the evidence-based gap assessment across all Compliance Program elements; produce the exposure heat map for top management', '', ''],
    ['', 'Restructure the internal audit programme to the six QMS Areas and four OAFRs, and test risk integration', '', ''],
    ['', 'Tier suppliers by risk; close the evaluation and monitoring evidence gaps for critical suppliers', '', ''],
    ['', 'Confirm the risk file updates on complaint, CAPA and change triggers, and that post-market data reaches it', '', ''],
    ['Days 61–90', 'Run a mock inspection under the applicable model, starting from the risk file and pulling one thread end to end', '', ''],
    ['', 'Run record-retrieval drills against a 15-minute target, including pre-2026 records', '', ''],
    ['', 'Put five readiness metrics into management review', '', ''],
    ['', 'Schedule the next drill and the annual cycle', '', ''],
  ], [1700, 5180, 1800, 1400]));

  c.push(pageBreak());
  c.push(h1('Appendix A. Glossary'));
  c.push(table(['Term', 'Meaning'], [
    ['482 / 483', 'Form FDA 482, Notice of Inspection; Form FDA 483, Inspectional Observations'],
    ['CGMP', 'Current good manufacturing practice'],
    ['CP 7382.850', 'Compliance Program 7382.850, Inspection of Medical Device Manufacturers, in force from 2 February 2026'],
    ['DDF', 'Design and development file (ISO 13485 Clause 7.3.10), successor to the design history file'],
    ['EIR', 'Establishment Inspection Report'],
    ['GUDID', 'Global Unique Device Identification Database'],
    ['IBR', 'Incorporation by reference'],
    ['MDF', 'Medical device file (ISO 13485 Clause 4.2.3), successor to the device master record'],
    ['MDR', 'Medical device reporting under 21 CFR Part 803'],
    ['MDSAP', 'Medical Device Single Audit Program (Australia, Brazil, Canada, Japan, USA)'],
    ['NAI / VAI / OAI', 'No Action Indicated; Voluntary Action Indicated; Official Action Indicated'],
    ['OAFR', 'Other Applicable FDA Requirement, as defined in Compliance Program 7382.850'],
    ['QMSR', 'Quality Management System Regulation, 21 CFR Part 820, effective 2 February 2026'],
    ['QSIT', 'Quality System Inspection Technique, withdrawn 2 February 2026'],
    ['QSR / QS regulation', 'The former Quality System Regulation'],
    ['RRA', 'Remote Regulatory Assessment under FD&C Act section 704(a)(4)'],
    ['SPRA', 'Specific Product Risk Assignment inspection'],
    ['TPLC', 'Total Product Lifecycle report'],
    ['UDI / UPC', 'Unique device identifier; universal product code'],
  ], [2000, 8080]));

  c.push(h1('Appendix B. References'));
  c.push(h3('Regulation and rulemaking'));
  c.push(...bullets(REFS_REG));
  c.push(h3('FDA implementation and enforcement'));
  c.push(...bullets(REFS_FDA));
  c.push(h1('Notes'));
  c.push(...lines(6));
  return c;
}

// =====================================================================
// 2. WORKSHOP EXERCISE PACK
// =====================================================================
function exercisePack() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  WORKSHOP EXERCISE PACK', 'QMSR Transition', 'Three table exercises: red-team the records, triage the gaps, build the 90-day plan',
    ['**Presented by:** Elder Consulting, LLC   ·   **Table number:** ______   ·   **Date:** ____________', '**Companion documents:** Participant Handout; Gap Assessment Workbook']));
  c.push(h1('How to use this pack'));
  c.push(p('The three exercises run inside the 90-minute seminar. Each has a strict clock, and each produces something you can take back to work. The firms, records and findings are fictional composites built from published Warning Letters, FDA officials\' public remarks and reported 2026 gap assessments. Any resemblance to a real manufacturer is unintended.'));
  c.push(table(['Exercise', 'When', 'Clock', 'Output'], [
    ['A  Red-team the records', 'After the inspection section', '6 minutes table work, 4 minutes debrief', 'Three investigator questions, one written observation, one response skeleton'],
    ['B  Gap triage under time pressure', 'After the gap-assessment section', '6 minutes table work, 4 minutes debrief', 'Eight gap cards scored and ranked, with an owner role and a first-30-day action for the top three'],
    ['C  Your 90-day plan', 'At the close', '3 minutes solo, 2 minutes read-outs', 'One completed plan card per participant'],
  ], [2400, 2400, 2400, 2880]));
  c.push(h3('Roles at your table')); 
  c.push(...bullets(['**Scribe** writes the table\'s answers on these pages.', '**Investigator** argues the FDA reading in Exercise A and challenges soft answers.', '**Spokesperson** reports out in 90 seconds.']));

  // ---- Exercise A
  c.push(pageBreak());
  c.push(h1('Exercise A: red-team the records'));
  c.push(p('**The firm.** Brightwater Instruments, a Class II manufacturer of powered surgical handpieces and a reusable irrigation controller. About 180 staff, one site, ISO 13485 certified since 2017, MDSAP for Canada. Last FDA inspection 2023 under the QS regulation, classified Voluntary Action Indicated with two observations (complaint handling and CAPA effectiveness). The firm closed its QMSR transition project in November 2025. It has not yet been inspected under the QMSR.'));
  c.push(p('**Your job.** Read the three records below as an FDA investigator working to Compliance Program 7382.850. You have six minutes.'));

  c.push(h2('Record A1: Management review minutes, Q2 2026 (extract)'));
  c.push(exhibit('Record A1', 'Brightwater Instruments - Management Review Meeting, 14 July 2026', [
    'Attendees: President, VP Operations, Director Quality (chair), Director R&D, Materials Manager.',
    'Apologies: VP Regulatory Affairs.',
    '',
    '1. Review of previous minutes: accepted.',
    '2. Quality objectives: all objectives on track. Scrap 1.8% against a 2.0% target.',
    '3. Internal audit: the 2026 audit plan is 60% complete. No major findings.',
    '4. Complaints: 34 complaints received in H1 2026 (H1 2025: 29). No adverse trends identified.',
    '5. CAPA: 11 CAPAs open, 6 closed in the period. Average age 142 days.',
    '6. Suppliers: no supplier issues to report.',
    '7. Customer feedback: satisfaction survey returned 4.2 of 5.',
    '8. Resources: no additional resources requested.',
    '9. AOB: QMSR transition project closed November 2025. No further action.',
    '',
    'Conclusion: the quality management system continues to be effective and suitable.',
    'Next review: January 2027.',
  ]));
  c.push(h2('Record A2: Internal audit summary, June 2026 (extract)'));
  c.push(exhibit('Record A2', 'Internal Audit Report IA-2026-04, Purchasing and Outsourcing, 9 June 2026', [
    'Scope: Purchasing procedure QP-740 rev 6. Checklist used: "21 CFR 820.50 Purchasing Controls" (rev 2019).',
    'Auditor: Quality Engineer (reports to Director Quality).',
    '',
    'Findings:',
    'OFI-1  The approved supplier list has not been reviewed since 2024.',
    'OFI-2  Supplier questionnaires on file for 22 of 24 active suppliers.',
    '',
    'Observation: "There continues to be a systemic weakness in how supplier risk is handled,',
    'as noted in prior audits. Recommend management attention."',
    '',
    'Conclusion: no nonconformities raised. Two opportunities for improvement (OFIs) assigned to',
    'the Materials Manager. No CAPA initiated. Audit closed 9 June 2026.',
  ]));
  c.push(h2('Record A3: Supplier audit report, critical supplier (extract)'));
  c.push(exhibit('Record A3', 'Supplier Audit SA-2025-11, Northbank Machining (motor housings), 3 October 2025', [
    'Supplier criticality per QP-740 Appendix A: "Critical - direct product contact, custom machined".',
    'Audit type: remote documentation review (no site visit).',
    '',
    'Findings: 3 minor. (1) Calibration records for 2 of 8 gauges overdue. (2) No documented',
    'process for notifying Brightwater of process changes. (3) Operator training records incomplete',
    'for the CNC cell.',
    '',
    'Supplier response: received 20 October 2025, "actions in progress".',
    'Brightwater follow-up: none recorded.',
    'Supplier status in ERP as of July 2026: APPROVED. Scorecard rating: GREEN (on-time delivery 99%,',
    'incoming inspection rejects 0.4%).',
  ]));

  c.push(h2('Your table\'s answers'));
  c.push(h3('1. The three questions you would ask first'));
  c.push(...lines(3));
  c.push(h3('2. The element you would go dig into, and why'));
  c.push(...lines(2));
  c.push(h3('3. Write one observation'));
  c.push(p('Name the clause or QMSR section, the specific record, and the specific failure. An observation that says "management review is weak" is not an observation.'));
  c.push(...lines(4));
  c.push(pageBreak());
  c.push(h3('4. Swap sheets. Draft the response skeleton for the neighbouring table\'s observation'));
  c.push(table(['Element', 'Your answer'], [
    ['Immediate correction', ''],
    ['Root cause (not "the procedure was not followed")', ''],
    ['Systemic corrective action', ''],
    ['Evidence and date you would commit to', ''],
    ['The metric that would prove effectiveness', ''],
  ], [3000, 7080]));

  // ---- Exercise B
  c.push(pageBreak());
  c.push(h1('Exercise B: gap triage under time pressure'));
  c.push(p('Eight findings from a 2026 gap assessment. Score each one, then sort by exposure. You have six minutes. Two cards are deliberately arguable; record your table\'s position and be ready to defend it.'));
  c.push(h3('Scoring guide'));
  c.push(table(['Axis', 'Values', 'Guidance'], [
    ['Regulatory gap', 'Y / N', 'Is there a requirement you do not meet? A cosmetic problem is not a regulatory gap.'],
    ['Exposure', 'H / M / L', 'High: an investigator reads this record early; the element is in Model 2\'s minimum list; it is one of the top-cited areas. Medium: reached when a thread leads there. Low: housekeeping; investigators judge content, not titles.'],
    ['Effort', 'S / M / L', 'S: a form or a clause. M: a procedure and training. L: a system, a validation or a file rebuild.'],
  ], [1800, 1400, 6880]));
  c.push(h2('The eight cards'));
  c.push(table(['#', 'Finding', 'Gap Y/N', 'Exp.', 'Effort', 'Rank'], [
    ['1', 'The complaint form has no UDI field and no place to record the Part 803 reportability decision or its rationale. 6 of 20 sampled records have neither.', '', '', '', ''],
    ['2', 'Forty procedures still say "design history file" and cite "21 CFR 820.30". The content of each procedure meets the ISO 13485 requirement.', '', '', '', ''],
    ['3', 'The label release step in the batch record is a single checkbox marked "labels verified". No record of the five §820.45(a) elements, and no signature.', '', '', '', ''],
    ['4', 'The risk file for the flagship product family has not been revised since design transfer in 2022, despite 14 complaints, 2 design changes and 1 field correction since.', '', '', '', ''],
    ['5', 'The eQMS, the complaint database and the ERP lot-genealogy module were validated in 2016. Four upgrades since; no revalidation. (Clause 4.1.6)', '', '', '', ''],
    ['6', 'An internal audit report describes "a systemic failure of the CAPA process" with no evidence cited, no nonconformity raised and no CAPA opened.', '', '', '', ''],
    ['7', 'Supplier controls are tiered by annual spend. The sole-source contract manufacturer of a critical sub-assembly has never been audited on site; its file holds one 2021 questionnaire.', '', '', '', ''],
    ['8', 'Servicing records capture the device name, date and technician, but not the UDI, the service performed in detail, or any test data; service reports are never screened as possible complaints.', '', '', '', ''],
  ], [500, 5580, 1100, 900, 1000, 1000], { boldFirst: false }));
  c.push(h3('Your top three, with an owner role and a first-30-day action'));
  c.push(table(['Rank', 'Card #', 'Owner role', 'First 30-day action'], [
    ['1', '', '', ''],
    ['2', '', '', ''],
    ['3', '', '', ''],
  ], [900, 900, 2200, 6080]));
  c.push(h3('Your position on the two arguable cards'));
  c.push(p('**Card 2 (legacy terminology in 40 procedures):** is this a regulatory gap? What exposure would you assign, and why?'));
  c.push(...lines(3));
  c.push(p('**Card 6 (the audit report that says "systemic failure"):** what would you do about the wording, and about the underlying finding?'));
  c.push(...lines(3));

  // ---- Exercise C
  c.push(pageBreak());
  c.push(h1('Exercise C: your 90-day plan'));
  c.push(p('Three minutes on your own. Then one sentence per table: "By [date], we will ...".'));
  c.push(table(['Field', 'Your answer'], [
    ['Your track (A: complete, verifying · B: still closing gaps)', ''],
    ['Record to fix first', ''],
    ['Owner and date', ''],
    ['Record to fix second', ''],
    ['Owner and date', ''],
    ['Record to fix third', ''],
    ['Owner and date', ''],
    ['Mock inspection: date, model (1 or 2), who plays the investigator', ''],
    ['The product risk your mock inspection thread starts from', ''],
    ['One behaviour to train, and who trains it', ''],
    ['Public-footprint check this month (registration and listing, MDR history, recalls, prior 483s, GUDID versus labels)', ''],
    ['The one metric you will put in front of top management this quarter', ''],
  ], [4600, 5480]));
  c.push(h3('My commitment, in one sentence'));
  c.push(...lines(2));
  c.push(h1('Notes'));
  c.push(...lines(8));
  return c;
}

// =====================================================================
// 3. FACILITATOR GUIDE
// =====================================================================
function facilitator() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  FACILITATOR GUIDE', 'QMSR Transition', 'Run-of-show, delivery notes, exercise answers, Q&A preparation and a pre-delivery accuracy checklist',
    ['**For the speaker only.** Do not distribute to participants.', '**Materials:** Speaker deck (41 slides with notes), Participant Handout, Workshop Exercise Pack, Gap Assessment Workbook']));

  c.push(h1('1. Purpose and audience'));
  c.push(p('A 90-minute seminar for medical device quality and regulatory professionals, delivered in the second half of 2026. The room will be mixed: firms that closed the transition and are waiting for the first inspection, firms still closing gaps, and a few that have already hosted a QMSR-era inspection. The design serves all three by anchoring everything to the inspection they all face.'));
  c.push(h3('The argument the seminar makes'));
  c.push(...numbered([
    'The regulation got shorter; the inspection surface got larger. Part 820 is six operative sections. Compliance Program 7382.850 evaluates six QMS Areas and four OAFRs on every inspection.',
    'ISO 13485 certification is not compliance. Four FDA-specific provisions carry the difference.',
    'The records that used to be private are now the first thing an investigator may read.',
    'Renaming is not compliance; evidence is. A gap assessment that scores procedures rather than records will not survive an inspection.',
  ]));
  c.push(h1('2. Room, materials and set-up'));
  c.push(...bullets([
    'Tables of four to six. The exercises do not work in theatre seating; if the room is fixed, pair rows and shorten each exercise by two minutes.',
    'One Participant Handout and one Workshop Exercise Pack per person. Pens. A flipchart for the opening poll counts and parked questions.',
    'The Gap Assessment Workbook: email it in advance, or hand out a link or QR code. Mention it three times: at the opening, in the gap-assessment section and at the close.',
    'A visible timer for the exercises. Exercise A and B are six minutes of table work each; hold the line.',
    'Fill in the placeholders on slide 1 and slide 41, and on the title pages of the handout and exercise pack.',
    'Work through section 8 of this guide, the accuracy checklist, in the week before you present.',
  ]));

  c.push(h1('3. Run-of-show'));
  c.push(table(['Clock', 'Slides', 'Segment', 'Facilitation notes'], [
    ['0:00', '1', 'Welcome', 'One line on your own QMSR experience. State the three deliverables. Point to the three documents.'],
    ['0:02', '2', 'Agenda', 'Ask people to sit in tables of four to six now. Flag the three exercises.'],
    ['0:04', '3', 'Room poll', 'Three shows of hands; write counts on the flipchart. Use the mix to weight Section 5 (Track A or Track B).'],
    ['0:06', '4–10', 'Section 1: what changed', 'Timeline, the six sections, the definitions hierarchy, what disappeared, what did not, myth or fact. Keep the myth-or-fact round to two minutes.'],
    ['0:20', '11–16', 'Section 2: load-bearing provisions', '§820.10 hooks, §820.35, §820.45, special cases, then the five-record spot check at pace.'],
    ['0:30', '17–24', 'Section 3: the inspection', 'QSIT versus the compliance program, the six areas, types and models, risk as the roadmap, the records shield, how an observation reads, early enforcement. This is the heart of the session.'],
    ['0:45', '25', 'Exercise A', '6 minutes table work, 4 minutes debrief. Model answers in section 5.'],
    ['0:55', '26–31', 'Section 4: crosswalk to gap assessment', 'Crosswalk at headline level only; spend the time on the scoring method and the recurring findings.'],
    ['1:05', '32', 'Exercise B', '6 minutes table work, 4 minutes debrief. Answers in section 5.'],
    ['1:15', '33–37', 'Section 5: the roadmap', 'Five phases with exit criteria, sizing, metrics, watch list. Compress here if behind.'],
    ['1:23', '38', 'Exercise C', '3 minutes solo, then one sentence per table.'],
    ['1:28', '39–40', 'Takeaways and references', 'Read the five takeaways slowly. Do not read the reference slide.'],
    ['1:29', '41', 'Q&A', 'Open with the question on the slide. Seed questions in section 7.'],
  ], [800, 900, 2600, 5780], { size: 18 }));
  c.push(h3('If you are running behind'));
  c.push(...bullets([
    'Cut the two crosswalk slides (27 and 28) to a single sentence: the crosswalk is in the handout and the workbook, and FDA never published one.',
    'Cut slide 15 (special cases) unless the room includes combination-product or Class I firms; the poll will tell you.',
    'Shorten Exercise B\'s debrief to one table and the reveal.',
    'Do not cut Exercise A. It is the exercise people remember.',
  ]));
  c.push(h3('If you have extra time'));
  c.push(...bullets([
    'Let the Exercise B argument about legacy terminology run; it exposes real disagreement about where effort should go.',
    'Ask anyone who has hosted a QMSR-era inspection to describe the first hour. Give them the floor before your own material.',
  ]));

  c.push(h1('4. Delivery notes by section'));
  c.push(h2('Section 1: what changed (slides 4–10)'));
  c.push(...bullets([
    '**The §820.15 trap.** The proposed rule had a §820.15 "Clarification of concepts". FDA deleted it and moved the content into §820.3(b), dropping the "validation of processes" clarification. A great deal of published material, including some consultancy checklists, still cites §820.15 as current law. Use it as a credibility test: if a crosswalk cites §820.15, check the rest of it.',
    '**Dates.** The final rule was published 2 February 2024 at 89 FR 7496; FDA\'s FAQ page says it was issued on 31 January 2024, which is the public-inspection date. Either is defensible; say which you mean. The compliance program PDF cover says 2 February 2026 while several law firms report it was posted on 30 January 2026.',
    '**"Safety and performance".** FDA agreed with commenters that the phrases are not interchangeable and narrowed the clarification to Clause 0.1 of the Introduction. The practical message: do not rewrite design inputs; do make sure the QMS assures safety and effectiveness.',
    '**Records.** The single most consequential change for a well-run firm is the removal of the §820.180(c) exemption. If you have only five minutes of this section, spend them here.',
    '**Technical amendments.** The December 2025 rule re-pointed 179 sections in 18 parts. It imposed no new obligations. If someone asks whether they need to act on it: no, but their procedures should cite §820.35 and §820.10(c) rather than §820.180, §820.198 and §820.30.',
  ]));
  c.push(h2('Section 2: load-bearing provisions (slides 11–16)'));
  c.push(...bullets([
    'Read the §820.35(a) list against the room\'s own complaint forms. Ask for a show of hands on the UDI field and on a documented reportability decision. In most rooms one of the two is missing.',
    '§820.45 is the easiest objective citation in the regulation and the one certified-only firms most often fail. A single "labels verified" checkbox is not a five-element examination record.',
    'On automated readers, FDA\'s position is precise: readers are allowed where followed by human oversight, and a designated individual must examine at minimum a representative sample of the labels checked.',
    'The spot check on slide 16 moves fast. Answers: (1) missing UDI or other identification; (2) no documented Part 803 evaluation; (3) no documented justification for not investigating; (4) correction taken but not recorded, and no reply recorded; (5) a service report describing a possible MDR-reportable failure never screened as a complaint.',
  ]));
  c.push(h2('Section 3: the inspection (slides 17–24)'));
  c.push(...bullets([
    'Say plainly that the compliance program is 78 pages, public, and that most firms have not read it. Attachment A is the part to read: it tabulates every element with its ISO clause and QMSR section.',
    'The two structural changes to stress: every inspection now touches every part of the QMS to some extent, and there are no sampling tables.',
    'On Model 1 versus Model 2: most firms in the room get Model 1. Model 2 applies to baseline surveillance, meaning no FDA inspection or MDSAP audit history, and to PMA preapproval.',
    'MDSAP: surveillance inspections are not conducted at sites actively enrolled, but for-cause, compliance follow-up, Specific Product Risk Assignment and PMA inspections still happen. A notified body ISO 13485 audit does not satisfy Clause 8.2.4.',
    '**The risk answer.** Teach the three-part structure and make the room say it: the risk identified, the record where the decision lives, the evidence the control worked. Reciting a procedure number prompts a deeper pull.',
    'On sanitizing records: be unambiguous. It is bad advice, it is visible, and the compliance program lists "feedback not used as a risk input" and "failure to correct the same deficiencies" among its OAI examples. Candid records with closed loops are protective.',
    'Quote FDA officials for the enforcement picture and label vendor statistics as vendor statistics. FDA has not published QMSR-era citation data; the first official dataset is expected after the fiscal year ends on 30 September 2026.',
  ]));
  c.push(h2('Section 4 and 5 (slides 26–37)'));
  c.push(...bullets([
    'The crosswalk slides exist so nobody asks for them afterwards. Say that FDA refused to publish one (Comment 18) and that the only official mapping is subpart-level, in the 2022 proposed rule.',
    'The gap-assessment method is the transferable content: three axes, sort by exposure, and one decisive column, "record sampled and what it lacked".',
    'On the roadmap: the exit criterion matters more than the phase. "We updated the procedures" is not a finish line; "every requirement sampled with at least one record" is.',
    'Sizing: name the three archetypes and let people self-identify. A small Class I firm being handed an enterprise programme is the most common consultancy failure.',
  ]));

  c.push(h1('5. Exercise answers'));
  c.push(h2('5.1 Exercise A: red-team the records'));
  c.push(p('The three records are built to fail in ways FDA has actually cited. Let the tables find them; then give the model answers.'));
  c.push(h3('Record A1, management review minutes: what is missing'));
  c.push(...bullets([
    '**Clause 5.6.2 inputs absent or nominal.** No regulatory reporting (MDR, Part 806) input at all. Complaints reported as a count with "no adverse trends identified" and no trend data. Supplier performance recorded as "no supplier issues to report" while a critical supplier audit sits unresolved (Record A3). No process or product monitoring input. No feedback input beyond a satisfaction score. No input on changes or on new or revised regulatory requirements, which in 2026 should have included the QMSR itself.',
    '**Clause 5.6.3 outputs absent.** There are no decisions, no actions and no resource commitments. "The quality management system continues to be effective and suitable" is a conclusion without evidence.',
    '**No risk-based prioritisation.** Nothing links the review to product risk, which is what the compliance program puts under Management Oversight.',
    '**CAPA age of 142 days recorded without comment**, and no follow-up on the 2023 inspection observations on complaint handling and CAPA effectiveness.',
    '**The QMSR line is a red flag**: "transition project closed, no further action" invites the investigator to test whether it actually closed.',
    '**Annual cadence** with the next review in January 2027 is a choice the firm must justify against its risk profile; the absent VP Regulatory Affairs is the second signal.',
  ]));
  c.push(h3('Record A2, internal audit summary: what is missing'));
  c.push(...bullets([
    '**A 2019 "21 CFR 820.50" checklist** means the audit did not test the current requirement. Clause 7.4.1 requires criteria for evaluation and selection proportionate to risk, and monitoring and re-evaluation. Clause 4.1.5 covers outsourced processes. Neither was audited.',
    '**Findings downgraded to "opportunities for improvement"** to avoid raising nonconformities. An approved supplier list unreviewed since 2024 and missing questionnaires for two active suppliers are findings against a documented requirement.',
    '**"Systemic weakness ... as noted in prior audits" with no evidence and no CAPA** is the worst of both worlds: it hands the investigator a self-identified systemic issue and shows the firm did not act. Compliance Program Situation 1 includes failure to correct the same or similar significant deficiencies.',
    '**Auditor independence** is worth a question: the auditor reports to the function\'s ultimate owner.',
    'The fix is not to soften the wording. The fix is to raise the nonconformity, open the CAPA, and let the record show the loop closing.',
  ]));
  c.push(h3('Record A3, supplier audit: what is missing'));
  c.push(...bullets([
    '**A critical supplier audited by remote document review only**, with three minor findings, a supplier response of "actions in progress", and no follow-up recorded in nine months.',
    '**Re-approval on a scorecard.** Status APPROVED and rating GREEN rest on delivery and reject data, not on the open findings. This is the Koven pattern: a procedure defining a supplier as critical, and no evidence the defined control was performed.',
    '**Missing change notification.** Finding 2 is the one with teeth: no documented process for the supplier to notify process changes, which breaks change control (Clause 7.4.2, 7.4.3 and the Change Control QMS Area) and risk re-evaluation.',
  ]));
  c.push(h3('Model observation (one of several defensible versions)'));
  c.push(callout('"Failure to maintain records of management review that include the inputs required by ISO 13485:2016, Clause 5.6.2, and that record the decisions and actions required by Clause 5.6.3. Specifically, the management review minutes dated 14 July 2026 contain no input on reporting to regulatory authorities, no complaint or feedback trend data, no process or product monitoring data, and no supplier performance data other than the statement \'no supplier issues to report\', notwithstanding three unresolved findings from supplier audit SA-2025-11 of a supplier your procedure QP-740 Appendix A defines as \'Critical\'. The minutes record no decisions, actions or resource allocations."'));
  c.push(h3('What makes a credible response'));
  c.push(...bullets([
    '**Correction:** reconvene the review with the missing inputs; document the decisions; open a CAPA covering the supplier findings and the audit-programme gap.',
    '**Root cause:** the management review procedure and agenda template were never updated to the Clause 5.6.2 input list, and the internal audit programme tests against a 2019 checklist. The cause is structural, not "the chair forgot".',
    '**Systemic action:** revise the procedure and agenda; retire the legacy checklists; restructure the audit programme to the six QMS Areas and four OAFRs; define when a finding must be raised as a nonconformity.',
    '**Evidence and dates:** the revised procedure effective by a date; the next review held to it; the audit programme reissued; the supplier follow-up closed with evidence.',
    '**Effectiveness metric:** Clause 5.6.2 input completeness at 100% for two consecutive reviews; management review actions closed on time; supplier findings closed within the defined period.',
    'Push back hard on "we retrained the chair". That is the answer FDA officials describe as the reason the same problems recur.',
  ]));
  c.push(h3('The privilege question, which someone always asks'));
  c.push(p('Answer it directly and move on. FDA removed the exemption and its FAQ says these records should be readily available upon inspection. Marking records confidential under §820.35(d) aids FDA\'s disclosure determinations under Part 20; it is not a basis for withholding. Keeping a "clean" parallel record set is a data integrity problem, not a strategy. If a firm has genuine privilege questions about a specific investigation, that is a conversation with its own counsel, not a reason to hollow out the quality records.'));

  c.push(h2('5.2 Exercise B: gap triage'));
  c.push(table(['#', 'Finding', 'Gap', 'Exposure', 'Effort', 'Comment'], [
    ['1', 'Complaint form lacks UDI and the Part 803 decision', 'Yes', 'High', 'S', 'A direct §820.35(a)(3) failure plus the §820.10(b)(3) hook. Complaint handling is a Model 2 minimum element and a top-cited area. Cited in the Koven letter. Cheap to fix: one form and one procedure step.'],
    ['2', '40 procedures say DHF and cite 820.30', 'No', 'Low to Medium', 'M', '**Arguable by design.** Content is compliant, so there is no regulatory gap, and FDA does not expect pre-2026 records to be scrubbed. But practice reports describe investigators reading QSR-structured procedures as an incomplete transition. Correct the citations opportunistically; do not let it consume the programme.'],
    ['3', 'Label release is one checkbox', 'Yes', 'High', 'S', 'A §820.45(a) and (c) failure. Objective, easy to cite, easy to fix. One of the two provisions ISO-only firms most often miss.'],
    ['4', 'Risk file unchanged since 2022 transfer', 'Yes', 'High', 'L', 'The highest-exposure item on the list. Clause 7.1 with 8.2.1; explicitly a Situation 1 (OAI) example where feedback is not used as a risk input. All three early Warning Letters cite Clause 7.1.'],
    ['5', 'QMS software validated in 2016, four upgrades since', 'Yes', 'Medium to High', 'L', 'Clause 4.1.6, an element under Management Oversight, and Software Changes under Change Control. The Linemaster letter cited Clause 7.6 for unvalidated monitoring and measurement software.'],
    ['6', 'Audit report says "systemic failure", no CAPA', 'Yes', 'High', 'M', '**Arguable by design.** The wording is not the problem; the absent nonconformity and CAPA are (Clauses 8.2.4 and 8.5.2). Now that FDA reads audit reports, this record hands over a self-declared systemic failure with no action. Raise the nonconformity and open the CAPA; do not edit the sentence.'],
    ['7', 'Suppliers tiered by spend; critical CM never audited', 'Yes', 'High', 'M', 'Clause 7.4.1 with 4.1.5. Outsourcing and purchasing was the second-ranked observation area in early QMSR inspections, and this is close to the Koven citation.'],
    ['8', 'Servicing records incomplete; no complaint screening', 'Yes', 'Medium to High', 'S', '§820.35(b) elements missing, and Clause 7.5.4 analysis absent. Cheap to fix and frequently forgotten because servicing sits outside the quality function.'],
  ], [500, 2600, 700, 1100, 700, 4480], { size: 16, boldFirst: false }));
  c.push(h3('The reveal'));
  c.push(p('Most tables rank card 2 higher than it deserves and card 4 lower. Say so. The pattern in real programmes is over-investment in terminology housekeeping and under-investment in the records an investigator reads early. The exposure-first ranking is roughly 4, 1, 3, 7, 6, 8, 5, 2.'));

  c.push(h2('5.3 Exercise C: the 90-day plan'));
  c.push(...bullets([
    'Watch for plans that name three procedures rather than three records. Redirect: the deliverable is a record an investigator could read.',
    'Watch for a mock inspection with no date or no named investigator. Both make it optional.',
    'Good behaviours to train: the three-part risk answer; producing management review and audit records without stalling; not using QSR vocabulary in the front room.',
    'Collect the read-outs on the flipchart and photograph it. If you offer a follow-up email, send it within a week or do not offer it.',
  ]));

  c.push(h1('6. The poll and the self-test'));
  c.push(...bullets([
    'Poll (slide 3): write the counts on the flipchart. A room that is mostly "complete but untested" wants Track A and the mock inspection. A room still closing gaps wants Track B and the sequencing rule.',
    'Question 3 is the hook: could you hand over the last two management reviews and this year\'s internal audits within 15 minutes, and be comfortable while they are read? Let the silence sit.',
    'The self-test in handout section 7 has 14 statements. Ask only for the high scorers publicly. Close the loop at the end: "would anyone change their answer to question 3 now?"',
  ]));

  c.push(h1('7. Q&A preparation'));
  c.push(table(['Likely question', 'Answer'], [
    ['Does our ISO 13485 certificate or MDSAP audit count for anything with FDA?', 'The certificate, no. FDA will not require it, will not accept it in lieu of an inspection or an establishment inspection report, and will not issue one. MDSAP audit reports are different: FDA uses the reports, not the certificate, as a substitute for routine surveillance inspections, and surveillance inspections are not conducted at sites actively enrolled. For-cause, compliance follow-up, Specific Product Risk Assignment and PMA inspections still happen.'],
    ['Can we keep calling them DHF, DMR and DHR?', 'Internally, yes. FDA does not expect pre-2026 records to be retitled or scrubbed. Be able to map the names to Clause 7.3.10, Clause 4.2.3 and Clause 7.5.1 on the spot, and use the new vocabulary in new records. Expect procedures organised by QSR subpart to draw attention.'],
    ['Will the investigator really ask for our internal audit reports and management review minutes?', 'FDA\'s FAQ says it has the authority and that these records should be readily available. FDA has said these processes are expected to be reviewed in baseline surveillance and PMA preapproval inspections, and may be reviewed in others depending on the focus and the elements selected.'],
    ['Can we redact them, or mark them privileged?', 'Do not redact records you hand over. Marking under §820.35(d) helps FDA decide what may be disclosed under Part 20; it is not a basis for withholding. Genuine privilege questions about a specific investigation belong with your counsel and do not change what the quality records must contain.'],
    ['Should we make our minutes and audit reports less candid?', 'No. Records that show real problems and closed loops are protective. Empty records are themselves an observation, and failure to correct previously identified deficiencies is an explicit OAI example.'],
    ['Is ISO 14971 mandatory now?', 'It is not incorporated by reference; only ISO 13485:2016 and ISO 9000:2015 Clause 3 are. FDA has said there is no QMSR requirement to conform to ISO 14971 and no required risk tool. But risk management is required throughout the QMS through ISO 13485, and FDA officials report risk management as the top observation area. Arguing that 14971 is optional is a poor use of front-room time.'],
    ['What exactly must a complaint record contain?', 'Seven elements under §820.35(a), including any UDI or UPC, plus records of review, evaluation and investigation, or documented justification for not investigating where a similar complaint was already investigated, plus the Part 803 evaluation through the §820.10(b)(3) hook.'],
    ['Does automated label inspection satisfy §820.45?', 'Automated readers are permitted where followed by human oversight, and a designated individual must examine at minimum a representative sample of the labels checked. The release record still has to exist.'],
    ['How does FDA choose Model 1 or Model 2?', 'By inspection type. Model 2 applies to baseline surveillance, meaning no FDA inspection or MDSAP audit history or risk factors indicating a need, and to PMA preapproval. Everything else uses Model 1. Both are minimums and investigators routinely go further.'],
    ['Do Part 11 expectations change?', 'Part 11 was not amended by the QMSR or the technical amendments and continues to apply to electronic records required by Part 820. FDA\'s only relevant statement in the rule is that where ISO 13485 says "approved", that means a signature and date, and that electronic methods meeting its requirements are acceptable.'],
    ['We are a small Class I firm. What applies?', 'Scope and document it. Most Class I devices are outside Clause 7.3, and the exclusion should be documented with its justification. CGMP exemption does not exempt you from complaint files or the §820.35 records, which is why the December 2025 technical amendments re-pointed 162 classification regulations to §820.35. Class I manufacturers are the lowest routine inspection priority, but for-cause inspections happen.'],
    ['What if ISO 13485 is revised?', 'The QMSR incorporates the 2016 third edition specifically. A new edition would require rulemaking, including approval of the incorporation by reference. ISO confirmed the 2016 edition in its 2025 systematic review, and FDA staff have said it will not be revised before at least April 2030.'],
    ['Has FDA said anything about being lenient in the first year?', 'No. The FAQ says FDA will begin to enforce the QMSR, and FDA said at the April 2026 town hall that the transition period has ended. The threshold for compliance action has not changed. Any claim of an informal grace period is unsourced.'],
    ['What has actually been cited so far?', 'On the record from FDA officials: risk management by a wide margin, then outsourcing and purchasing, complaint handling and feedback, UDI, and corrective action. Three Warning Letters from QMSR-era inspections were public by August 2026, and all three cite Clause 7.1. Be careful with circulating percentages; they are vendor compilations.'],
  ], [3000, 7080], { size: 18 }));

  c.push(h1('8. Accuracy checklist before each delivery'));
  c.push(p('This material was verified in September 2026 against the Federal Register, the eCFR, FDA web pages, Compliance Program 7382.850, FDA webinar and town hall transcripts, published Warning Letters and FDA\'s inspection observation data. Re-verify the following and update the deck and handout if anything has moved.'));
  c.push(...checks([
    'FDA\'s QMSR page and FAQ: still 13 questions? Any new question, especially on inspections or records?',
    'Compliance Program 7382.850: still the current version? Any revision to Attachment A, the models, or the Situation 1 examples? FDA said it would not supplement it, but check.',
    'Any CDRH webinar or town hall after 1 April 2026, and any new CDRH Learn QMSR module.',
    'New Warning Letters from QMSR-era inspections, and the clauses they cite. Update slide 23 and handout section 4.6 if there is a better example.',
    'FDA\'s FY2026 inspection observation spreadsheet, due after 30 September 2026: the first official QMSR citation data. Replace the FY2025 baseline figures on slide 24 when it publishes.',
    'Any FDA statement on enforcement posture, inspection volumes or foreign inspection practice for devices.',
    'Status of the draft guidance Quality Management System Information for Certain Premarket Submission Reviews (November 2025): finalized?',
    'Status of the Computer Software Assurance guidance update and the human factors guidance revision, both reported in 2026 but not verified here.',
    'The MDSAP Audit Approach revision reported as P0002.010 (February 2026): confirm the document number and that the US chapter now cites §820.10, §820.35 and §820.45.',
    'ISO 13485 revision status in ISO/TC 210, and the publication status of ISO/TS 23485, the application guideline.',
    'Whether FDA has published any QMSR-related guidance revisions promised in the final rule preamble.',
  ]));
  c.push(h3('Statements to be careful with'));
  c.push(...bullets([
    '**The compliance program issue date.** The PDF cover says 2 February 2026; several law firms report 30 January 2026. Say "issued at the end of January 2026 and applicable from 2 February" if you want to avoid the question.',
    '**The final rule date.** 2 February 2024 is the Federal Register publication date; FDA\'s FAQ says the rule was issued 31 January 2024.',
    '**Cost savings.** The final rule quotes roughly $532 million annualized at 7% in its executive summary and roughly $507 million in its economic analysis section. If you use a number, quote the range and the source.',
    '**Vendor inspection statistics.** Percentages such as "about 90% of 2026 observations cite ISO clauses" and "almost all classified VAI" are vendor compilations of FDA databases, not FDA publications. Attribute them or leave them out.',
    '**Element counts.** The 22 non-sterile and 23 sterile figures for Model 2 come from counting the elements listed in Figure 2 of the compliance program, and are also reported by law firms. If challenged, point to Figure 2 itself.',
  ]));

  c.push(h1('9. Variants'));
  c.push(h2('60-minute version'));
  c.push(...bullets(['Cut slides 5, 7, 15, 27, 28, 29, 35 and 37. Run Exercise A only, at 8 minutes. Section 5 becomes slides 34 and 36 in five minutes. Close with the takeaways and 10 minutes of Q&A.']));
  c.push(h2('Half-day workshop (3 hours)'));
  c.push(...bullets([
    'Add a 30-minute session on the Gap Assessment Workbook: each table completes five rows for its own firm, with evidence columns filled from memory and gaps flagged for verification.',
    'Extend Exercise A to 25 minutes and add a second evidence pack: a complaint file with a missing reportability decision and a design change with no significance assessment.',
    'Add a 30-minute mock-inspection rehearsal: one table plays the investigator, one the front room, one the back room, with the thread starting from a supplied product risk.',
    'Close with participants completing the 30-60-90 plan in handout section 8, with owners and dates.',
  ]));
  c.push(h2('Executive briefing (20 minutes)'));
  c.push(...bullets(['Slides 1, 9, 22, 24, 34 and 39. The argument for a leadership audience is narrow: the records they sign are now inspection documents, risk management is the top observation area, and the roadmap needs a named sponsor and five metrics in management review.']));
  return c;
}

// ---------- build ----------
(async () => {
  const outputs = [
    ['out/QMSR-Transition-Participant-Handout.docx', 'QMSR Transition: Participant Handout', 'QMSR Transition  ·  Participant Handout  ·  Elder Consulting, LLC', handout],
    ['out/QMSR-Transition-Workshop-Exercise-Pack.docx', 'QMSR Transition: Workshop Exercise Pack', 'QMSR Transition  ·  Workshop Exercise Pack  ·  Elder Consulting, LLC', exercisePack],
    ['out/QMSR-Transition-Facilitator-Guide.docx', 'QMSR Transition: Facilitator Guide', 'QMSR Transition  ·  Facilitator Guide (speaker only)  ·  Elder Consulting, LLC', facilitator],
  ];
  for (const [file, title, footer, fn] of outputs) {
    const doc = makeDoc(title, footer, fn());
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(file, buf);
    console.log('wrote', file, buf.length, 'bytes');
  }
})();
