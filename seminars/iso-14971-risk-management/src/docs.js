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
  rows.forEach((r, ri) => out.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { fill: o.plain ? undefined : (ri % 2 === 0 ? TINT2 : 'FFFFFF'), bold: i === 0 && o.boldFirst !== false, size: o.size })) })));
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
    creator: 'Elder Consulting, LLC', title, description: 'Risk Management Workshop (ISO 14971) seminar material',
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
  ['0:00 - 0:05', 'Opening: the asymmetry, objectives, room poll'],
  ['0:05 - 0:18', '1. The file is the argument: what ISO 14971:2019 actually requires'],
  ['0:18 - 0:30', '2. Two regulators, one standard: where EU and FDA expectations part'],
  ['0:30 - 0:45', 'Exercise A: repair the hazard chain (15 min)'],
  ['0:45 - 0:58', '3. Risk control and residual risk that survive review'],
  ['0:58 - 1:12', 'Exercise B: red-team a risk file against the GSPRs (14 min)'],
  ['1:12 - 1:22', '4. Closing the loop: production and post-production information'],
  ['1:22 - 1:30', 'Exercise C: your 30-day plan, takeaways, Q&A (8 min)'],
];

const CLAUSES = [
  ['4  General requirements for risk management system', '4.1 risk management process; 4.2 management responsibilities; 4.3 competence of personnel; 4.4 risk management plan; 4.5 risk management file'],
  ['5  Risk analysis', '5.1 risk analysis process; 5.2 intended use and reasonably foreseeable misuse; 5.3 identification of characteristics related to safety; 5.4 identification of hazards and hazardous situations; 5.5 risk estimation'],
  ['6  Risk evaluation', 'No subclauses. Compare each estimated risk against the criteria defined in the plan. An acceptable risk goes straight to 7.6 and its estimated risk is treated as the residual risk'],
  ['7  Risk control', '7.1 risk control option analysis; 7.2 implementation of risk control measures; 7.3 residual risk evaluation; 7.4 benefit-risk analysis; 7.5 risks arising from risk control measures; 7.6 completeness of risk control'],
  ['8  Evaluation of overall residual risk', 'No subclauses. A separate evaluation, by the method the plan declared, against the criteria the plan declared'],
  ['9  Risk management review', 'No subclauses. Review before release; the output is the risk management report'],
  ['10  Production and post-production activities', '10.1 general; 10.2 information collection; 10.3 information review; 10.4 actions'],
];

const PLAN44 = [
  ['a)', 'The scope of the planned risk management activities, identifying and describing the device and the life cycle phases covered', 'What is in and what is excluded, with a reason'],
  ['b)', 'Assignment of responsibilities and authorities', 'Who may sign a residual risk acceptable, and who may sign the overall residual risk. Two distinct authorities'],
  ['c)', 'Requirements for review of risk management activities', 'The milestones that produce the Clause 9 report'],
  ['d)', 'Criteria for risk acceptability, based on the manufacturer’s policy for determining acceptable risk, including criteria for the case where the probability of occurrence of harm cannot be estimated', 'The matrix, the policy behind it, AND the severity-only rule. Most plans are silent on the second half'],
  ['e)', 'A method to evaluate overall residual risk, and the criteria for its acceptability', 'How Clause 8 will be done, decided before the answer is known'],
  ['f)', 'Activities for verification of the implementation and effectiveness of risk control measures', 'Which record will prove each of the two'],
  ['g)', 'Activities related to collection and review of relevant production and post-production information', 'Whether Clause 10 will happen at all'],
];

const GSPR_COVER = [
  ['Point 1', 'Devices shall achieve the performance intended, be safe and effective, and not compromise the clinical condition or safety of patients, provided that any risks constitute acceptable risks when weighed against the benefits, taking into account the generally acknowledged state of the art', 'Not listed'],
  ['Point 2', 'The requirement in this Annex to reduce risks as far as possible means the reduction of risks as far as possible without adversely affecting the benefit-risk ratio', 'Not listed'],
  ['Point 3', 'Manufacturers shall establish, implement, document and maintain a risk management system. Risk management is a continuous iterative process throughout the entire lifecycle, requiring regular systematic updating, with the sub-points (a) to (f)', 'Covered'],
  ['Point 4', 'Risk control measures shall conform to safety principles taking account of the state of the art; the residual risk associated with each hazard and the overall residual risk shall be judged acceptable; and a mandatory order of priority (a) to (c). Closes with: manufacturers shall inform users of any residual risks', 'Covered'],
  ['Point 5', 'Reduce as far as possible the risks related to use error, including ergonomic features and the knowledge, experience, education and training of the intended user and the use environment', 'Covered'],
  ['Point 6', 'Consideration of the technical knowledge, experience, education, training and use environment, and the medical and physical conditions of intended users (design for lay, professional, disabled or other users)', 'Not listed'],
  ['Point 7', 'Devices shall be designed, produced and packed so that their characteristics and performance are not adversely affected during transport and storage', 'Not listed'],
  ['Point 8', 'All known and foreseeable risks, and any undesirable side-effects, shall be minimised and be acceptable when weighed against the evaluated benefits to the patient or user arising from the achieved performance', 'Covered'],
  ['Point 9', 'Requirements for devices without an intended medical purpose listed in Annex XVI', 'Covered'],
];

const MDR_PLUMBING = [
  ['Article 10(2)', 'Manufacturers shall establish, document, implement and maintain a system for risk management as described in Section 3 of Annex I'],
  ['Article 10(9)(e)', 'The quality management system shall address at least risk management as set out in Section 3 of Annex I'],
  ['Annex I point 3 (e) and (f)', 'Evaluate the impact of information from the production phase and from post-market surveillance on hazards and their frequency of occurrence, on risk estimates, on overall risk, on the benefit-risk ratio and on risk acceptability; and, based on that evaluation, amend control measures if necessary'],
  ['Annex II point 5', 'The technical documentation shall contain (a) the benefit-risk analysis referred to in Sections 1 and 8 of Annex I, and (b) the solutions adopted and the results of the risk management referred to in Section 3 of Annex I'],
  ['Article 83(3)(a)', 'PMS data is used first to update the benefit-risk determination and to improve the risk management as referred to in Chapter I of Annex I. Article 83(3) closes: "The technical documentation shall be updated accordingly"'],
  ['Annex III point 1(b)', 'The post-market surveillance plan shall contain suitable indicators and threshold values that shall be used in the continuous reassessment of the benefit-risk analysis and of the risk management referred to in Section 3 of Annex I'],
  ['Article 86(1)(a)', 'The periodic safety update report shall set out, throughout the lifetime of the device, the conclusions of the benefit-risk determination'],
  ['Article 88(1)', 'Trend reporting where a statistically significant increase in the frequency or severity of non-serious incidents or expected undesirable side-effects could change the benefit-risk analysis referred to in Sections 1 and 8 of Annex I'],
  ['Annex XIV Part A point 1(a)', 'The clinical evaluation plan shall specify methods for examining clinical safety with clear reference to the determination of residual risks and side-effects, and an indicative list and specification of parameters to be used to determine, based on the state of the art in medicine, the acceptability of the benefit-risk ratio'],
  ['Annex XIV Part B points 6.2(d) and 8', 'The PMCF plan references the relevant parts of the clinical evaluation report and the risk management; the PMCF evaluation report conclusions shall be taken into account in the clinical evaluation AND in the risk management'],
  ['Article 61(10)', 'Where demonstration of conformity based on clinical data is not deemed appropriate, adequate justification shall be given based on the results of the manufacturer’s risk management'],
  ['Recital 33', 'The risk management system should be carefully aligned with and reflected in the clinical evaluation. The risk management and clinical evaluation processes should be inter-dependent and should be regularly updated'],
];

const FDA_HOOKS = [
  ['ISO 13485 Clause 4.1.2 b)', 'Apply a risk-based approach to the control of the appropriate processes needed for the quality management system. This is an inspectable element in its own right: Compliance Program 7382.850 lists "Risk-based Approach (Clause 4.1.2 b))" as an element under the Management Oversight QMS Area'],
  ['ISO 13485 Clause 7.1', 'Document one or more processes for risk management in product realization, and retain records arising from risk management'],
  ['ISO 13485 Clause 7.3 (design and development)', 'Risk proportionality throughout design planning, inputs, outputs, review, verification, validation, transfer and change control'],
  ['ISO 13485 Clause 7.4 (purchasing)', 'Supplier evaluation, selection, monitoring and re-evaluation criteria proportionate to the risk associated with the purchased product'],
  ['ISO 13485 Clauses 7.5 and 7.6', 'Production and service provision controls, process validation, and control of monitoring and measuring equipment, each risk-proportionate'],
  ['ISO 13485 Clause 8.2 (feedback, complaints, reporting)', 'Feedback is an input to risk management. This is the FDA analogue of ISO 14971 Clause 10'],
];

