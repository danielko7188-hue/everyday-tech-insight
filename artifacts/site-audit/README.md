# Site-audit evidence index

This directory separates historical screenshots, the Purple Signal rollback
baseline, staged after-state evidence, and final runtime verification. A local
capture never proves a deployment, and a screenshot never proves an AdSense or
other external decision.

## Purple Signal release protocol

The fixed release identifier is `purple-signal-2026-08-25`.

- `before/purple-signal-2026-08-25/` is the directly observed rollback
  baseline. Its manifest records 40 full-page captures from eight routes at
  390, 768, 1024, 1440, and 1920 CSS pixels.
- `after/purple-signal-2026-08-25/local/` is local implementation evidence. It
  requires the exact Git SHA, a canonical loopback origin, and no deployment
  ID.
- `after/purple-signal-2026-08-25/production/` is committed production evidence.
  It requires a canonical HTTPS origin, exact Git SHA, and Vercel deployment
  ID.
- `runtime-verification/purple-signal-2026-08-25-final/` is ignored local
  evidence for the final deployed commit. It has the same provenance
  requirements as the production phase and prevents a self-referential
  evidence-commit loop.

With the current published inventory, each after-state contains exactly 97
PNGs: 18 full-page routes at five widths, two keyboard-open navigation states,
and five focused skip-link states. If no article is published, the five
nullable representative article routes are omitted and the valid after-state
contains 72 PNGs rather than unsafe `/null` routes. A successful capture
atomically publishes `audit-manifest.json` with the observed origin, phase, Git
SHA, deployment ID when applicable, status assertions, file sizes, and SHA-256
hashes.

The local after-state was captured at `2026-08-25T22:35:30.143Z` from commit
`c4d2ae63637cf53f43d9971a6c55256fac681b5b`. Its 97 manifest rows contain 97
unique PNG hashes, 92 expected/actual 200 responses, 5 expected/actual 404
responses, and six passing CMS/monetization-absence assertions. Representative
390, 768, 1024, 1440, and 1920 pixel images were inspected after capture. This
is local evidence only; it does not prove the Vercel deployment.

The production after-state was captured at `2026-08-25T22:56:00.997Z` from
GitHub `main` commit `a921e08f1655aec184e386131573ceecb66b0721` on Vercel
deployment `dpl_Cqnru4yBwkQ1pmr6S971hd85EveH`. Its 97 manifest rows contain 97
unique PNG hashes, 92 expected/actual 200 responses, 5 expected/actual 404
responses, and six passing CMS/monetization-absence assertions. All 97 PNG
hashes exactly match the inspected local after-state. The ignored runtime
directory records the later direct check of the final evidence commit without
creating a self-referential commit loop.

## Historical inventories

- `before/local/` and `before/production/` are the legacy 2026-08-22 baseline:
  48 PNGs each, without the current manifest contract.
- `after/production/` is the legacy 2026-08-23 publication-maturity evidence:
  48 PNGs plus `SHA256SUMS.txt`.

The legacy readmes inside `before/` and `after/` describe only those historical
inventories. They are not the contract or status record for the versioned
Purple Signal directories.

## Evidence boundary

The capture runner checks exact expected status, redirect absence, browser and
request errors, cross-origin requests, protected CMS and advertising routes,
and the monetization-off DOM contract for its defined plan. It does not replace
the complete local QA gate, human editorial/accessibility/privacy/legal review,
hosted Pages CMS authorization and save testing, or an external Google review.
Google alone decides AdSense eligibility and approval.
