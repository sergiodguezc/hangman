"""Build src/assets/fonts/penjat-ui-variable.woff2 from upstream Source Sans 3.

Source: https://github.com/google/fonts/tree/main/ofl/sourcesans3 (SourceSans3[wght].ttf, version 3.052,
SHA-256 042fe2cc0b933e328410d7acbd0aa6a1873dca5aef81875f4bc214b08825c7b9). SIL Open Font License 1.1 with the
Reserved Font Name "Source": a subset is a Modified Version, so it is renamed "Penjat UI" and keeps the
copyright, trademark and license name records. Requires fontTools and the woff2_compress tool (google/woff2).

Usage: python3 scripts/build-ui-font.py SourceSans3[wght].ttf OUTDIR [--compare]
--compare also writes static 400/600/700 instances so their total size can be compared with the variable file.
"""
import os
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Latin, Latin-1 (all Catalan/Spanish precomposed letters, ·, ¡, ¿, «, »), Ŀ/ŀ, Œ/œ, the combining marks
# used by decomposed Catalan/Spanish text, typographic punctuation, euro and arrows.
UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
  [0x131, 0x13F, 0x140, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC] +
  [0x300, 0x301, 0x302, 0x303, 0x304, 0x306, 0x307, 0x308, 0x30A, 0x30C, 0x327, 0x328] +
  [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2039, 0x203A, 0x20AC,
   0x2190, 0x2191, 0x2192, 0x2193, 0x2212])
# Default figures are already tabular in Source Sans 3; mark/mkmk/ccmp position combining accents.
FEATURES = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'case']
FAMILY = 'Penjat UI'
KEEP_NAME_IDS = (0, 5, 7, 8, 9, 10, 11, 12, 13, 14)


def subsetted(source):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = ['*']
    options.name_languages = [0x409]
    options.notdef_outline = True
    options.hinting = False
    options.drop_tables += ['DSIG']
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    return font


def rename(font, style):
    kept = []
    for record in font['name'].names:
        if record.nameID in (1, 16): record.string = FAMILY
        elif record.nameID in (2, 17): record.string = style
        elif record.nameID == 3: record.string = f'{FAMILY} {style}; 3.052 subset'
        elif record.nameID == 4: record.string = f'{FAMILY} {style}'
        elif record.nameID == 6: record.string = f'PenjatUI-{style}'
        elif record.nameID == 25: record.string = 'PenjatUI'
        elif record.nameID < 256 and record.nameID not in KEEP_NAME_IDS: continue
        kept.append(record)
    font['name'].names = kept
    for record in kept:
        assert 'Source' not in str(record) or record.nameID in (0, 5, 7, 10, 13), (record.nameID, str(record))


def write(font, path):
    font.save(path)
    subprocess.run(['woff2_compress', path], check=True, stdout=subprocess.DEVNULL)
    os.remove(path)
    print(path.replace('.ttf', '.woff2'), os.path.getsize(path.replace('.ttf', '.woff2')))


def main():
    source, out = sys.argv[1], sys.argv[2]
    # The UI uses weights 400–700 only; limiting the axis keeps one file small.
    variable = instancer.instantiateVariableFont(subsetted(source), {'wght': (400, 700)}, updateFontNames=False)
    rename(variable, 'Regular')
    write(variable, os.path.join(out, 'penjat-ui-variable.ttf'))
    if '--compare' in sys.argv:
        for weight, style in ((400, 'Regular'), (600, 'SemiBold'), (700, 'Bold')):
            static = instancer.instantiateVariableFont(subsetted(source), {'wght': weight})
            rename(static, style)
            write(static, os.path.join(out, f'penjat-ui-{weight}.ttf'))


if __name__ == '__main__':
    main()
