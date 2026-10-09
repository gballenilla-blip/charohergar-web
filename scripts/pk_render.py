# -*- coding: utf-8 -*-
"""Renderiza la página 1 de cada PDF en shots/pkimg (antes/después) para
comparar visualmente la optimización. Uso: python scripts/pk_render.py [tag]"""
import os
import sys

import pymupdf

DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'presskit')
OUT = os.path.join(os.path.dirname(__file__), '..', 'shots', 'pkimg')
tag = sys.argv[1] if len(sys.argv) > 1 else 'after'

for f in sorted(os.listdir(DIR)):
    if not f.lower().endswith('.pdf'):
        continue
    doc = pymupdf.open(os.path.join(DIR, f))
    for pno in (0, min(1, doc.page_count - 1)):
        pm = doc[pno].get_pixmap(dpi=90)
        pm.save(os.path.join(OUT, f'{tag}-{f[:-4]}-p{pno + 1}.png'))
    doc.close()
print('rendered', tag)
