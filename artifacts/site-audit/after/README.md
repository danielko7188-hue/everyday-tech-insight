# Publication maturity after-state evidence

This directory is the template for evidence captured only after the publication-maturity release is deployed and separately verified. The live production site is still the older release at the time this template was added, so no `production/` screenshots have been captured or populated here.

## Capture command

From the repository root, after confirming that the explicit origin serves the intended deployed commit:

```text
npm run capture:production -- --origin https://production.example
```

The command accepts only a canonical HTTPS origin with no credentials, path, query, or fragment. It validates expected 200/404 status codes, rejects redirects and runtime/cross-origin errors, and writes exactly 48 PNGs to `production/` using 390, 768, and 1440 CSS-pixel widths, a fixed 900px height, DPR 1, and both above-fold and full-page captures.

| Alias                 | Route                                                          |
| --------------------- | -------------------------------------------------------------- |
| `home`                | `/`                                                            |
| `category`            | `/categories/cybersecurity-data-protection/`                   |
| `article`             | `/articles/back-up-business-files-with-the-3-2-1-method/`      |
| `toolkit`             | `/toolkit/`                                                    |
| `about`               | `/about/`                                                      |
| `editorial-standards` | `/editorial-standards/`                                        |
| `contact`             | `/contact/`                                                    |
| `404`                 | an intentional nonexistent route returning the custom 404 page |

Filenames follow `<width>-<alias>-<above-fold|full>.png`.

## Deployment record

- Production origin: pending
- Deployed commit: pending
- Capture date and timezone: pending
- Production smoke result: pending
- Visual comparison/review: pending

Local Playwright baselines under `tests/e2e/__screenshots__/` are implementation regression evidence. They are not production capture evidence and must not be copied here or used to claim deployment parity.

Nothing in this directory establishes an AdSense decision, Blogger change, advertising/tracking activation, or Google approval.