const TEN_THINGS = [
  'Put the acceptability criteria in the risk management plan, and date them before the risk table.',
  'Add a verification of EFFECTIVENESS record to every risk control that currently has only an implementation record.',
  'Separate P1 and P2 in every row, and write the basis for each.',
  'Split every row where one hazard reaches more than one hazardous situation.',
  'Add the severity-only rule for the case where probability of occurrence of harm cannot be estimated (Clause 4.4 d).',
  'Add a Clause 7.6 completeness step to the procedure, and run it over the acceptable rows too.',
  'Strike every cost argument out of the order-of-priority justifications.',
  'Add residual risk disclosure references for every risk control in the information-for-safety category.',
  'Put indicators and threshold values in the post-market surveillance plan, and link them to the risk rows they are meant to test.',
  'Rebuild the GSPR matrix against MDR Annex I as it stands now, not against the seven content deviations of the withdrawn EN ISO 14971:2012.',
];

const SOURCES = [
  'ISO 14971:2019, Medical devices - Application of risk management to medical devices, third edition, December 2019; reviewed and confirmed March 2025. ISO/TC 210 with IEC/SC 62A.',
  'ISO/TR 24971:2020, Medical devices - Guidance on the application of ISO 14971. Annex C gives guidance on the policy for establishing criteria for risk acceptability required by Clause 4.2, and compares ALARP, AFAP, ALARA and ALAP.',
  'EN ISO 14971:2019 as amended by EN ISO 14971:2019/A11:2021. A11 replaces the European foreword and adds Annex ZA (MDR) and Annex ZB (IVDR). It does not modify the normative text.',
  'ISO/TS 24971-2:2026, Guidance on the application of ISO 14971 - Part 2: Machine learning in artificial intelligence, published June 2026.',
  'Regulation (EU) 2017/745 (MDR), consolidated text of 9 July 2024.',
  'Commission Implementing Decision (EU) 2022/757 of 11 May 2022, OJ L 138, 17.5.2022, p. 27, adding EN ISO 14971:2019 with A11:2021 as entry 16 of the Annex to Decision (EU) 2021/1182 (MDR harmonised standards).',
  'Commission Implementing Decision (EU) 2022/729 of 11 May 2022, OJ L 135, 12.5.2022, p. 31, the equivalent IVDR citation as entry 10 of the Annex to Decision (EU) 2021/1195.',
  'Commission summary list of harmonised standards for Regulation (EU) 2017/745, generated 17 June 2026: the EN ISO 14971 row shows start of legal effect 17.05.2022 and no end of legal effect or withdrawal reference.',
  'MDCG 2021-5 rev.1, Guidance on standardisation for medical devices, July 2024, section 2.3 on what an Annex Z is and does.',
  'MDCG 2025-10, Guidance on post-market surveillance of medical devices and IVDs, December 2025, Table 3 on the PMS-to-risk-management interface.',
  'MDCG 2019-16 rev.1, Guidance on cybersecurity for medical devices, July 2020, section 3.2 on security risk management.',
  'Team-NB, Position Paper on Technical Documentation under the MDR, V3, 9 April 2025.',
  '21 CFR Part 820 as in force from 2 February 2026; 820.7 incorporates ISO 13485:2016 by reference. QMSR final rule, 89 FR 7496 (2 February 2024).',
  'FDA Compliance Program 7382.850, Inspection of Medical Device Manufacturers, date of issuance and implementation 2 February 2026, Attachment A.',
  'FDA recognized consensus standards database, for the currently recognized edition of ISO 14971 and any transition notice.',
];

