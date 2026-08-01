# Analytics Snippet — REQUIRED on every page

Every HTML page on futurereadyus.com **must** include BOTH of these in its `<head>`:

```html
<!-- Vercel Web Analytics -->
<script>
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
<!-- Vercel Speed Insights -->
<script defer src="/_vercel/speed-insights/script.js"></script>
```

## How this is enforced

- `scripts/check-analytics.py` scans all `*.html` files and fails if any page is missing the snippet.
- `.github/workflows/analytics-check.yml` runs it on every push/PR to `master` — **a page without analytics will block deployment.**

## When you add a new page

1. Copy the snippet above into the new page's `<head>` (right after `<head>`).
2. Run `python3 scripts/check-analytics.py` locally to confirm it passes.
3. Push — CI will verify again automatically.

## Auto-fix

Forgot one? Run:

```bash
python3 scripts/check-analytics.py --fix
```

It injects the snippet into any page missing it (adds the `<head>` marker if absent).

## Conversion events

The contact form fires a custom `lead_submit` event on successful submission:

```js
window.va('event', { name: 'lead_submit', data: { page: location.pathname, source: 'contact-form' } });
```

Use the same pattern for any new conversion (CTA clicks, deep-links, etc.).
