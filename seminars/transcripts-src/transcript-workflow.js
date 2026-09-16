export const meta = {
  name: 'presentation-transcripts',
  description: 'Generate verbatim speaking transcripts for three medical device seminar decks in the speakers own documented style',
  phases: [
    { title: 'Style', detail: 'four independent lenses on the speaker style corpus, then one synthesis' },
    { title: 'Draft', detail: 'one agent per five-slide chunk across all three decks' },
    { title: 'Verify', detail: 'style, fidelity and continuity critics for each deck' },
    { title: 'Repair', detail: 'targeted per-slide replacements per deck' },
  ],
}

const CORPUS = '/tmp/claude-0/-home-user-my-website/a1302f2f-f03d-577e-a2f6-a5a313b39076/scratchpad/transcripts/style_corpus.txt'
// Paths are derived here rather than passed in, so there is no transcription
// surface for a typo. This reproduces the original manifest byte-for-byte, so
// the prompts are identical and the completed agents still replay from cache.
const T = '/tmp/claude-0/-home-user-my-website/a1302f2f-f03d-577e-a2f6-a5a313b39076/scratchpad/transcripts'
const pad = (n) => (n < 10 ? '0' + n : '' + n)
const SPEC = [
  ['iso13485', 1, 5, 40], ['iso13485', 6, 10, 40], ['iso13485', 11, 15, 40], ['iso13485', 16, 20, 40],
  ['iso13485', 21, 25, 40], ['iso13485', 26, 30, 40], ['iso13485', 31, 35, 40], ['iso13485', 36, 40, 40],
  ['qmsr', 1, 6, 41], ['qmsr', 7, 11, 41], ['qmsr', 12, 16, 41], ['qmsr', 17, 21, 41],
  ['qmsr', 22, 26, 41], ['qmsr', 27, 31, 41], ['qmsr', 32, 36, 41], ['qmsr', 37, 41, 41],
  ['iso14971', 1, 5, 39], ['iso14971', 6, 10, 39], ['iso14971', 11, 15, 39], ['iso14971', 16, 20, 39],
  ['iso14971', 21, 25, 39], ['iso14971', 26, 30, 39], ['iso14971', 31, 35, 39], ['iso14971', 36, 39, 39],
]
const MANIFEST = SPEC.map(([deck, start, end, total]) => ({
  deck, start, end, total,
  chunk_path: `${T}/chunks/${deck}_${pad(start)}-${pad(end)}.txt`,
  draft_path: `${T}/draft/${deck}_${pad(start)}-${pad(end)}.txt`,
}))
const DECKS = ['iso13485', 'qmsr', 'iso14971']
const DECK_TITLES = {
  iso13485: 'ISO 13485 & Audit Readiness',
  qmsr: 'QMSR Transition',
  iso14971: 'Risk Management Workshop (ISO 14971)',
}

const STYLE_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      description: 'Concrete, quotable observations about the speaker style, each with at least one verbatim example from the corpus',
      items: {
        type: 'object',
        properties: {
          rule: { type: 'string', description: 'An imperative instruction a writer could follow' },
          evidence: { type: 'string', description: 'Verbatim quote(s) from the corpus that show the pattern' },
          frequency: { type: 'string', description: 'How pervasive: every-presentation, common, occasional' },
        },
        required: ['rule', 'evidence', 'frequency'],
      },
    },
    anti_patterns: {
      type: 'array',
      description: 'Things this speaker never or almost never does, that a generic LLM would do by default',
      items: { type: 'string' },
    },
  },
  required: ['findings', 'anti_patterns'],
}

// ---------------------------------------------------------------- Phase 1
phase('Style')
log('Analysing the speaker style corpus through four independent lenses')

