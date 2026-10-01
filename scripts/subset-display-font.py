#!/usr/bin/env python3
"""Optional asset maintenance: pip install fonttools brotli, then pass the source OTF.

Usage: python scripts/subset-display-font.py /path/to/SourceHanSansSC-Heavy.otf
The application build uses the checked-in WOFF2 and does not require Python.
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
text = "".join(path.read_text(encoding="utf-8") for path in [root / "index.html", *sorted((root / "src").glob("*.ts"))])
text += "".join(chr(index) for index in range(32, 127))
font = TTFont(source, recalcTimestamp=False)
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
options.notdef_glyph = True
options.notdef_outline = True
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
# A modified/subset font must not retain Adobe's reserved family name "Source".
names = {
    1: "DXTag Display", 2: "Heavy", 3: "DXTag Display Heavy Subset 1.0",
    4: "DXTag Display Heavy", 6: "DXTagDisplay-Heavy", 16: "DXTag Display",
    17: "Heavy", 21: "DXTag Display", 22: "Heavy",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
if "CFF " in font:
    cff = font["CFF "].cff
    cff.fontNames = ["DXTagDisplay-Heavy"]
    top = cff.topDictIndex[0]
    top.FamilyName = "DXTag Display"
    top.FullName = "DXTag Display Heavy"
    top.FontName = "DXTagDisplay-Heavy"
font.flavor = "woff2"
target = root / "public/fonts/dxtag-display.woff2"
font.save(target)
print(f"{target.name}: {target.stat().st_size} bytes, {len(font.getBestCmap())} code points")