// =====================================================================
// 1. PARTICIPANT HANDOUT
// =====================================================================
function handout() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  WORKSHOP', 'Risk Management Workshop',
    'ISO 14971 in practice: aligning risk files with EU MDR and FDA expectations',
    ['**Participant handout**  ·  Elder Consulting, LLC  ·  September 2026',
     'Duration 90 minutes, of which 35 minutes are hands-on exercises.',
     'Companion materials: Hands-On Exercise Pack; ISO 14971 Risk File Toolkit (Excel, 10 sheets); Facilitator Guide (speaker copy).']));

  c.push(h1('1  How to use this handout'));
  c.push(p('This is the reference, not the script. Sections 2 to 7 follow the workshop; sections 8 and 9 are reference material you will want after the session. Every factual claim carries its source in section 10.'));
  c.push(p('Nothing here is legal or regulatory advice. Content was verified in September 2026. Harmonised-standard citations, MDCG guidance and FDA recognition entries change; re-verify before you rely on any of it as evidence.'));
  c.push(h3('Agenda'));
  c.push(table(['Time', 'Section'], AGENDA, [1900, 8180]));

  c.push(h1('2  The file is the argument, not the archive'));
  c.push(p('ISO 14971:2019 Clause 3.25 defines the risk management file as **the set of records and other documents that are produced by risk management**. That is the whole definition: no list of contents, no format, no template. The content requirements are distributed through the standard, because almost every clause ends with a sentence sending its output to the file.'));
  c.push(p('The obligation that turns a folder into a file is in Clause 4.5. The file must provide **traceability for each identified hazard** to the risk analysis, the risk evaluation, the risk control measures, and the assessment of the acceptability of any residual risk. The file may be a set of references to records held elsewhere; what it may not be is unwalkable.'));
  c.push(callout(['**The practical test.** A reviewer picks one hazard, usually from the device’s clinical profile or from your own complaint data rather than from your index, and walks it end to end. If the file holds for the row they picked at random, they believe the rest. If it breaks, they pick three more.']));
  c.push(h3('What the file has to be able to answer'));
  c.push(table(['A reviewer asks', 'The file answers it from'], [
    ['Where did this hazard come from?', 'Clause 5.3 characteristics related to safety; Clause 5.4 hazard identification'],
    ['How does this hazard reach a harm?', 'Clause 5.4 foreseeable sequences of events and the resulting hazardous situation'],
    ['Where did this number come from?', 'Clause 5.5 risk estimation, plus the qualitative or quantitative categorisation system used for probability and severity'],
    ['Why is this acceptable?', 'Clause 4.4 d) criteria; Clause 6 risk evaluation; Clause 7.3 residual risk evaluation'],
    ['What did you do about it, and does it work?', 'Clause 7.1 option analysis; Clause 7.2, both verifications'],
    ['What has changed since?', 'Clause 10.2 collection; 10.3 review; 10.4 actions'],
  ], [3200, 6880]));

  c.push(h2('2.1  The clause structure'));
  c.push(table(['Clause', 'Subclauses and what they require'], CLAUSES, [3300, 6780]));
  c.push(callout([
    '**Two structural points that catch procedures out.** First, Clause 7 runs to **7.6**, not 7.5. A procedure that ends at 7.5 has no completeness-of-risk-control step.',
    'Second, Clause 6 routes an acceptable risk straight to 7.6 and directs that the estimated risk be treated as the residual risk. So Clause 7.6 applies to **every** hazardous situation, including the ones that never needed a control. People assume the acceptable ones drop out of the process; they do not.',
  ]));
  c.push(small('Clause 2 is also new in the third edition, and it states that there are no normative references in the document. Conforming to ISO 14971 therefore does not pull in ISO/TR 24971: the TR is guidance, not requirement.'));

  c.push(h2('2.2  Three definitions arrived in 2019'));
  c.push(p('Clause 3 carries 31 definitions (3.1 to 3.31). Most are now sourced from ISO/IEC Guide 63:2019 rather than the older Guide 51 lineage, and defined terms are printed in italics in the body text. Three definitions are entirely new in the third edition, and each one creates an obligation elsewhere.'));
  c.push(table(['Term', 'Substance', 'What it costs you'], [
    ['3.2  benefit', 'A positive impact or desirable outcome of the use of a medical device on the health of an individual, or a positive impact on patient management or on public health', 'Clause 7.4 and Clause 8 now expect a characterised benefit: nature, magnitude, probability and duration. "It treats the disease" is not a benefit statement you can weigh a risk against'],
    ['3.15  reasonably foreseeable misuse', 'Use of a product or system in a way not intended by the manufacturer but which can result from readily predictable human behaviour. Sourced from ISO/IEC Guide 63:2019, 3.8', 'Clause 5.2 is now "intended use AND reasonably foreseeable misuse". Misuse can be intentional or unintentional, and a workaround you already know about is foreseeable by definition'],
    ['3.28  state of the art', 'The developed stage of technical capability at a given time as regards products, processes and services, based on the relevant consolidated findings of science, technology and experience. Not necessarily the most technologically advanced solution', 'An input to the Clause 4.2 policy and a named trigger in Clause 10.3. It ages your file with no failure, no complaint and no trend'],
  ], [2000, 4040, 4040]));
  c.push(small('Clause 3.30 use error is sourced from IEC 62366-1:2015, 3.21. That is the explicit textual bridge between ISO 14971 and usability engineering, and it is why the effectiveness of an information-for-safety control is proven in the usability engineering file or nowhere.'));

  c.push(pageBreak());
  c.push(h1('3  The plan decides the answer before you know it'));
  c.push(p('Clause 4.4 requires the risk management plan to include seven things. Every one of them is a decision that has to be made **before** the analysis, and the commonest finding in this clause is a plan whose acceptability criteria were evidently written after the risk table had been coloured in. Changes to the plan are themselves recorded in the risk management file, so a plan at revision 1 alongside a risk table at revision 7 is a finding on its own.'));
  c.push(table(['4.4', 'The plan shall include', 'What it really decides'], PLAN44, [600, 5000, 4480]));
  c.push(callout(['**The half of 4.4 d) nobody writes.** The criteria must include the criteria for the case where the probability of occurrence of harm **cannot be estimated**. In practice that means a severity-only evaluation with a stated decision rule. Almost every plan is silent here, and the gap only becomes visible when a novel hazard arrives with no data behind it.']));
  c.push(h3('The two authorities in 4.4 b)'));
  c.push(p('Accepting an individual residual risk (Clause 7.3) and accepting the overall residual risk (Clause 8) are different decisions with different consequences, and the plan should name who may make each. In practice the first is usually delegated and the second is not.'));

  c.push(h1('4  Two regulators, one standard'));
  c.push(h2('4.1  FDA: not incorporated, and still inspected'));
  c.push(p('ISO 14971 is **not** incorporated by reference into 21 CFR Part 820. Section 820.7 incorporates ISO 13485:2016. In the QMSR rulemaking FDA was asked to incorporate ISO 14971 as well and declined, on the basis that the risk management requirements it needs are already captured through ISO 13485.'));
  c.push(p('Declining to incorporate the standard did not reduce the obligation; it relocated it. Risk management is enforced through the ISO 13485 clauses that Part 820 does incorporate, and an observation is written against those clauses rather than against ISO 14971.'));
  c.push(table(['Where FDA reaches risk management', 'What it asks for'], FDA_HOOKS, [3100, 6980]));
  c.push(callout(['**The answer to "is ISO 14971 mandatory for FDA?"** The standard is not; the activity is. ISO 14971:2019 is an FDA-recognized consensus standard, so conformance can be declared in a submission - but recognition is not incorporation. Check the current recognition entry and any transition notice before citing an edition.'], TINT));

  c.push(h2('4.2  EU: harmonised, but narrowly'));
  c.push(p('EN ISO 14971:2019 as amended by EN ISO 14971:2019/A11:2021 is a harmonised standard for the MDR, cited by Commission Implementing Decision (EU) 2022/757 of 11 May 2022, OJ L 138, 17.5.2022, p. 27. The equivalent IVDR citation is Decision (EU) 2022/729, OJ L 135, 12.5.2022. Both were still live, with no end of legal effect, on the Commission summary lists generated 17 June 2026.'));
  c.push(p('Two facts that surprise people. There was **no harmonised risk management standard under the MDR between 26 May 2021 and 17 May 2022**, because the base decision could not cite EN ISO 14971:2019 before A11 existed. And A11:2021 does not change a word of the normative text: it replaces the European foreword and adds Annex ZA for the MDR and Annex ZB for the IVDR.'));
  c.push(h3('What Annex ZA covers, and what it does not'));
  c.push(p('Annex ZA is a correspondence table between the clauses of the standard and the MDR general safety and performance requirements. It addresses a narrow set: MDR Annex I Chapter I points 3, 4, 5, 8 and 9. Points 1, 2, 6 and 7 are not listed as covered, and neither is any of Chapter II (points 10 to 22) or Chapter III (point 23). Presumption of conformity can be claimed only for what the Annex Z lists as covered.'));
  c.push(table(['MDR Annex I Chapter I', 'Substance', 'Annex ZA'], GSPR_COVER, [1200, 7280, 1600]));
  c.push(callout([
    '**Kill the zombie.** The seven **content deviations** that consultants and gap analyses still cite belong to **EN ISO 14971:2012**, the Directive-era European edition. That edition was superseded by EN ISO 14971:2019 with conflicting national standards withdrawn by 30 June 2020. A11:2021 contains **no content deviations** at all - it uses a correspondence table with coverage notes instead. A GSPR matrix built on the seven deviations is built on a withdrawn standard.',
  ], REDTINT));
  c.push(small('MDCG 2021-5 rev.1, Guidance on standardisation for medical devices, section 2.3, is the authoritative explanation of what an Annex Z is: it is the tool that identifies the legal requirements NOT covered, and without an adequate Annex Z a standard cannot be cited in the OJEU at all. It also confirms that a standard covering more than one EU act carries several annexes designated ZA, ZB and so on - which is why EN ISO 14971:2019/A11:2021 has both.'));

  c.push(h2('4.3  AFAP is not ALARP'));
  c.push(p('The cleanest way to see the difference is by what is absent from the regulation. The word **ALARP** appears nowhere in the MDR. Neither does any reference to economic considerations. The Medical Devices Directive 93/42/EEC did contain a recital permitting "technical and economical considerations compatible with a high level of protection of health and safety" - and that recital was not carried into the MDR.'));
  c.push(p('So the MDR’s only stated limit on how far a risk must be reduced is the one in Annex I point 2: without adversely affecting the benefit-risk ratio. Not cost, not schedule, not manufacturability.'));
  c.push(table(['', 'ALARP', 'AFAP'], [
    ['Full form', 'As low as reasonably practicable', 'As far as possible'],
    ['Admits economic impact?', 'Yes. Cost, effort and time enter the judgement of how far to go', 'No. MDR Annex I point 2 limits the obligation only by the benefit-risk ratio'],
    ['Where it comes from', 'Occupational safety regimes; carried into device practice in the Directive era', 'MDR Annex I point 2, as the definition of a phrase used throughout Annex I'],
    ['Effect on an "acceptable" risk', 'An acceptable risk can be left alone on economic grounds', 'An acceptable risk still has to be reduced as far as possible. "It is in the green zone" is not a stopping argument'],
  ], [1900, 4090, 4090]));
  c.push(callout(['**Where the choice actually lives.** ISO/TR 24971:2020 Annex C gives guidance on the policy for establishing criteria for risk acceptability required by ISO 14971:2019 Clause 4.2. It identifies the possible elements of that policy and lists the approaches to risk control - ALARP, AFAP, ALARA and ALAP. The standard does not choose for you. Your policy does, and for an EU device the Regulation constrains the choice.']));
  c.push(small('One asymmetry worth knowing: the IVDR carries recital 13, tying the AFAP obligation to the generally acknowledged state of the art in the field of medicine. The MDR has no equivalent recital; its state-of-the-art hook sits in Annex I points 1 and 4 instead. There is no MDCG guidance dedicated to risk management or to the AFAP question, and none in the Commission’s published guidance pipeline.'));

  c.push(pageBreak());
  c.push(h1('5  The hazard chain'));
  c.push(p('A hazard is a potential source of harm (3.4). On its own it does nothing. A foreseeable sequence of events turns the hazard into a hazardous situation (3.5), which is a circumstance in which people, property or the environment are exposed to one or more hazards. Only then can harm (3.3) occur, and whether it does is a separate question.'));
  c.push(exhibit('THE CHAIN', 'Clause 5.4 and 5.5', [
    'HAZARD                  a potential source of harm (3.4)',
    '   |',
    '   |   foreseeable sequence of events        P1 = probability that the',
    '   v   (5.4)                                     hazardous situation arises',
    '   |',
    'HAZARDOUS SITUATION     people exposed to the hazard (3.5)',
    '   |',
    '   |   exposure                              P2 = conditional probability',
    '   v                                             that it leads to the harm',
    '   |',
    'HARM                    injury or damage to health (3.3)',
    '',
    'Probability of occurrence of harm  =  P1 x P2',
  ]));
  c.push(p('The decomposition is described in ISO 14971:2019 Annex C and in ISO/TR 24971:2020. The reason to separate the two is not arithmetic - it is that they are defended with completely different evidence.'));
  c.push(table(['P1 is defended with engineering', 'P2 is defended clinically'], [
    ['Failure rates, bench test results and field return rates', 'Who is exposed, and for how long'],
    ['Use frequency and exposure in the intended environment', 'Whether the harm is detectable before it becomes harm'],
    ['Observed rates from complaints and service data', 'Whether it is reversible, and whether anyone intervenes in time'],
  ], [5040, 5040], { boldFirst: false }));
  c.push(callout(['**One row per hazardous situation, not one row per hazard.** A single hazard reaches several hazardous situations by several sequences, and each one carries its own probability and often its own severity. Collapsing them into one row is what makes a probability estimate impossible to defend: a reviewer who asks "which half of this number is clinical?" gets silence.']));

  c.push(h1('6  Risk control and residual risk'));
  c.push(h2('6.1  The order of priority is an order'));
  c.push(p('ISO 14971 Clause 7.1 and MDR Annex I point 4 say the same thing, and both say it as a sequence. MDR point 4 is worth quoting because the wording is unambiguous: "In selecting the most appropriate solutions, manufacturers shall, in the following order of priority". And before the list, point 4 requires that the residual risk associated with **each hazard** as well as the **overall** residual risk be judged acceptable.'));
  c.push(table(['Order', 'The option', 'What it does to the probabilities'], [
    ['1', 'Inherent safety by design and manufacture: eliminate the hazard, or eliminate the sequence of events that reaches it', 'Changes P1. The only option that can take a hazardous situation off the table'],
    ['2', 'Adequate protection measures, including alarms if necessary, in relation to risks that cannot be eliminated', 'Usually changes P1; sometimes changes P2 where it buys time to intervene'],
    ['3', 'Information for safety - warnings, precautions, contra-indications - and, where appropriate, training to users', 'Rarely changes P1 at all. May change P2 if it changes what the user does in time'],
  ], [700, 5680, 3700]));
  c.push(callout([
    '**You may stop at option 2 or 3. You may not stop without a record of why the higher option was not practicable** - and under MDR Annex I point 2, that record cannot rest on cost.',
    'MDR point 4 closes with a sentence people forget because it sits after the list: "Manufacturers shall inform users of any residual risks." Not significant residual risks - **any**. That is broader than ISO 14971 Clause 8, which speaks of significant residual risks in the accompanying documentation.',
  ]));
  c.push(small('Information for safety does not reduce the probability that the hazardous situation arises. A warning cannot stop an occlusion forming. If a risk file credits an information-for-safety control with a large drop in P1, that is the row a reviewer opens first.'));

  c.push(h2('6.2  Clause 7.2 asks for two verifications'));
  c.push(p('Clause 7.2 requires verification of the **implementation** of each risk control measure, and verification of the **effectiveness** of each risk control measure. Two verifications, two records, different evidence. The second is the one that gets skipped, because the answer has to connect back to the number written in the residual risk column.'));
  c.push(table(['Control category', 'Verification of IMPLEMENTATION', 'Verification of EFFECTIVENESS'], [
    ['1  Inherent safety by design', 'Drawing or specification revision; design verification report; build records showing the change is in the product', 'Test that the hazardous situation can no longer arise, or arises at the claimed lower rate. Field data after the change'],
    ['2  Protective measure', 'Specification and design verification of the guard, interlock, detector or lockout; production test records', 'Challenge the measure under worst-case conditions across the full operating range, not only at nominal. Show that it triggers'],
    ['2  Alarm', 'Alarm specification, levels and priorities verified against the design input', 'Audibility and comprehension in the real use environment with the real user. A bench sound-pressure measurement is implementation, not effectiveness'],
    ['3  Information for safety', 'IFU or label approval record; artwork release; training material release', 'Usability evidence that users find it, understand it and act on it. **An approved IFU is not effectiveness evidence.**'],
  ], [1900, 4090, 4090]));
  c.push(callout(['**The test for an effectiveness record:** does the evidence support the size of the reduction claimed in the residual risk column? If you credited a control with moving P1 from 4 to 2, the effectiveness record has to support a two-order-of-magnitude claim. If it does not, the residual estimate is unsupported and the row fails.'], GOLDTINT));

  c.push(h2('6.3  The two clauses procedures stop short of'));
  c.push(table(['Clause', 'What it requires'], [
    ['7.5  Risks arising from risk control measures', 'Review the effects of the risk control measures for (i) new hazards or hazardous situations introduced and (ii) whether the estimated risks for previously identified hazardous situations are affected. Any new or increased risk is managed in accordance with 5.5 to 7.4 - which means it gets its own row, its own estimate and its own residual risk'],
    ['7.6  Completeness of risk control', 'Confirm that the risks from all identified hazardous situations have been considered. Because Clause 6 routes acceptable risks straight here, 7.6 covers every hazardous situation, controlled or not'],
  ], [2900, 7180]));
  c.push(h3('Real examples of a control creating a risk'));
  c.push(...bullets([
    'An escalating alarm profile solves audibility, and creates alarm fatigue and caregiver dependence.',
    'A plasticiser-free administration set solves leachables, and changes tubing stiffness and therefore pumping accuracy.',
    'A stronger pouch seal solves sterile barrier integrity in distribution, and makes aseptic opening harder.',
    'A hard dose limit solves programming error, and creates a workaround where clinicians split doses across two pumps.',
  ]));

  c.push(h2('6.4  7.3, 7.4 and 8 are three different questions'));
  c.push(table(['Clause', 'The question', 'Scope'], [
    ['7.3  Residual risk evaluation', 'Is this residual risk acceptable against the criteria the plan declared?', 'Per risk. If yes, done. If no, go to 7.4'],
    ['7.4  Benefit-risk analysis', 'Do the benefits of the intended use outweigh this residual risk?', 'Per risk, and conditional. It applies only where the residual risk is NOT acceptable AND further risk control is not practicable. Two gates'],
    ['8  Overall residual risk', 'Is the overall residual risk of the device acceptable, by the method and criteria the plan declared?', 'Per device. Not the sum of the rows'],
  ], [2400, 4640, 3040]));
  c.push(callout(['**A benefit-risk analysis used as a shortcut around risk control is a finding, not a conclusion.** Clause 7.4 has two gates, and "further risk control is not practicable" has to be argued and recorded - on a basis that, for an EU device, is not economic.'], REDTINT));
  c.push(h3('What a credible Clause 8 evaluation considers'));
  c.push(...bullets([
    'The combination of individual residual risks, particularly where they affect the same patient episode.',
    'Risks arising from a single common cause, where one failure produces several hazardous situations at once.',
    'Conflicting requirements between risk controls, and how the conflicts were resolved.',
    'The number and nature of warnings and instructions that safety rests on. A device whose safety rests on a stack of warnings has a higher overall residual risk than the individual rows suggest.',
    'Comparison with similar devices on the market and the generally acknowledged state of the art.',
    'The clinical benefit and the benefit-risk conclusion.',
    'Information from production and post-production, for a device already on the market.',
    'Disclosure of significant residual risks in the accompanying information.',
    'The conclusion, stated against the criteria the plan declared, signed by someone with the authority to sign it.',
  ]));
  c.push(small('Team-NB’s Position Paper on Technical Documentation under the MDR, V3, 9 April 2025, states that the MDR does not permit risk acceptance based on a risk priority number alone or on a "green" zone: the acceptability of each risk must be decided individually against predefined criteria. It also expects a statement that the clinical benefits outweigh all the residual risks, and three distinct risk assessments - design, production and process, and clinical or application.'));

  c.push(pageBreak());
  c.push(h1('7  Closing the loop'));
  c.push(h2('7.1  Clause 10: four questions of every input'));
  c.push(p('Clause 10 has four subclauses: 10.1 general, 10.2 information collection, 10.3 information review, 10.4 actions. The plan has to name the activities under Clause 4.4 g). This is the clause most often found empty on a device that has been marketed for years.'));
  c.push(h3('10.2  Sources you have to collect from'));
  c.push(...bullets([
    'Information generated during production and the monitoring of the production process.',
    'Information from the user.',
    'Information from installation, servicing and maintenance.',
    'Publicly available information.',
    'Information on the generally acknowledged state of the art. **This is a named source, and it is the one nobody collects.**',
  ]));
  c.push(h3('10.3  The four questions, and what a "yes" costs'));
  c.push(table(['The question', 'If the answer is yes'], [
    ['Is there a previously unrecognised hazard or hazardous situation?', 'A new row. Full estimation, evaluation, control and residual risk under Clauses 5.5 to 7.4'],
    ['Is an estimated risk no longer acceptable?', 'Risk control is reopened. The individual residual risk and the overall residual risk are both revisited'],
    ['Is the original risk estimate no longer valid?', 'The estimate is corrected and its basis updated. This is the question that catches optimistic P1 values'],
    ['Has the state of the art changed?', 'Your AFAP position may have moved with nothing having failed. Comparator devices, new standards and new guidance all count'],
  ], [4200, 5880]));
  c.push(p('Clause 10.4 says what follows: the impact is evaluated as an input to the risk management process, the risk management file is reviewed, and if the residual risk or its acceptability has changed, the impact on previously implemented risk control measures is evaluated and fed into the risk management review.'));
  c.push(callout(['**The field test.** Pick one complaint from eighteen months ago. Find the risk file revision it produced. If there is no revision and no recorded decision that none was needed, the loop is open and Clause 10 is not being done - whatever the procedure says.'], GOLDTINT));

  c.push(h2('7.2  The MDR plumbing Clause 10 has to connect to'));
  c.push(p('In the EU, Clause 10 is not free-standing. It plugs into a named set of obligations, and notified bodies check the joints rather than the pipes.'));
  c.push(table(['MDR provision', 'What it requires of the risk file'], MDR_PLUMBING, [2400, 7680]));
  c.push(callout([
    '**Two numbering traps for your cross-references.** Corrigendum C2 renumbered MDR Annex III: the original text numbered the two items 1.1 and 1.2, the consolidated text numbers them 1 and 2, and Article 84 was corrected to match. An SOP still citing "Annex III Section 1.1" is citing superseded numbering.',
    'And Annex XIV Part B point 6.1(d) still refers to "the benefit-risk ratio referred to in Sections 1 and 9 of Annex I". Section 9 is the Annex XVI provision; the benefit-risk sections are 1 and 8. That cross-reference was never corrected, unlike the identical error in Article 88(1), which corrigendum C2 fixed.',
  ]));

  c.push(h2('7.3  The interfaces that get audited'));
  c.push(p('The risk file does not live alone, and findings cluster at the joins rather than inside any one document. For each row below, the audit question is simply: do these two documents agree?'));
  c.push(table(['Interface', 'What has to agree', 'Where it is required'], [
    ['Risk file and clinical evaluation', 'The risk acceptability criteria in the risk management plan, and the parameters for determining the acceptability of the benefit-risk ratio in the clinical evaluation plan, based on the state of the art in medicine', 'MDR Annex XIV Part A point 1(a); recital 33'],
    ['Risk file and post-market surveillance', 'The PMS plan indicators and threshold values, and the probabilities and severities in the risk file that they are meant to test', 'MDR Annex III point 1(b); MDCG 2025-10 Table 3'],
    ['Risk file and usability engineering', 'Use errors identified in the use-related risk analysis, and the critical tasks in the summative evaluation. The effectiveness of an information-for-safety control is proven here or nowhere', 'ISO 14971 Clause 3.30 sources use error from IEC 62366-1; MDR Annex I point 5'],
    ['Risk file and software or security', 'The software safety classification and the security risk records, and the hazardous situations they feed', 'MDR Annex I 17.1, 17.2, 17.4 and 18.8; MDCG 2019-16 rev.1 section 3.2; IEC 62304'],
  ], [2100, 5180, 2800]));
  c.push(small('MDCG 2025-10, Guidance on post-market surveillance, December 2025, Table 3, sets out the PMS-to-risk-management interface expectations: establish procedures to address the interface; link PMS plan indicators and threshold values to the risk management documentation; assess the impact of collected data on probability and severity ratings of existing or new risks; and evaluate the impact on overall risk, the benefit-risk ratio and risk acceptability.'));

  c.push(pageBreak());
  c.push(h1('8  Ten things to fix on Monday'));
  c.push(...numbered(TEN_THINGS));
  c.push(callout(['If you do only one, do number two. It is the finding that appears most often and it is the cheapest to close, because the work has usually already been done and simply was not written down as an effectiveness verification.'], GREENTINT));

  c.push(h1('9  Reference: the toolkit'));
  c.push(p('The ISO 14971 Risk File Toolkit accompanying this workshop is a working skeleton of a risk management file with ten sheets. Every pale-yellow cell is an input; everything else is reference data or a formula.'));
  c.push(table(['Sheet', 'Clause', 'What it is for'], [
    ['Read me', '-', 'How the workbook is built and what to replace before use'],
    ['RM Plan', '4.4', 'The seven required contents as a checklist, plus the MDR and FDA additions, with owner and status'],
    ['Scales', '4.4 d)', 'Example severity and P1 and P2 scales, the P1 x P2 combination table with its derivation shown, and the acceptability matrix. Replace all of it'],
    ['Hazard Analysis', '5.4, 5.5, 6, 7.1, 7.3, 7.6', 'The main risk table. One row per hazardous situation, with formula columns for the combined probability, the risk verdicts and a completeness check'],
    ['Risk Controls', '7.1, 7.2, 7.5', 'One row per control, with separate columns for verification of implementation and verification of effectiveness, and an order-of-priority justification'],
    ['Residual Risk', '8', 'Counts rolled up from the hazard table, and the nine inputs to the overall residual risk evaluation'],
    ['Benefit-Risk', '7.4, 8', 'One row per residual risk the criteria do not accept, plus an OVERALL row. Benefit characterised by nature, magnitude, probability and duration'],
    ['Prod & Post-Prod', '10.1 to 10.4', 'The Clause 10 log, with the four Clause 10.3 questions as columns and an overdue flag'],
    ['RM File Index', '4.5', 'The traceability index: 31 record types with document ID, revision and location'],
    ['Dashboard', '-', 'Every figure is a formula over the other sheets, ending in six exit criteria'],
  ], [1900, 1800, 6380]));
  c.push(callout([
    '**The worked example is deliberately imperfect.** The 16 example rows describe a programmable ambulatory infusion pump for home use. Two rows carry deliberate defects, one risk control is missing its effectiveness verification and its order-of-priority justification, one justification rests on cost, and one post-production item has not yet updated the file. The Dashboard reports all of them. The Facilitator Guide names each one.',
  ]));

  c.push(h1('10  Sources'));
  c.push(...bullets(SOURCES));
  c.push(callout(['**Verify before you rely on this.** Content was verified in September 2026. Harmonised-standard citations, MDCG guidance documents, Team-NB position papers and FDA recognition entries all change. Confirm against the primary sources before using any of this as evidence in a submission or an audit.'], REDTINT));
  c.push(spacer(200));
  c.push(small('Prepared by Elder Consulting, LLC. Workshop material; not legal or regulatory advice.'));
  return makeDoc('Risk Management Workshop (ISO 14971) - Participant Handout', 'Risk Management (ISO 14971)  ·  Participant Handout  ·  Elder Consulting, LLC', c);
}