const LENSES = [
  {
    key: 'syntax',
    prompt: `Read the whole file at ${CORPUS}. It contains five presentation transcripts written and delivered verbatim by one speaker (Jordan Elder, a medical device regulatory consultant).

Your lens is SENTENCE-LEVEL SYNTAX AND GRAMMAR. Report only on:
- Average and typical sentence length; how often sentences run long and how they are joined (semicolons? "while"? "however,"? em dashes? "which"?).
- Preferred constructions: "In order to" vs "To"; "It is important to note that" vs "Note that"; passive vs active; nominalisations.
- Paragraph length and how paragraphs open.
- How lists are rendered when read aloud: are numbers spoken? are bullets expanded into full sentences? does each list item get a lead-in colon?
- Punctuation habits, including any consistent irregularities (missing apostrophes, comma splices, doubled words, agreement slips). Report these factually as part of the fingerprint. Do NOT recommend reproducing errors, but DO record the level of polish: is this copy-edited prose or first-draft prose read aloud?
- How acronyms are introduced and re-used.
- How numbers, dates, statistics and regulation citations are spoken.

Quote verbatim. Be specific enough that another writer could imitate the syntax without seeing the corpus.`,
  },
  {
    key: 'discourse',
    prompt: `Read the whole file at ${CORPUS}. Five presentation transcripts by one speaker (Jordan Elder, medical device regulatory consultant), read verbatim when delivered.

Your lens is DISCOURSE STRUCTURE AND TRANSITIONS. Report only on:
- The opening formula, quoted exactly, including how the speaker thanks an introducer, names themself, states the topic, previews scope, and hands off into the body. Note every variant across the five sources.
- The closing formula, quoted exactly.
- How each slide begins. Catalogue the actual sentence openers used at slide boundaries.
- Backward and forward references between slides ("As we discussed in our previous slide", "So now that we have a baseline understanding of X, we can move on to Y"). List every instance.
- Rhetorical questions posed on the audience's behalf, quoted exactly, and where in a slide they appear.
- Section and topic signposting ("The first challenge I want to discuss today is", "I would like to take a moment to discuss").
- How the speaker labels a Conclusion or wrap-up section and what it does.
- Whether the speaker writes stage directions or interaction cues anywhere, and if so how.

Quote verbatim and count instances where you can.`,
  },
  {
    key: 'lexicon',
    prompt: `Read the whole file at ${CORPUS}. Five presentation transcripts by one speaker (Jordan Elder, medical device regulatory consultant).

Your lens is LEXICAL AND PHRASAL FINGERPRINT. Report only on:
- The speaker's high-frequency stock phrases. For each, give the exact wording and count how many times it appears. Be exhaustive; include hedges, intensifiers and emphasis markers ("it is important to note", "it is critical that", "crucial", "imperative", "non-negotiable", "It should be noted that", "with that said", "Trust me when I say").
- Pronoun and address habits: when does the speaker use "we", when "you/your", when "I", when "manufacturers"? Is there a pattern (e.g. "we" for the shared journey, "you" for the audience's own device, "manufacturers" for the regulated party)?
- Analogy and framing devices ("We can think of the PCCP as setting the guardrails").
- Informal discourse openers ("Alright", "So", "Well", "Alright great", "So first off") and how frequently they appear.
- Domain vocabulary preferences: does the speaker say "clearance" vs "approval", "the agency" vs "FDA", "premarket notification" vs "510(k)"? Any terms the speaker is careful to distinguish?
- Words and registers the speaker avoids.

Give exact counts or close estimates. Quote verbatim.`,
  },
  {
    key: 'persona',
    prompt: `Read the whole file at ${CORPUS}. Five presentation transcripts by one speaker (Jordan Elder, medical device regulatory consultant), read verbatim when delivered.

Your lens is PERSONA, STANCE AND AUDIENCE RELATIONSHIP. Report only on:
- First-person professional anecdotes: quote each one in full, and characterise what job they do in the argument (credibility, warning, reassurance). Note the typical length and how they are introduced ("I actually recently worked with a manufacturer who...").
- Self-deprecation, apology and acknowledgement of the audience's likely boredom or scepticism. Quote each instance ("I know regulatory requirements are not typically considered exciting or fun for most people").
- How the speaker handles apologising for a slide's visual quality or density.
- Stance toward the regulator: deferential, critical, neutral, pragmatic? Quote evidence.
- Stance toward the audience's competence: does the speaker flatter, warn, level with them? How are junior vs senior audience members addressed ("most senior regulatory team members will recognize this as a common misconception among younger regulatory teams").
- How advice is issued: imperative, recommendation, or "I always recommend"?
- How the speaker signals the limits of their own claim ("This is by no means an exhaustive list").
- Whether the speaker ever uses humour, and of what kind.

Quote verbatim.`,
  },
]

