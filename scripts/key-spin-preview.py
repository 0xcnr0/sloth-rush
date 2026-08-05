#!/usr/bin/env python3
"""
Kurma anahtarinin PERVANE donusunu dogrular.

Sorun: anahtarin tamami (mil dahil) ekran duzleminde dondurulunce akrep gibi
geziyor. Gercekte mil sabittir ve sadece kelebek kanatlar mil ekseni etrafinda
doner — govdeye dik duran, sirta paralel bir pervane gibi.

Cozum: sprite'i kaynak dikdortgeniyle ikiye ayir. Mil sabit cizilir. Kanatlar
donerken donus duzlemi 3/4 goruste egik oldugu icin yatayda kisaltilir; boylece
tur basina iki kez ince bir cizgiye iner — pervanenin okunmasini saglayan sey bu.

  python3 scripts/key-spin-preview.py
"""

import math
from pathlib import Path

from PIL import Image

KEY = Path("scripts/generated/parts/tinbot/part-05.png")
OUT = Path("scripts/generated/parts/tinbot/key-spin-preview.png")

# Sprite olculeri olculdu, tahmin degil (bkz. alfa sutun profili):
SHAFT_BOX = (0, 38, 26, 84)      # mil: ince yatay cubuk
WINGS_BOX = (24, 0, 87, 121)     # kelebek kanatlar
HUB = (38, 60)                   # mil ekseninin kanatlardan gectigi nokta
FORESHORTEN = 0.45               # donus duzlemi 3/4 goruste egik


def frame(angle_deg: float, size=(200, 200)) -> Image.Image:
    src = Image.open(KEY).convert("RGBA")
    canvas = Image.new("RGBA", size, (201, 223, 245, 255))
    cx, cy = size[0] // 2, size[1] // 2

    wings = src.crop(WINGS_BOX)
    hub_in_wings = (HUB[0] - WINGS_BOX[0], HUB[1] - WINGS_BOX[1])

    # Kanatlari, hub'i TAM ORTAYA alan kare bir tuvale yerlestir. Donerken hicbir
    # kose disari tasip kirpilmasin diye yaricap kosegen kadar buyuk secilir.
    radius = math.ceil(math.hypot(wings.width, wings.height))
    pad = Image.new("RGBA", (radius * 2, radius * 2), (0, 0, 0, 0))
    pad.alpha_composite(wings, (radius - hub_in_wings[0], radius - hub_in_wings[1]))

    rot = pad.rotate(angle_deg, resample=Image.BICUBIC)   # merkez = tuval merkezi = hub
    # Donus duzlemi egik: yatayda kisalt. Hub tuvalin merkezinde oldugu icin
    # kisaltma da merkez etrafinda simetrik kaliyor.
    squashed = rot.resize((max(1, round(rot.width * FORESHORTEN)), rot.height), Image.LANCZOS)
    canvas.alpha_composite(squashed, (cx - squashed.width // 2, cy - squashed.height // 2))

    # Mil en uste, sabit — donmuyor, kisalmiyor.
    shaft = src.crop(SHAFT_BOX)
    canvas.alpha_composite(shaft, (round(cx - (HUB[0] - SHAFT_BOX[0])), round(cy - (HUB[1] - SHAFT_BOX[1]))))
    return canvas


def main() -> None:
    n = 8
    shots = [frame(i / n * 360) for i in range(n)]
    w, h = shots[0].size
    strip = Image.new("RGBA", (w * n, h), (255, 253, 247, 255))
    for i, s in enumerate(shots):
        strip.alpha_composite(s, (i * w, 0))
    strip.save(OUT)
    print(f"Tamamlandı: {OUT}  ({n} kare, tam tur)")


if __name__ == "__main__":
    main()
