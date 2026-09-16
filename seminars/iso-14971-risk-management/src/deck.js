const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.author = 'Elder Consulting, LLC';
pres.company = 'Elder Consulting, LLC';
pres.title = 'Risk Management Workshop (ISO 14971): aligning risk files with EU MDR and FDA expectations';
pres.subject = 'Medical Device Seminar - hands-on application of ISO 14971:2019 to EU MDR and FDA expectations';

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
  s.addText('Risk Management  |  ISO 14971  |  Elder Consulting, LLC', { x: M, y: H - 0.36, w: 6.5, h: 0.22, fontFace: FB, fontSize: 9, color: fc, isTextBox: true, margin: 0, valign: 'middle' });
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
  const s = base(true);
  s.addShape(S.rect, { x: 0, y: 0, w: 0.1, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  txt(s, 'MEDICAL DEVICE SEMINAR  ·  WORKSHOP', { x: 0.75, y: 1.15, w: 8.5, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3 });
  txt(s, 'Risk Management Workshop', { x: 0.75, y: 1.5, w: 8.5, h: 0.75, fontFace: FH, fontSize: 38, color: C.white, bold: true });
  txt(s, 'ISO 14971 in practice: aligning risk files with EU MDR and FDA expectations', { x: 0.75, y: 2.3, w: 8.5, h: 0.55, fontSize: 17, color: C.paleText });
  s.addShape(S.rect, { x: 0.75, y: 3.05, w: 1.6, h: 0.03, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  txt(s, 'Ninety minutes, three hands-on exercises, one risk file taken apart and put back together.', { x: 0.75, y: 3.3, w: 8.5, h: 0.4, fontSize: 13, color: '9FB3C8', italic: true });
  txt(s, 'Elder Consulting, LLC', { x: 0.75, y: 4.35, w: 5, h: 0.3, fontSize: 14, color: C.white, bold: true });
  txt(s, 'September 2026', { x: 0.75, y: 4.68, w: 5, h: 0.25, fontSize: 11, color: '8FA1B5' });
  s.addNotes(`[0:00 | 1 min]
Welcome. Say the promise plainly: today we do not learn the standard, we work a file. By the end you will have taken a real hazard row apart, rebuilt it, and written the deficiency you would have received for the original.
Housekeeping: the participant handout is the reference, the exercise pack is what we write on, and the Excel toolkit is what you take back. Everything is sourced; the last slide tells you what to re-verify before you rely on it.
Set expectations about level: this assumes you have a risk file. If anyone is starting from nothing, tell them the plan comes first and the toolkit's 'RM Plan' sheet is where to start.`);
}

// 2 The room's problem
{
  const s = content('Opening', 'Nobody fails an audit for not owning the standard',
`[0:01 | 2 min]
Open with the asymmetry. Three columns: what firms prepare, what reviewers actually do, and where the gap opens. The point is that risk files fail on traceability and on arithmetic that cannot be defended, not on missing procedures.
Ask for a show of hands on the poll at the bottom. Typically most of the room has had at least one risk-management finding, and the most common single one is verification of effectiveness. Use whatever the room says as the thread for the rest of the session.
If the room is quiet, name the three findings you see most: a probability with no stated basis, a control verified as implemented but never as effective, and an empty Clause 10 log on a device that has been on the market for four years.`);
  const cw = (CW - 0.4) / 3;
  const cards = [
    { t: 'What firms prepare', b: ['A procedure that restates the standard', 'A spreadsheet with a colour matrix', 'A risk management report signed at design transfer', 'A plan written after the analysis'], f: C.tint },
    { t: 'What reviewers do', b: ['Pull one hazard and walk it end to end', 'Ask where a probability number came from', 'Ask for the effectiveness record, not the implementation record', 'Ask what post-market data changed'], f: C.goldTint },
    { t: 'Where the gap opens', b: ['Traceability breaks at the control', 'Estimates have no basis', 'Clause 10 log is empty or historical', 'Acceptability criteria were reverse-engineered'], f: C.redTint },
  ];
  cards.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.25, w: cw, h: 2.85, title: c.t, titleSize: 12.5, titleH: 0.32, fill: c.f, body: c.b, bodySize: 10.5, gap: 5 }));
  band(s, 'Room poll: hands up if you have had a risk-management finding. Keep them up if it was verification of effectiveness.', { y: 4.35, h: 0.5, fontSize: 12.5, fill: C.navy });
}

// 3 Objectives
{
  const s = content('Opening', 'What you will be able to do at 1:30',
`[0:03 | 1 min]
Read them once. These are deliberately verbs, not topics. Each one maps to an exercise: A is the chain, B is the red-team, C is the plan.
Say what is out of scope so nobody waits for it: we are not covering IEC 62366-1 usability engineering as a discipline, not covering IEC 62304 software life cycle, and not covering security risk management beyond where it touches the risk file. The handout names the standards that carry those.`);
  const items = [
    ['Draw a hazard chain that a reviewer cannot collapse', 'Hazard, foreseeable sequence of events, hazardous situation, harm - one row per hazardous situation, with P1 and P2 separated'],
    ['Defend a probability estimate', 'Name the basis, the population, the period and the record. An estimate with no stated basis is the finding'],
    ['Work the order of priority as an order', 'ISO 14971 Clause 7.1 and MDR Annex I point 4: design, then protective measures, then information for safety, with a record of why you stopped'],
    ['Produce both verifications for every control', 'Clause 7.2 asks for implementation AND effectiveness. Two records, different evidence'],
    ['Say which regulator asks for what', 'Where the EU and FDA expectations actually differ, and where they do not'],
    ['Close the loop from post-market data back into the file', 'Clause 10 and the MDR plumbing: PMS plan indicators, PSUR, PMCF, trend reporting'],
  ];
  table(s, ['You will be able to', 'Which means'], items, { y: 1.2, colW: [3.5, 5.5], fontSize: 10, rowH: 0.3 });
}

// 4 Agenda
{
  const s = content('Opening', 'Ninety minutes, thirty-five of them yours',
`[0:04 | 1 min]
Point at the three shaded blocks. Thirty-five of the ninety minutes are exercise time; that is deliberate for a workshop. If we overrun, the compression comes out of section 6, not out of the exercises.
Flag the toolkit now so people know the Excel exists before Exercise C needs it.`);
  table(s, ['Time', 'Section'], [
    ['0:00 - 0:05', 'Opening: the asymmetry, objectives, room poll'],
    ['0:05 - 0:18', '1. The file is the argument: what ISO 14971:2019 actually requires'],
    ['0:18 - 0:30', '2. Two regulators, one standard: where EU and FDA expectations part'],
    [{ text: '0:30 - 0:45', options: { bold: true } }, { text: 'Exercise A: repair the hazard chain  (15 min)', options: { bold: true, fill: { color: C.goldTint } } }],
    ['0:45 - 0:58', '3. Risk control and residual risk that survive review'],
    [{ text: '0:58 - 1:12', options: { bold: true } }, { text: 'Exercise B: red-team a risk file against the GSPRs  (14 min)', options: { bold: true, fill: { color: C.goldTint } } }],
    ['1:12 - 1:22', '4. Closing the loop: production and post-production information'],
    [{ text: '1:22 - 1:30', options: { bold: true } }, { text: 'Exercise C: your 30-day plan, takeaways, Q&A  (8 min)', options: { bold: true, fill: { color: C.goldTint } } }],
  ], { y: 1.2, colW: [1.5, 7.5], fontSize: 10.5, rowH: 0.36 });
  band(s, 'Materials: Participant Handout  ·  Hands-On Exercise Pack  ·  ISO 14971 Risk File Toolkit (Excel, 10 sheets)', { y: 4.55, h: 0.45, fontSize: 11.5, fill: C.goldTint, color: C.navy, italic: false, bold: true });
}

// 5 Divider S1
divider(1, 'The file is the argument', 'ISO 14971:2019: ten clauses, one obligation - make every risk decision traceable and defensible',
`[0:05]
Thirteen minutes. The aim is not to teach the standard but to fix the four places where files break: the plan written too late, the chain collapsed into one row, the estimate with no basis, and the file that is a folder rather than an argument.`);

