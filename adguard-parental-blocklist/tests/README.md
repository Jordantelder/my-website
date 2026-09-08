# Rule tests

These scripts load the generated files into AdGuard's own filtering engine
(`@adguard/tsurlfilter`, the library inside the AdGuard Browser Extension) so you can
confirm a rule blocks or allows a given URL before rolling it out to a child's device.

```
cd tests
npm install @adguard/tsurlfilter        # once
node engine-test.mjs ../adguard-app-search-rules.txt urls.json
node engine-test.mjs ../adguard-app-search-rules-compact.txt urls.json
node dns-test.mjs ../adguard-dns-user-rules.txt
node dns-test.mjs ../adguard-dns-user-rules-strict.txt  reddit.com  www.pixiv.net   # probe specific hosts
```

`urls.json` is a list of `[url, "block" | "pass"]` pairs. Add your own cases, for example a search your
child was wrongly blocked on, and re-run after editing `sources/` and `python3 generate.py`.

The AdGuard desktop and Android apps use a different engine (CoreLibs) with the same rule syntax; the
browser-extension engine is the closest thing that can be run from the command line.
