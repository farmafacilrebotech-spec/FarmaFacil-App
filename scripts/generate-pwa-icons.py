#!/usr/bin/env python3
"""
Genera iconos PWA seguros SIN rediseñar el logo (usa public/icons/pwa-512.png como fuente):
  - public/icons/pwa-maskable-192.png / pwa-maskable-512.png  (logo al 70 % en cuadrado opaco → dentro de la safe zone 80 %)
  - public/icons/apple-touch-180.png y public/images/logos/farmafacil-apple-touch.png
    (opaco, logo al 90 %, sin esquinas transparentes que iOS pinta de negro)
Los iconos purpose=any siguen siendo los PNG circulares originales (pwa-192/512).
"""
from PIL import Image
import os
root = os.path.join(os.path.dirname(__file__), "..")
src = Image.open(os.path.join(root, "public/icons/pwa-512.png")).convert("RGBA")
BG = (11, 15, 21, 255)  # fondo oscuro del logo

def compose(size: int, ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    d = round(size * ratio)
    logo = src.resize((d, d), Image.LANCZOS)
    o = (size - d) // 2
    canvas.alpha_composite(logo, (o, o))
    return canvas.convert("RGB")

for size in (192, 512):
    compose(size, 0.70).save(os.path.join(root, f"public/icons/pwa-maskable-{size}.png"), optimize=True)
apple = compose(180, 0.90)
apple.save(os.path.join(root, "public/icons/apple-touch-180.png"), optimize=True)
apple.save(os.path.join(root, "public/images/logos/farmafacil-apple-touch.png"), optimize=True)
print("OK")