// 6 What a risk management file is
{
  const s = content('Section 1  |  The file', 'A file, not a folder',
`[0:06 | 2 min]
Start with the definition because it is deliberately thin: Clause 3.25 defines the risk management file as the set of records and other documents produced by risk management. That is all. The content requirements are distributed: almost every clause ends with a sentence sending its output to the file.
Clause 4.5 is where the obligation bites. It requires the file to provide TRACEABILITY for each identified hazard to the risk analysis, the risk evaluation, the risk control measures and the assessment of the acceptability of any residual risk. That is the sentence that turns a folder into a file, and it is the sentence people fail.
The file may be a set of references. You do not have to physically bind the usability engineering file into it. You do have to be able to walk it. The toolkit's 'RM File Index' sheet is that index.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 1.5, kicker: 'CLAUSE 3.25', title: 'What the standard says it is', fill: C.tint, titleSize: 12.5, titleH: 0.3,
    body: 'The set of records and other documents that are produced by risk management. No list of contents, no format, no template. The content requirements live in the individual clauses.', bodySize: 10.5 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 1.5, kicker: 'CLAUSE 4.5', title: 'What makes it a file', fill: C.goldTint, titleSize: 12.5, titleH: 0.3,
    body: 'It must provide traceability for each identified hazard to: the risk analysis, the risk evaluation, the risk control measures, and the assessment of the acceptability of any residual risk.', bodySize: 10.5 });
  txt(s, 'The file may be a set of references to other records. What it may not be is unwalkable.', { x: M, y: 2.85, w: CW, h: 0.24, fontSize: 11, bold: true, color: C.navy });
  table(s, ['A reviewer asks', 'The file has to answer it from'], [
    ['Where did this hazard come from?', '5.3 characteristics related to safety; 5.4 hazard identification'],
    ['How did this hazard reach a harm?', '5.4 foreseeable sequences of events and the resulting hazardous situation'],
    ['Where did this number come from?', '5.5 risk estimation, plus the categorisation system you used'],
    ['Why is this acceptable?', '4.4 d) criteria, 6 risk evaluation, 7.3 residual risk evaluation'],
    ['What did you do about it, and does it work?', '7.1 option analysis, 7.2 both verifications'],
    ['What has changed since?', '10.2 collection, 10.3 review, 10.4 actions'],
  ], { y: 3.15, colW: [3.2, 5.8], fontSize: 9.5, rowH: 0.26 });
}

// 7 The ten clauses
{
  const s = content('Section 1  |  The file', 'Ten clauses, and the three people skip',
`[0:08 | 2 min]
Walk the spine quickly: 4 sets up the system, 5 analyses, 6 evaluates, 7 controls, 8 evaluates the whole, 9 reviews and reports, 10 keeps it alive.
Then stop on the three gold rows. 7.5 risks arising from risk control measures, 7.6 completeness of risk control, and 10 as a whole are the three that are most often absent. 
Two structural points worth saying out loud. First, Clause 7 runs to 7.6, not 7.5 - if your procedure stops at 7.5 you are missing completeness. Second, Clause 6 routes an acceptable risk straight to 7.6 and tells you to treat the estimated risk as the residual risk: so 7.6 applies to every hazardous situation, acceptable or not. People assume the acceptable ones drop out of the process. They do not.
Clause 2 is new in 2019 and says there are no normative references. That is a trap for anyone who thinks conforming to 14971 pulls in 24971: it does not. 24971 is a technical report, guidance only.`);
  table(s, ['Clause', 'What it requires', 'Usual state'], [
    ['4  General requirements', '4.1 process · 4.2 management responsibilities · 4.3 competence · 4.4 plan · 4.5 file', 'Procedure exists; plan thin'],
    ['5  Risk analysis', '5.1 process · 5.2 intended use and reasonably foreseeable misuse · 5.3 safety characteristics · 5.4 hazards and hazardous situations · 5.5 estimation', 'Chain collapsed; basis missing'],
    ['6  Risk evaluation', 'Compare each estimated risk against the criteria in the plan. No subclauses', 'Done, but criteria written late'],
    ['7  Risk control', '7.1 option analysis · 7.2 implementation · 7.3 residual risk evaluation · 7.4 benefit-risk · 7.5 risks arising from controls · 7.6 completeness', 'Order not worked as an order'],
    [{ text: '7.5  Risks from controls', options: { fill: { color: C.goldTint } } }, { text: 'Review every control for new hazards AND for effects on existing estimates', options: { fill: { color: C.goldTint } } }, { text: 'Often absent', options: { fill: { color: C.goldTint }, bold: true, color: C.red } }],
    [{ text: '7.6  Completeness', options: { fill: { color: C.goldTint } } }, { text: 'Every identified hazardous situation has been considered. Applies to the acceptable ones too', options: { fill: { color: C.goldTint } } }, { text: 'Often absent', options: { fill: { color: C.goldTint }, bold: true } }],
    ['8  Overall residual risk', 'A separate evaluation, by the method the plan declared, against its own criteria', 'Confused with the sum of rows'],
    ['9  Risk management review', 'Review before release; produce the risk management report', 'Signed, sometimes early'],
    [{ text: '10  Production and post-production', options: { fill: { color: C.goldTint } } }, { text: '10.1 general · 10.2 collection · 10.3 review · 10.4 actions', options: { fill: { color: C.goldTint } } }, { text: 'Often empty', options: { fill: { color: C.goldTint }, bold: true } }],
  ], { y: 1.2, colW: [1.9, 5.3, 1.8], fontSize: 8.5, rowH: 0.32 });
}

// 8 The three new definitions
{
  const s = content('Section 1  |  The file', 'Three definitions arrived in 2019, and each one costs work',
`[0:10 | 2 min]
Clause 3 has 31 definitions. Three are new in the third edition, and they are not cosmetic: each one creates an obligation somewhere else in the standard.
'Benefit' being defined for the first time is what makes Clause 7.4 and Clause 8 workable - you cannot weigh a benefit you have not characterised. 'Reasonably foreseeable misuse' is why 5.2 changed its title and why the use-related analysis has to reach beyond the IFU. 'State of the art' is now an input to the Clause 4.2 policy and a trigger in 10.3, which means a change in the state of the art obliges you to revisit the file even with no complaint and no failure.
Worth noting the plumbing: most 2019 definitions are now sourced from ISO/IEC Guide 63:2019 rather than Guide 51, and defined terms are printed in italics in the body text so you can see them. 'Use error' comes from IEC 62366-1, which is the textual bridge to usability engineering.`);
  const cw = (CW - 0.4) / 3;
  const defs = [
    { n: '3.2', t: 'benefit', b: ['A positive impact or desirable outcome of use on the health of an individual, or a positive impact on patient management or on public health', { text: 'What it costs you:', bold: true }, 'Clause 7.4 and Clause 8 now expect a characterised benefit: nature, magnitude, probability and duration. "It treats the disease" is not a benefit statement'] },
    { n: '3.15', t: 'reasonably foreseeable misuse', b: ['Use in a way not intended by the manufacturer but which can result from readily predictable human behaviour', { text: 'What it costs you:', bold: true }, 'Clause 5.2 is now "intended use AND reasonably foreseeable misuse". Misuse can be intentional. Workarounds you know about are foreseeable'] },
    { n: '3.28', t: 'state of the art', b: ['The developed stage of technical capability at a given time, based on consolidated findings of science, technology and experience', { text: 'What it costs you:', bold: true }, 'Not the most advanced solution - generally accepted good practice. An input to 4.2 policy and a trigger in 10.3, so it ages your file without any failure occurring'] },
  ];
  defs.forEach((d, i) => card(s, { x: M + i * (cw + 0.2), y: 1.2, w: cw, h: 3.25, kicker: d.n, num: null, title: d.t, titleSize: 13, titleH: 0.3, titleColor: C.navy, fill: i === 2 ? C.goldTint : C.tint, body: d.b, bodySize: 9.5, gap: 4 }));
  band(s, 'Clause 2 is also new, and it says there are no normative references. Conforming to ISO 14971 does not pull in ISO/TR 24971: the TR is guidance, not requirement.', { y: 4.65, h: 0.4, fontSize: 10.5, fill: C.navy });
}

// 9 Clause 4.4 the plan
{
  const s = content('Section 1  |  The file', 'The plan decides the answer before you know it',
`[0:12 | 3 min]
This is the single highest-yield slide in section 1. Clause 4.4 requires seven things, a) to g). Read the list and then make the point: every one of them is a decision that has to be made BEFORE the analysis, and the most common finding in this area is a plan whose acceptability criteria were clearly written after the risk table was coloured in.
Point at d) twice. It is two obligations, not one: the criteria themselves, derived from the manufacturer's policy for determining acceptable risk, AND the criteria for the case where the probability of occurrence of harm cannot be estimated. Almost every plan is silent on the second. Ask the room: does your plan say what you do when you cannot estimate a probability? Usually two or three hands.
Then e). The method to evaluate overall residual risk and the criteria for its acceptability, declared in advance. If the plan does not say how Clause 8 will be done, Clause 8 cannot be done credibly, because the method will be chosen once the answer is visible.
And g). The plan has to name the production and post-production activities. A plan that is silent here is why the Clause 10 log is empty three years later.`);
  table(s, ['4.4', 'The plan shall include', 'What it really decides'], [
    ['a)', 'The scope of the planned risk management activities, identifying and describing the device and the life cycle phases covered', 'What is in and what is excluded, with a reason'],
    ['b)', 'Assignment of responsibilities and authorities', 'Who may sign a residual risk acceptable, and who may sign the overall residual risk. Two authorities'],
    ['c)', 'Requirements for review of risk management activities', 'The milestones that produce the Clause 9 report'],
    ['d)', 'Criteria for risk acceptability, based on the manufacturer\'s policy for determining acceptable risk, including criteria for when the probability of occurrence of harm cannot be estimated', 'The matrix AND the policy behind it AND the severity-only rule'],
    ['e)', 'A method to evaluate overall residual risk, and criteria for its acceptability', 'How Clause 8 will be done, decided before the answer is known'],
    ['f)', 'Activities for verification of the implementation and effectiveness of risk control measures', 'Which records will prove each of the two'],
    ['g)', 'Activities related to collection and review of relevant production and post-production information', 'Whether Clause 10 will happen at all'],
  ], { y: 1.2, colW: [0.5, 5.0, 3.5], fontSize: 9, rowH: 0.34 });
  band(s, 'Changes to the plan are themselves recorded in the risk management file. A plan at revision 1 next to a risk table at revision 7 is a finding on its own.', { y: 4.72, h: 0.38, fontSize: 10.5, fill: C.goldTint, color: C.navy, italic: false });
}

// 10 Divider S2
divider(2, 'Two regulators, one standard', 'ISO 14971 is not incorporated into US law and is only narrowly harmonised in the EU. Both regulators still expect it',
`[0:18]
Twelve minutes. The message of this section is that the standard is the common language but not the legal requirement in either jurisdiction, and the gap is where findings live.`);

// 11 FDA position
{
  const s = content('Section 2  |  Two regulators', 'FDA: not incorporated, and still inspected',
`[0:19 | 3 min]
Get the legal position exactly right, because people draw the wrong conclusion in both directions.
ISO 14971 is NOT incorporated by reference into 21 CFR Part 820. Section 820.7 incorporates ISO 13485:2016. In the QMSR final rule FDA was asked to incorporate ISO 14971 as well and declined, saying the risk management requirements it needs are already captured through ISO 13485. That is the first half.
The second half is the half people miss. Declining to incorporate 14971 did not reduce the obligation - it relocated it. Risk management is required through the ISO 13485 clauses that Part 820 does incorporate: 4.1.2 b) applies a risk-based approach to the QMS processes, 7.1 requires risk management in product realization, and the design, purchasing, production and measurement clauses each carry a risk interface. Compliance Program 7382.850 lists "Risk-based Approach" under Management Oversight as an inspectable element.
So the practical answer to "is ISO 14971 mandatory for FDA?" is: the standard is not, the activity is. And arguing the first half in front of an investigator without the second half goes badly.
Separately, ISO 14971:2019 is an FDA-recognized consensus standard, so you can declare conformity in a submission. The entry is recognition number 5-125, ISO 14971 Third edition 2019-12, with the extent of recognition given as the complete standard. It entered the database on 23 December 2019 and was published in Recognition List Number 053 at 85 FR 17584 on 30 March 2020, replacing recognition 5-40 for the 2007 edition. It was still unchanged in Recognition List Number 066 of 24 August 2026. Recognition is not incorporation: it supports a submission, it does not create a regulation. Check the entry before you cite it anyway, because recognition numbers and transition notices change.\nOne more fact that makes the point better than any argument. Search the 78 pages of Compliance Program 7382.850 for the string 14971 and you get zero hits. The inspection program is written entirely against ISO 13485 clauses and 21 CFR Part 820. FDA inspects the activity without ever naming the standard.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 1.65, kicker: 'THE LEGAL POSITION', title: 'ISO 14971 is not in Part 820', fill: C.redTint, titleSize: 13, titleH: 0.3,
    body: '21 CFR 820.7 incorporates ISO 13485:2016 by reference. It does not incorporate ISO 14971. FDA was asked to and declined, on the basis that the risk management requirements are already captured through ISO 13485.', bodySize: 10 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 1.65, kicker: 'THE PRACTICAL POSITION', title: 'The obligation moved, it did not shrink', fill: C.greenTint, titleSize: 13, titleH: 0.3,
    body: 'Risk management is enforced through the ISO 13485 clauses that Part 820 does incorporate. An observation is written against the clause, not against ISO 14971.', bodySize: 10 });
  table(s, ['Where FDA reaches risk management', 'What it asks for'], [
    ['ISO 13485 Clause 4.1.2 b)', 'A risk-based approach applied to the control of the appropriate QMS processes. This is an inspectable element in its own right'],
    ['ISO 13485 Clause 7.1', 'Risk management in product realization: documented requirements, and records of the results'],
    ['Clauses 7.3 design, 7.4 purchasing, 7.5 production, 7.6 monitoring equipment', 'Risk proportionality in each: supplier controls, process validation, acceptance activities'],
    ['Clause 8.2 feedback, complaints and reporting', 'Post-market information used as an input to risk management. This is the FDA analogue of Clause 10'],
  ], { y: 2.95, colW: [3.3, 5.7], fontSize: 8.5, rowH: 0.28 });
  band(s, 'Recognition number 5-125, complete standard, unchanged as of Recognition List 066 (24 August 2026). And the word "14971" appears nowhere in the 78 pages of Compliance Program 7382.850.', { y: 4.72, h: 0.38, fontSize: 9.5, fill: C.navy });
}

