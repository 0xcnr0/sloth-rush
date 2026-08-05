#!/usr/bin/env python3
"""
Kurma anahtarinin donusunu dogrular — tarayiciya gecmeden once.

MODEL: mil YATAY, govdenin yanindan disari cikar. Kanatlar o milin etrafinda
doner, yani ustten asirip alttan gecerler — oyuncagi kurarken elinin yaptigi
hareketin ta kendisi.

Ekranda bu, kanatlarin DIKEYDE kisalmasi demek: tam acikken kelebek gorunur,
ceyrek turda yatay ince bir seride iner, sonra TERS YUZU gorunerek acilir.

Denenip elenen iki model:
  - Anahtarin tamamini ekran duzleminde dondurmek → govdenin etrafinda gezen
    bir akrep. Mil de dondugu icin eksen diye bir sey kalmiyor.
  - Kanatlari YATAYDA kisaltmak → dikey bir eksende yalpalama. Kapi gibi
    aciliyor, cark gibi donmuyor.

  python3 scripts/key-spin-preview.py
"""

import math
from pathlib import Path

from PIL import Image

KEY = Path("scripts/generated/parts/tinbot/part-05.png")
OUT = Path("scripts/generated/parts/tinbot/key-spin-preview.png")

# Sprite olculeri alfa profilinden okundu, goz karariyla degil.
SHAFT_BOX = (0, 38, 26, 84)      # mil: ince yatay cubuk, x<26
WINGS_BOX = (24, 0, 87, 121)     # kelebek kanatlar
HUB = (38, 60)                   # mil ekseninin kanatlardan gectigi nokta

# Gercek bir sacin kalinligi var: tam kenardan bakista yok olmasin, ince bir
# serit kalsin. Sifira inmesine izin vermek kareyi bosaltip titreme yaratiyor.
MIN_EDGE = 0.09


def frame(angle_deg: float, size=(170, 170)) -> Image.Image:
    src = Image.open(KEY).convert("RGBA")
    canvas = Image.new("RGBA", size, (201, 223, 245, 255))
    cx, cy = size[0] // 2, size[1] // 2

    wings = src.crop(WINGS_BOX)
    hub = (HUB[0] - WINGS_BOX[0], HUB[1] - WINGS_BOX[1])

    cos = math.cos(math.radians(angle_deg))
    squash = max(MIN_EDGE, abs(cos))
    # Turun ikinci yarisinda sacin ARKA yuzunu goruyoruz — dikeyde aynalanir.
    flipped = cos < 0
    plate = wings.transpose(Image.FLIP_TOP_BOTTOM) if flipped else wings
    hub_y = plate.height - hub[1] if flipped else hub[1]

    squashed = plate.resize((plate.width, max(1, round(plate.height * squash))), Image.LANCZOS)
    canvas.alpha_composite(squashed, (cx - hub[0], round(cy - hub_y * squash)))

    # Mil en uste, sabit — donmez, kisalmaz. Donusu okutan sabit eksen bu.
    shaft = src.crop(SHAFT_BOX)
    canvas.alpha_composite(shaft, (cx - (HUB[0] - SHAFT_BOX[0]), cy - (HUB[1] - SHAFT_BOX[1])))
    return canvas


def main() -> None:
    n = 8
    shots = [frame(i / n * 360) for i in range(n)]
    w, h = shots[0].size
    strip = Image.new("RGBA", (w * n, h), (255, 253, 247, 255))
    for i, shot in enumerate(shots):
        strip.alpha_composite(shot, (i * w, 0))
    strip.save(OUT)
    print(f"Tamamlandı: {OUT}  ({n} kare, tam tur)")


if __name__ == "__main__":
    main()
