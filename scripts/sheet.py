"""Contact sheets: agrupa capturas en rejillas etiquetadas para revisión."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

tag = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
cell_w = 620
label_h = 26

src = Path('shots') / tag
files = sorted(src.glob('*.png'))
files = [f for f in files if not f.name.startswith('sheet-') and not f.name.endswith('.jpg')]
per_sheet = cols * cols

for si in range(0, len(files), per_sheet):
    batch = files[si:si + per_sheet]
    rows = (len(batch) + cols - 1) // cols
    # celda apaisada en desktop/tablet, vertical en móvil
    first = Image.open(batch[0])
    portrait = first.height > first.width
    cell_w = 300 if portrait else 620
    cell_h = round(cell_w * first.height / first.width)
    sheet = Image.new('RGB', (cols * cell_w, rows * (cell_h + label_h)), (28, 28, 28))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(batch):
        im = Image.open(f).convert('RGB').resize((cell_w, cell_h))
        x = (i % cols) * cell_w
        y = (i // cols) * (cell_h + label_h)
        sheet.paste(im, (x, y))
        d.text((x + 8, y + cell_h + 6), f.stem, fill=(255, 210, 80))
    out = src / f'sheet-{si // per_sheet}.jpg'
    sheet.save(out, quality=86)
    print(out, sheet.size)