// 12 EU position: harmonised but narrow
{
  const s = content('Section 2  |  Two regulators', 'EU: harmonised, but only for five of the nine',
`[0:22 | 3 min]
This is the slide that changes how people write their GSPR matrix, so give it time.
EN ISO 14971:2019 as amended by A11:2021 is a harmonised standard for the MDR. The citation is Commission Implementing Decision (EU) 2022/757 of 11 May 2022, published in OJ L 138 on 17 May 2022. It is also harmonised for the IVDR by Decision 2022/729. Both citations were still live on the Commission's summary list generated in June 2026, with no end of legal effect.
Two facts that surprise people. First, there was no harmonised risk management standard under the MDR between 26 May 2021 and 17 May 2022. The base decision did not cite EN ISO 14971 because A11 did not exist yet. Second, A11:2021 does not change a word of the normative text. It replaces the European foreword and adds Annex ZA for the MDR and Annex ZB for the IVDR.
Now the part that matters. Annex ZA is a correspondence table, and it is narrow: it addresses MDR Annex I Chapter I points 3, 4, 5, 8, and 9. Points 1, 2 and 7 are not listed as covered, and neither is any of Chapter II or Chapter III. So conformity with the standard gives you a presumption of conformity for the risk management system, the order of priority, use error and the benefit-risk minimisation requirement - and none at all for the benefit-risk requirement in point 1 or the AFAP definition in point 2.
Kill the zombie while you are here: the seven content deviations that everyone still cites belong to EN ISO 14971:2012, which was withdrawn, with conflicting national standards withdrawn by 30 June 2020. A11:2021 has no content deviations. If your gap analysis is built on the seven deviations, it is built on a withdrawn standard.
MDCG 2021-5 rev.1 is the authority on what an Annex Z is: it identifies the requirements NOT covered, and presumption of conformity can be claimed only for what the Annex Z lists as covered.`);
  table(s, ['MDR Annex I Chapter I', 'Subject', 'Annex ZA'], [
    ['Point 1', 'Intended performance; safe and effective; risks acceptable when weighed against benefits; state of the art', { text: 'Not listed', options: { fill: { color: C.redTint }, bold: true } }],
    ['Point 2', 'The definition of "reduce risks as far as possible": without adversely affecting the benefit-risk ratio', { text: 'Not listed', options: { fill: { color: C.redTint }, bold: true } }],
    ['Point 3', 'Establish, implement, document and maintain a risk management system; the iterative process a) to f)', { text: 'Covered', options: { fill: { color: C.greenTint }, bold: true } }],
    ['Point 4', 'Risk control measures and the mandatory order of priority; inform users of residual risks', { text: 'Covered', options: { fill: { color: C.greenTint }, bold: true } }],
    ['Point 5', 'Use error: reduce risks related to ergonomic features and the intended user environment', { text: 'Covered', options: { fill: { color: C.greenTint }, bold: true } }],
    ['Point 6', 'Lifetime of the device', { text: 'Not listed', options: { fill: { color: C.redTint } } }],
    ['Point 7', 'Transport and storage', { text: 'Not listed', options: { fill: { color: C.redTint } } }],
    ['Point 8', 'All known and foreseeable risks minimised and acceptable against the evaluated benefits', { text: 'Covered', options: { fill: { color: C.greenTint }, bold: true } }],
    ['Point 9', 'Annex XVI devices without an intended medical purpose', { text: 'Covered', options: { fill: { color: C.greenTint } } }],
  ], { y: 1.2, colW: [1.0, 6.5, 1.5], fontSize: 8.5, rowH: 0.3 });
  band(s, 'Cited for the MDR by Commission Implementing Decision (EU) 2022/757, OJ L 138, 17.5.2022 - still live on the Commission list generated 17 June 2026. A11:2021 has NO content deviations; the seven belong to the withdrawn EN ISO 14971:2012.', { y: 4.42, h: 0.5, fontSize: 10, fill: C.navy });
}

// 13 AFAP vs ALARP
{
  const s = content('Section 2  |  Two regulators', 'AFAP is not ALARP, and the difference is money',
`[0:25 | 3 min]
The cleanest way to make this land is by what is absent from the text. The word ALARP does not appear anywhere in the MDR. Neither does any reference to economic considerations. The old Medical Devices Directive had a recital permitting "technical and economical considerations compatible with a high level of protection of health and safety" - and that recital was not carried into the MDR.
So the MDR's only stated limit on how far you must reduce a risk is the one in Annex I point 2: without adversely affecting the benefit-risk ratio. Not cost, not schedule, not manufacturability.
Practical consequence, and this is the one that generates findings: a risk your matrix calls acceptable still has to be reduced as far as possible. "It is in the green zone" is not a stopping argument in the EU. What you need in the file is a record of the control options you considered and why the higher-priority ones were not practicable - on a basis that is not economic.
Where does the ALARP-versus-AFAP choice actually live in the standards system? ISO/TR 24971:2020 Annex C, as guidance on the Clause 4.2 policy for establishing risk acceptability criteria. It sets out the possible elements of that policy and lists the approaches: ALARP, AFAP, ALARA, ALAP. The standard does not choose for you; your policy does, and for an EU device the regulation constrains the choice.
One asymmetry worth a footnote: the IVDR has recital 13 tying AFAP to the generally acknowledged state of the art in medicine. The MDR has no equivalent recital - its state-of-the-art hook sits in Annex I points 1 and 4 instead.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 1.9, kicker: 'ALARP', title: 'As low as reasonably practicable', fill: C.tint, titleSize: 13, titleH: 0.3,
    body: ['Admits cost, effort and time into the judgement of how far to go', 'Familiar from occupational safety regimes and from the Directive era', 'Produces a defensible stopping point on economic grounds', { text: 'Not the MDR test', bold: true }], bodySize: 10, gap: 4 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 1.9, kicker: 'AFAP', title: 'As far as possible', fill: C.goldTint, titleSize: 13, titleH: 0.3,
    body: ['MDR Annex I point 2: reduction as far as possible means without adversely affecting the benefit-risk ratio', 'The only stated limit is the benefit-risk ratio', 'Bounded in practice by the state of the art (points 1 and 4)', { text: 'The word ALARP does not appear in the MDR', bold: true }], bodySize: 10, gap: 4 });
  table(s, ['What is absent from the MDR text', 'Why it matters'], [
    ['The word "ALARP"', 'No textual basis for an economic stopping argument'],
    ['Any reference to economic considerations', 'The Directive 93/42/EEC recital permitting "technical and economical considerations" was not carried over'],
    ['A "negligible risk" carve-out in point 8', 'All known and foreseeable risks must be minimised, not just the ones above a threshold'],
  ], { y: 3.25, colW: [3.3, 5.7], fontSize: 9.5, rowH: 0.3 });
  band(s, 'ISO/TR 24971:2020 Annex C is where ALARP, AFAP, ALARA and ALAP are compared, as guidance on the Clause 4.2 policy. The standard does not choose; your policy does, and the regulation constrains it.', { y: 4.62, h: 0.42, fontSize: 10.5, fill: C.navy });
}

// 14 Where they agree
{
  const s = content('Section 2  |  Two regulators', 'Where they agree, and where they genuinely differ',
`[0:28 | 2 min]
Close the section by lowering the temperature. For a firm selling into both markets, the overlap is large and the differences are narrow but sharp.
Read the three differences out. The AFAP-versus-acceptability difference is the one that changes your file. The individual benefit-risk expectation is the one that changes your record count - Team-NB's best practice guidance on technical documentation, now at V4 adopted 21 April 2026, says plainly that the MDR does not permit risk acceptance on RPN alone or on a "green" zone, and that acceptability of each risk must be decided individually against predefined criteria. That wording is identical in V3 and V4, so it has been their position for over a year. The third is a documentation-location difference, not a substance difference.
If someone asks "so can I run one risk file for both markets?" - yes, and you should. Build to the stricter test, which is the EU's, and make sure the FDA-facing trail through the ISO 13485 clauses is visible. The handout has the two-column mapping.`);
  table(s, ['', 'EU MDR', 'FDA'], [
    ['Is ISO 14971 required?', 'Voluntary, but harmonised - presumption of conformity for the points Annex ZA lists', 'Not incorporated into Part 820. Recognized consensus standard, so declarable in a submission'],
    ['How far must risk be reduced?', 'As far as possible, limited only by the benefit-risk ratio (Annex I point 2)', 'To acceptable levels as defined by the manufacturer, through ISO 13485 Clauses 4.1.2 b) and 7.1'],
    ['Benefit-risk for an individual risk?', 'Expected. Annex I point 4 speaks of the residual risk associated with each hazard; Team-NB rejects RPN-alone and green-zone acceptance', 'Clause 7.4 applies if you declare conformity to ISO 14971; not separately mandated by Part 820'],
    ['Where the risk file is filed', 'Annex II point 5: the benefit-risk analysis and the results of risk management, inside the technical documentation', 'Design and development file / medical device file, reviewed at inspection rather than submitted'],
    ['Post-market feedback into the file', 'Article 83(3)(a), Annex III point 1(b) indicators and thresholds, PSUR, PMCF, trend reporting under Article 88', 'ISO 13485 Clause 8.2 feedback and complaints; MDR reporting under 21 CFR 803'],
  ], { y: 1.2, colW: [1.9, 3.6, 3.5], fontSize: 8.5, rowH: 0.32 });
}

// 15 Divider Exercise A
divider(3, 'Exercise A: repair the hazard chain', 'Fifteen minutes. One broken row, rebuilt by the table, then the deficiency you would have received',
`[0:30]
Move people into groups of three or four now, before you explain the exercise. Exercise pack page 2.`);

// 16 The chain, properly drawn
{
  const s = content('Exercise A  |  Setup', 'The chain a reviewer expects to see',
`[0:31 | 2 min]
Draw the chain on the board as you talk, because the picture is the whole teaching point. Hazard is a potential source of harm. It does nothing on its own. A foreseeable sequence of events turns it into a hazardous situation, which is a circumstance in which people are exposed to the hazard. Only then can harm occur, and whether it does is a separate question.
The two probabilities sit at two different arrows. P1 is the probability that the hazardous situation arises. P2 is the conditional probability that the hazardous situation leads to the harm. Their product is the probability of occurrence of harm. Annex C.5 of the standard and Clause 5.5 of ISO/TR 24971 describe the decomposition.
Why separate them? Because they are defended with completely different evidence. P1 is engineering and field data. P2 is clinical: who is exposed, for how long, is the harm detectable, is it reversible, does anyone intervene in time. Most files that combine them into one number cannot defend either half, and a reviewer who asks "which half of this number is clinical?" gets silence.
The rule that follows: one row per hazardous situation, not one row per hazard. A single hazard, say stored energy in a compliant fluid path, reaches several hazardous situations by several sequences, and each carries its own probability.`);
  const bw = 1.62, gap = 0.28, y0 = 1.35;
  const boxes = [
    { t: 'HAZARD', d: 'Potential source of harm (3.4)', f: C.tint },
    { t: 'SEQUENCE OF EVENTS', d: 'Foreseeable, and often several in series (5.4)', f: C.tint },
    { t: 'HAZARDOUS SITUATION', d: 'People exposed to the hazard (3.5)', f: C.goldTint },
    { t: 'HARM', d: 'Injury or damage to health (3.3)', f: C.redTint },
  ];
  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap + 0.55);
    card(s, { x, y: y0, w: bw + 0.55, h: 1.15, title: b.t, titleSize: 9.5, titleH: 0.34, fill: b.f, body: b.d, bodySize: 9 });
    if (i < 3) txt(s, '>', { x: x + bw + 0.55 + 0.03, y: y0 + 0.35, w: 0.25, h: 0.4, fontSize: 20, bold: true, color: C.goldDark, align: 'center' });
  });
  txt(s, 'P1  probability the hazardous situation arises', { x: M + 0.3, y: 2.62, w: 4.3, h: 0.25, fontSize: 10.5, bold: true, color: C.navy });
  txt(s, 'P2  conditional probability it leads to the harm', { x: M + 4.9, y: 2.62, w: 4.1, h: 0.25, fontSize: 10.5, bold: true, color: C.navy });
  card(s, { x: M, y: 2.95, w: 4.35, h: 1.5, title: 'P1 is defended with engineering', fill: C.tint2, titleSize: 11.5, titleH: 0.28,
    body: ['Failure rates, bench test results, field return rates', 'Use frequency and exposure in the intended environment', 'Observed rates from complaints and service data'], bodySize: 9.5, gap: 3 });
  card(s, { x: M + 4.55, y: 2.95, w: 4.45, h: 1.5, title: 'P2 is defended clinically', fill: C.tint2, titleSize: 11.5, titleH: 0.28,
    body: ['Who is exposed, and for how long', 'Whether the harm is detectable before it becomes harm', 'Whether it is reversible, and whether anyone intervenes in time'], bodySize: 9.5, gap: 3 });
  band(s, 'One row per hazardous situation. Collapsing several sequences into one row is what makes a probability estimate impossible to defend.', { y: 4.6, h: 0.42, fontSize: 11.5, fill: C.navy });
}

