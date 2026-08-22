# Local web-font subsets

These WOFF2 files are self-hosted subsets of the pinned Fontsource 5.3.0 packages in `package.json`:

- `newsreader-variable-english.woff2`: Newsreader Variable, normal style, weight range 600–800.
- `source-sans-3-variable-english.woff2`: Source Sans 3 Variable, normal style, weight range 200–900.

The subsets cover the current English publication text: printable ASCII plus the punctuation, currency, arrows, and symbols declared by the matching `unicode-range` rules in `src/styles/global.css`. Characters outside that range use the documented fallback stacks.

The files were produced from the packages' Latin WOFF2 sources with fontTools 4.63.0, layout features retained, hinting removed, and WOFF2/Zopfli output. The Newsreader weight axis was first restricted to the weights the design uses. Full license texts are included beside the fonts.
