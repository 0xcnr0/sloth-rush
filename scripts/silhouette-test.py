#!/usr/bin/env python3
"""
ART_DIRECTION §4.1 — silüet testi. Gecilmesi zorunlu bir kapi.

Dort arketip 48x48 piksel DUZ SIYAH DOLGU olarak yan yana konur. Renk yok,
detay yok, sadece siluet. Dordu de birbirinden ayirt edilemiyorsa tasarim
reddedilir — cunku yaris sirasinda oyuncu yarim saniyede "hangisi benim"
sorusunu cevaplamak zorunda (§10) ve o olcekte renkten once form okunuyor.

Bu script KARAR VERMEZ, sadece seridi basar. Yazdirdigi sayi (XOR/birlesim)
kaba bir vekildir ve tek basina guvenilmez: benzer kutledeki iki dolu sekil,
konturlari tamamen farkli olsa bile dusuk fark verir. §4.1 sayisal bir esik
tanimlamiyor — "yan yana koy ve bak" diyor. Sayiya degil serite bakin.

  python3 scripts/silhouette-test.py
"""

import itertools
from pathlib import Path

import numpy as np
from PIL import Image

PARTS = Path("scripts/generated/parts")
OUT = PARTS / "silhouette-test.png"
SIZE = 48

# Her arketip icin govde ve kafa: siluetin buyuk kismini bu ikisi tasiyor.
# Uzuvlar ayni sema uzerinde durdugu icin ayirt ediciligi onlar saglamiyor.
#
# Klasorler oyunda GERCEKTEN gorunen sayfalari gostermek zorunda. Uc arketip
# docs/PART_TEMPLATE.md'ye gore yeniden cizildi; harita eski sayfalarda kalinca
# script calismaya ve bir sayi basmaya devam etti — ama o sayi artik kimsenin
# gormedigi bir sanata aitti. Gecmeyen bir kapi degil, yanlis kapiyi olcen bir
# kapi daha kotudur. Dordunde de govde part-04, kafa part-01.
ARCHETYPES = {
    "Jetster": ("jetster-v5", "part-04.png", "part-01.png"),
    "Tinbot": ("tinbot-3q", "part-04.png", "part-01.png"),
    "Waddler": ("waddler-v3", "part-04.png", "part-01.png"),
    "Chomper": ("chomper-v3", "part-04.png", "part-01.png"),
}


def silhouette(folder: str, torso: str, head: str) -> np.ndarray:
    """Govde + kafayi ust uste koyup 48x48 ikili maskeye indirir."""
    t = Image.open(PARTS / folder / torso).convert("RGBA")
    h = Image.open(PARTS / folder / head).convert("RGBA")
    # Kafa govdenin ustune, yatayda ortalanmis — kaba ama tutarli bir yerlesim.
    canvas = Image.new("RGBA", (max(t.width, h.width), t.height + int(h.height * 0.72)), (0, 0, 0, 0))
    canvas.alpha_composite(h, ((canvas.width - h.width) // 2, 0))
    canvas.alpha_composite(t, ((canvas.width - t.width) // 2, int(h.height * 0.72)))

    box = canvas.getbbox()
    canvas = canvas.crop(box)
    # En-boy oranini koruyarak sigdir: siluet testinin anlamli olmasi icin
    # oranlarin bozulmamasi sart.
    scale = min(SIZE / canvas.width, SIZE / canvas.height)
    canvas = canvas.resize((max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale))), Image.LANCZOS)
    cell = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cell.alpha_composite(canvas, ((SIZE - canvas.width) // 2, SIZE - canvas.height))
    return np.asarray(cell)[:, :, 3] > 96


def main() -> None:
    masks = {name: silhouette(*spec) for name, spec in ARCHETYPES.items()}

    print(f"§4.1 siluet testi — {SIZE}x{SIZE} düz siyah dolgu\n")
    print("Çiftler arası fark (farklı piksel oranı):")
    worst = (1.0, "")
    for a, b in itertools.combinations(masks, 2):
        diff = np.logical_xor(masks[a], masks[b]).sum()
        union = np.logical_or(masks[a], masks[b]).sum()
        ratio = diff / union if union else 0.0
        flag = "" if ratio >= 0.30 else "   ← kütlece yakın"
        print(f"  {a:8} / {b:8}  %{ratio*100:5.1f}{flag}")
        if ratio < worst[0]:
            worst = (ratio, f"{a}/{b}")

    print(f"\nKütlece en yakın çift: {worst[1]} — %{worst[0]*100:.1f}")
    print("Bu sayı bir vekil, karar değil: §4.1 görsel bir test. Şeride bakın.")

    pad = 10
    sheet = Image.new("RGBA", (len(masks) * (SIZE + pad) + pad, SIZE + pad * 2 + 14), (255, 253, 247, 255))
    for i, (name, mask) in enumerate(masks.items()):
        cell = Image.fromarray(np.where(mask, 0, 255).astype("uint8")).convert("RGBA")
        cell.putalpha(Image.fromarray(np.where(mask, 255, 0).astype("uint8")))
        sheet.alpha_composite(cell, (pad + i * (SIZE + pad), pad))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(OUT)
    print(f"\nGörsel: {OUT}")


if __name__ == "__main__":
    main()