// =====================================================================
// 2. HANDS-ON EXERCISE PACK
// =====================================================================
function exercises() {
  const c = [];
  c.push(...titleBlock('MEDICAL DEVICE SEMINAR  ·  WORKSHOP', 'Hands-On Exercise Pack',
    'Risk Management Workshop (ISO 14971): three exercises, 35 minutes',
    ['**Participant worksheet**  ·  Elder Consulting, LLC  ·  September 2026',
     'Write on this. Exercise A on pages 2 to 3, Exercise B on pages 4 to 5, Exercise C on page 6.',
     '**Device for all three exercises:** a programmable ambulatory infusion pump for home use, with a single-use administration set. The same device as the Excel toolkit.']));
  c.push(h3('The device, in one paragraph'));
  c.push(p('A battery-powered programmable infusion pump, prescribed for home use and operated by the patient or a lay carer. It delivers a titrated therapy through a single-use administration set over periods of hours to days. It has a drug library with configurable dose limits, updated over a wireless network; an air-in-line detector; an occlusion alarm; and a rechargeable battery with a remaining-time indicator. The therapy is life-sustaining for the indicated population, and the alternative is inpatient infusion.'));
  c.push(callout(['You do not need to know this device. Everything you need is on the page. If a detail matters to your answer and it is not stated, write down the assumption you are making - that is part of the exercise.']));

  c.push(pageBreak());
  c.push(h1('Exercise A  ·  Repair the hazard chain'));
  c.push(small('15 minutes: 10 in groups of three or four, 5 taking answers.'));
  c.push(h3('The row, exactly as it appears in the file'));
  c.push(table(['Column', 'What the row says'], [
    ['ID', 'HZ-15'],
    ['Device function or part', 'Pumping mechanism'],
    ['Hazard', 'Pump failure'],
    ['Foreseeable sequence of events', 'Pump fails.'],
    ['Hazardous situation', 'Pump failure.'],
    ['Harm', 'Harm to patient.'],
    ['MDR Annex I GSPR link', '(blank)'],
    ['P1 / P2 / Severity', '2  /  2  /  3'],
    ['Basis for the estimate', '(blank)'],
    ['Initial risk', 'Acceptable'],
    ['Risk control', 'Mitigated by design'],
    ['Verification of implementation', '(blank)'],
    ['Verification of effectiveness', '(blank)'],
    ['Residual P1 / P2 / Severity', '(blank)'],
    ['Status', 'Open'],
  ], [3100, 6980]));
  c.push(h3('Step 1  ·  Take the row apart'));
  c.push(p('For each of the four positions in the chain, write what the row has actually put there, and say whether it is empty, duplicated, or in the wrong position.'));
  c.push(table(['Position', 'What the row actually says', 'Problem'], [
    ['Hazard (3.4)', '', ''],
    ['Foreseeable sequence of events (5.4)', '', ''],
    ['Hazardous situation (3.5)', '', ''],
    ['Harm (3.3)', '', ''],
  ], [2600, 3740, 3740]));
  c.push(spacer(120));
  c.push(h3('Step 2  ·  Rebuild it'));
  c.push(p('Write as many rows as this hazard needs - **one per hazardous situation**. For each, assign P1, P2 and severity, and write the basis you would cite for each probability. Use extra paper if you need more than three rows.'));

  c.push(pageBreak());
  c.push(h3('Exercise A, step 2  ·  Rebuild grid'));
  c.push(small('Rows 1 and 2 below; row 3 and step 3 are on the next page.'));
  for (let i = 1; i <= 3; i++) {
    if (i === 3) c.push(pageBreak());
    c.push(p(`**Row ${i}**`, { after: 60 }));
    c.push(table(['Field', 'Your answer'], [
      ['Hazard', ''],
      ['Foreseeable sequence of events', ''],
      ['Hazardous situation', ''],
      ['Harm', ''],
      ['P1 and its basis', ''],
      ['P2 and its basis', ''],
      ['Severity', ''],
      ['MDR Annex I link', ''],
    ], [2800, 7280]));
    c.push(spacer(140));
  }
  c.push(h3('Step 3  ·  Write the finding'));
  c.push(p('Draft the deficiency a notified body reviewer would raise against the original row. Cite the clause. One or two sentences.'));
  c.push(...lines(6));

  c.push(pageBreak());
  c.push(h1('Exercise B  ·  Red-team the file'));
  c.push(small('14 minutes: 9 in groups, 5 taking answers, one finding per table with no repeats.'));
  c.push(p('You are the notified body technical reviewer assessing this technical documentation. You have the excerpt below and nothing else. There are at least **six defensible findings**. Write them, cite the clause or the MDR Annex I point, then rank them: which one would you raise as a major nonconformity, and why?'));
  c.push(h3('The excerpt'));
  c.push(table(['Field', 'HZ-16', 'HZ-11'], [
    ['Hazardous situation', 'Alarm silenced.', 'Residue and microbial load transferred between patients'],
    ['Harm', 'Delay of therapy.', 'Cross-infection'],
    ['MDR Annex I link', '1', '1, 11.1, 11.2'],
    ['Initial P1 / P2 / S', '5  /  5  /  4', '3  /  2  /  3'],
    ['Basis for the estimate', 'Engineering judgement.', 'Cleaning validation CV-03; material compatibility MC-11 over 200 cycles'],
    ['Initial risk', 'Not acceptable', 'Acceptable'],
    ['Risk control', 'Warning added to IFU section 6 telling the user not to silence the alarm without checking the line', 'Validated cleaning agent list and procedure in the IFU; compatibility-tested enclosure material; label symbol pointing to the cleaning section'],
    ['Control category', '3  (information for safety)', '3  (information for safety)'],
    ['Why a higher-priority option was not practicable', '(blank)', 'A fully sealed enclosure was rejected on thermal grounds; a single-patient-use durable was rejected on cost of therapy'],
    ['Residual P1 / P2 / S', '1  /  1  /  4', '3  /  2  /  3'],
    ['Residual risk', 'Acceptable', 'Acceptable'],
    ['Verification of implementation', 'IFU approval record DOC-2230', 'IFU approval DOC-2214; label artwork approval LA-118'],
    ['Verification of effectiveness', '(blank)', 'CV-03 cleaning validation with the listed agents over 200 cycles; MC-11 material compatibility'],
    ['Residual risk disclosure', '(blank)', 'IFU section 7.3; label symbol'],
    ['New risks assessed (7.5)', '(blank)', 'RA-NEW-11 (an unlisted agent used anyway)'],
    ['Status', 'Closed', 'Closed'],
  ], [2400, 3540, 4140], { size: 18 }));

  c.push(pageBreak());
  c.push(h3('Exercise B  ·  Findings grid'));
  const blank = [];
  for (let i = 1; i <= 8; i++) blank.push([String(i), '', '', '']);
  c.push(table(['#', 'Finding', 'Clause or GSPR', 'Major?'], blank, [500, 6580, 1900, 1100]));
  c.push(spacer(160));
  c.push(h3('Which one is the major nonconformity, and why?'));
  c.push(...lines(5));
  c.push(h3('Is there anything in this excerpt that is done well?'));
  c.push(...lines(4));

  c.push(pageBreak());
  c.push(h1('Exercise C  ·  Your 30-day plan'));
  c.push(small('8 minutes: 5 writing on your own, 3 sharing first actions and Q&A.'));
  c.push(p('Not "what should we improve" but "what will I have done by this day next month". One action per row. An owner who is in the building. A date inside 30 days.'));
  c.push(table(['#', 'What I will change', 'Clause or GSPR it answers', 'Owner', 'Done by', 'How I will know it worked'], [
    ['1', '', '', '', '', ''],
    ['2', '', '', '', '', ''],
    ['3', '', '', '', '', ''],
    ['4', '', '', '', '', ''],
    ['5', '', '', '', '', ''],
  ], [400, 3100, 1800, 1300, 1100, 2380]));
  c.push(spacer(160));
  c.push(h3('If you need prompts: six checks from today'));
  c.push(...checks([
    'Does the risk management plan state what you do when the probability of occurrence of harm cannot be estimated? (Clause 4.4 d)',
    'Does every risk control have a verification of EFFECTIVENESS record, distinct from its implementation record? (Clause 7.2)',
    'Does any justification for skipping a higher-priority control option rest on cost? (MDR Annex I point 2)',
    'Does the procedure have a Clause 7.6 completeness step, applied to the acceptable rows too?',
    'Can you find the risk file revision that one old complaint produced? (Clauses 10.3 and 10.4)',
    'Do the acceptability criteria in the risk management plan and the benefit-risk acceptability parameters in the clinical evaluation plan agree?',
  ]));
  c.push(spacer(200));
  c.push(h3('Notes'));
  c.push(...lines(8));
  c.push(spacer(160));
  c.push(small('Prepared by Elder Consulting, LLC. Workshop material; not legal or regulatory advice.'));
  return makeDoc('Risk Management Workshop (ISO 14971) - Hands-On Exercise Pack', 'Risk Management (ISO 14971)  ·  Exercise Pack  ·  Elder Consulting, LLC', c);
}