// 17 Exercise A brief
{
  const s = content('Exercise A  |  Brief', 'Your task, in three steps',
`[0:33 | 1 min]
Read the three steps. Emphasise step 3: the deficiency wording matters more than the rebuilt row, because writing the finding is what makes people see the gap. Ten minutes in groups, five minutes taking answers from two or three tables.
The device is a programmable ambulatory infusion pump for home use with a single-use administration set. Same device as the toolkit, so the exercise and the Excel line up.
Circulate. The two things to nudge: groups that produce one rebuilt row rather than several, and groups that write a P1 with no basis. Ask "where did that 4 come from?" and let them hear themselves answer.`);
  const cw = (CW - 0.4) / 3;
  [['Take the row apart', 'Identify what the row has actually written in each of the four positions: hazard, sequence of events, hazardous situation, harm. Name which positions are empty or duplicated.'],
   ['Rebuild it', 'Write as many rows as the hazard needs - one per hazardous situation. Assign P1, P2 and severity, and for each one write the basis you would cite.'],
   ['Write the finding', 'Draft the deficiency a notified body reviewer would raise against the original row. Cite the clause. One or two sentences.']]
    .forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 2.0, num: i + 1, title: c[0], titleSize: 12.5, titleH: 0.3, fill: C.tint, body: c[1], bodySize: 10 }));
  table(s, ['Timing', 'Who'], [
    ['10 minutes', 'In groups of three or four. Exercise pack page 2. Use the blank rows on page 3'],
    ['5 minutes', 'Two or three tables read their rebuilt rows and their deficiency wording'],
  ], { y: 3.55, colW: [1.5, 7.5], fontSize: 10.5, rowH: 0.32 });
  band(s, 'Device: programmable ambulatory infusion pump for home use, with a single-use administration set. The same device as the Excel toolkit.', { y: 4.55, h: 0.45, fontSize: 11, fill: C.goldTint, color: C.navy, italic: false });
}

// 18 Exercise A: the broken row
{
  const s = content('Exercise A  |  The row', 'HZ-15, exactly as it appears in the file',
`[0:34 | 1 min]
Put it up and say nothing for ten seconds. Let them read it.
Then start the clock. Do not pre-empt the findings - the value is in them finding them.
This row is HZ-15 in the Excel toolkit, so people can see it in situ afterwards.`);
  table(s, ['Column', 'What the row says'], [
    ['ID', 'HZ-15'],
    ['Device function or part', 'Pumping mechanism'],
    [{ text: 'Hazard', options: { fill: { color: C.redTint } } }, { text: 'Pump failure', options: { fill: { color: C.redTint } } }],
    [{ text: 'Foreseeable sequence of events', options: { fill: { color: C.redTint } } }, { text: 'Pump fails.', options: { fill: { color: C.redTint } } }],
    [{ text: 'Hazardous situation', options: { fill: { color: C.redTint } } }, { text: 'Pump failure.', options: { fill: { color: C.redTint } } }],
    [{ text: 'Harm', options: { fill: { color: C.redTint } } }, { text: 'Harm to patient.', options: { fill: { color: C.redTint } } }],
    ['MDR Annex I GSPR link', '(blank)'],
    ['P1 / P2 / Severity', '2  /  2  /  3'],
    ['Basis for the estimate', '(blank)'],
    ['Initial risk', 'Acceptable'],
    ['Risk control', 'Mitigated by design'],
    ['Residual P1 / P2 / S', '(blank)'],
    ['Status', 'Open'],
  ], { y: 1.18, colW: [2.6, 6.4], fontSize: 9, rowH: 0.245 });
  band(s, 'Ten minutes. Take it apart, rebuild it, write the deficiency.', { y: 4.92, h: 0.3, fontSize: 11, fill: C.navy, bold: true });
}

// 19 Exercise A: model answer
{
  const s = content('Exercise A  |  Model answer', 'What the row should have been: three rows, not one',
`[0:44 | 2 min]
Take answers first, then show this. The key move is that one line about the pumping mechanism becomes three rows because there are three distinct hazardous situations reached by three distinct sequences - and their severities and probabilities are genuinely different.
Walk the middle row as the exemplar. Hazard: stored mechanical energy in the compliant fluid path. Sequence: a downstream occlusion raises line pressure, the occlusion clears, the stored volume is released before the pump can decompress the line. Hazardous situation: the patient receives a bolus above the prescribed rate. Harm: over-infusion causing hypotension and respiratory depression. P1 = 4 from the complaint trend, P2 = 4 from the clinical argument about an unattended home-use patient, severity 4.
Make the P1-versus-P2 point concrete by comparing rows 2 and 3: the same hazard category, but under-infusion has a lower severity and a different P2 because loss of therapy is usually detectable and recoverable, whereas the bolus is not.
Then the GSPR links. This device supplies substances to the patient, so Annex I point 21 is directly on point: 21.1 requires the amount delivered to be set and maintained accurately, and 21.2 requires means of preventing or indicating inadequacies in the amount delivered. Most files cite point 4 and stop. Citing 21.1 and 21.2 is what tells a reviewer you read Chapter II.`);
  table(s, ['#', 'Hazard', 'Sequence of events', 'Hazardous situation', 'Harm', 'P1', 'P2', 'S', 'GSPR'], [
    ['1', 'Energy - mechanical (unintended delivery)', 'Occlusion raises pressure in the compliant set; it clears and the stored volume is released before the pump decompresses', 'Patient receives a bolus above the prescribed rate', 'Over-infusion: hypotension, respiratory depression', '4', '4', '4', '1, 4, 14.2(a), 21.1, 21.2'],
    ['2', 'Energy - mechanical (delivery stops)', 'Drive train wears beyond the qualified cycle count; the pump stalls and the stall is not detected by the motion sensor', 'Therapy stops without the user being alerted', 'Under-infusion: loss of therapy', '3', '3', '4', '1, 4, 18.1, 21.2'],
    ['3', 'Energy - mechanical (inaccurate delivery)', 'Plunger seal creeps over the infusion period; delivered volume drifts below the set rate within the alarm window', 'Patient receives less than the prescribed rate, undetected', 'Under-infusion: therapeutic failure', '3', '4', '3', '1, 21.1'],
  ], { y: 1.2, colW: [0.3, 1.5, 2.6, 1.5, 1.4, 0.3, 0.3, 0.3, 1.3], fontSize: 8, rowH: 0.34 });
  card(s, { x: M, y: 3.1, w: CW, h: 1.3, kicker: 'THE DEFICIENCY', title: 'What a reviewer would write against the original', fill: C.redTint, titleSize: 11.5, titleH: 0.26,
    body: 'The file does not identify the foreseeable sequences of events by which the identified hazard leads to a hazardous situation, and does not distinguish the hazardous situation from the hazard or from the harm (5.4). No basis is recorded for the probability estimate (5.5). The stated risk control is not identified and is not traceable to a verification of implementation or of effectiveness (7.2). No residual risk has been evaluated (7.3), and the row is not linked to any general safety and performance requirement.', bodySize: 9 });
  band(s, 'One line became three rows, and only now can any of them be argued with.', { y: 4.58, h: 0.38, fontSize: 11, fill: C.navy });
}