const styleParts = (await parallel(LENSES.map(l => () =>
  agent(l.prompt, { label: `style:${l.key}`, phase: 'Style', schema: STYLE_SCHEMA, effort: 'high' })
    .then(r => r ? { key: l.key, ...r } : null)
))).filter(Boolean)

log(`Style lenses returned: ${styleParts.map(p => `${p.key} (${p.findings.length} findings)`).join(', ')}`)

const styleDump = styleParts.map(p =>
  `===== LENS: ${p.key} =====\n` +
  p.findings.map(f => `RULE (${f.frequency}): ${f.rule}\n  EVIDENCE: ${f.evidence}`).join('\n') +
  `\nANTI-PATTERNS:\n- ${p.anti_patterns.join('\n- ')}`
).join('\n\n')

const styleGuide = await agent(
  `You are writing a STYLE SPECIFICATION that other writers will follow to produce presentation transcripts indistinguishable from one specific speaker's own writing.

Four analysts examined the speaker's corpus of five verbatim-read presentation transcripts through different lenses. Their findings:

${styleDump}

You may also read the corpus yourself at ${CORPUS} to resolve any disagreement or fill gaps — do so.

Write the specification. Requirements:
- Lead with the OPENING FORMULA and CLOSING FORMULA, quoted exactly as the speaker writes them, with the slots marked (topic, scope preview). These must be reproduced near-verbatim.
- Then a numbered list of 20 to 35 concrete, checkable rules. Each rule must be actionable ("Open a slide that follows a conceptual slide with 'So now that we have...'") not vague ("be formal").
- Include the stock-phrase inventory with guidance on how often to deploy each, so imitation does not become parody. Say explicitly which phrases are load-bearing and which would look like tics if overused.
- Include a target words-per-slide range derived from the corpus: compute roughly how many spoken words the speaker writes per slide, and note the variance between a dense content slide and a transitional one.
- Include an ANTI-PATTERN list: the specific things a generic AI writer would do that this speaker never does. Be concrete (e.g. about em dashes, rhetorical triples, "Let's dive into", bulleted output, second-person coaching voice, exclamation marks).
- Include a short section on SENTENCE RHYTHM with two or three model sentences you have written yourself that could pass as the speaker's.
- Note the level of polish honestly: if the corpus is first-draft prose with occasional slips, say so and say that the imitation should read as competent professional prose without being conspicuously copy-edited. Do NOT instruct writers to insert deliberate errors.

Output the specification as plain prose and numbered lists. No preamble. This is a working document, aim for 1200 to 1800 words.`,
  { label: 'style:synthesise', phase: 'Style', effort: 'high' }
)

log('Style specification complete')

// ---------------------------------------------------------------- Phase 2
const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    slides_written: { type: 'array', items: { type: 'number' }, description: 'The slide numbers you wrote text for' },
    word_counts: { type: 'array', items: { type: 'number' }, description: 'Spoken word count per slide, same order as slides_written' },
    written_to: { type: 'string', description: 'The absolute path you wrote the transcript chunk to' },
    notes_for_editor: { type: 'string', description: 'Anything the final editor must know: content you could not source from the slide, a seam you could not resolve, a factual claim you softened' },
  },
  required: ['slides_written', 'word_counts', 'written_to'],
}

