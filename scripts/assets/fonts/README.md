# Social image font source

`source-sans-3-variable-english.ttf` is an uncompressed TrueType container
conversion of the existing local `public/fonts/source-sans-3-variable-english.woff2`.
It preserves the same Source Sans 3 glyph subset and 200–900 weight axis. No
new font design, extra glyphs, or external font service has been introduced.

The font remains under the SIL Open Font License in
[`public/fonts/LICENSE-source-sans-3.txt`](../../../public/fonts/LICENSE-source-sans-3.txt).
This build asset stays outside `public/` because browsers use the smaller WOFF2.

Conversion performed with FontTools 4.59.2, `recalcTimestamp=False`,
`font.flavor=None`, and `save(..., reorderTables=False)`:

- Source SHA-256: `3a829b0f91bb20c4cdbe996d1c5c76482ee31a822ee5e934b85b69aa69b9d09e`
- Derived SHA-256: `ffd57992b71716f7db3ed9b8a1f437bb17dca8c16bbf52e4774959d30937de5f`

The social generator uses Fontkitten 1.0.3 to obtain genuine Source Sans 3
weight variations and outlines. Each generated SVG binds the exact TTF hash
and contains measured glyph paths, so rasterization does not depend on
installed operating-system fonts or support for embedded SVG webfonts. The
English subset lacks U+2011; the generator draws the bundled U+002D hyphen
glyph while retaining the exact nonbreaking-hyphen text in accessible labels.