// 20 Exercise A: what the room gets wrong
{
  const s = content('Exercise A  |  Debrief', 'The four things the room reliably gets wrong',
`[0:46 | 1 min]
Quick. These are the recurring patterns; naming them is what makes the lesson stick beyond today.
The fourth one is the subtle one and worth twenty seconds: people write the harm as the clinical event that would be reported rather than as the harm the patient experiences. "MDR reportable event" is not a harm. "Hypotension requiring intervention" is.`);
  const items = [
    ['Rebuilding one row instead of several', 'The hazard reached more than one hazardous situation. If your rebuild has one row, you have renamed the problem rather than analysed it'],
    ['Writing a sequence that is one step long', '"Pump fails" is a state, not a sequence. A sequence has a first event, an intermediate condition and an exposure. Clause 5.4 says sequences, plural, and combinations of events'],
    ['Assigning P1 and P2 without separating the evidence', 'If you cannot say which half of the number is engineering and which half is clinical, you have one number wearing two hats'],
    ['Writing the harm as a regulatory event', 'A harm is physical injury or damage to health (3.3). "Reportable incident", "complaint" and "recall" are consequences of harm, not harms'],
  ];
  items.forEach((it, i) => {
    const y = 1.22 + i * 0.93;
    card(s, { x: M, y, w: CW, h: 0.85, num: i + 1, title: it[0], titleSize: 11.5, titleH: 0.3, fill: i % 2 ? C.tint2 : C.tint, body: it[1], bodySize: 9.5 });
  });
}

// 21 Divider S3
divider(4, 'Risk control and residual risk', 'Clause 7 in six parts, and the three questions people answer as one',
`[0:45]
Thirteen minutes. Everything here is Clause 7 and Clause 8. The single most valuable idea in the section is that 7.3, 7.4 and 8 are three different questions.`);

// 22 Order of priority
{
  const s = content('Section 3  |  Risk control', 'The order of priority is an order, not a menu',
`[0:46 | 3 min]
Both texts say the same thing and both say it as a sequence. ISO 14971 Clause 7.1 and MDR Annex I point 4 give three options in a fixed order, and MDR point 4 is worth quoting because the wording is unambiguous: "In selecting the most appropriate solutions, manufacturers shall, in the following order of priority". Shall, and in this order.
The obligation this creates is a documentation obligation. You do not have to use option 1. You have to be able to show you considered it and why it was not practicable. A file full of category 3 controls with no option analysis behind them is the commonest Clause 7.1 finding.
And note what point 4 requires before the list: that the residual risk associated with EACH hazard AND the overall residual risk be judged acceptable. Both, separately.
Then the sting in the tail of point 4, which people forget because it sits after the list: "Manufacturers shall inform users of any residual risks." Not significant residual risks - any. That is a broader disclosure obligation than the one in ISO 14971 Clause 8, which speaks of significant residual risks in the accompanying documentation.
Last point, and make it firmly: information for safety does not reduce the probability that the hazardous situation arises. A warning cannot stop an occlusion forming. It may reduce P2 if it changes what the user does in time. If your file shows a category 3 control dropping P1 by three bands, that is the row a reviewer will open first.`);
  const rows = [
    ['1', 'Inherent safety by design', 'Eliminate the hazard, or eliminate the sequence of events that reaches it. Changes P1', C.greenTint],
    ['2', 'Protective measures in the device itself or in manufacture', 'Guards, interlocks, alarms, detection. Usually changes P1; sometimes P2', C.goldTint],
    ['3', 'Information for safety, and training', 'Warnings, precautions, contra-indications, IFU, training. Rarely changes P1 at all', C.redTint],
  ];
  rows.forEach((r, i) => {
    const y = 1.2 + i * 0.9;
    card(s, { x: M, y, w: 6.05, h: 0.82, num: r[0], badge: C.navy, title: r[1], titleSize: 11.5, titleH: 0.3, fill: r[3], body: r[2], bodySize: 9.5 });
  });
  card(s, { x: M + 6.25, y: 1.2, w: 2.75, h: 2.3, kicker: 'MDR ANNEX I POINT 4', title: 'Verbatim', fill: C.tint, titleSize: 11.5, titleH: 0.26,
    body: '"In selecting the most appropriate solutions, manufacturers shall, in the following order of priority ..." and, after the list, "Manufacturers shall inform users of any residual risks."', bodySize: 9.5 });
  band(s, 'You may stop at option 2 or 3. You may not stop without a record of why the higher option was not practicable - and under MDR point 2, that record cannot rest on cost.', { y: 3.95, h: 0.45, fontSize: 11.5, fill: C.navy });
  txt(s, 'Information for safety does not move P1. If your file credits a warning with a three-band probability drop, expect that row to be opened first.', { x: M, y: 4.5, w: CW, h: 0.3, fontSize: 10.5, italic: true, color: C.red, bold: true });
}

// 23 Clause 7.2
{
  const s = content('Section 3  |  Risk control', 'Clause 7.2 asks for two verifications',
`[0:49 | 3 min]
If you take one slide home, take this one. Clause 7.2 requires verification of the implementation of each risk control measure, and verification of the effectiveness of each risk control measure. Two verifications. Two records. Different evidence.
Implementation is: is the control actually in the product as designed? A drawing revision, a build record, an incoming inspection result, a code review.
Effectiveness is: does it do the job it was credited with in the risk estimate? That is a harder question and it is the one that gets skipped, because the answer has to connect back to the number you wrote in the residual risk column. If you credited a control with dropping P1 from 4 to 2, the effectiveness record has to support a factor-of-a-hundred claim.
The table gives the pattern per control category. Look at the bottom row, because it is where most files fail: for information for safety, effectiveness is comprehension and behaviour, not the existence of an approved IFU. An IFU approval record proves implementation. It proves nothing about effectiveness. The only credible effectiveness evidence for a category 3 control is usability evidence that users read it, understood it and acted on it - which is the IEC 62366-1 bridge.
FDA reaches this through ISO 13485 Clause 7.3 design verification and validation; a notified body reaches it through Annex ZA point 4. Both arrive at the same place.`);
  table(s, ['Control category', 'Verification of IMPLEMENTATION', 'Verification of EFFECTIVENESS'], [
    ['1  Inherent safety by design', 'Drawing or specification revision; design verification report; build records showing the change is in the product', 'Test that the hazardous situation can no longer arise, or arises at the claimed lower rate. Field data after the change'],
    ['2  Protective measure', 'Specification and design verification of the guard, interlock, alarm or detector; production test records', 'Challenge the measure under worst-case conditions across the full operating range, not only at nominal. Show it triggers'],
    ['2  Alarm', 'Alarm specification, levels and priorities verified against the design input', 'Audibility and comprehension in the real use environment, with the real user. A bench sound-pressure measurement is implementation'],
    [{ text: '3  Information for safety', options: { fill: { color: C.redTint } } }, { text: 'IFU or label approval record; artwork release; training material release', options: { fill: { color: C.redTint } } }, { text: 'Usability evidence that users find it, understand it and act on it. An approved IFU is NOT effectiveness evidence', options: { fill: { color: C.redTint }, bold: true } }],
  ], { y: 1.2, colW: [1.9, 3.55, 3.55], fontSize: 9, rowH: 0.36 });
  band(s, 'The test for an effectiveness record: does it support the size of the reduction you claimed in the residual risk column? If it does not, the residual estimate is unsupported.', { y: 4.4, h: 0.5, fontSize: 11.5, fill: C.goldTint, color: C.navy, italic: false, bold: true });
}

