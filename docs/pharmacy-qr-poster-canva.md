# Cartel QR A4 — integración plantilla Canva

## Enfoque
1. Diseñar el cartel completo en **Canva** (A4 vertical).
2. Exportar **PNG de alta resolución** (recomendado ≥ 2480×3508 px ≈ 300 dpi).
3. La app **solo** inserta dinámicamente:
   - Logo de la farmacia (`pharmacy_branding.logo_url`) — contain, centrado; si no hay logo, no se dibuja nada y el nombre usa `rectWithoutLogo`.
   - Nombre real de la farmacia (1–2 líneas, tamaño auto, mínimo legible).
   - QR de `https://app.farmafacil.solutions/e/{publicId}`.

No rediseñar el cartel en TypeScript/jsPDF.

## Dónde colocar el asset
```
public/images/posters/pharmacy-qr-a4.png
```

## Coordenadas
Se definen en **fracción 0..1** del tamaño de la plantilla (`PosterRectNorm`) en
`lib/pharmacies/pharmacy-qr-poster-layout.ts`, y se convierten a mm A4 con
`rectNormToMm`.

También se puede partir de píxeles del export Canva con `rectPxToNorm`.

| Zona | Campos |
|------|--------|
| Logo | `logo.rect`, `logo.configured` |
| Nombre | `name.rect`, `name.rectWithoutLogo`, tipografía, `configured` |
| QR | `qr.rect`, `qr.quietZoneRatio`, `configured` |
| Fondo | `backgroundSrc`, `templatePx` |
| Descarga UI | `pdfDownloadEnabled` (false hasta OK visual) |

## Estado actual (PR #23)
- Generador preparado (logo + nombre + QR).
- **PNG Canva aún no recibido** → zonas `configured: false`.
- **Descarga PDF del panel desactivada** (`pdfDownloadEnabled: false`) hasta aprobación de ejemplos.
- PNG/SVG independientes del QR: activos.

## Checklist al recibir el Canva
- [ ] Copiar PNG a `public/images/posters/pharmacy-qr-a4.png`
- [ ] Anotar tamaño px del export en `templatePx`
- [ ] Medir zonas vacías (logo / nombre / QR) sin solapar titulares fijos
- [ ] Rellenar `rect` / `rectWithoutLogo` / `quietZoneRatio` y `configured: true`
- [ ] Generar PDFs de revisión (`allowUnapprovedReview`) con variantes logo/nombre
- [ ] Escanear QR → URL canónica
- [ ] Aprobación visual → `pdfDownloadEnabled: true`

## Scripts
Cuando exista el PNG: `scripts/generate-pharmacy-qr-poster-review.mjs` (revisión local, gitignored en `public/_review_clients_qr/`).