function draftPrompt(m) {
  return `You are ghost-writing a presentation transcript for Jordan Elder, a medical device regulatory consultant. He reads his transcripts VERBATIM from the page with almost no improvisation, so whatever you write is exactly what comes out of his mouth. It must be complete, speakable prose.

STYLE SPECIFICATION — follow it closely; this is the whole point of the task:
${styleGuide}

YOUR INPUT: read the file at ${m.chunk_path}. It contains the deck subject, your slide range, the neighbouring slide titles, the full deck outline, and for each of your slides both the ON-SCREEN TEXT and Jordan's own SPEAKER NOTES.

TASK: write the spoken transcript for slides ${m.start} to ${m.end} of the "${DECK_TITLES[m.deck]}" deck (${m.total} slides total).

Hard requirements:
1. Cover EVERY slide in your range, in order, each headed exactly "SLIDE ${m.start}" style — the literal word SLIDE, a space, the number, on its own line. Nothing else on that line.
2. The SPEAKER NOTES are the authoritative content. They are written in the imperative to himself ("Walk the agenda quickly", "Stop on the third row"). Convert their SUBSTANCE into first-person spoken prose. Every substantive fact, figure, citation, clause number and argument in the notes must survive into the transcript.
3. The ON-SCREEN TEXT tells you what the audience is looking at. Do not simply read the slide aloud verbatim — the speaker talks around and through it, expanding bullets into full sentences and adding the reasoning the slide only gestures at. But do not contradict the slide, and do not omit a table row or card the notes clearly want discussed.
4. Never invent a regulatory fact, figure, date, citation or statistic that is not in the slide or the notes. If the notes tell him to say something you cannot source, write the sentence without the unsourced specific and flag it in notes_for_editor.
5. Do not reproduce the bracketed timing cues like [0:06 | 2 min]. Use them only to size the slide's text. Roughly 130 to 150 spoken words per minute is the right density.
6. ${m.start === 1
    ? 'Your chunk OPENS the presentation. Slide 1 must carry the speaker\'s standard opening formula from the style specification, near-verbatim, adapted to this topic, including naming himself and previewing the scope of the session.'
    : 'Your chunk does NOT open the presentation. Do NOT re-introduce the speaker, do not greet the audience, and do not re-state the session scope. Begin as a continuation.'}
7. ${m.end === m.total
    ? 'Your chunk CLOSES the presentation. The final slide must carry the speaker\'s standard closing formula from the style specification, near-verbatim.'
    : 'Your chunk does NOT close the presentation. Do not thank the audience or invite questions at the end.'}
8. These are WORKSHOPS, not one-way webinars. Several slides run an exercise, a show of hands, or table discussion. Jordan's earlier transcripts were non-interactive so the corpus gives you no model for this. Handle it like this: write the actual spoken words that set the interaction up and the actual spoken words that resume afterwards, and where he must stop talking, put a cue on its own line in square brackets and in capitals, for example:
   [PAUSE FOR SHOW OF HANDS]
   [TABLE WORK - 10 MINUTES. CIRCULATE.]
   [TAKE ANSWERS FROM TWO OR THREE TABLES BEFORE ADVANCING]
   These cues are stage directions, never spoken. Use them only where the notes call for an interaction. Keep them rare.
9. Where the deck's on-screen text has an obvious placeholder such as "[Name, Title]" or "[Date]", write around it; do not read a placeholder aloud.
10. Write nothing but the transcript: no commentary, no headings other than the SLIDE lines, no markdown emphasis, no bullet characters. Where the speaker would enumerate, write the numbers as he does in the corpus ("1." on its own, then the prose).

Write the finished transcript to ${m.draft_path} using the Write tool, then return the structured result. The file must contain ONLY the SLIDE headings and the spoken prose.`
}

phase('Draft')
log(`Drafting ${MANIFEST.length} chunks across three decks`)

