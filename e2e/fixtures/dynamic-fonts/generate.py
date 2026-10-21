"""可重复构建的合成测试字体；字形由本文件原创，CC0-1.0。"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

for version in (1, 2):
    builder = FontBuilder(1000, isTTF=True)
    order = [".notdef", "space", "A", "a"]
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap({32: "space", 65: "A", 97: "a"})
    glyphs = {}
    for name in order:
        pen = TTGlyphPen(None)
        if name not in (".notdef", "space"):
            points = [(100, 0), (300, 700), (500, 0)] if version == 1 else [(80, 0), (80, 700), (520, 700), (520, 0)]
            pen.moveTo(points[0])
            for point in points[1:]:
                pen.lineTo(point)
            pen.closePath()
        glyphs[name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (600, 0) for name in order})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": f"Wenyou Synthetic {version}", "styleName": "Regular", "uniqueFontIdentifier": f"wenyou-synthetic-{version}", "fullName": f"Wenyou Synthetic {version}", "psName": f"WenyouSynthetic-{version}", "version": "Version 1.000", "copyright": "CC0-1.0; original synthetic test glyphs"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200, fsType=0)
    builder.setupPost()
    builder.setupMaxp()
    builder.font["head"].created = 3406620150
    builder.font["head"].modified = 3406620150
    builder.font.recalcTimestamp = False
    builder.save(Path(__file__).with_name(f"synthetic-{version}.ttf"))