// 24 7.5 and 7.6
{
  const s = content('Section 3  |  Risk control', '7.5 and 7.6: the two clauses procedures stop short of',
`[0:52 | 2 min]
Clause 7.5 requires you to review the effects of the risk control measures themselves, for two things: new hazards or hazardous situations introduced, and whether the estimated risks for previously identified hazardous situations are affected. And then any new or increased risks are managed in accordance with 5.5 through 7.4 - which means they go back through estimation, evaluation, control and residual risk. They get rows.
The examples on the left are real and worth reading out, because they make the clause concrete rather than procedural. The escalating alarm that solves audibility creates alarm fatigue. The DEHP-free set that solves leachables changes stiffness and therefore pumping accuracy. The stronger pouch seal that solves sterility makes aseptic opening harder.
Clause 7.6 is completeness: confirm that the risks from all identified hazardous situations have been considered. And remember the routing from Clause 6 - an acceptable risk goes straight to 7.6 and its estimated risk is treated as the residual risk. So 7.6 covers every hazardous situation, including the ones you never controlled. Procedures that stop at 7.5 miss this entirely.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 2.6, kicker: 'CLAUSE 7.5', title: 'Risks arising from risk control measures', fill: C.goldTint, titleSize: 12.5, titleH: 0.3,
    body: ['Review every control for (i) new hazards or hazardous situations and (ii) effects on existing risk estimates', 'Any new or increased risk is managed under 5.5 to 7.4 - it gets its own row', { text: 'Real examples:', bold: true }, 'Escalating alarm solves audibility, creates alarm fatigue', 'Plasticiser-free set solves leachables, changes stiffness and pumping accuracy', 'Stronger pouch seal solves sterility, makes aseptic opening harder'], bodySize: 9.5, gap: 3 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 2.6, kicker: 'CLAUSE 7.6', title: 'Completeness of risk control', fill: C.tint, titleSize: 12.5, titleH: 0.3,
    body: ['Confirm the risks from ALL identified hazardous situations have been considered', { text: 'The routing people miss:', bold: true }, 'Clause 6 sends an acceptable risk straight to 7.6 and tells you to treat the estimated risk as the residual risk', 'So 7.6 applies to every hazardous situation - including the ones that never needed a control', 'A procedure that ends at 7.5 has no completeness step at all'], bodySize: 9.5, gap: 3 });
  band(s, 'Check your own procedure tonight: does it have a step for 7.6? Clause 7 runs to 7.6, not 7.5.', { y: 4.0, h: 0.45, fontSize: 12, fill: C.navy });
  txt(s, 'The Excel toolkit flags both: "New risks not assessed (Clause 7.5)" on the Risk Controls sheet, and a completeness check on every hazard row.', { x: M, y: 4.58, w: CW, h: 0.28, fontSize: 10, italic: true, color: C.gray });
}

// 25 Three different questions
{
  const s = content('Section 3  |  Residual risk', '7.3, 7.4 and 8 are three different questions',
`[0:54 | 2 min]
This is the conceptual centre of the section. Three questions, three records, and people routinely answer them as one.
7.3 is per risk: is this residual risk acceptable against the criteria the plan declared? If yes, done, move on. If no, go to 7.4.
7.4 is conditional and per risk: it applies only where the residual risk is not acceptable AND further risk control is not practicable. Then you gather and review data and literature to decide whether the benefits of the intended use outweigh that residual risk. Note the two gates: not acceptable, and no further control practicable. A benefit-risk analysis used as a shortcut around risk control is a finding, not a conclusion.
8 is not per risk at all. It asks whether the overall residual risk of the device is acceptable, by the method the plan declared, against the criteria the plan declared. Several individually acceptable risks can be collectively unacceptable - especially where they share a cause, or where safety rests on a stack of warnings. The toolkit's Residual Risk sheet lists the nine inputs a credible Clause 8 evaluation considers.
If Clause 8 in your file is a sentence saying "the overall residual risk is acceptable" under a table of green cells, you do not have a Clause 8 evaluation. You have a roll-up.`);
  const cards3 = [
    { k: 'CLAUSE 7.3', t: 'Residual risk evaluation', b: ['Per risk', 'Against the criteria in the plan', 'Acceptable, or on to 7.4'], f: C.tint },
    { k: 'CLAUSE 7.4', t: 'Benefit-risk analysis', b: ['Per risk, and conditional', 'Applies only if NOT acceptable AND further control is not practicable', 'Do the benefits of the intended use outweigh this residual risk?'], f: C.goldTint },
    { k: 'CLAUSE 8', t: 'Overall residual risk', b: ['Not per risk - per device', 'By the method the plan declared', 'Several acceptable risks can be unacceptable together'], f: C.greenTint },
  ];
  const cw = (CW - 0.4) / 3;
  cards3.forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.2, w: cw, h: 2.0, kicker: c.k, title: c.t, titleSize: 12.5, titleH: 0.3, fill: c.f, body: c.b, bodySize: 10, gap: 4 }));
  table(s, ['What a credible Clause 8 evaluation considers', ''], [
    ['The combination of individual residual risks', 'Risks that share a single common cause'],
    ['Conflicting requirements between risk controls', 'The number and nature of warnings safety rests on'],
    ['Comparison with similar devices and the state of the art', 'The clinical benefit and the benefit-risk conclusion'],
    ['Information from production and post-production', 'Disclosure of significant residual risks in the accompanying information'],
    ['The conclusion, against the criteria the plan declared, signed by someone with the authority', ''],
  ], { y: 3.3, colW: [4.5, 4.5], fontSize: 8.5, rowH: 0.26, boldFirst: false });
}

// 26 Divider Exercise B
divider(5, 'Exercise B: red-team the file', 'Fourteen minutes. A real-looking risk file excerpt, and the deficiencies a notified body would raise',
`[0:58]
Same groups. Exercise pack page 4.`);

// 27 Exercise B brief
{
  const s = content('Exercise B  |  Brief', 'Find the deficiencies. Cite the clause or the GSPR',
`[0:58 | 1 min]
Read the brief. Nine minutes in groups, five taking answers.
Tell them there are at least six defensible findings in the excerpt and that the group that finds the most is not necessarily the winner - the group whose findings cite the right clause is.
The trap to watch for: groups that only critique the numbers. The deeper findings are structural: the order of priority not worked, the effectiveness verification absent, the disclosure obligation unmet.`);
  const cw = (CW - 0.4) / 3;
  [['Read as a reviewer', 'You are the notified body technical reviewer assessing this technical documentation. You have the excerpt and nothing else. What do you ask for?'],
   ['Write the findings', 'One line each. Cite either the ISO 14971 clause or the MDR Annex I point. At least six are defensible.'],
   ['Rank them', 'Which one would you make a major nonconformity, and why? Be ready to defend the ranking.']]
    .forEach((c, i) => card(s, { x: M + i * (cw + 0.2), y: 1.3, w: cw, h: 2.0, num: i + 1, title: c[0], titleSize: 12.5, titleH: 0.3, fill: C.tint, body: c[1], bodySize: 10 }));
  table(s, ['Timing', 'Who'], [
    ['9 minutes', 'Same groups. Exercise pack page 4, findings grid on page 5'],
    ['5 minutes', 'Round the room: one finding per table, no repeats'],
  ], { y: 3.55, colW: [1.5, 7.5], fontSize: 10.5, rowH: 0.32 });
  band(s, 'Hint, if the room stalls: read the residual risk numbers next to the control category.', { y: 4.55, h: 0.42, fontSize: 11, fill: C.goldTint, color: C.navy, italic: false });
}

// 28 Exercise B: the excerpt
{
  const s = content('Exercise B  |  The excerpt', 'Risk file extract, rows HZ-16 and HZ-11',
`[0:59 | 1 min]
Put it up and start the clock. Do not narrate.`);
  table(s, ['Field', 'HZ-16', 'HZ-11'], [
    ['Hazardous situation', 'Alarm silenced.', 'Residue and microbial load transferred between patients'],
    ['Harm', 'Delay of therapy.', 'Cross-infection'],
    ['GSPR link', '1', '1, 11.1, 11.2'],
    ['Initial P1 / P2 / S', '5  /  5  /  4', '3  /  2  /  3'],
    ['Basis for the estimate', 'Engineering judgement.', 'Cleaning validation CV-03; material compatibility MC-11 over 200 cycles'],
    ['Initial risk', 'Not acceptable', 'Acceptable'],
    ['Risk control', 'Warning added to IFU section 6: do not silence the alarm without checking the line', 'Validated cleaning agent list and procedure in the IFU; compatibility-tested enclosure; label symbol'],
    ['Control category', '3  (information for safety)', '3  (information for safety)'],
    ['Why a higher option was not practicable', '(blank)', 'Sealed enclosure rejected on thermal grounds; single-patient-use durable rejected on cost of therapy'],
    ['Residual P1 / P2 / S', '1  /  1  /  4', '3  /  2  /  3'],
    ['Residual risk', 'Acceptable', 'Acceptable'],
    ['Verification of implementation', 'IFU approval record DOC-2230', 'IFU approval DOC-2214; label artwork approval LA-118'],
    ['Verification of effectiveness', '(blank)', 'CV-03 cleaning validation over 200 cycles; MC-11'],
    ['Residual risk disclosure', '(blank)', 'IFU section 7.3; label symbol'],
    ['New risks assessed', '(blank)', 'RA-NEW-11 (unlisted agent used anyway)'],
  ], { y: 1.16, colW: [2.1, 3.25, 3.65], fontSize: 7, rowH: 0.22 });
  // timing is on the brief slide; the excerpt table uses the full height
}

// 29 Exercise B: model findings
{
  const s = content('Exercise B  |  Model answer', 'Seven findings, ranked',
`[1:08 | 4 min]
Take the room's findings first, one per table, and write them up. Then show this and fill the gaps.
Finding 1 is the major. A category 3 control - a warning in the IFU - is credited with taking P1 from 5 to 1 and P2 from 5 to 1. That is a claim that a sentence in an instruction manual reduced the probability of the hazardous situation arising by four bands. Information for safety does not do that. And the effectiveness verification that would have to support it is blank. This is the row that fails the file.
Finding 2 is the structural twin: the order of priority was never worked on HZ-16. The justification field is empty. Before adding a warning, the file has to show that inherent safety by design and protective measures were considered. For an alarm-silence hazard the obvious category 2 control is a time-limited silence that re-arms automatically - so option 2 was available and is not discussed.
Finding 3 is the one people miss and it is a good one: HZ-11's justification cites cost. "Single-patient-use durable rejected on cost of therapy" is not an admissible argument under MDR Annex I point 2, where the only permitted limit on reducing risks as far as possible is the benefit-risk ratio. The thermal argument is fine. The cost argument has to come out.
Finding 4: HZ-16 has no residual risk disclosure reference, and its safety rests entirely on information. Clause 8 and MDR point 4 both bite.
Finding 5: "Engineering judgement" is not a basis under Clause 5.5.
Finding 6: no Clause 7.5 assessment for HZ-16's control - an auto-silence warning changes user behaviour and can create a new hazardous situation.
Finding 7: the GSPR link on HZ-16 is point 1 only. This is a use-error hazard with an alarm: points 5, 18.4 and 21.2 are on point.
End with the fairness note: HZ-11 is a good row. Its numbers are honest - a category 3 control that changed nothing numerically, which is exactly right - and it has both verifications, a disclosure reference and a 7.5 assessment. The only thing wrong with it is one clause of its justification. Praise it, because it shows the room what "good" looks like.`);
  table(s, ['#', 'Finding', 'Cite'], [
    [{ text: '1', options: { fill: { color: C.redTint } } }, { text: 'MAJOR. A category 3 control (a warning in the IFU) is credited with reducing P1 from 5 to 1 and P2 from 5 to 1. Information for safety does not reduce the probability that the hazardous situation arises. The residual estimate is unsupported, and no verification of effectiveness is recorded', options: { fill: { color: C.redTint } } }, { text: '7.1, 7.2, 7.3', options: { fill: { color: C.redTint }, bold: true } }],
    ['2', 'The order of priority was not worked on HZ-16: no record of why inherent safety by design or a protective measure was not practicable. A self-re-arming alarm silence is an available category 2 control and is not discussed', '7.1; MDR I.4'],
    [{ text: '3', options: { fill: { color: C.goldTint } } }, { text: 'HZ-11 justifies rejecting a higher-priority option on cost of therapy. Under MDR Annex I point 2 the only permitted limit on reducing risks as far as possible is the benefit-risk ratio, not cost', options: { fill: { color: C.goldTint } } }, { text: 'MDR I.2', options: { fill: { color: C.goldTint }, bold: true } }],
    ['4', 'HZ-16 relies entirely on information for safety and records no disclosure of the residual risk in the accompanying information', '8; MDR I.4'],
    ['5', '"Engineering judgement" is not a recorded basis for a risk estimate, and the estimate is at the top of both probability scales', '5.5'],
    ['6', 'No assessment of risks arising from HZ-16\'s risk control measure. A warning changes user behaviour and can introduce a new hazardous situation', '7.5'],
    ['7', 'HZ-16 is linked to GSPR 1 only. It is a use-error hazard involving an alarm on a home-use device: points 5, 18.4, 21.2 and 22.1 are engaged', 'MDR Annex I'],
  ], { y: 1.2, colW: [0.3, 7.35, 1.35], fontSize: 8.5, rowH: 0.32 });
  band(s, 'And a fair word for HZ-11: a category 3 control that honestly changed nothing numerically, with both verifications, a disclosure reference and a 7.5 assessment. One clause of its justification is wrong. That is what good looks like.', { y: 4.55, h: 0.48, fontSize: 10.5, fill: C.greenTint, color: C.navy, italic: false });
}

// 30 How a reviewer walks a file
{
  const s = content('Section 3  |  Debrief', 'How a reviewer actually walks a risk file',
`[1:12 | 2 min]
This is the generalisation from Exercise B, and it is the slide people photograph. Six moves, in order. It is not a document review, it is a traversal, and it always starts from the device rather than from the file.
Say the pattern out loud: they pick the hazard, not you. They pick it from the device's clinical profile, from your own complaint data, or from the recall history of devices like yours. Then they walk one row end to end and see whether the file holds. If it holds for the row they picked at random, they believe the rest. If it breaks, they pick three more.
Mention Team-NB's best practice guidance on technical documentation for the documentation expectations. It is now at V4, adopted 21 April 2026, and it replaced the V3 of 9 April 2025 that most people are still citing. Section 5 is Benefit-Risk Analysis and Risk Management, and section 5.5 is a named list of common pitfalls in risk management observed by notified bodies. It expects you to state whether your risk management process is based on EN ISO 14971; no acceptance on RPN alone; no green zone; each risk decided individually against predefined criteria; a statement that the clinical benefits outweigh all the residual risks; and three distinct risk assessments - design, production and process, and clinical or application - which catches firms that have only the design one.\nWorth saying out loud what V4 added, because it is exactly the finding the room just wrote in Exercise B: a new pitfall for a warning or caution in the instructions for use offered as a risk control without usability-engineering evidence of its effectiveness. A notified-body association wrote that down as a named pitfall in April 2026. If your file does that, it is not an obscure risk, it is on their list.`);
  const steps = [
    ['Pick the hazard from the device, not the file', 'From the clinical profile, your complaint data, or the recall history of similar devices. Never from your index'],
    ['Walk to the estimate and ask for the basis', 'Where did P1 come from? What population, what period, what record? "Engineering judgement" ends the conversation badly'],
    ['Walk to the control and read the option analysis', 'Was the order of priority worked? Is there a record of why a higher option was not practicable, on a non-economic basis?'],
    ['Ask for the effectiveness record, not the implementation record', 'Does the evidence support the size of the reduction claimed? This is where most traversals stop'],
    ['Walk to the labelling and the clinical evaluation', 'Is the residual risk disclosed? Do the risk file criteria and the clinical evaluation plan benefit-risk parameters agree?'],
    ['Walk to the post-market data and back', 'What has come in since? Did it change a probability, a severity, or the state of the art? Show me the file revision it produced'],
  ];
  steps.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    card(s, { x: M + col * (CW / 2 + 0.1), y: 1.2 + row * 1.2, w: CW / 2 - 0.1, h: 1.1, num: i + 1, title: st[0], titleSize: 11, titleH: 0.4, fill: row % 2 ? C.tint2 : C.tint, body: st[1], bodySize: 9 });
  });
  band(s, 'Team-NB best practice guidance, V4, 21 April 2026, section 5.5: no acceptance on RPN alone, no green zone, each risk decided individually - and V4 adds a pitfall for an IFU warning used as a risk control with no usability evidence of effectiveness.', { y: 4.85, h: 0.42, fontSize: 9, fill: C.navy });
}