const drafts = await pipeline(
  MANIFEST,
  m => agent(draftPrompt(m), {
    label: `draft:${m.deck}:${m.start}-${m.end}`,
    phase: 'Draft',
    schema: DRAFT_SCHEMA,
    effort: 'high',
  }).then(r => r ? { ...m, ...r } : null)
)

const ok = drafts.filter(Boolean)
const failed = MANIFEST.filter(m => !ok.some(o => o.chunk_path === m.chunk_path))
if (failed.length) log(`WARNING: ${failed.length} chunk(s) failed to draft: ${failed.map(f => `${f.deck} ${f.start}-${f.end}`).join(', ')}`)

for (const d of DECKS) {
  const mine = ok.filter(o => o.deck === d)
  const words = mine.flatMap(o => o.word_counts || [])
  const total = words.reduce((a, b) => a + b, 0)
  const slides = mine.flatMap(o => o.slides_written || []).length
  log(`${DECK_TITLES[d]}: ${slides} slides drafted, ${total} spoken words (~${Math.round(total / 140)} min of speech)`)
}

const editorNotes = ok.filter(o => o.notes_for_editor && o.notes_for_editor.trim().length > 4)
if (editorNotes.length) log(`${editorNotes.length} chunk(s) left notes for the editor`)

// ---------------------------------------------------------------- Phase 3
const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', description: 'pass, or needs-work' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slide: { type: 'number', description: 'The slide number the problem is on, or 0 if it is deck-wide' },
          severity: { type: 'string', description: 'blocking, or minor' },
          problem: { type: 'string', description: 'What is wrong, specifically, quoting the offending text' },
          fix: { type: 'string', description: 'What it should say instead, concretely' },
        },
        required: ['slide', 'severity', 'problem', 'fix'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['verdict', 'findings', 'summary'],
}

function deckFiles(deck) {
  return MANIFEST.filter(m => m.deck === deck)
    .sort((a, b) => a.start - b.start)
    .map(m => m.draft_path)
}
function deckChunks(deck) {
  return MANIFEST.filter(m => m.deck === deck)
    .sort((a, b) => a.start - b.start)
    .map(m => m.chunk_path)
}

