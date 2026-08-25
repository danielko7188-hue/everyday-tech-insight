# Historical publication-maturity after-state evidence

This readme describes only the legacy `production/` inventory captured on
2026-08-23. It is historical evidence for that publication-maturity release,
not the contract or status record for the versioned Purple Signal directories.
The `production/` directory contains the exact 48-image inventory produced from
the canonical live origin after that release reached Vercel `READY` state and
passed its independent production smoke gate. See the parent evidence index for
the current 97-image protocol.

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

- Production origin: `https://everyday-tech-insight.vercel.app`
- GitHub release commit: `f626fcf2ccc76f9f40c2c717dc2b16fa72f4ee27`
- Vercel deployment: `dpl_4h7us2N5TFFtP6xz8763ZLn7TzvK` (`READY`, production alias confirmed)
- Capture window: 2026-08-23 08:00:41-08:01:08, America/Los_Angeles
- Production smoke result: pass for 42 expected routes and 30 exact root-relative assets, including crawler files, disabled-monetization boundaries, and decoded social-image dimensions
- Screenshot inventory: 48 PNGs, 48 unique SHA-256 hashes; see `SHA256SUMS.txt`
- Visual review: representative full-page home, article, category, Toolkit, About, Contact, Editorial standards, and 404 captures were inspected across 390, 768, and 1440-pixel evidence. No actionable clipping, overlap, missing deferred content, or broken layout was observed.

## Evidence boundary

The captures prove the rendered production state at the recorded origin and time. They do not prove that every browser or assistive-technology combination is defect-free, that every editorial statement has received specialist review, or that Google will approve an AdSense application. The current production origin is the verified Vercel subdomain; no unverified custom domain, private contact identity, advertising code, analytics, tracking, or consent platform was added.

Local Playwright baselines under `tests/e2e/__screenshots__/` are implementation regression evidence. They are not production capture evidence and must not be copied here or used to claim deployment parity.

Nothing in this directory establishes an AdSense decision, Blogger change, advertising/tracking activation, or Google approval.
