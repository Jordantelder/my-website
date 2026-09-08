# AdGuard parental-control blocklist

Domain rules for **AdGuard DNS** plus search-term rules for the **AdGuard app / browser extension**,
covering pornography and NSFW content, sexuality and LGBTQ+ topics, furry and therian content,
demonic/occult content, the platforms where that content concentrates, and the tools kids use to get
around DNS filtering.

## Read this first: AdGuard DNS cannot block a Google search

A DNS filter only ever sees the **hostname** of a request. When a child opens
`https://www.google.com/search?q=lbqtq`, AdGuard DNS sees `www.google.com` and nothing else:
the `/search?q=...` part is inside the encrypted HTTPS connection and never reaches a DNS server.
Pasting that URL into AdGuard DNS user rules therefore either does nothing or, if AdGuard reduces it
to the domain, blocks all of Google.

What the DNS layer *can* do, and what this folder provides for it:

| Goal | Where it is handled |
|---|---|
| Hide explicit results in Google, Bing, DuckDuckGo, Yandex, Brave, Ecosia, Pixabay and YouTube | AdGuard DNS dashboard: **Server settings → Parental control → Safe search / YouTube Restricted Mode** (one click, no list needed) |
| Block whole sites (porn, furry, occult, chat, AI, proxies, ...) | `adguard-dns-user-rules.txt` (this folder) |
| Block search engines whose SafeSearch cannot be forced | included in `adguard-dns-user-rules.txt` (Startpage, SearX instances, Qwant, Mojeek, Presearch, ...) |
| Stop devices from bypassing AdGuard DNS (encrypted DNS, VPNs, proxies, Tor, Apple Private Relay) | included in `adguard-dns-user-rules.txt` |
| **Block a search by its words** ("lesbian", "lbqtq", "how to summon a demon", misspellings, algospeak) | needs software on the device that sees full URLs: `adguard-app-search-rules.txt` for the AdGuard app or browser extension |

## Files

| File | Use it in | What it is |
|---|---|---|
| `adguard-dns-user-rules.txt` | AdGuard DNS → your server → **User rules** | Domain rules, grouped by category. Optional entries (mainstream sites many parents keep) are commented out with `! optional:`. |
| `adguard-dns-user-rules-strict.txt` | same | Same list with every optional entry enabled. |
| `DOMAINS.md` | you | Every domain in the DNS lists with its category and a one-line note. |
| `adguard-app-search-rules.txt` | AdGuard for Windows / Mac / Android → **User rules**, or AdGuard Browser Extension | One rule per search site and keyword. Blocks the results page on Google, Bing, DuckDuckGo, Yahoo, Yandex, Brave, Ecosia, YouTube, TikTok, Pinterest, Reddit, X, Tumblr, DeviantArt, Wattpad, AO3, Giphy/Tenor, ChatGPT/Copilot/Perplexity, Amazon/Etsy/eBay, Roblox, Steam/itch/Google Play, Wikipedia and Fandom when the query or tag contains a listed term. |
| `adguard-app-search-rules-compact.txt` | same, when rule count matters (Chrome MV3 extension) | Same coverage as a few dozen regular-expression rules. |
| `search-keywords.txt` | any other tool with keyword blocking (Qustodio, Bark, Net Nanny, Mobicip, LeechBlock, router filters) | Plain keyword list, one per line. |
| `sources/` | you | The editable lists everything above is generated from. |
| `generate.py` | you | Rebuilds all output files from `sources/` (`python3 generate.py`). |
| `research-caveats.json` | you | Per-category notes from the research pass: what DNS cannot cover and why. |
| `tests/` | you | Scripts that run the generated files through AdGuard's own filtering engine. |

{{STATS}}

## Setup, layer by layer

### 1. AdGuard DNS dashboard (covers every device pointed at your server)

1. **Parental control**: turn on *Block adult content*, *Safe search* for every engine listed, and
   *YouTube Restricted Mode*. This is the single most effective switch for Google and YouTube.
