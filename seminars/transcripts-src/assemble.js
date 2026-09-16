// Assembles per-chunk transcript drafts into one .docx + .txt per deck,
// applying the repair phase's per-slide replacements.
// Output format mirrors the speaker's own transcript files exactly:
//   "SLIDE n"  bold 12pt, NoSpacing   /  6pt spacer  /  body 12pt  /  6pt spacer
const fs = require('fs');
const path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = D;

const T = '/tmp/claude-0/-home-user-my-website/a1302f2f-f03d-577e-a2f6-a5a313b39076/scratchpad/transcripts';
const manifest = JSON.parse(fs.readFileSync(`${T}/manifest.json`, 'utf8'));
const repairs = fs.existsSync(`${T}/repairs.json`)
  ? JSON.parse(fs.readFileSync(`${T}/repairs.json`, 'utf8')) : [];

const DECK_META = {
  iso13485: { file: 'ISO-13485-Audit-Readiness', title: 'ISO 13485 & Audit Readiness', total: 40 },
  qmsr:     { file: 'QMSR-Transition',           title: 'QMSR Transition',            total: 41 },
  iso14971: { file: 'ISO-14971-Risk-Management', title: 'Risk Management Workshop (ISO 14971)', total: 39 },
};

function parseChunk(txt) {
  // split on lines that are exactly "SLIDE <n>" (tolerate trailing spaces / colon)
  const out = [];
  const lines = txt.replace(/\r/g, '').split('\n');
  let cur = null;
  for (const ln of lines) {
    const m = ln.match(/^\s*SLIDE\s+(\d+)\s*:?\s*$/i);
    if (m) {
      if (cur) out.push(cur);
      cur = { n: parseInt(m[1], 10), lines: [] };
    } else if (cur) {
      cur.lines.push(ln);
    }
  }
  if (cur) out.push(cur);
  return out;
}

const report = [];
for (const key of Object.keys(DECK_META)) {
  const meta = DECK_META[key];
  const chunks = manifest.filter(m => m.deck === key).sort((a, b) => a.start - b.start);
  const slides = new Map();
  const dupes = [];
  for (const c of chunks) {
    if (!fs.existsSync(c.draft_path)) { report.push(`${key}: MISSING draft ${c.start}-${c.end}`); continue; }
    for (const s of parseChunk(fs.readFileSync(c.draft_path, 'utf8'))) {
      if (slides.has(s.n)) dupes.push(s.n);
      const body = s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      slides.set(s.n, body);
    }
  }
  // apply repairs
  const r = repairs.find(x => x.deck === key);
  let applied = 0, skipped = [];
  if (r) for (const f of (r.fixes || [])) {
    if (slides.has(f.slide)) { slides.set(f.slide, f.replacement.trim()); applied++; }
    else skipped.push(f.slide);
  }
  // validate coverage
  const missing = [];
  for (let i = 1; i <= meta.total; i++) if (!slides.has(i)) missing.push(i);
  const extra = [...slides.keys()].filter(n => n < 1 || n > meta.total);

  // build
  const children = [];
  const SPACER = () => new Paragraph({ style: 'NoSpacing', children: [new TextRun({ text: '', size: 12 })] });
  for (let i = 1; i <= meta.total; i++) {
    const body = slides.get(i) || '';
    children.push(new Paragraph({ style: 'NoSpacing', children: [new TextRun({ text: `SLIDE ${i}`, bold: true, size: 24 })] }));
    children.push(SPACER());
    for (const para of body.split(/\n\s*\n/)) {
      const t = para.trim();
      if (!t) continue;
      // stage directions stay on their own line, bold, so they are never read aloud
      const isCue = /^\[[^\]]+\]$/.test(t);
      children.push(new Paragraph({
        style: 'NoSpacing',
        children: t.split('\n').map((l, idx) => new TextRun({
          text: l.trim(), size: 24, bold: isCue, break: idx > 0 ? 1 : 0,
        })),
      }));
      children.push(SPACER());
    }
    children.push(SPACER());
  }

  const doc = new Document({
    creator: 'Elder Consulting, LLC',
    title: `${meta.title} - Presentation Transcript`,
    styles: {
      default: { document: { run: { font: 'Aptos', size: 24 } } },
      paragraphStyles: [{
        id: 'NoSpacing', name: 'No Spacing', basedOn: 'Normal', next: 'NoSpacing', quickFormat: true,
        run: { size: 24 }, paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } },
      }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  const outBase = `${T}/final/${meta.file}-Transcript`;
  Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(`${outBase}.docx`, buf);
    // plain text twin
    let txt = '';
    for (let i = 1; i <= meta.total; i++) txt += `SLIDE ${i}\n\n${(slides.get(i) || '').trim()}\n\n\n`;
    fs.writeFileSync(`${outBase}.txt`, txt);
    const words = txt.split(/\s+/).filter(Boolean).length;
    console.log(JSON.stringify({
      deck: key, slides: slides.size, expected: meta.total,
      missing, extra, duplicates: [...new Set(dupes)],
      repairs_applied: applied, repairs_skipped: skipped,
      words, minutes: Math.round(words / 140),
      docx: `${outBase}.docx`,
    }));
  });
}
if (report.length) console.error(report.join('\n'));
