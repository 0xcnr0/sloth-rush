#!/usr/bin/env python3
"""
Kod-native rig'in provasi. Parcalari pivotlarindan dondurup birlestirir ve
kosu dongusunden birkac kareyi tek serit halinde basar.

Amaci tarayiciya gecmeden once pivotlarin dogru yerde oldugunu gormek —
ayni sayilar birebir JS tarafina tasinacak.

  python3 scripts/rig-preview.py
"""

import math
from pathlib import Path

from PIL import Image

PARTS = Path("scripts/generated/parts/tinbot")
OUT = Path("scripts/generated/parts/tinbot/rig-preview.png")

# Pivotlar parca goruntusunun KENDI piksel uzayinda (x, y), OLCEKLENMEDEN once.
# Govde uzerindeki baglanti noktalari govdenin kendi uzayinda.
#
# scale: parca sayfasi birlesecek oranlarda cizilmedi — uzuvlar govdeye gore
# fazla uzun cikti. Oranlari burada duzeltiyoruz; ART_DIRECTION §4 Tinbot'u
# "genis, koseli, dik" ve tiknaz tarif ediyor, sıska degil.
RIG = {
    "torso": {"file": "part-04.png", "scale": 1.0},
    "head":  {"file": "part-01.png", "scale": 1.0,  "pivot": (153, 200), "anchor": (140, -4)},
    "arm":   {"file": "part-03.png", "scale": 0.78, "pivot": (52, 30)},
    "leg":   {"file": "part-07.png", "scale": 0.62, "pivot": (100, 40)},
    # Anahtar TEK PARCA doner: dikeyde kisalir, yatay mil ekseni etrafinda.
    # Hub 341 secildi ki milin dibi govdenin arka sinirinin icine gomulsun.
    "key":   {"file": "part-06.png", "scale": 1.50, "pivot": (90, 60), "anchor": (437, 101)},
}
# Uzuv araliklari govde merkezine (x=162) gore simetrik. Deger 2026-08-05'te
# canli kaydiricilarla secildi: dar durus bilincli bir tercih, tesadufi degil.
CENTER, ARM_SPREAD, LEG_SPREAD = 163, 27, 10
SHOULDER = {"near": (CENTER + ARM_SPREAD, 56), "far": (CENTER - ARM_SPREAD, 56)}
HIP = {"near": (CENTER + LEG_SPREAD, 316), "far": (CENTER - LEG_SPREAD, 316)}


def load(name: str) -> Image.Image:
    img = Image.open(PARTS / RIG[name]["file"]).convert("RGBA")
    scale = RIG[name].get("scale", 1.0)
    if scale != 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return img


def pivot_of(name: str) -> tuple[float, float]:
    """Pivot ham piksel uzayinda tanimli — olcekle birlikte kayar."""
    px, py = RIG[name]["pivot"]
    scale = RIG[name].get("scale", 1.0)
    return px * scale, py * scale


def place(canvas: Image.Image, part: Image.Image, pivot, anchor, angle_deg: float, origin) -> None:
    """part'i pivotundan angle kadar dondurup anchor noktasina oturtur."""
    rotated = part.rotate(angle_deg, resample=Image.BICUBIC, center=pivot, expand=False)
    x = origin[0] + anchor[0] - pivot[0]
    y = origin[1] + anchor[1] - pivot[1]
    canvas.alpha_composite(rotated, (int(x), int(y)))


def frame(phase: float, key_angle: float, size=(620, 1000)) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    torso = load("torso")
    # Zipla: kosarken govde hafif yukari-asagi. Ayaklar kadraja sigsin diye
    # origin yukaridan degil, ayak hizasindan geriye hesaplaniyor.
    bob = int(abs(math.sin(phase)) * 12)
    origin = ((size[0] - torso.width) // 2, 300 - bob)

    swing = math.sin(phase)
    arm, leg, head, key = load("arm"), load("leg"), load("head"), load("key")

    # Arka uzuvlar once — govdenin arkasinda kalsinlar.
    place(canvas, leg, pivot_of("leg"), HIP["far"], -swing * 24, origin)
    place(canvas, arm, pivot_of("arm"), SHOULDER["far"], swing * 22, origin)

    canvas.alpha_composite(torso, origin)

    place(canvas, key, pivot_of("key"), RIG["key"]["anchor"], key_angle, origin)
    place(canvas, head, pivot_of("head"), RIG["head"]["anchor"], -swing * 3, origin)

    place(canvas, leg, pivot_of("leg"), HIP["near"], swing * 24, origin)
    place(canvas, arm, pivot_of("arm"), SHOULDER["near"], -swing * 22, origin)
    return canvas


def main() -> None:
    frames = 6
    shots = [frame(i / frames * 2 * math.pi, -i / frames * 360 * 1.5) for i in range(frames)]
    w, h = shots[0].size
    strip = Image.new("RGBA", (w * frames, h), (255, 253, 247, 255))
    for i, shot in enumerate(shots):
        strip.alpha_composite(shot, (i * w, 0))
    strip.resize((w * frames // 2, h // 2), Image.LANCZOS).save(OUT)
    print(f"Tamamlandı: {OUT}  ({frames} kare)")


if __name__ == "__main__":
    main()
