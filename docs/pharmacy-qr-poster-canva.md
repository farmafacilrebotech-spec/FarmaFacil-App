# Cartel QR A4 — plantilla Canva integrada

## Asset
`public/images/posters/pharmacy-qr-a4.png`  
Export Canva alta resolución (**4419×6250** px). El diseño fijo no se redibuja en código.

## Zonas dinámicas (px sobre plantilla → fracción 0..1)

Medidas en fracciones relativas (mismas que el export 724×1024); píxeles equivalentes sobre 4419×6250:

| Zona | Píxeles HD (x, y, w×h) | Notas |
|------|---------------------|--------|
| Logo | `549, 171, 3320×317` | contain, centrado; sin logo → no se dibuja |
| Nombre (con logo) | `305, 513, 3809×293` | 1–2 líneas, auto-tamaño 18→9 pt |
| Nombre (sin logo) | `305, 195, 3809×610` | aprovecha cabecera |
| QR | `2777, 4651, 1373×1392` | interior de la caja blanca + quiet zone 4 % |

Config: `lib/pharmacies/pharmacy-qr-poster-layout.ts`  
`pdfDownloadEnabled: **false**` hasta aprobación visual.

## QR
URL canónica: `https://app.farmafacil.solutions/e/{publicId}`  
Nunca localhost/staging.

## Revisión local
```bash
node scripts/generate-pharmacy-qr-poster-review.mjs
```
Salida gitignored: `public/_review_clients_qr/` (+ copia en `~/Desktop/farmafacil-cartel-review/`).

## Checklist post-aprobación
- [ ] OK visual de Pilar
- [ ] `pdfDownloadEnabled: true`
- [x] PNG alta resolución 4419×6250 integrado
