import fs from 'node:fs';
import { Engine, Request, RequestType, setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';
setConfiguration({ compatibility: CompatibilityTypes.Extension, engine: 'extension', version: '1', verbose: false });
const text = fs.readFileSync(process.argv[2], 'utf8');
const engine = Engine.createSync({ filters: [{ id: 1, content: text, ignoreCosmetic: true }] });
console.log('rules loaded:', engine.getRulesCount());
const check = (url) => {
  const res = engine.matchRequest(new Request(url, null, RequestType.Document)).getBasicResult();
  return res ? (res.isAllowlist() ? 'ALLOW ' : 'BLOCK ') + String(res.getPattern ? res.getPattern() : (res.getIndex ? res.getIndex() : '')).slice(0, 80) : 'pass';
};
let bad = 0;
for (const [url, expect] of JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))) {
  const r = check(url);
  const ok = (expect === 'block' && r.startsWith('BLOCK')) || (expect === 'pass' && !r.startsWith('BLOCK'));
  if (!ok) bad++;
  console.log((ok ? '  ok  ' : '  FAIL') + ` [${expect}] ${url}  ->  ${r}`);
}
console.log(bad ? `${bad} FAILURES` : 'all good');
