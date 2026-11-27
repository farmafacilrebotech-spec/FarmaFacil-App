#!/usr/bin/env python3
"""
Previsualización 80 mm alineada con KioskTicketBitmap (métricas diseño 0186 + K02).

No sustituye la prueba física; replica tipografía/márgenes/QR del renderer nativo
para aprobación visual previa al APK.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

try:
    import qrcode
except ImportError:
    qrcode = None  # type: ignore

# IcodPrintableWidth.SDK_80MM_PRINTABLE_DOTS = (80 - 8) * 8
WIDTH = 576
EDGE_RATIO = 0.015
LOGO_RATIO = 0.48
QR_RATIO = 0.50

ROOT = Path(__file__).resolve().parents[1]
LOGO_CANDIDATES = [
    ROOT / "branding/ticket-logo/ff_ticket_logo_thermal_512.png",
    ROOT / "branding/ticket-logo/Logo_FarmaFacil_Ticket_Monocromo.png",
    ROOT / "app/src/main/res/drawable-nodpi/ff_ticket_logo.png",
]
OUT_DIR = Path(os.environ.get("TICKET_PREVIEW_DIR", str(Path.home() / "Desktop")))
QR_URL = "https://farmafacil-staging.vercel.app/o/abcdefghijklmnopqrstuvwxyz0123456789ABCD"


def size_for(w: int, ratio: float, mn: float, mx: float) -> float:
    return max(mn, min(mx, w * ratio))


def load_font(size: float, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    size_i = max(10, int(round(size)))
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            try:
                return ImageFont.truetype(path, size_i)
            except OSError:
                continue
    return ImageFont.load_default()


def load_logo(target: int) -> Image.Image:
    for path in LOGO_CANDIDATES:
        if path.is_file():
            img = Image.open(path).convert("RGBA")
            img = img.resize((target, target), Image.Resampling.LANCZOS)
            # Asegurar B/N puro sobre blanco
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            composed = Image.alpha_composite(bg, img).convert("L")
            return composed.convert("RGB")
    # Fallback disco
    img = Image.new("RGB", (target, target), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.ellipse((4, 4, target - 5, target - 5), outline=(0, 0, 0), width=max(3, target // 40))
    return img


def make_qr(payload: str, target: int) -> Image.Image:
    if qrcode is None:
        raise RuntimeError("Instala qrcode: pip install qrcode[pil]")
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=1,
        border=0,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    modules = len(matrix)
    scale = max(1, target // modules)
    size = modules * scale
    img = Image.new("RGB", (size, size), (255, 255, 255))
    px = img.load()
    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            if not dark:
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = (0, 0, 0)
    return img


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    width: int,
    y: float,
    font: ImageFont.ImageFont,
) -> float:
    edge = max(2, int(round(width * EDGE_RATIO)))
    max_w = float(width - 2 * edge)
    use_font = font
    tw, th = text_size(draw, text, use_font)
    # Reduce solo si no cabe (TOTAL largo con pendiente de valoración).
    if tw > max_w and hasattr(font, "size"):
        size = int(getattr(font, "size"))
        while tw > max_w and size > 12:
            size -= 1
            try:
                use_font = ImageFont.truetype(font.path, size)  # type: ignore[attr-defined]
            except Exception:
                break
            tw, th = text_size(draw, text, use_font)
    x = max(0, (width - tw) / 2)
    draw.text((x, y), text, fill=(0, 0, 0), font=use_font)
    return y + th + 4


def ellipsize(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_w: float) -> str:
    if text_size(draw, text, font)[0] <= max_w:
        return text
    end = len(text)
    while end > 1:
        end -= 1
        candidate = text[:end] + "…"
        if text_size(draw, candidate, font)[0] <= max_w:
            return candidate
    return "…"


def render_ticket(
    *,
    pharmacy: str,
    display: str,
    items: list[tuple[str, str]],
    total: str,
    payment_footer: str | None,
    qr_payload: str,
    out_path: Path,
) -> None:
    edge = max(2, int(round(WIDTH * EDGE_RATIO)))
    content_w = WIDTH - 2 * edge
    logo_size = max(96, min(WIDTH - 16, int(round(WIDTH * LOGO_RATIO))))

    pharmacy_font = load_font(size_for(WIDTH, 0.055, 18, 28), bold=False)
    headline_font = load_font(size_for(WIDTH, 0.10, 32, 48), bold=True)
    product_font = load_font(size_for(WIDTH, 0.052, 17, 26), bold=False)
    total_font = load_font(size_for(WIDTH, 0.13, 40, 64), bold=True)
    small_font = load_font(size_for(WIDTH, 0.045, 15, 22), bold=False)
    slogan_font = load_font(size_for(WIDTH, 0.042, 14, 22), bold=True)

    gap = max(10, int(round(size_for(WIDTH, 0.10, 32, 48) * 0.55)))
    qr_target = max(64, min(content_w, int(WIDTH * QR_RATIO)))
    qr_img = make_qr(qr_payload, qr_target)
    logo = load_logo(logo_size)

    # Medición aproximada de altura
    probe = Image.new("RGB", (WIDTH, 10), (255, 255, 255))
    pd = ImageDraw.Draw(probe)
    h_ph = text_size(pd, pharmacy, pharmacy_font)[1] + 4
    h_hd = text_size(pd, f"Pedido {display}", headline_font)[1] + 4
    h_tot = text_size(pd, total, total_font)[1] + 4
    h_sm = text_size(pd, "Pago pendiente en mostrador", small_font)[1] + 4
    h_sg = text_size(pd, "Tu farmacia, más cerca de tus clientes", slogan_font)[1] + 4
    h_prod = text_size(pd, "1× Producto", product_font)[1] + 6

    height = edge
    height += gap + logo_size + int(gap * 0.6)
    height += h_ph + gap // 3 + h_hd + gap + 3 + gap
    for left, right in items:
        tw = text_size(pd, right, product_font)[0]
        height += h_prod * (2 if tw > content_w * 0.40 else 1)
    height += gap + 3 + gap + h_tot
    if payment_footer:
        height += gap // 2 + h_sm
    height += gap + qr_img.height + gap // 2 + h_sm
    height += gap + h_sg + gap + edge

    img = Image.new("RGB", (WIDTH, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = float(edge)

    y += gap
    lx = (WIDTH - logo_size) // 2
    img.paste(logo, (lx, int(y)))
    y += logo_size + gap * 0.6

    y = draw_centered(draw, pharmacy, WIDTH, y, pharmacy_font)
    y += gap / 3
    y = draw_centered(draw, f"Pedido {display}", WIDTH, y, headline_font)
    y += gap
    draw.line((edge, y, WIDTH - edge, y), fill=(0, 0, 0), width=max(3, WIDTH // 120))
    y += gap

    for left, right in items:
        right_w = text_size(draw, right, product_font)[0]
        two_lines = right_w > content_w * 0.40
        if two_lines:
            left_text = ellipsize(draw, left, product_font, content_w)
            draw.text((edge, y), left_text, fill=(0, 0, 0), font=product_font)
            y += h_prod
            draw.text((WIDTH - edge - right_w, y), right, fill=(0, 0, 0), font=product_font)
            y += h_prod
        else:
            max_left = max(40, content_w - right_w - 12)
            left_text = ellipsize(draw, left, product_font, max_left)
            draw.text((edge, y), left_text, fill=(0, 0, 0), font=product_font)
            draw.text((WIDTH - edge - right_w, y), right, fill=(0, 0, 0), font=product_font)
            y += h_prod

    y += gap
    draw.line((edge, y, WIDTH - edge, y), fill=(0, 0, 0), width=max(3, WIDTH // 120))
    y += gap
    y = draw_centered(draw, total, WIDTH, y, total_font)

    if payment_footer:
        y += gap / 2
        y = draw_centered(draw, payment_footer, WIDTH, y, small_font)

    y += gap
    qx = (WIDTH - qr_img.width) // 2
    img.paste(qr_img, (qx, int(y)))
    y += qr_img.height + gap / 2
    y = draw_centered(draw, "Consulta el estado de tu pedido", WIDTH, y, small_font)
    y += gap
    draw_centered(draw, "Tu farmacia, más cerca de tus clientes", WIDTH, y, slogan_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")
    print(f"Wrote {out_path} ({img.size[0]}x{img.size[1]})")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render_ticket(
        pharmacy="Farmacia Fase7 QR Requests",
        display="0187",
        items=[
            ("1× Ibuprofeno 400 mg", "4,50 €"),
            ("1× Crema hidratante", "8,00 €"),
        ],
        total="TOTAL: 12,50 €",
        payment_footer="Pago pendiente en mostrador",
        qr_payload=QR_URL,
        out_path=OUT_DIR / "Ticket_Propuesta_Precios_Conocidos.png",
    )
    render_ticket(
        pharmacy="Farmacia Fase7 QR Requests",
        display="0188",
        items=[
            ("1× Medicamento con receta", "Pendiente de valoración"),
            ("1× Consulta farmacéutica", "Pendiente de valoración"),
        ],
        total="TOTAL: Pendiente de valoración",
        payment_footer="Pago pendiente en mostrador",
        qr_payload=QR_URL,
        out_path=OUT_DIR / "Ticket_Propuesta_Pendiente_Valoracion.png",
    )


if __name__ == "__main__":
    main()
