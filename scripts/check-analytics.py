#!/usr/bin/env python3
"""
check-analytics.py — enforce Vercel Web Analytics + Speed Insights on every HTML page.

Scans all *.html files in the repo and fails (exit 1) if any page is missing
the analytics snippet. Run locally before pushing, and automatically in CI
(.github/workflows/analytics-check.yml).

Usage:
    python3 scripts/check-analytics.py            # check only (CI mode)
    python3 scripts/check-analytics.py --fix      # inject the snippet into missing pages
    python3 scripts/check-analytics.py --verbose  # list every page checked
"""
import argparse
import pathlib
import sys

# The exact marker that must exist in every page's <head>
ANALYTICS_MARKER = "/_vercel/insights/script.js"
SPEED_MARKER = "/_vercel/speed-insights/script.js"

# Snippet injected by --fix (kept in sync with the live pages)
SNIPPET = """<head>
<!-- Vercel Web Analytics -->
<script>
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
<!-- Vercel Speed Insights -->
<script defer src="/_vercel/speed-insights/script.js"></script>
"""

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {".git", "node_modules", ".vercel", "dist", "build"}


def html_files():
    for path in sorted(ROOT.rglob("*.html")):
        if any(part in EXCLUDE_DIRS for part in path.relative_to(ROOT).parts):
            continue
        yield path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true", help="inject snippet into missing pages")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    pages = list(html_files())
    if not pages:
        print("No HTML pages found — nothing to check.")
        return 0

    missing = []
    for page in pages:
        html = page.read_text(encoding="utf-8")
        has_analytics = ANALYTICS_MARKER in html
        has_speed = SPEED_MARKER in html
        ok = has_analytics and has_speed
        if args.verbose:
            status = "OK " if ok else "MISSING"
            print(f"[{status}] {page.relative_to(ROOT)}"
                  + ("" if ok else f" (analytics={has_analytics}, speed={has_speed})"))
        if not ok:
            missing.append((page, has_analytics, has_speed))

    if missing:
        print(f"\n❌ {len(missing)} page(s) missing analytics snippet:")
        for page, has_a, has_s in missing:
            print(f"   - {page.relative_to(ROOT)}  (web-analytics={has_a}, speed-insights={has_s})")

        if args.fix:
            print("\n🔧 Injecting snippet into missing pages...")
            for page, _, _ in missing:
                html = page.read_text(encoding="utf-8")
                if "<head>" in html:
                    html = html.replace("<head>", SNIPPET, 1)
                    page.write_text(html, encoding="utf-8")
                    print(f"   ✓ fixed {page.relative_to(ROOT)}")
                else:
                    print(f"   ✗ cannot fix {page.relative_to(ROOT)} (no <head> tag)")
            print("\nRe-run without --fix to confirm all pages pass.")
            return 0

        print("\nEvery page on futurereadyus.com MUST include BOTH snippets in <head>:")
        print(SNIPPET)
        return 1

    print(f"✅ All {len(pages)} HTML page(s) have Web Analytics + Speed Insights.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
