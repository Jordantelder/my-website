// Checks the DNS rule files in AdGuard's DNS engine.
// usage: node dns-test.mjs ../adguard-dns-user-rules.txt  [hostname ...]
import fs from 'node:fs';
import { DnsEngine, RuleStorage, StringRuleList, setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';
setConfiguration({ compatibility: CompatibilityTypes.Dns, engine: 'dns', version: '1', verbose: false });
const text = fs.readFileSync(process.argv[2], 'utf8');
const engine = new DnsEngine(new RuleStorage([new StringRuleList(1, text, false)]));
const hosts = process.argv.slice(3);
if (!hosts.length) {
  // default probe: every rule in the file must block its own domain and a subdomain of it,
  // and a few well-known safe hosts must pass.
  const rules = text.split('\n').filter((l) => l.startsWith('||') && l.endsWith('^')).map((l) => l.slice(2, -1));
  let bad = 0;
  for (const d of rules) {
    for (const h of [d, 'www.' + d]) {
      if (!engine.match(h).basicRule) { bad++; console.log('  FAIL not blocked:', h); }
    }
  }
  for (const h of ['google.com', 'www.google.com', 'youtube.com', 'wikipedia.org', 'khanacademy.org', 'scratch.mit.edu',
                   'thetrevorproject.org', 'd.adguard-dns.com', 'adguard.com', 'apple.com', 'microsoft.com', 'cloudflare.com']) {
    const r = engine.match(h).basicRule;
    if (r) { bad++; console.log('  FAIL must-allow host is blocked:', h, '->', r.getPattern()); }
  }
  console.log(`${rules.length} rules checked; ${bad ? bad + ' FAILURES' : 'all good'}`);
} else {
  for (const h of hosts) {
    const r = engine.match(h).basicRule;
    console.log(h, '->', r ? 'BLOCK ' + r.getPattern() : 'pass');
  }
}