// 31 Divider S4
divider(6, 'Closing the loop', 'Clause 10 and the MDR plumbing: the difference between a risk file and a historical document',
`[1:12]
Ten minutes. This is the section to compress if we are behind, but try not to: it is the one that fails most often in the field.`);

// 32 Clause 10
{
  const s = content('Section 4  |  Closing the loop', 'Clause 10: four questions of every input',
`[1:13 | 3 min]
Clause 10 has four subclauses. 10.1 general, 10.2 information collection, 10.3 information review, 10.4 actions. The plan has to name the activities under 4.4 g), and this is the clause most often found empty on a device that has been marketed for years.
10.2 is the list of sources. Read a few: information generated during production and monitoring of the production process, information from the user, from installation and servicing, publicly available information, and information on the generally acknowledged state of the art. That last one is the one nobody collects, and it is a named source.
10.3 is the heart of it. For every piece of safety-relevant information you ask four questions, and you record the answers. Is there a previously unrecognised hazard or hazardous situation? Is an estimated risk no longer acceptable? Is the original estimate no longer valid? Has the state of the art changed? Each one is a different question with a different consequence.
10.4 says what happens if any answer is yes: the impact is evaluated as an input to the risk management process, and the risk management file is reviewed, and if the residual risk has increased or is no longer acceptable, the impact of previously implemented controls is evaluated and fed into the risk management review.
The practical test of whether this works at your firm: pick one complaint from eighteen months ago and try to find the risk file revision it produced. If you cannot, the loop is open.`);
  table(s, ['10.3 asks', 'And if the answer is yes'], [
    ['Is there a previously unrecognised hazard or hazardous situation?', 'A new row. Full estimation, evaluation, control and residual risk under 5.5 to 7.4'],
    ['Is an estimated risk no longer acceptable?', 'Risk control is reopened. The residual risk and the overall residual risk are both revisited'],
    ['Is the original risk estimate no longer valid?', 'The estimate is corrected and the basis updated. This is the one that catches optimistic P1 values'],
    ['Has the state of the art changed?', 'Your AFAP position may have moved without anything failing. Comparators, standards and guidance all count'],
  ], { y: 1.18, colW: [4.2, 4.8], fontSize: 9, rowH: 0.3 });
  card(s, { x: M, y: 3.22, w: 4.35, h: 1.32, kicker: 'CLAUSE 10.2', title: 'Sources you have to collect from', fill: C.tint, titleSize: 11.5, titleH: 0.28,
    body: ['Production and monitoring of the production process', 'Information from the user', 'Installation, servicing and maintenance', 'Publicly available information and the state of the art'], bodySize: 9, gap: 2 });
  card(s, { x: M + 4.55, y: 3.22, w: 4.45, h: 1.32, kicker: 'THE FIELD TEST', title: 'Try this on your own file tonight', fill: C.goldTint, titleSize: 11.5, titleH: 0.28,
    body: 'Pick one complaint from eighteen months ago. Find the risk file revision it produced. If there is none, and no recorded decision that none was needed, the loop is open.', bodySize: 9.5 });
  band(s, 'The state of the art is a named collection source. It is also the one that ages your file with no failure, no complaint and no trend.', { y: 4.68, h: 0.4, fontSize: 10.5, fill: C.navy });
}

// 33 MDR plumbing
{
  const s = content('Section 4  |  Closing the loop', 'The MDR plumbing that Clause 10 has to connect to',
`[1:16 | 3 min]
In the EU, Clause 10 is not free-standing. It plugs into a named set of obligations, and the notified body checks the joints rather than the pipes.
Article 10(2) is the headline: manufacturers shall establish, document, implement and maintain a system for risk management as described in Section 3 of Annex I. One sentence. And Article 10(9)(e) puts risk management inside the quality management system, which is how it becomes auditable.
Annex I point 3 sub-points (e) and (f) are the loop in the law itself: evaluate the impact of information from production and from post-market surveillance on hazards, on frequency of occurrence, on risk estimates, on overall risk, on the benefit-risk ratio and on risk acceptability - and then amend control measures if necessary.
Article 83(3)(a) makes updating the benefit-risk determination and improving risk management the FIRST named use of post-market surveillance data, and Article 83(3) closes with "The technical documentation shall be updated accordingly."
Annex III point 1(b) is the single most audited joint: the post-market surveillance plan must contain suitable indicators and threshold values that shall be used in the continuous reassessment of the benefit-risk analysis and of the risk management. Indicators and thresholds. Quantitative. If your PMS plan has no numbers in it, that is a finding waiting to be written.
Then Annex XIV Part B point 8 sends the PMCF conclusions back into the risk management, and recital 33 states that the risk management and clinical evaluation processes should be inter-dependent and regularly updated. That recital is what a reviewer cites when they ask why your risk file and your clinical evaluation report disagree.
Two numbering traps for your cross-references. Corrigendum C2 renumbered Annex III from 1.1 and 1.2 to 1 and 2, so an SOP citing "Annex III Section 1.1" is citing superseded numbering. And Annex XIV Part B point 6.1(d) still refers to "the benefit-risk ratio referred to in Sections 1 and 9 of Annex I" - Section 9 is the Annex XVI provision; the benefit-risk sections are 1 and 8. That cross-reference was never corrected, unlike the identical error in Article 88(1), which was.`);
  table(s, ['MDR provision', 'What it requires of the risk file'], [
    ['Article 10(2)', 'Establish, document, implement and maintain a system for risk management as described in Section 3 of Annex I'],
    ['Article 10(9)(e)', 'Risk management is a named aspect the quality management system shall address'],
    ['Annex I point 3 (e), (f)', 'Evaluate the impact of production and post-market information on hazards, frequency, estimates, overall risk, benefit-risk ratio and acceptability - then amend controls'],
    ['Annex II point 5', 'The technical documentation contains the benefit-risk analysis (Sections 1 and 8) and the solutions adopted and the results of the risk management (Section 3)'],
    ['Article 83(3)(a)', 'PMS data is used first to update the benefit-risk determination and improve risk management, and "the technical documentation shall be updated accordingly"'],
    [{ text: 'Annex III point 1(b)', options: { fill: { color: C.goldTint } } }, { text: 'The PMS plan shall contain suitable indicators and threshold values for the continuous reassessment of the benefit-risk analysis and of the risk management', options: { fill: { color: C.goldTint }, bold: true } }],
    ['Article 86(1)(a)', 'The PSUR sets out the conclusions of the benefit-risk determination, throughout the lifetime of the device'],
    ['Article 88(1)', 'Trend reporting where a statistically significant increase would change the benefit-risk analysis referred to in Sections 1 and 8 of Annex I'],
    ['Annex XIV Part B point 8', 'PMCF evaluation report conclusions are taken into account in the clinical evaluation AND in the risk management'],
    ['Article 61(10)', 'Where conformity based on clinical data is not appropriate, the justification rests on the results of the risk management'],
  ], { y: 1.16, colW: [2.1, 6.9], fontSize: 8, rowH: 0.28 });
  txt(s, 'Two numbering traps: Corrigendum C2 renumbered Annex III 1.1 and 1.2 to 1 and 2; and Annex XIV Part B 6.1(d) still says "Sections 1 and 9" where it means 1 and 8 - never corrected, unlike the same error in Article 88(1).', { x: M, y: 4.78, w: CW, h: 0.36, fontSize: 9, italic: true, color: C.gray });
}

// 34 Interfaces
{
  const s = content('Section 4  |  Closing the loop', 'The interfaces that get audited',
`[1:19 | 2 min]
Last content slide. The risk file does not live alone, and the findings cluster at the joins rather than inside any one document.
Read the four rows and put the question after each one: do these two documents agree? Because that is the audit question. The clinical evaluation plan has to specify parameters for determining the acceptability of the benefit-risk ratio, based on the state of the art - and those parameters have to be consistent with the acceptability criteria in your risk management plan. Two documents, two sets of criteria, written by two teams, and nobody compared them. That is the finding.
MDCG 2025-10 on post-market surveillance, published December 2025, sets out the PMS-to-risk-management interface expectations explicitly: establish procedures for the interface, link PMS plan indicators and thresholds to the risk management documentation, assess the impact of collected data on probability and severity ratings, and evaluate the impact on overall risk, benefit-risk ratio and acceptability. It also confirms in a footnote that EN ISO 14971:2019 plus A11:2021 is harmonised and cited for both the MDR and the IVDR.
One 2026 development worth mentioning: ISO/TS 24971-2:2026, guidance on applying ISO 14971 to machine learning in artificial intelligence, was published in June 2026. It is guidance on applying the standard, not an amendment to it.`);
  table(s, ['Interface', 'What has to agree', 'Where it is required'], [
    ['Risk file and clinical evaluation', 'The risk acceptability criteria in the RM plan and the benefit-risk acceptability parameters in the clinical evaluation plan, based on the state of the art. Team-NB expects the interface to be "clear and noticeable"', 'Annex VII 4.5.4(c) and 4.5.5; Annex XIV Part A 1(a); recital 33'],
    ['Risk file and PMS', 'The PMS plan indicators and threshold values, and the probabilities and severities in the risk file they are meant to test', 'Annex III point 1(b); MDCG 2025-10 Table 3'],
    ['Risk file and usability engineering', 'Use errors identified in the use-related risk analysis, and the critical tasks in the summative evaluation. Effectiveness of category 3 controls is proven here or nowhere', 'ISO 14971 3.30 sources use error from IEC 62366-1'],
    ['Risk file and software or security', 'Software safety classification and the security risk records, and the hazardous situations they feed', 'MDR Annex I 17.1, 17.2, 17.4, 18.8; MDCG 2019-16 rev.1'],
  ], { y: 1.2, colW: [1.9, 5.1, 2.0], fontSize: 8.5, rowH: 0.38 });
  band(s, 'MDCG 2025-10 (December 2025) sets out the PMS-to-risk-management interface expectations. There is still no MDCG guidance dedicated to risk management, and none in the published pipeline.', { y: 4.4, h: 0.5, fontSize: 10.5, fill: C.navy });
}

