# DXTag Display

`dxtag-display.woff2` is a Heavy-weight webfont subset derived from Adobe's
[Source Han Sans SC](https://github.com/adobe-fonts/source-han-sans), used for
short UI headings and the DXTag wordmark. Its glyphs are unchanged; the subset
contains the static UI text and printable ASCII. User-provided text falls back
to the system CJK sans-serif font for characters outside the subset.

Copyright 2014–2025 Adobe. Distributed under the SIL Open Font License 1.1;
see [OFL.txt](./OFL.txt). The modified subset's family, full, unique and
PostScript names have been changed to **DXTag Display** / **DXTagDisplay-Heavy**
to respect the Reserved Font Name “Source”. This font is not covered by the
application's MIT license.

Generated with FontTools 4.61.1 using its WOFF2 subsetter. To refresh, install
`fonttools brotli` and run `python scripts/subset-display-font.py /path/to/SourceHanSansSC-Heavy.otf`.
The script retains copyright/license metadata and renames family and
CFF/PostScript names. Keep this notice and OFL.txt with the font.
