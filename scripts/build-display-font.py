"""Subset Fraunces (OFL) for Penjat; keep optical size and 400–900 weight axes.
Usage: python3 scripts/build-display-font.py upstream.ttf output.woff2
Uses the same Catalan/Spanish repertoire as the Source Sans 3 UI font.
"""
import importlib.util
import sys
from fontTools.varLib.instancer import instantiateVariableFont
spec = importlib.util.spec_from_file_location('ui', 'scripts/build-ui-font.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
font = instantiateVariableFont(ui.subsetted(sys.argv[1]), {'wght': (400, 900), 'SOFT': 100, 'WONK': 1})
ui.write(font, sys.argv[2].replace('.woff2', '.ttf'))
required = set(map(ord, 'ÀÁÈÉÍÏÒÓÚÜÇàáèéíïòóúüç·Ŀŀ¡¿')) | {0x300, 0x301, 0x308, 0x327}
assert required <= font.getBestCmap().keys()
print('Fraunces: Catalan/Spanish and combining-accent coverage verified')