// 35 Divider Exercise C
divider(7, 'Exercise C: your 30-day plan', 'Eight minutes. What you will actually change, and in what order',
`[1:22]
Individual, not group. Exercise pack page 6.`);

// 36 Exercise C
{
  const s = content('Exercise C  |  Brief', 'Five minutes, on your own, on one page',
`[1:22 | 5 min]
Individual work, deliberately. Five minutes of quiet, then two or three people read out their first action.
The framing that makes this useful: not "what should we improve" but "what will I have done by this day next month". One action per row, an owner who is in the building, and a date.
The prompts on the right are the six checks that come straight out of today. Point at the Excel toolkit: its Dashboard sheet computes the first five of these six for you once you have loaded your own rows. The sixth, whether your risk management plan criteria and your clinical evaluation plan parameters actually agree, is a document comparison that no formula can do for you. The toolkit also leaves the Clause 8 overall residual risk evaluation blank on purpose, because it is the last thing you do.
As they write, put the toolkit's delivered state on the screen if you have it open: sixteen rows, two deliberately defective, one control missing its effectiveness verification, one justification citing cost, one open post-production item. The facilitator guide names all five so you can point at them.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 3.3, kicker: 'THE SHEET', title: 'Write five rows', fill: C.tint, titleSize: 12.5, titleH: 0.3,
    body: ['What I will change', 'Which clause or GSPR it answers', 'Who owns it - a name, not a function', 'Done by - a date inside 30 days', 'How I will know it worked'], bodySize: 10.5, gap: 5 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 3.3, kicker: 'IF YOU NEED PROMPTS', title: 'Six checks from today', fill: C.goldTint, titleSize: 12.5, titleH: 0.3,
    body: ['Does the plan state what you do when probability cannot be estimated? (4.4 d)', 'Does every control have an EFFECTIVENESS record? (7.2)', 'Does any justification for skipping a higher-priority option rest on cost? (MDR I.2)', 'Does the procedure have a 7.6 completeness step?', 'Can you find the file revision one old complaint produced? (10.3, 10.4)', 'Do the RM plan criteria and the clinical evaluation plan parameters agree?'], bodySize: 9.5, gap: 3 });
  band(s, 'The Dashboard computes the first five of these six. The sixth, whether the plan criteria and the clinical evaluation plan agree, is a document comparison no formula can do - as is the Clause 8 evaluation, which the toolkit leaves blank on purpose.', { y: 4.62, h: 0.46, fontSize: 9.5, fill: C.navy });
}

// 37 Ten things
{
  const s = content('Close', 'Ten things to fix on Monday',
`[1:27 | 2 min]
Read them fast. This is the page people keep.
If you only do one, do number two. It is the finding that appears most often and it is the cheapest to close, because the work is usually already done and simply not written down as effectiveness.`);
  const items = [
    'Put the acceptability criteria in the plan, and date them before the risk table.',
    'Add a verification of EFFECTIVENESS record to every control that has only an implementation record.',
    'Separate P1 and P2 in every row, and write the basis for each.',
    'Split every row where one hazard reaches more than one hazardous situation.',
    'Add the severity-only rule for when probability cannot be estimated (4.4 d).',
    'Add a 7.6 completeness step to the procedure, and run it over the acceptable rows too.',
    'Strike every cost argument out of the order-of-priority justifications.',
    'Add residual risk disclosure references for every category 3 control.',
    'Put indicators and threshold values in the PMS plan, and link them to the rows they test.',
    'Rebuild the GSPR matrix against Annex I as it is now, not against the seven 2012 deviations.',
  ];
  const half = 5;
  for (let i = 0; i < 10; i++) {
    const col = Math.floor(i / half), row = i % half;
    const x = M + col * (CW / 2 + 0.1), y = 1.2 + row * 0.7;
    card(s, { x, y, w: CW / 2 - 0.1, h: 0.62, num: i + 1, badge: i === 1 ? C.gold : C.navy, title: items[i], titleSize: 10, titleH: 0.42, fill: i === 1 ? C.goldTint : (row % 2 ? C.tint2 : C.tint) });
  }
  band(s, 'If you do one: number two.', { y: 4.78, h: 0.35, fontSize: 12, fill: C.navy, bold: true });
}

// 38 Sources
{
  const s = content('Close', 'Sources, and what to re-verify before you rely on this',
`[1:29 | 1 min]
Point at the bottom band rather than reading the list. The material was verified in September 2026. Harmonised-standard citations, MDCG guidance and FDA recognition entries all move, so the facilitator guide carries a pre-delivery accuracy checklist. Tell them the handout has the full source list with the OJ references.`);
  card(s, { x: M, y: 1.2, w: 4.35, h: 1.55, kicker: 'STANDARDS', title: 'Primary', fill: C.tint, titleSize: 11.5, titleH: 0.26,
    body: ['ISO 14971:2019, third edition, December 2019, confirmed March 2025', 'ISO/TR 24971:2020, guidance (Annex C on the acceptability policy)', 'EN ISO 14971:2019/A11:2021, Annexes ZA and ZB', 'ISO/TS 24971-2:2026, machine learning in AI (June 2026)'], bodySize: 9, gap: 2 });
  card(s, { x: M + 4.55, y: 1.2, w: 4.45, h: 1.55, kicker: 'EU LAW', title: 'Primary', fill: C.tint, titleSize: 11.5, titleH: 0.26,
    body: ['Regulation (EU) 2017/745, consolidated text of 9 July 2024', 'Commission Implementing Decision (EU) 2022/757, OJ L 138, 17.5.2022 (MDR citation)', 'Commission Implementing Decision (EU) 2022/729, OJ L 135, 12.5.2022 (IVDR citation)', 'Commission summary list for 2017/745, generated 17.6.2026'], bodySize: 9, gap: 2 });
  card(s, { x: M, y: 2.9, w: 4.35, h: 1.45, kicker: 'US LAW', title: 'Primary', fill: C.tint2, titleSize: 11.5, titleH: 0.26,
    body: ['21 CFR Part 820 as in force from 2 February 2026, incorporating ISO 13485:2016 at 820.7', 'QMSR final rule, 89 FR 7496 (2 February 2024)', 'Compliance Program 7382.850, implementation date 2 February 2026', 'FDA recognized consensus standards database: ISO 14971 = 5-125'], bodySize: 9, gap: 2 });
  card(s, { x: M + 4.55, y: 2.9, w: 4.45, h: 1.45, kicker: 'GUIDANCE AND POSITION PAPERS', title: 'Secondary, and labelled as such', fill: C.tint2, titleSize: 11.5, titleH: 0.26,
    body: ['MDCG 2021-5 rev.1 on standardisation (what an Annex Z is)', 'MDCG 2025-10 on post-market surveillance (December 2025)', 'MDCG 2019-16 rev.1 on cybersecurity', 'Team-NB best practice guidance on technical documentation, V4, 21 April 2026 (supersedes V3 of 9 April 2025)'], bodySize: 9, gap: 2 });
  band(s, 'Verified September 2026. Harmonised-standard citations, MDCG guidance and FDA recognition entries change. The Facilitator Guide has a pre-delivery accuracy checklist; re-run it before you present this.', { y: 4.5, h: 0.5, fontSize: 10.5, fill: C.goldTint, color: C.navy, italic: false });
}

// 39 Close
{
  const s = base(true);
  s.addShape(S.rect, { x: 0, y: 0, w: 0.1, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  txt(s, 'THE ONE IDEA', { x: 0.75, y: 1.15, w: 8.5, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3 });
  txt(s, 'A risk file is an argument, not an archive', { x: 0.75, y: 1.5, w: 8.5, h: 0.8, fontFace: FH, fontSize: 32, color: C.white, bold: true });
  txt(s, 'Every number has a basis. Every control has two verifications. Every unacceptable residual risk has a benefit-risk record. Every post-market input has a recorded answer to four questions. If any one of those is missing, the file does not hold - and it will be the one a reviewer pulls.', { x: 0.75, y: 2.45, w: 8.4, h: 1.1, fontSize: 14.5, color: C.paleText });
  s.addShape(S.rect, { x: 0.75, y: 3.7, w: 1.6, h: 0.03, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  txt(s, 'Questions', { x: 0.75, y: 3.95, w: 4, h: 0.35, fontSize: 18, color: C.white, bold: true });
  txt(s, 'Elder Consulting, LLC  ·  Workshop material, not legal or regulatory advice', { x: 0.75, y: 4.55, w: 8.4, h: 0.3, fontSize: 11, color: '8FA1B5' });
  s.addNotes(`[1:30]
Close on the one idea, then take questions.
Three questions that always come and the short answers:
1. "Do we have to use ISO 14971?" - Not as law, in either jurisdiction. In the EU it is voluntary but harmonised, and the presumption of conformity only covers what Annex ZA lists. For FDA it is not incorporated into Part 820 but is a recognized consensus standard, and the activity is inspected through ISO 13485 regardless. In practice everyone uses it because the alternative is inventing a defensible process from scratch.
2. "Can we keep our three-band matrix?" - You can, but be ready to say which clause the middle band implements. ISO 14971:2019 does not have one, and under MDR point 2 an amber "acceptable with justification" band does not create a stopping point that cost can justify.
3. "How many rows should our risk file have?" - Wrong question. One per hazardous situation, which is determined by the device, not by a target. But a file with fewer rows than the device has failure modes has collapsed the analysis somewhere, and that is findable.
If there is time left, offer to walk one of their own rows on the screen. It is the most useful ten minutes of the session and it is worth over-running for.`);
}

pres.writeFile({ fileName: 'out/ISO-14971-Risk-Management-Workshop.pptx' }).then(f => console.log('wrote ' + f + ' slides: ' + n));