2. **Blocked services**: for a 6-to-12-year-old, consider the toggles for Reddit, Tumblr, X/Twitter,
   Discord, Telegram, Snapchat, TikTok, Twitch, 4chan, OnlyFans, Omegle, Tinder, VK, Pinterest and
   Steam community. The domain list repeats most of these as `optional` lines, so use whichever is
   easier to manage.
3. **Filters**: if your plan offers third-party lists, add the NSFW-oriented ones
   (HaGeZi NSFW, OISD NSFW, Steven Black "porn") and HaGeZi's *Encrypted DNS / VPN / Proxy bypass* list.
   The user rules below are meant to fill the gaps those lists leave (furry, therian, occult, AI chat,
   leak sites, stranger chat, bypass tools), not to replace them.
4. **User rules**: paste the contents of `adguard-dns-user-rules.txt`. If your plan caps the number of
   user rules, paste the categories in this priority order: bypass hardening, stranger chat and dating,
   erotica and AI, adult video, furry/therian, occult, hentai, LGBTQ+ sites, platforms.
5. **Blocking mode**: set it to *NXDOMAIN* if the option is available. Firefox disables its automatic
   DNS-over-HTTPS when `use-application-dns.net` returns NXDOMAIN or an answer without addresses; an answer
   of `0.0.0.0` does not count. This only stops the *automatic* DoH rollout, which is why the list also blocks
   the public DoH provider hostnames a child could enter by hand.

### 2. Lock the devices to your AdGuard DNS server

The list blocks the *websites* of VPN and proxy services and the hostnames of public encrypted-DNS
resolvers, so a browser or app that tries to switch DNS providers fails. It cannot stop a child from
changing the device's own DNS setting, so:

- **iPhone / iPad / Mac**: install the AdGuard DNS configuration profile from the dashboard, then in
  Screen Time turn on *Content & Privacy Restrictions → Web Content → Limit Adult Websites* and disable
  *Account Changes* and *Installing Apps*. A profile can still be removed by hand on an unsupervised
  device, so check it occasionally or supervise the device with Apple Configurator.
- **Android**: set *Private DNS* to your server's `....d.adguard-dns.com` hostname and use Google
  Family Link (SafeSearch lock, app-install approval). Family Link does not lock the Private DNS setting.
- **Windows**: give the child a standard (non-administrator) account; use Microsoft Family Safety for
  SafeSearch enforcement and to allow only Edge (so the AdGuard extension or app cannot be sidestepped
  by installing another browser).
- **Router**: point the router's DNS at your AdGuard DNS server and, if the router supports it, block
  outbound ports 53 and 853 to any other address.

### 3. Search-term blocking on the device (the part you originally asked for)

Install one of these and import `adguard-app-search-rules.txt` (or the compact file):

- **AdGuard for Windows / Mac / Android**: *Settings → Network → HTTPS filtering* must be ON, otherwise
  the app cannot see `google.com/search?q=...`. Then *Filters → User rules → Import* (or add the file as
  a custom filter so you can update it from a URL).
- **AdGuard Browser Extension** (free; Chrome, Firefox, Edge): *Settings → User rules → Import*. No HTTPS
  filtering needed because it runs inside the browser. Use the compact file on Chrome. A child can
  remove an extension unless the browser is managed, so pair it with a standard user account or force-install
  the extension through Chrome/Edge policy. Both rule files were verified against AdGuard's own filtering
  engine (`@adguard/tsurlfilter`, the library inside the browser extension) with the test URLs in
  `tests/`.
- **iOS**: AdGuard for iOS applies user rules only inside Safari and does not support every rule type
  used here. Rely on the DNS list plus Screen Time's *Limit Adult Websites* there.

Keyword rules work in **browsers**. The YouTube, TikTok, Reddit and Roblox *apps* talk to their own
servers and never expose a search URL; use each app's restricted mode, block the app, or block the
service at DNS instead.

## How the search rules work

Every keyword in `sources/keywords/*.txt` becomes rules like:

