#!/usr/bin/env python3
"""
Parca sayfasindan (exploded sprite sheet) her parcayi kendi seffaf PNG'sine ayirir.

Parcalar duz zeminde birbirine degmeden duruyor — yani zemini silip bagimsiz
lekeleri bulmak yetiyor, elle kesim gerekmiyor.

  python3 scripts/extract-parts.py <girdi.png> <cikti-klasoru> [--min-area 2000]

Cikti: <cikti-klasoru>/part-01.png, part-02.png, ... (ustten asagi, soldan saga)
arti bir contact-sheet.png — hangi parcanin hangi dosya oldugunu gormek icin.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def row_runs(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """Her satirdaki kesintisiz True kosularini (baslangic, bitis) olarak dondurur."""
    runs = []
    for row in mask:
        if not row.any():
            runs.append([])
            continue
        edges = np.flatnonzero(np.diff(np.concatenate(([0], row.view(np.int8), [0]))))
        runs.append(list(zip(edges[0::2], edges[1::2])))
    return runs


def label_components(mask: np.ndarray, h: int, w: int) -> np.ndarray:
    """
    8-komsuluklu bagli bilesen etiketleme. Arka plan 0, bilesenler 1'den baslar.

    PIL'in ImageDraw.floodfill'i burada kullanilamiyor: Image.fromarray salt-okunur
    tampon uretiyor ve mutasyon sessizce yutuluyor. Piksel piksel BFS yerine satir
    kosulari uzerinden yayiliyoruz — 1M piksel yerine birkac bin kosu isleniyor.
    """
    labels = np.zeros((h, w), dtype=np.int32)
    runs = row_runs(mask)
    label = 0

    for y0 in range(h):
        for x0, x1 in runs[y0]:
            if labels[y0, x0] != 0:
                continue
            label += 1
            labels[y0, x0:x1] = label
            stack = [(y0, x0, x1)]
            while stack:
                cy, cx0, cx1 = stack.pop()
                for ny in (cy - 1, cy + 1):
                    if ny < 0 or ny >= h:
                        continue
                    for nx0, nx1 in runs[ny]:
                        # 8-komsuluk: tek piksellik capraz temas da baglar
                        if nx1 < cx0 or nx0 > cx1 or labels[ny, nx0] == label:
                            continue
                        labels[ny, nx0:nx1] = label
                        stack.append((ny, nx0, nx1))
    return labels


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 2

    src_path, out_dir = Path(args[0]), Path(args[1])
    min_area = 2000
    if "--min-area" in sys.argv:
        min_area = int(sys.argv[sys.argv.index("--min-area") + 1])

    if not src_path.exists():
        print(f"REDDEDILDI — girdi yok: {src_path}")
        return 2

    img = Image.open(src_path).convert("RGBA")
    rgb = np.asarray(img)[:, :, :3].astype(np.int16)
    h, w = rgb.shape[:2]

    # Zemin rengi = kenar piksellerinin medyani. Parcalar ortada durdugu icin
    # kenar seridi guvenle zemin sayilabilir.
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)

    # "Zemin rengine yakin" demek zemin demek DEGIL: sanattaki beyaz alanlar
    # (goz aklari) krem zemine cok yakin cikiyor ve delik olarak kesiliyordu.
    # Zemin, kenara BAGLI olan bolgedir; icerideki beyazlar on planda kalir.
    distance = np.abs(rgb - bg).sum(axis=2)
    near_bg = distance <= 60

    bg_labels = label_components(near_bg, h, w)
    touching = set(bg_labels[0]) | set(bg_labels[-1]) | set(bg_labels[:, 0]) | set(bg_labels[:, -1])
    touching.discard(0)
    foreground = ~np.isin(bg_labels, list(touching))

    print(f"görsel      {w}x{h}")
    print(f"zemin rengi rgb{tuple(int(c) for c in bg)}")
    print(f"ön plan     %{100 * foreground.mean():.1f}"
          f"  (düz renk eşiğiyle %{100 * (~near_bg).mean():.1f} olurdu)")

    labels = label_components(foreground, h, w)
    components = []
    for label in range(1, labels.max() + 1):
        blob = labels == label
        area = int(blob.sum())
        if area < min_area:
            continue
        ys, xs = np.where(blob)
        components.append({
            "label": label,
            "area": area,
            "box": (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1),
        })

    if not components:
        print("REDDEDILDI — hiçbir parça bulunamadı. --min-area düşür.")
        return 1

    # Insan sirasi: once ustten asagi bantlar, bant icinde soldan saga.
    row_height = max(c["box"][3] - c["box"][1] for c in components)
    components.sort(key=lambda c: (round(c["box"][1] / (row_height * 0.6)), c["box"][0]))

    out_dir.mkdir(parents=True, exist_ok=True)
    source = np.asarray(img).copy()

    print()
    print(f"{len(components)} parça bulundu")
    written = []
    for index, comp in enumerate(components, start=1):
        x0, y0, x1, y1 = comp["box"]
        blob = labels == comp["label"]
        # Alfa'yi SADECE bu lekeden al — kutu icine giren komsu parca sizmasin.
        cut = source[y0:y1, x0:x1].copy()
        cut[:, :, 3] = np.where(blob[y0:y1, x0:x1], 255, 0)
        out_path = out_dir / f"part-{index:02d}.png"
        Image.fromarray(cut).save(out_path)
        written.append(out_path)
        print(f"  part-{index:02d}.png  {x1 - x0}x{y1 - y0}  alan {comp['area']}")

    # Contact sheet — hangi dosya hangi parca, tek bakista.
    pad, cols = 12, min(4, len(written))
    thumbs = [Image.open(p) for p in written]
    tw = max(t.width for t in thumbs)
    th = max(t.height for t in thumbs)
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * (tw + pad) + pad, rows * (th + pad + 18) + pad), (255, 253, 247, 255))
    draw = ImageDraw.Draw(sheet)
    for i, thumb in enumerate(thumbs):
        cx = pad + (i % cols) * (tw + pad)
        cy = pad + (i // cols) * (th + pad + 18)
        sheet.paste(thumb, (cx + (tw - thumb.width) // 2, cy), thumb)
        draw.text((cx + 2, cy + th + 2), written[i].name, fill=(36, 26, 56, 255))
    sheet.save(out_dir / "contact-sheet.png")

    print()
    print(f"Tamamlandı: {out_dir}/  (+ contact-sheet.png)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