// =====================================================================
// 3. FACILITATOR GUIDE  (speaker copy)
// =====================================================================
function facilitator() {
  const c = [];
  c.push(...titleBlock('SPEAKER COPY  ·  NOT FOR DISTRIBUTION', 'Facilitator Guide',
    'Risk Management Workshop (ISO 14971): timings, model answers and the questions that come',
    ['**Speaker copy**  ·  Elder Consulting, LLC  ·  September 2026',
     'This carries the model answers to all three exercises. Do not hand it out.',
     'Companions: 39-slide deck with timed speaker notes; Participant Handout; Hands-On Exercise Pack; ISO 14971 Risk File Toolkit.']));

  c.push(h1('1  Before you present this'));
  c.push(h2('1.1  Accuracy checklist'));
  c.push(p('The content was verified in September 2026. Five things in it have a short shelf life. Re-check each one and update the deck and handout before delivery.'));
  c.push(...checks([
    '**The MDR harmonised-standard citation.** Confirm EN ISO 14971:2019 with A11:2021 is still cited with no end of legal effect, on the current Commission summary list of harmonised standards for Regulation (EU) 2017/745. Slide 12 and handout section 4.2 state the June 2026 position.',
    '**The FDA recognition entry** for ISO 14971. Check the recognized consensus standards database for the currently recognized edition and any transition notice. Slide 11 deliberately does not quote a recognition number, for this reason.',
    '**MDCG guidance.** Slide 34 and handout section 7.3 state that there is no MDCG guidance dedicated to risk management and none in the published pipeline. Re-check the MDCG index; if one has appeared, it changes the section.',
    '**Any new edition or amendment of ISO 14971 or ISO/TR 24971.** ISO 14971:2019 was confirmed in March 2025 with no changes, so nothing was pending as of September 2026. ISO/TS 24971-2:2026 on machine learning was published in June 2026.',
    '**Team-NB position papers.** V3 of the technical documentation paper is dated 9 April 2025. Check for a later version before quoting it on slides 25 and 30.',
  ]));
  c.push(callout(['**A claim to be careful with.** The statement that Annex ZA addresses only MDR Annex I Chapter I points 3, 4, 5, 8 and 9 is central to slide 12 and to handout section 4.2. It comes from the Annex ZA correspondence table. If you have access to the standard, read Table ZA.1 yourself before presenting it, and say "as I read the table" rather than asserting it flatly if you have not.'], GOLDTINT));

  c.push(h2('1.2  Room setup'));
  c.push(...bullets([
    'Tables of three or four. Exercises A and B are group work; C is individual.',
    'Print the Exercise Pack single-sided. People write on it and turn pages back and forth between the excerpt and the grid.',
    'Have the Excel toolkit open on a second screen if you have one. It is useful in the Exercise A and Exercise B debriefs and essential in Exercise C.',
    'Whiteboard or flip chart for the hazard chain on slide 16 and for collecting Exercise B findings.',
  ]));
  c.push(h2('1.3  If you are short of time'));
  c.push(table(['Running late by', 'Cut this'], [
    ['5 minutes', 'Slide 14 (where they agree and differ) - the handout carries the table. Compress slide 8 to the third definition only'],
    ['10 minutes', 'The above, plus slide 34 (interfaces), and slide 33 reduced to the Annex III point 1(b) row - the joint that is most often audited'],
    ['15 minutes', 'The above, plus drop Exercise C to 4 minutes and take no answers. Never cut Exercise A or B - they are the workshop'],
  ], [1900, 8180]));

  c.push(pageBreak());
  c.push(h1('2  Exercise A  ·  Model answer'));
  c.push(p('**Timing:** 10 minutes in groups, 5 minutes taking answers. Take answers before showing slide 19.'));
  c.push(h2('2.1  Step 1: what the row actually says'));
  c.push(table(['Position', 'What the row says', 'The problem'], [
    ['Hazard', '"Pump failure"', 'Not a hazard. A hazard is a potential source of harm; "pump failure" is a failure mode. The hazard here is energy - mechanical, in one of several forms'],
    ['Sequence of events', '"Pump fails."', 'Not a sequence. A sequence has a first event, an intermediate condition and an exposure. This is a state, restated'],
    ['Hazardous situation', '"Pump failure."', 'Duplicated from the hazard column. A hazardous situation is a circumstance in which people are exposed'],
    ['Harm', '"Harm to patient."', 'Circular. A harm is physical injury or damage to health: over-infusion causing hypotension, loss of therapy, and so on'],
  ], [1700, 2000, 6380]));
  c.push(h2('2.2  Step 2: the rebuild'));
  c.push(p('The single line becomes **three rows**, because the pumping mechanism reaches three distinct hazardous situations by three distinct sequences, with genuinely different severities and probabilities.'));
  c.push(table(['#', 'Hazard', 'Sequence of events', 'Hazardous situation', 'Harm', 'P1', 'P2', 'S'], [
    ['1', 'Energy - mechanical (unintended delivery)', 'A downstream occlusion raises pressure in the compliant administration set; the occlusion clears and the stored volume is released before the pump can decompress the line', 'Patient receives a bolus above the prescribed rate', 'Over-infusion: hypotension and respiratory depression', '4', '4', '4'],
    ['2', 'Energy - mechanical (delivery stops)', 'The drive train wears beyond the qualified cycle count; the pump stalls and the stall is not detected by the motion sensor', 'Therapy stops without the user being alerted', 'Under-infusion: loss of therapy', '3', '3', '4'],
    ['3', 'Energy - mechanical (inaccurate delivery)', 'The plunger seal creeps over the infusion period; delivered volume drifts below the set rate, within the alarm window', 'Patient receives less than the prescribed rate, undetected', 'Under-infusion: therapeutic failure', '3', '4', '3'],
  ], [400, 1500, 3400, 1700, 1700, 460, 460, 460], { size: 17 }));
  c.push(h3('The bases to insist on'));
  c.push(table(['Row', 'P1 basis', 'P2 basis'], [
    ['1', 'Complaint trend over the installed base, plus a bench measurement of post-occlusion bolus volume against the specified limit', 'The patient is unattended at home; a bolus of this size acts within minutes and nobody is present to intervene. Hence a high conditional probability'],
    ['2', 'Drive-train cycle-life test and the observed service age at failure in returned units', 'A stall with no alert persists until the next scheduled check. For a life-sustaining therapy that is a high conditional probability, but lower than row 1 because a carer may notice the absence of infusion'],
    ['3', 'Seal creep measured over the maximum infusion duration, across the temperature range', 'Drift inside the alarm window is by definition undetected by the device, so it persists for the whole infusion - a high conditional probability, but the harm is therapeutic failure rather than an acute event'],
  ], [760, 4660, 4660]));
  c.push(h3('The GSPR links, and why they matter'));
  c.push(p('Most files link a row like this to Annex I point 4 and stop. This device **supplies substances to the patient**, so Chapter II point 21 is directly on point: 21.1 requires that the amount to be delivered can be set and maintained accurately, and 21.2 requires the device to be fitted with the means of preventing and/or indicating any inadequacies in the amount delivered which could pose a danger. Row 1 also engages 14.2(a), risk of injury in connection with physical features including the volume/pressure ratio. Row 2 engages 18.1, single fault condition in a non-implantable active device.'));
  c.push(h2('2.3  Step 3: the deficiency'));
  c.push(exhibit('MODEL DEFICIENCY', 'What a reviewer would write against HZ-15', [
    'The risk management file does not identify the foreseeable sequences of events by',
    'which the identified hazard leads to a hazardous situation, and does not distinguish',
    'the hazardous situation from the hazard or from the harm (ISO 14971:2019, 5.4). No',
    'basis is recorded for the probability estimate (5.5). The stated risk control is not',
    'identified, and is not traceable to a verification of implementation or of',
    'effectiveness (7.2). No residual risk has been evaluated (7.3). The row is',
    'not linked to any general safety and performance requirement (MDR Annex II',
    'point 4).',
  ]));
  c.push(h2('2.4  What the room reliably gets wrong'));
  c.push(table(['Pattern', 'What to say'], [
    ['Rebuilding one row instead of several', 'The hazard reached more than one hazardous situation. A single rebuilt row has renamed the problem, not analysed it. This is the most common outcome and it is worth 30 seconds'],
    ['A sequence that is one step long', '"Pump fails" is a state, not a sequence. Clause 5.4 says sequences, plural, and combinations of events'],
    ['P1 and P2 assigned without separating the evidence', 'Ask: which half of that number is engineering and which half is clinical? If they cannot say, they have one number wearing two hats'],
    ['The harm written as a regulatory event', 'A harm is physical injury or damage to health (3.3). "Reportable incident", "complaint" and "recall" are consequences of harm, not harms. This is the subtle one - name it explicitly'],
  ], [2900, 7180]));

  c.push(pageBreak());
  c.push(h1('3  Exercise B  ·  Model answer'));
  c.push(p('**Timing:** 9 minutes in groups, 5 minutes round the room, one finding per table with no repeats. Collect findings on the board before showing slide 29.'));
  c.push(table(['#', 'Finding', 'Cite'], [
    ['1', '**MAJOR.** A risk control in the information-for-safety category (a warning in the IFU) is credited with reducing P1 from 5 to 1 and P2 from 5 to 1. Information for safety does not reduce the probability that the hazardous situation arises: a sentence in an instruction manual cannot stop a user silencing an alarm. The residual risk estimate is therefore unsupported, and the verification of effectiveness that would have to support a four-band claim is absent', '7.1, 7.2, 7.3'],
    ['2', 'The order of priority was not worked on HZ-16: the justification for not using a higher-priority option is blank. A self-re-arming alarm silence, or a silence with a hard time limit, is an available protective measure and is not discussed', '7.1; MDR Annex I point 4'],
    ['3', 'HZ-11 justifies rejecting a higher-priority option partly on **cost of therapy**. Under MDR Annex I point 2 the only permitted limit on reducing risks as far as possible is the benefit-risk ratio. The thermal argument is admissible; the cost argument is not', 'MDR Annex I point 2'],
    ['4', 'HZ-16 relies entirely on information for safety and records no disclosure of the residual risk in the accompanying information', '8; MDR Annex I point 4'],
    ['5', '"Engineering judgement" is not a recorded basis for a risk estimate, and the estimate sits at the top of both probability scales, where the consequences of being wrong are largest', '5.5'],
    ['6', 'No assessment of risks arising from HZ-16’s risk control measure. A warning changes user behaviour and can introduce a new hazardous situation - for example, a user who checks the line instead of responding to the underlying alarm condition', '7.5'],
    ['7', 'HZ-16 is linked to GSPR 1 only. It is a use-error hazard involving an alarm on a home-use device: points 5 (use error), 18.4 (alarm systems), 21.2 (indicating inadequacies in delivery) and 22.1 (devices for use by lay persons) are all engaged', 'MDR Annex I'],
  ], [400, 7680, 2000]));
  c.push(h3('Ranking: why finding 1 is the major'));
  c.push(p('It is not a documentation gap, it is an unsupported safety conclusion. The residual risk verdict for a severity-4 hazard rests on a probability reduction the control category cannot deliver, and the record that would have to support it does not exist. The device shipped on that conclusion. Findings 2 to 7 are all real, but they are gaps in the argument rather than a wrong answer.'));
  c.push(h3('The fair word for HZ-11 - do not skip this'));
  c.push(callout([
    'HZ-11 is a **good row**, and saying so is what shows the room what "good" looks like. Its numbers are honest: an information-for-safety control that changed nothing numerically, which is exactly the right answer. It has both verifications, with the effectiveness verification tied to the agents actually named in the IFU over the claimed service life. It has a residual risk disclosure reference. It has a Clause 7.5 assessment of the new risk the control creates (an unlisted agent used anyway). One clause of its justification is wrong. That is the only thing to fix.',
  ], GREENTINT));
  c.push(h3('If the room stalls'));
  c.push(...bullets([
    'Prompt: "read the residual risk numbers next to the control category." That gets finding 1 out within a minute.',
    'Second prompt: "look at what is blank." That gets findings 2, 4, 6 and part of 5.',
    'Third prompt, only if needed: "is every reason for not doing more an admissible reason?" That gets finding 3, which is the one groups almost never find unaided.',
  ]));

  c.push(pageBreak());
  c.push(h1('4  Exercise C and the toolkit’s delivered state'));
  c.push(p('**Timing:** 5 minutes individual writing, 3 minutes sharing and Q&A. Take two or three first actions out loud; do not go round the room.'));
  c.push(p('The toolkit ships in a deliberately imperfect state so that the Dashboard has something to report. If you demonstrate it, these are the five things it flags and why each one is there.'));
  c.push(table(['What the Dashboard reports', 'Why it is there'], [
    ['1 hazard row with no MDR GSPR link, and 1 with no stated basis for the estimate', 'HZ-15, the collapsed row from Exercise A. Both flags come from the same row'],
    ['1 risk control with effectiveness not verified, and 1 with no order-of-priority justification', 'RC-16, the control from Exercise B. It has an implementation record and nothing else'],
    ['1 category-3 control with no residual risk disclosure reference', 'HZ-16 again. The three flags on this pair are the point of Exercise B'],
    ['1 benefit-risk record that is not complete', 'The OVERALL row on the Benefit-Risk sheet. Its conclusion and approval are blank because the overall benefit-risk conclusion is the last thing anyone does'],
    ['Overall residual risk inputs recorded: 0 of 9; risk management file index: not started', 'Left blank on purpose. Filling these in is the natural follow-on exercise after the workshop'],
    ['1 open post-production item whose risk file rows were not updated', 'PP-005, the returned pumps whose battery indicator did not trigger. It invalidates the estimate for HZ-05 and the file has not caught up - which is exactly what an open Clause 10 item looks like in real life'],
  ], [3600, 6480]));
  c.push(callout([
    '**There is one more defect, and it is the best one in the workbook.** RC-11’s order-of-priority justification on the Risk Controls sheet reads: "a single-patient-use durable was rejected on cost of therapy" and then carries a note saying cost is not admissible under MDR Annex I point 2. No formula flags it, because no formula can. If someone finds it unprompted, that is the moment the session has worked.',
  ], GOLDTINT));
  c.push(h3('Exit criteria on delivery'));
  c.push(table(['Criterion', 'Reads'], [
    ['Every unacceptable initial risk has a risk control measure', 'Yes'],
    ['Every risk control measure has both verifications', 'No - 1 missing'],
    ['Every unacceptable residual risk has a complete benefit-risk record', 'No - 1 outstanding'],
    ['The overall residual risk has been evaluated against the declared criteria', 'No'],
    ['Traceability is complete on every row', 'No - 3 rows incomplete'],
    ['The production and post-production loop is current', 'No - 2 open or overdue'],
  ], [7180, 2900]));
  c.push(small('Four of the four residual risks the criteria do not accept (HZ-02, HZ-03, HZ-07, HZ-12) do have complete benefit-risk records. Every severity-5 row ends "Not acceptable" under the example matrix, which is deliberate: it forces a benefit-risk record for every death-capable hazard, which is what happens on a real infusion pump.'));

  c.push(h1('5  Questions that always come, and the short answers'));
  c.push(table(['The question', 'The answer'], [
    ['Do we have to use ISO 14971?', 'Not as law, in either jurisdiction. In the EU it is voluntary but harmonised, and the presumption of conformity covers only what Annex ZA lists. For FDA it is not incorporated into Part 820 but is a recognized consensus standard, and the activity is inspected through ISO 13485 regardless. In practice everyone uses it, because the alternative is inventing a defensible process from scratch and then defending the invention'],
    ['Can we keep our three-band matrix?', 'You can, but be ready to say which clause the middle band implements. ISO 14971:2019 does not have one - the amber "acceptable with justification" band is a hold-over from the 2007 edition. And under MDR Annex I point 2 the middle band does not create a stopping point that cost can justify'],
    ['How many rows should our risk file have?', 'Wrong question. One per hazardous situation, which the device determines, not a target. But a file with fewer rows than the device has failure modes has collapsed the analysis somewhere, and that is findable'],
    ['Can we run one risk file for both markets?', 'Yes, and you should. Build to the stricter test, which is the EU’s AFAP obligation, and make sure the FDA-facing trail through the ISO 13485 clauses is visible. The handout has the mapping in sections 4.1 and 4.2'],
    ['Is a risk priority number acceptable?', 'Not as the basis for acceptance. Team-NB’s V3 position paper of April 2025 says the MDR does not permit risk acceptance based on RPN alone or on a "green" zone; each risk must be decided individually against predefined criteria. RPN is fine for prioritising work'],
    ['What about FMEA?', 'An FMEA is a useful input and not a risk analysis. It starts from failure modes, so it does not reach hazards that arise without a failure - use error, foreseeable misuse, material interactions, and normal use outside the intended environment. Use it to feed Clause 5.4, not to replace it'],
    ['Our notified body asked for the seven content deviations. Now what?', 'Ask which document they are citing. The seven deviations belong to EN ISO 14971:2012, withdrawn, with conflicting national standards withdrawn by 30 June 2020. A11:2021 has none. What they may actually want is your position on the requirements Annex ZA does not cover - points 1, 2, 6 and 7 - and that is a fair question with a different answer'],
  ], [2500, 7580]));

  c.push(h1('6  Timing sheet'));
  c.push(table(['Time', 'Slides', 'Section'], [
    ['0:00 - 0:05', '1 to 4', 'Opening: the asymmetry, objectives, agenda, room poll'],
    ['0:05 - 0:18', '5 to 9', '1. The file is the argument'],
    ['0:18 - 0:30', '10 to 14', '2. Two regulators, one standard'],
    ['0:30 - 0:45', '15 to 20', 'Exercise A: brief, work, model answer, debrief'],
    ['0:45 - 0:58', '21 to 25', '3. Risk control and residual risk'],
    ['0:58 - 1:12', '26 to 30', 'Exercise B: brief, work, model answer, how a reviewer walks a file'],
    ['1:12 - 1:22', '31 to 34', '4. Closing the loop'],
    ['1:22 - 1:30', '35 to 39', 'Exercise C, ten things, sources, close and Q&A'],
  ], [1700, 1500, 6880]));
  c.push(callout(['If there is time left at the end, offer to walk one of the room’s own hazard rows on the screen. It is the most useful ten minutes of the session and it is worth over-running for.'], GREENTINT));
  c.push(spacer(200));
  c.push(small('Prepared by Elder Consulting, LLC. Speaker copy. Workshop material; not legal or regulatory advice.'));
  return makeDoc('Risk Management Workshop (ISO 14971) - Facilitator Guide', 'Risk Management (ISO 14971)  ·  Facilitator Guide  ·  SPEAKER COPY', c);
}

// ---------- write ----------
const fsx = require('fs');
if (!fsx.existsSync('out')) fsx.mkdirSync('out');
const jobs = [
  ['out/ISO-14971-Risk-Management-Participant-Handout.docx', handout],
  ['out/ISO-14971-Risk-Management-Exercise-Pack.docx', exercises],
  ['out/ISO-14971-Risk-Management-Facilitator-Guide.docx', facilitator],
];
(async () => {
  for (const [name, fn] of jobs) {
    const buf = await Packer.toBuffer(fn());
    fsx.writeFileSync(name, buf);
    console.log('wrote ' + name + '  ' + buf.length + ' bytes');
  }
})();