const CRITICS = [
  {
    key: 'style',
    prompt: (deck) => `Read the speaker's own corpus at ${CORPUS} first, then read these transcript files IN ORDER, which together form one draft transcript for the "${DECK_TITLES[deck]}" presentation:
${deckFiles(deck).join('\n')}

You are a STYLE FIDELITY critic. The transcript was written to imitate the speaker in the corpus. Judge only whether it reads as his writing. Look hard for:
- Generic AI register: em-dash asides, rhetorical triples, "Let's dive into", "In today's rapidly evolving landscape", "It's worth noting" where he would write "It is important to note that", sentences that are too short and punchy, bulleted or fragmentary output.
- Over-imitation: the same stock phrase used so often it reads as parody. Count the uses of "It is important to note that" and similar and say whether the density matches the corpus.
- Wrong pronoun discipline: "we/you/I/manufacturers" used against the pattern in the corpus.
- Wrong opening or closing formula, or an opening formula appearing anywhere other than the first slide.
- Second-person coaching voice ("You should ensure that you...") where he would write about manufacturers or about "your device".
- Any place the prose is conspicuously more copy-edited or more literary than the corpus.

Report findings with the slide number and a quote. Be specific and quote both the offending text and what it should be. Do not report on factual accuracy — another critic has that.`,
  },
  {
    key: 'fidelity',
    prompt: (deck) => `Read these SOURCE files, which contain the on-screen text and the speaker's own planning notes for every slide of the "${DECK_TITLES[deck]}" deck:
${deckChunks(deck).join('\n')}

Then read the DRAFT TRANSCRIPT files in order:
${deckFiles(deck).join('\n')}

You are a CONTENT FIDELITY critic. Go slide by slide and check:
1. COVERAGE: does every slide in the source have a transcript entry, headed "SLIDE n", with nothing missing and nothing invented? Report any missing or duplicated slide number.
2. SUBSTANCE LOSS: for each slide, does every substantive fact, figure, clause number, regulation citation, date and argument in the SPEAKER NOTES appear in the transcript? List anything dropped. This is the most important check — the notes are the authoritative content and the speaker reads the transcript verbatim, so anything dropped is simply never said.
3. FABRICATION: does the transcript assert any regulatory fact, figure, date, citation, statistic or clause number that is NOT in that slide's on-screen text or notes? Quote every instance. Treat invented specifics as BLOCKING.
4. CONTRADICTION: does the transcript contradict the slide it accompanies, or another slide?
5. CLAUSE AND CITATION ACCURACY: check every clause number, regulation section, article, annex point, CFR citation and standard designation against the source. Report any that was altered, transposed or mis-stated.

Report findings with slide numbers and quotes. Do not report on style — another critic has that.`,
  },
  {
    key: 'continuity',
    prompt: (deck) => `Read these transcript files IN ORDER, which together form one continuous transcript for the "${DECK_TITLES[deck]}" presentation:
${deckFiles(deck).join('\n')}

They were drafted by different writers working on separate five-slide chunks, so seams are the expected failure. You are a CONTINUITY AND DELIVERABILITY critic. Check:
1. SEAMS at every chunk boundary (after slides 5, 10, 15, 20, 25, 30, 35 and thereabouts): does the transcript read as one person talking straight through? Look for a concept introduced twice as if new, an acronym expanded twice, a self-introduction or greeting appearing mid-deck, a topic promised and never delivered, or a "as we discussed earlier" pointing at something never said.
2. REPETITION: any sentence, anecdote, analogy or framing used more than once across the whole deck. Quote both instances.
3. FORWARD AND BACKWARD REFERENCES: does every "as we discussed" point at something actually earlier, and every "we will come to" point at something actually later? Check each one.
4. SPEAKABILITY: read it as if aloud. Flag any sentence that cannot be said in one breath, any tongue-twister, any place where a number or citation would be awkward spoken, and any place where the text assumes the reader can see punctuation the listener cannot hear.
5. INTERACTION CUES: are the bracketed stage directions used consistently, in capitals, on their own lines, and only where an interaction is actually called for? Flag any that could be mistaken for spoken text, and any exercise that is set up but never resumed.
6. ARC: does the deck build? Does the close land on the point the opening promised?

Report findings with slide numbers and quotes.`,
  },
]

phase('Verify')
log('Critiquing each deck through three lenses')

const critiques = await pipeline(
  DECKS.flatMap(d => CRITICS.map(c => ({ deck: d, critic: c }))),
  ({ deck, critic }) => agent(critic.prompt(deck), {
    label: `verify:${deck}:${critic.key}`,
    phase: 'Verify',
    schema: CRITIQUE_SCHEMA,
    effort: 'high',
  }).then(r => r ? { deck, critic: critic.key, ...r } : null)
)

const goodCritiques = critiques.filter(Boolean)
for (const d of DECKS) {
  const mine = goodCritiques.filter(c => c.deck === d)
  const blocking = mine.flatMap(c => c.findings.filter(f => f.severity === 'blocking')).length
  const minor = mine.flatMap(c => c.findings.filter(f => f.severity !== 'blocking')).length
  log(`${DECK_TITLES[d]}: ${blocking} blocking, ${minor} minor findings from ${mine.length} critics`)
}

// ---------------------------------------------------------------- Phase 4
const REPAIR_SCHEMA = {
  type: 'object',
  properties: {
    fixes: {
      type: 'array',
      description: 'One entry per slide that needs changing. The replacement is the COMPLETE new spoken text for that slide, excluding the SLIDE heading line.',
      items: {
        type: 'object',
        properties: {
          slide: { type: 'number' },
          replacement: { type: 'string', description: 'The complete replacement spoken text for this slide' },
          reason: { type: 'string' },
        },
        required: ['slide', 'replacement', 'reason'],
      },
    },
    rejected: {
      type: 'array',
      description: 'Critic findings you decided NOT to act on, and why',
      items: { type: 'string' },
    },
    unresolved: { type: 'string', description: 'Anything a human must decide, or any content gap you could not close from the source' },
  },
  required: ['fixes', 'rejected'],
}