```
||google.*/search?*q=*lesbian*$document
||youtube.com/results?*search_query=*lesbian*$document
||tiktok.com/tag/*lesbian*$document
```

- Matching is **case-insensitive** and works on any part of the query, so `lesbian` also catches
  `lesbians`, `lesbianism`, `lesbian+flag`. Spaces and hyphens become wildcards, so `bi sexual`,
  `bi-sexual` and `bisexual` are one pattern.
- Google auto-corrects misspellings but keeps the misspelled text in the URL, which is why the lists
  carry misspellings, transpositions, leetspeak (`l3sbian`, `p0rn`), spaced-out spellings and algospeak
  (`seggs`, `le dollar bean`, `leg booty`).
- Short words that live inside innocent words are marked `[word]` and generated as whole-word
  regular expressions: `gay` blocks *is he gay* but not *Gaylord*; `demon` blocks *demon summoning* but not
  *demonstration*; `anal` does not block *analysis*; `vore` does not block *carnivore*.
- Terms with heavy collateral are marked `[optional]` and shipped disabled, for example `asexual`
  (blocks *asexual reproduction*), `witchcraft` (blocks *Hogwarts School of Witchcraft and Wizardry*),
  `devil` (*Tasmanian devil*, *devil fruit*), `corn` (algospeak for porn, but also a vegetable).
- Some intended blocks have side effects you should know about: `demon` blocks *Demon Slayer*, `furry`
  blocks *furry friends*, `trans` as a whole word blocks *trans fat*. `paimon` is deliberately absent
  because it is the Genshin Impact mascot. Add exceptions in `sources/allow.txt` (see below).

### Allowing a search that got caught

Add the phrase to `sources/allow.txt` and re-run `python3 generate.py`, or paste an exception
directly into AdGuard's user rules:

```
@@||google.*/search?*q=*demon*slayer*$document
@@||youtube.com/results?*search_query=*demon*slayer*$document
```

To allow a whole site again in AdGuard DNS: `@@||example.com^`.

## Editing the lists

- `sources/domains/*.txt`: one domain per line, `?` prefix = optional, `#` starts a note.
- `sources/keywords/*.txt`: `term [word, optional]: variant, variant  # note`.
- `sources/allow.txt`: searches to exempt.
- Run `python3 generate.py` (Python 3.9+, no dependencies) to rebuild the output files; it prints counts per category
  and drops any pattern another pattern already covers.

## What is deliberately not in the lists

- **Crisis and support lines** (The Trevor Project, Trans Lifeline, 988, Crisis Text Line, Childhelp and
  similar) are excluded on purpose, including from the parent-requested LGBTQ+ category. A child in
  trouble must be able to reach one.
- **General health, education and reference sites**, and shared infrastructure (Google, Apple, Microsoft,
  Cloudflare, GitHub, Wikipedia, Fandom root). Individual Fandom wikis for adult-oriented shows are listed.
- The parent's own AdGuard endpoints (`d.adguard-dns.com`, `adguard.com`).

## A note on the LGBTQ+ category

The LGBTQ+ terms in this list are identity words rather than sexual content, and children who search
them are often trying to understand a classmate, a show, or themselves. Blocking them is your decision
as their parent and the lists implement it as requested; the community and advocacy sites are grouped in
their own files (`sources/domains/70-lgbtq-sexuality-sites.txt`, `sources/keywords/20-sexuality-lgbtq.txt`)
so the category is easy to review, trim, or remove as a unit.

## Publishing

This folder is listed in the repository's `.assetsignore`, so Cloudflare Workers does **not** serve it
from the public website. Because the GitHub repository is public, the raw files can still be used as
subscribe-by-URL filter lists in the AdGuard apps once this branch is merged, for example:

```
https://raw.githubusercontent.com/Jordantelder/my-website/main/adguard-parental-blocklist/adguard-app-search-rules.txt
```

Delete the `.assetsignore` line if you would rather serve the files from the site itself.
