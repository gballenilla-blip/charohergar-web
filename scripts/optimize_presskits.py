# -*- coding: utf-8 -*-
"""Optimiza los PDFs de public/assets/presskit recomprimiendo sus imágenes
incrustadas (sin tocar texto ni flujos de contenido → layout idéntico).

Reemplaza los streams de imagen a nivel de objeto con pikepdf + Pillow:
los matrices de colocación no cambian, así que la composición se preserva
por construcción (a diferencia de Page.replace_image de PyMuPDF, que
duplica draws y rompe el layout).

  python scripts/optimize_presskits.py [--force]
"""
import io
import os
import sys
import zlib

import pikepdf
from pikepdf import Name, PdfImage
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'presskit')

MAX_SIDE = 2200          # lado máximo de imagen (≈300 dpi en A4 lateral)
JPEG_Q = 78              # calidad JPEG (visualmente transparente para fotos)
SKIP_KB = 200            # imágenes por debajo de este peso no se tocan


def iter_images(pdf):
    for obj in pdf.objects:
        if (isinstance(obj, pikepdf.Stream)
                and obj.get('/Subtype', None) == Name('/Image')):
            yield obj


def cs_kind(obj):
    """clase de espacio de color: 'gray' | 'rgb' | 'other'"""
    cs = obj.get('/ColorSpace', None)
    if cs is None:
        return 'rgb'
    if isinstance(cs, Name):
        n = str(cs)
        if n == '/DeviceGray':
            return 'gray'
        if n in ('/DeviceRGB', '/DeviceCMYK'):
            return 'rgb' if n == '/DeviceRGB' else 'other'
        return 'other'
    try:
        if str(cs[0]) == '/ICCBased':
            data = cs[1].read_raw_bytes()
            sig = data[16:20] if len(data) > 20 else b'RGB '
            ncomp = {b'GRAY': 1, b'RGB ': 3, b'CMYK': 4}.get(sig, 3)
            return 'gray' if ncomp == 1 else 'rgb'
        if str(cs[0]) in ('/CalGray',):
            return 'gray'
    except Exception:
        pass
    return 'other'


def optimize_one(path, force=False):
    size0 = os.path.getsize(path)
    if not force and size0 < 400 * 1024:
        print(f'skip (pequeño): {os.path.basename(path)} {size0 // 1024} KB')
        return
    pdf = pikepdf.open(path)
    replaced = skipped = 0
    for obj in iter_images(pdf):
        raw = len(obj.read_raw_bytes())
        w0 = int(obj.get('/Width', 0))
        h0 = int(obj.get('/Height', 0))
        if raw < SKIP_KB * 1024 and max(w0, h0) <= 1200:
            continue
        if obj.get('/ImageMask', False):
            skipped += 1
            continue
        try:
            pi = PdfImage(obj)
            im = pi.as_pil_image()
        except Exception as e:
            skipped += 1
            print(f'  x{obj.objgen[0]}: sin decodificar ({e})')
            continue
        kind = cs_kind(obj)
        if kind == 'gray':
            im = im.convert('L')
        elif im.mode not in ('RGB', 'L'):
            im = im.convert('RGB')
        # máscara de transparencia: se reescala y recomprime en paralelo
        mask_obj = obj.get('/SMask', None)
        mask_im = None
        if mask_obj is not None and isinstance(mask_obj, pikepdf.Stream) \
                and mask_obj.get('/Subtype', None) == Name('/Image'):
            try:
                mask_im = PdfImage(mask_obj).as_pil_image().convert('L')
                if mask_im.size != im.size:
                    mask_im = mask_im.resize(im.size, Image.LANCZOS)
            except Exception:
                mask_im = None
        if mask_im is None and '/SMask' in obj:
            skipped += 1          # no tocar pares con máscara indecodificable
            continue
        if max(im.size) > MAX_SIDE:
            s = MAX_SIDE / max(im.size)
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            if mask_im is not None:
                mask_im = mask_im.resize(im.size, Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True)
        if buf.tell() < raw:
            obj.write(buf.getvalue(), filter=Name('/DCTDecode'), decode_parms=None)
            obj[Name.Width] = im.width
            obj[Name.Height] = im.height
            if kind == 'other':
                obj[Name.ColorSpace] = Name.DeviceRGB
            if Name('/DecodeParms') in obj:
                del obj[Name.DecodeParms]
            replaced += 1
            print(f'  x{obj.objgen[0]}: {w0}x{h0} {raw // 1024}KB -> '
                  f'{im.width}x{im.height} {buf.tell() // 1024}KB')
        if mask_im is not None:
            mraw = len(mask_obj.read_raw_bytes())
            comp = zlib.compress(mask_im.tobytes(), 9)
            if len(comp) < mraw:
                mask_obj.write(comp, filter=Name('/FlateDecode'), decode_parms=None)
                mask_obj[Name.Width] = mask_im.width
                mask_obj[Name.Height] = mask_im.height
                mask_obj[Name.ColorSpace] = Name.DeviceGray
                mask_obj[Name.BitsPerComponent] = 8
                if Name('/DecodeParms') in mask_obj:
                    del mask_obj[Name.DecodeParms]
    tmp = path + '.tmp'
    pdf.save(tmp, compress_streams=True,
             object_stream_mode=pikepdf.ObjectStreamMode.generate)
    pdf.close()
    size1 = os.path.getsize(tmp)
    os.replace(tmp, path)
    print(f'{os.path.basename(path)}: {size0 // 1024} KB -> {size1 // 1024} KB '
          f'({replaced} imgs, {skipped} saltadas)')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    for f in sorted(os.listdir(DIR)):
        if f.lower().endswith('.pdf') and (not args or any(a in f for a in args)):
            optimize_one(os.path.join(DIR, f), force)
