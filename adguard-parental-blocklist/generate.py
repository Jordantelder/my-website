#!/usr/bin/env python3
"""
Build AdGuard-ready parental-control filter files from the editable lists in ./sources.

Outputs (written next to this script):
  adguard-dns-user-rules.txt          domain rules for AdGuard DNS "User rules" (optional entries commented out)
  adguard-dns-user-rules-strict.txt   same, with the optional entries enabled too
  DOMAINS.md                          human-readable table of every domain with its category and note
  adguard-app-search-rules.txt        URL-pattern rules for the AdGuard app / browser extension user filter
                                      (blocks searches on Google, Bing, YouTube, TikTok, Pinterest, Reddit, ... by keyword)
  adguard-app-search-rules-compact.txt  same coverage as a handful of regex rules (for tools with rule limits)
  search-keywords.txt                 plain keyword list, one per line, for any other tool with keyword blocking

Usage:  python3 generate.py            (re-run after editing anything in ./sources)
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "sources"
TODAY = date.today().isoformat()

# --------------------------------------------------------------------------------------
# Search engines / sites whose URL carries the search term.
#   wild : AdGuard wildcard templates, {T} is replaced by the glob form of the term
#   re   : regex prefix (RE2/PCRE/JS safe, no commas, no "$") that ends right before the term
#   kind : "param" (term is a ?q=... value) or "path" (term is part of the path, e.g. /hashtag/term)
# --------------------------------------------------------------------------------------
ENGINES = [
    # core web search
    dict(name="Google (web, images, video, news, shopping)", group="core", kind="param",
         wild=["||google.*/search?*q=*{T}*"], re=[r"google\.[a-z.]+\/search\?[^#]*q=[^&]*"]),
    dict(name="Bing (web, images, videos)", group="core", kind="param",
         wild=["||bing.com/*search?*q=*{T}*"], re=[r"bing\.com\/[a-z\/]*search\?[^#]*q=[^&]*"]),
    dict(name="DuckDuckGo", group="core", kind="param",
         wild=["||duckduckgo.com/*q=*{T}*"], re=[r"duckduckgo\.com\/[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Yahoo (web, images, video)", group="core", kind="param",
         wild=["||search.yahoo.com/*p=*{T}*"], re=[r"search\.yahoo\.com\/[^?#]*\?[^#]*p=[^&]*"]),
    dict(name="Yandex", group="core", kind="param",
         wild=["||yandex.*/*text=*{T}*"], re=[r"yandex\.[a-z.]+\/[^?#]*\?[^#]*text=[^&]*"]),
    dict(name="Brave Search", group="core", kind="param",
         wild=["||search.brave.com/*q=*{T}*"], re=[r"search\.brave\.com\/[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Ecosia", group="core", kind="param",
         wild=["||ecosia.org/*q=*{T}*"], re=[r"ecosia\.org\/[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Qwant", group="core", kind="param",
         wild=["||qwant.com/*q=*{T}*"], re=[r"qwant\.com\/[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Startpage (GET form)", group="core", kind="param",
         wild=["||startpage.com/*query=*{T}*"], re=[r"startpage\.com\/[^?#]*\?[^#]*query=[^&]*"]),
    dict(name="Ask.com / AOL", group="core", kind="param",
         wild=["||ask.com/*q=*{T}*", "||search.aol.com/*q=*{T}*"],
         re=[r"ask\.com\/[^?#]*\?[^#]*q=[^&]*", r"search\.aol\.com\/[^?#]*\?[^#]*q=[^&]*"]),
    # video / social
    dict(name="YouTube search", group="social", kind="param",
         wild=["||youtube.com/results?*search_query=*{T}*"], re=[r"youtube\.com\/results\?[^#]*search_query=[^&]*"]),
    dict(name="YouTube hashtag pages", group="social", kind="path",
         wild=["||youtube.com/hashtag/*{T}*"], re=[r"youtube\.com\/hashtag\/[^?#]*"]),
    dict(name="TikTok search", group="social", kind="param",
         wild=["||tiktok.com/search*q=*{T}*"], re=[r"tiktok\.com\/search[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="TikTok tag pages", group="social", kind="path",
         wild=["||tiktok.com/tag/*{T}*"], re=[r"tiktok\.com\/tag\/[^?#]*"]),
    dict(name="Pinterest search", group="social", kind="param",
         wild=["||pinterest.*/search/*q=*{T}*"], re=[r"pinterest\.[a-z.]+\/search\/[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Reddit search", group="social", kind="param",
         wild=["||reddit.com/search*q=*{T}*"], re=[r"reddit\.com\/search[^?#]*\?[^#]*q=[^&]*"]),
    dict(name="Reddit subreddit and post URLs", group="social", kind="path",
         wild=["||reddit.com/r/*{T}*"], re=[r"reddit\.com\/r\/[^?#]*"]),
    dict(name="X / Twitter search", group="social", kind="param",
         wild=["||x.com/search?*q=*{T}*", "||twitter.com/search?*q=*{T}*"],
         re=[r"x\.com\/search\?[^#]*q=[^&]*", r"twitter\.com\/search\?[^#]*q=[^&]*"]),
    dict(name="X / Twitter hashtag pages", group="social", kind="path",
         wild=["||x.com/hashtag/*{T}*", "||twitter.com/hashtag/*{T}*"],
         re=[r"x\.com\/hashtag\/[^?#]*", r"twitter\.com\/hashtag\/[^?#]*"]),
    dict(name="Tumblr search and tag pages", group="social", kind="path",
         wild=["||tumblr.com/search/*{T}*", "||tumblr.com/tagged/*{T}*"],
         re=[r"tumblr\.com\/search\/[^?#]*", r"tumblr\.com\/tagged\/[^?#]*"]),
    dict(name="DeviantArt search and tag pages", group="social", kind="param",
         wild=["||deviantart.com/search*q=*{T}*", "||deviantart.com/tag/*{T}*"],
         re=[r"deviantart\.com\/search[^?#]*\?[^#]*q=[^&]*", r"deviantart\.com\/tag\/[^?#]*"]),
    dict(name="Wattpad search and story URLs", group="social", kind="path",
         wild=["||wattpad.com/search/*{T}*", "||wattpad.com/stories/*{T}*"],
         re=[r"wattpad\.com\/(?:search|stories)\/[^?#]*"]),
    dict(name="Archive of Our Own (any URL containing the term)", group="social", kind="path",
         wild=["||archiveofourown.org/*{T}*"], re=[r"archiveofourown\.org\/[^#]*"]),
    dict(name="Giphy / Tenor GIF search", group="social", kind="path",
         wild=["||giphy.com/search/*{T}*", "||tenor.com/search/*{T}*"],
         re=[r"giphy\.com\/search\/[^?#]*", r"tenor\.com\/search\/[^?#]*"]),
    # AI assistants that accept a query in the URL
    dict(name="ChatGPT / Copilot / Perplexity / You.com", group="ai", kind="param",
         wild=["||chatgpt.com/*q=*{T}*", "||copilot.microsoft.com/*q=*{T}*",
               "||perplexity.ai/search*q=*{T}*", "||you.com/search?*q=*{T}*"],
         re=[r"chatgpt\.com\/[^?#]*\?[^#]*q=[^&]*", r"copilot\.microsoft\.com\/[^?#]*\?[^#]*q=[^&]*",
             r"perplexity\.ai\/search[^?#]*\?[^#]*q=[^&]*", r"you\.com\/search\?[^#]*q=[^&]*"]),
    # stores and shopping
    dict(name="Amazon search", group="shopping", kind="param",
         wild=["||amazon.*/s?*k=*{T}*", "||amazon.*/s?*field-keywords=*{T}*"],
         re=[r"amazon\.[a-z.]+\/s\?[^#]*(?:k|field-keywords)=[^&]*"]),
    dict(name="Etsy / eBay search", group="shopping", kind="param",
         wild=["||etsy.com/search?*q=*{T}*", "||ebay.*/sch/*_nkw=*{T}*"],
         re=[r"etsy\.com\/search\?[^#]*q=[^&]*", r"ebay\.[a-z.]+\/sch\/[^?#]*\?[^#]*_nkw=[^&]*"]),
    dict(name="Roblox search / discover / catalog", group="shopping", kind="param",
         wild=["||roblox.com/*keyword=*{T}*", "||roblox.com/search/*{T}*"],
         re=[r"roblox\.com\/[^?#]*\?[^#]*keyword=[^&]*", r"roblox\.com\/search\/[^?#]*"]),
    dict(name="Steam / itch.io / Google Play search", group="shopping", kind="param",
         wild=["||store.steampowered.com/search/*term=*{T}*", "||itch.io/search?*q=*{T}*",
               "||play.google.com/store/search?*q=*{T}*"],
         re=[r"store\.steampowered\.com\/search\/[^?#]*\?[^#]*term=[^&]*", r"itch\.io\/search\?[^#]*q=[^&]*",
             r"play\.google\.com\/store\/search\?[^#]*q=[^&]*"]),
    # reference (optional group: blocks encyclopedia articles whose title contains a term)
    dict(name="Wikipedia articles and search", group="reference", kind="path",
         wild=["||wikipedia.org/wiki/*{T}*", "||wikipedia.org/w/index.php?*search=*{T}*"],
         re=[r"wikipedia\.org\/wiki\/[^?#]*", r"wikipedia\.org\/w\/index\.php\?[^#]*search=[^&]*"]),
    dict(name="Fandom wiki pages", group="reference", kind="path",
         wild=["||fandom.com/wiki/*{T}*"], re=[r"fandom\.com\/wiki\/[^?#]*"]),
]

# --------------------------------------------------------------------------------------
# Source parsing
# --------------------------------------------------------------------------------------
KW_LINE = re.compile(r"^(?P<term>[^\[:]+?)\s*(?:\[(?P<flags>[^\]]*)\])?\s*(?::\s*(?P<variants>.*))?$")


def strip_comment(line: str) -> tuple[str, str]:
    """Split 'text  # note' into (text, note). '#' inside a term never occurs in our data."""
    if "#" in line:
        text, note = line.split("#", 1)
        return text.strip(), note.strip()
    return line.strip(), ""


def read_domain_file(path: Path) -> list[dict]:
    entries = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        text, note = strip_comment(raw)
        if not text:
            continue
        optional = text.startswith("?")
        text = text.lstrip("? ").strip().lower()
        text = re.sub(r"^https?://", "", text).lstrip("|").rstrip("^/").removeprefix("*.")
        if text.startswith("www.") and text.count(".") > 1:
            text = text[4:]
        if not re.fullmatch(r"[a-z0-9.-]+\.[a-z0-9-]{2,}", text):
            print(f"  ! skipping invalid domain line in {path.name}: {raw.strip()}", file=sys.stderr)
            continue
        entries.append(dict(domain=text, note=note, optional=optional))
    return entries


def read_keyword_file(path: Path) -> list[dict]:
    entries = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        text, note = strip_comment(raw)
        if not text:
            continue
        m = KW_LINE.match(text)
        if not m:
            print(f"  ! skipping unparsable keyword line in {path.name}: {raw.strip()}", file=sys.stderr)
            continue
        flags = {f.strip().lower() for f in (m.group("flags") or "").split(",") if f.strip()}
        unknown = flags - {"word", "optional"}
        if unknown:
            print(f"  ! unknown flag(s) {sorted(unknown)} in {path.name}: {raw.strip()}", file=sys.stderr)
        term = m.group("term").strip().lower()
        variants = [v.strip().lower() for v in (m.group("variants") or "").split(",") if v.strip()]
        entries.append(dict(term=term, variants=variants, word="word" in flags,
                            optional="optional" in flags, note=note))
    return entries


def category_title(path: Path) -> tuple[str, str]:
    """First line of the file, if it is a '# Title' comment, is the human-readable category name."""
    first = path.read_text(encoding="utf-8").splitlines()[0] if path.stat().st_size else ""
    title = first.lstrip("# ").strip() if first.startswith("#") else path.stem
    return path.stem, title


# --------------------------------------------------------------------------------------
# Term -> pattern conversion
#
# Three kinds of pattern are generated:
#   sub    single-word substring: AdGuard wildcard rules  ||site/search?*q=*TERM*   (fast, readable)
#   phrase multi-word term: regex, words may only be separated by spaces/hyphens/etc. and the phrase
#          must start at a word boundary ("step sis" matches stepsis / step-sis / step+sis, not "footstep sister")
#   word   [word]-flagged term: regex with a word boundary on both sides ("gay" but not "Gaylord")
# --------------------------------------------------------------------------------------
SEP = r"(?:%20|[^a-z0-9])*"      # what may appear between the words of a phrase in a URL
LB = r"(?:\b|_)"                 # word boundary that also treats '_' as a boundary (URL slugs)


def tokens(term: str) -> list[str]:
    """'bi-sexual' -> ['bi', 'sexual'];  '18+' -> ['18%2b'] (a literal plus is sent as %2b)."""
    return [w for w in re.split(r"[^a-z0-9%]+", term.replace("+", "%2b")) if w]


def url_form(term: str) -> str:
    """Browsers percent-encode non-ASCII letters in URLs, so 'séance' must be matched as 's%c3%a9ance'."""
    if any(ord(c) > 127 for c in term):
        return quote(term, safe=" +'/").lower()
    return term


def regex_inner(toks: list[str]) -> str:
    return SEP.join(re.escape(w).replace("\\%", "%") for w in toks)


def regex_group(items: list[dict], lead: bool, trail: bool) -> str:
    """One alternation covering all items.

    The never-matching first alternative [^\s\S] is deliberate: AdGuard's engines pre-filter regex
    rules by the longest literal they can extract from the *first* alternative, and a literal such as
    "bi" would make the rule fire only on URLs containing "bi". Starting with a character class
    leaves no literal to extract, so the rule is evaluated by the regex alone."""
    alt = "(?:[^\\s\\S]|" + "|".join(regex_inner(c["toks"]) for c in items) + ")"
    return (LB if lead else "") + alt + (LB if trail else "")


def kind_of(toks: list[str], word: bool) -> str:
    if word:
        return "word"
    return "phrase" if len(toks) > 1 else "sub"


def is_covered(c: dict, pool: list[dict]) -> bool:
    """True if some already-kept pattern in pool blocks everything c would block."""
    for k in pool:
        if k is c:
            continue
        if k["kind"] == "sub":
            if k["glob"] in c["glob"]:                      # substring of a substring / of a phrase
                return True
        elif k["kind"] == "word":
            if len(k["toks"]) == 1 and k["toks"][0] in c["toks"] and (c["kind"] != "sub" or c["toks"] == k["toks"]):
                return True                                 # whole word 'gay' already blocks 'gay porn'
            if c["kind"] == "word" and c["toks"] == k["toks"]:
                return True
        elif k["kind"] == "phrase":
            if c["kind"] in ("phrase", "word") and c["toks"][: len(k["toks"])] == k["toks"] and c["toks"] != k["toks"]:
                return True                                 # phrase prefix: 'furry art' covers 'furry art style'
            if c["kind"] == "phrase" and c["toks"] == k["toks"]:
                return True
    return False


def prune_terms(categories: list[tuple[str, list[dict]]]) -> list[dict]:
    """Flatten all categories into unique patterns, dropping anything another kept pattern already
    covers. Default (enabled) patterns are pruned only by other default patterns; optional ones by both."""
    cands = []
    for title, entries in categories:
        for e in entries:
            for form in dict.fromkeys(url_form(t) for t in [e["term"], *e["variants"]]):
                toks = tokens(form)
                if not toks:
                    continue
                cands.append(dict(category=title, form=form, toks=toks, glob="*".join(toks),
                                  kind=kind_of(toks, e["word"]), optional=e["optional"]))
    kind_rank = {"sub": 0, "word": 1, "phrase": 2}
    def sort_key(c):
        return (c["optional"], kind_rank[c["kind"]], len(c["toks"]), len(c["glob"]), c["glob"])
    kept: list[dict] = []
    for c in sorted(cands, key=sort_key):
        if not is_covered(c, kept):
            kept.append(c)
    order = {title: i for i, (title, _) in enumerate(categories)}
    return sorted(kept, key=lambda c: (order[c["category"]], c["optional"], kind_rank[c["kind"]], c["form"]))


# --------------------------------------------------------------------------------------
# Builders
# --------------------------------------------------------------------------------------
def build_dns(domain_files: list[Path]) -> tuple[str, str, str, dict]:
    """Returns (default rules, strict rules, markdown reference table, stats).
    Rule lines carry no inline comments: AdGuard treats '!' as a comment only at the start of a line."""
    stats = {}
    default_lines = [
        "! AdGuard DNS - parental control user rules",
        f"! Generated {TODAY} by generate.py from ./sources/domains/*.txt",
        "! Paste into AdGuard DNS > (your server) > User rules.  Lines starting with '!' are comments.",
        "! Entries marked 'optional' are commented out here: remove the leading '! optional: ' to enable one,",
        "! or use adguard-dns-user-rules-strict.txt which has all of them enabled.",
        "! What each domain is: see DOMAINS.md next to this file.",
        "! To allow a site again, add an exception:   @@||example.com^",
        "",
    ]
    strict_lines = [
        "! AdGuard DNS - parental control user rules (STRICT: optional entries enabled)",
        f"! Generated {TODAY} by generate.py from ./sources/domains/*.txt",
        "! What each domain is: see DOMAINS.md next to this file.",
        "! To allow a site again, add an exception:   @@||example.com^",
        "",
    ]
    md = [f"# Domain reference", "",
          f"Generated {TODAY} from `sources/domains/*.txt`. *Optional* entries are commented out in",
          "`adguard-dns-user-rules.txt` and enabled in `adguard-dns-user-rules-strict.txt`.", ""]
    seen = set()
    for path in domain_files:
        key, title = category_title(path)
        entries = [e for e in read_domain_file(path) if not (e["domain"] in seen or seen.add(e["domain"]))]
        if not entries:
            continue
        n_default = sum(1 for e in entries if not e["optional"])
        stats[title] = (n_default, len(entries) - n_default)
        header = [f"! ==== {title} ({n_default} rules, {len(entries) - n_default} optional) ====", ""]
        default_lines += header
        strict_lines += header
        md += [f"## {title}", "", "| Domain | Optional | Note |", "|---|---|---|"]
        for e in sorted(entries, key=lambda e: (e["optional"], e["domain"])):
            rule = f"||{e['domain']}^"
            strict_lines.append(rule)
            default_lines.append(f"! optional: {rule}" if e["optional"] else rule)
            md.append(f"| `{e['domain']}` | {'yes' if e['optional'] else ''} | {e['note'].replace('|', '/')} |")
        default_lines.append("")
        strict_lines.append("")
        md.append("")
    return ("\n".join(default_lines).rstrip() + "\n", "\n".join(strict_lines).rstrip() + "\n",
            "\n".join(md).rstrip() + "\n", stats)


def build_app_rules(keyword_files: list[Path], allow_terms: list[str]) -> tuple[str, str, str, dict]:
    categories = []
    for path in keyword_files:
        _, title = category_title(path)
        entries = read_keyword_file(path)
        if entries:
            categories.append((title, entries))
    kept = prune_terms(categories)

    param_re_prefix = r"^https?:\/\/[^\/]*(?:" + "|".join(p for e in ENGINES if e["kind"] == "param" for p in e["re"]) + r")"
    path_re_prefix = r"^https?:\/\/[^\/]*(?:" + "|".join(p for e in ENGINES if e["kind"] == "path" for p in e["re"]) + r")"

    header_common = [
        f"! Generated {TODAY} by generate.py from ./sources/keywords/*.txt",
        "! Import into: AdGuard for Windows / Mac / Android > Filters > User rules, or add the file as a custom filter.",
        "! The AdGuard apps need HTTPS filtering enabled for these to see search URLs (browser extension: not needed).",
        "! Each rule blocks the results page ($document) when the search query contains the term.",
        "! Rules starting with '/' are regular expressions: multi-word phrases and whole-word terms are grouped per category.",
        "! Lines starting with '! optional:' are disabled; remove the '! optional: ' prefix to enable one.",
        "! To allow a specific search again, add it to sources/allow.txt or paste an exception, for example:",
        "!   @@||google.*/search?*q=*demon*slayer*$document",
        "!   @@||youtube.com/results?*search_query=*demon*slayer*$document",
        "",
    ]
    full = ["! AdGuard app - search-term blocking rules (FULL: one readable rule per site for each single-word term)"] + header_common
    compact = ["! AdGuard app - search-term blocking rules (COMPACT: a few regex rules per category; same coverage, far fewer rules)",
               "! Use this version for the AdGuard Browser Extension on Chrome (Manifest V3 rule limits) or if the full file is too big."] + header_common
    plain = ["# Parental-control search keywords, one per line.",
             f"# Generated {TODAY}.  [word] = match as a whole word;  [phrase] = words in this order, only spaces/hyphens between them.", ""]

    stats, total_full, total_compact = {}, 0, 0
    for title, _ in categories:
        items = [c for c in kept if c["category"] == title]
        if not items:
            continue
        full += [f"! ==== {title} ====", ""]
        compact += [f"! ==== {title} ====", ""]
        plain += [f"# ==== {title} ====", ""]
        for c in items:
            tag = {"word": "  [word]", "phrase": "  [phrase]", "sub": ""}[c["kind"]]
            plain.append(("# optional: " if c["optional"] else "") + c["form"] + tag)
        plain.append("")
        n_full = n_compact = 0
        # FULL: wildcard rules for single-word substrings
        for c in items:
            if c["kind"] != "sub":
                continue
            prefix = "! optional: " if c["optional"] else ""
            full.append(f"! -- {c['form']}")
            for eng in ENGINES:
                for tpl in eng["wild"]:
                    full.append(prefix + tpl.replace("{T}", c["glob"]) + "$document")
                    n_full += 1
        # regex groups (FULL: word + phrase; COMPACT: word + phrase + sub)
        groups = [
            ("whole-word terms", "word", False, True, True),
            ("whole-word terms (optional)", "word", True, True, True),
            ("phrases", "phrase", False, True, False),
            ("phrases (optional)", "phrase", True, True, False),
        ]
        compact_groups = groups + [
            ("single-word terms", "sub", False, False, False),
            ("single-word terms (optional)", "sub", True, False, False),
        ]
        for target, group_list in ((full, groups), (compact, compact_groups)):
            for label, kind, optional, lead, trail in group_list:
                sel = [c for c in items if c["kind"] == kind and c["optional"] == optional]
                if not sel:
                    continue
                prefix = "! optional: " if optional else ""
                rx = regex_group(sel, lead, trail)
                target += [f"! -- {label}: {', '.join(c['form'] for c in sel)}",
                           f"{prefix}/{param_re_prefix}{rx}/$document",
                           f"{prefix}/{path_re_prefix}{rx}/$document"]
                if target is full:
                    n_full += 2
                else:
                    n_compact += 2
        full.append("")
        compact.append("")
        stats[title] = (len(items), n_full, n_compact)
        total_full += n_full
        total_compact += n_compact

    if allow_terms:
        block = ["! ==== Allowed searches (exceptions from sources/allow.txt) ====", ""]
        for t in allow_terms:
            g = "*".join(tokens(url_form(t)))
            block.append(f"! -- allow: {t}")
            for eng in ENGINES:
                for tpl in eng["wild"]:
                    block.append("@@" + tpl.replace("{T}", g) + "$document")
        block.append("")
        full += block
        compact += block
    stats["__total__"] = (len(kept), total_full, total_compact)
    return ("\n".join(full).rstrip() + "\n", "\n".join(compact).rstrip() + "\n",
            "\n".join(plain).rstrip() + "\n", stats)


def read_allow(path: Path) -> list[str]:
    if not path.exists():
        return []
    out = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        text, _ = strip_comment(raw)
        if text:
            out.append(text.lower())
    return out


def main() -> None:
    domain_files = sorted((SRC / "domains").glob("*.txt"))
    keyword_files = sorted((SRC / "keywords").glob("*.txt"))
    if not domain_files or not keyword_files:
        sys.exit("no source files found under ./sources/domains and ./sources/keywords")

    dns_default, dns_strict, dns_md, dns_stats = build_dns(domain_files)
    (ROOT / "adguard-dns-user-rules.txt").write_text(dns_default, encoding="utf-8")
    (ROOT / "adguard-dns-user-rules-strict.txt").write_text(dns_strict, encoding="utf-8")
    (ROOT / "DOMAINS.md").write_text(dns_md, encoding="utf-8")

    app_full, app_compact, plain, kw_stats = build_app_rules(keyword_files, read_allow(SRC / "allow.txt"))
    (ROOT / "adguard-app-search-rules.txt").write_text(app_full, encoding="utf-8")
    (ROOT / "adguard-app-search-rules-compact.txt").write_text(app_compact, encoding="utf-8")
    (ROOT / "search-keywords.txt").write_text(plain, encoding="utf-8")

    print("DNS domain rules (default / optional):")
    for title, (d, o) in dns_stats.items():
        print(f"  {title:<48} {d:>5} / {o}")
    print(f"  {'TOTAL':<48} {sum(d for d, _ in dns_stats.values()):>5} / {sum(o for _, o in dns_stats.values())}")
    print("Search keywords (patterns / full rules / compact rules):")
    for title, v in kw_stats.items():
        if title != "__total__":
            print(f"  {title:<48} {v[0]:>5} / {v[1]:>6} / {v[2]}")
    t = kw_stats["__total__"]
    print(f"  {'TOTAL':<48} {t[0]:>5} / {t[1]:>6} / {t[2]}")


if __name__ == "__main__":
    main()