phase('Repair')
log('Applying critic findings deck by deck')

const repairs = await pipeline(
  DECKS,
  (deck) => {
    const mine = goodCritiques.filter(c => c.deck === deck)
    const body = mine.map(c =>
      `===== CRITIC: ${c.critic} — verdict ${c.verdict} =====\n${c.summary}\n` +
      c.findings.map(f => `[slide ${f.slide}] (${f.severity}) PROBLEM: ${f.problem}\n   PROPOSED FIX: ${f.fix}`).join('\n')
    ).join('\n\n')
    const notes = editorNotes.filter(e => e.deck === deck)
      .map(e => `chunk ${e.start}-${e.end}: ${e.notes_for_editor}`).join('\n') || '(none)'
    return agent(
      `You are the final editor of a presentation transcript for Jordan Elder, a medical device regulatory consultant who reads his transcripts VERBATIM from the page.

THE STYLE SPECIFICATION the transcript must satisfy:
${styleGuide}

THE DRAFT, in order — read all of these:
${deckFiles(deck).join('\n')}

THE SOURCE MATERIAL for every slide (on-screen text and the speaker's own planning notes) — read these too, you will need them to close content gaps:
${deckChunks(deck).join('\n')}

NOTES LEFT BY THE DRAFTERS:
${notes}

THREE CRITIQUES:
${body}

Your job: decide which findings are real, then produce the corrected text.

Rules:
- For every slide that needs any change, return the COMPLETE replacement spoken text for that slide (not a diff, not a fragment). Do not include the "SLIDE n" heading line in the replacement — just the prose that follows it.
- A finding is real if it would be noticed by the speaker reading aloud or by an audience member. Reject findings that are matters of taste, that would make the prose more generic, or that ask for a fact the source does not support. List every rejection with your reason.
- Treat as BLOCKING and always fix: an invented regulatory fact, figure, date, citation, clause number or statistic; a dropped substantive point from the speaker notes; a missing or duplicated slide; a self-introduction or closing appearing on the wrong slide; a wrong clause or citation number.
- When you fix a seam, you may need to change BOTH slides involved. Return both.
- Never introduce a fact that is not in that slide's on-screen text or speaker notes. If a critic asks for content the source does not support, reject the finding and say so.
- Preserve the bracketed stage-direction convention exactly: capitals, square brackets, own line, only where an interaction happens.
- Match the style specification. Do not make the prose more polished, shorter, punchier or more list-like than the corpus.
- If two critics disagree, read the source and decide; say which you followed.

Return the structured result. Be thorough: it is better to return twelve careful replacements than three.`,
      { label: `repair:${deck}`, phase: 'Repair', schema: REPAIR_SCHEMA, effort: 'high' }
    ).then(r => r ? { deck, ...r } : null)
  }
)

const goodRepairs = repairs.filter(Boolean)
for (const r of goodRepairs) {
  log(`${DECK_TITLES[r.deck]}: ${r.fixes.length} slide replacements, ${r.rejected.length} findings rejected`)
}

return {
  style_guide: styleGuide,
  drafted: ok.map(o => ({ deck: o.deck, start: o.start, end: o.end, path: o.draft_path, slides: o.slides_written, words: o.word_counts })),
  failed_chunks: failed.map(f => ({ deck: f.deck, start: f.start, end: f.end })),
  editor_notes: editorNotes.map(e => ({ deck: e.deck, chunk: `${e.start}-${e.end}`, note: e.notes_for_editor })),
  critiques: goodCritiques.map(c => ({ deck: c.deck, critic: c.critic, verdict: c.verdict, summary: c.summary, findings: c.findings })),
  repairs: goodRepairs,
}
