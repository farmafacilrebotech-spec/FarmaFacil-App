# Cartel QR A4 — plantilla Canva integrada

## Asset
`public/images/posters/pharmacy-qr-a4.png`  
Export Canva (724×1024 px en la entrega actual). El diseño fijo no se redibuja en código.

## Zonas dinámicas (px sobre plantilla → fracción 0..1)

Medidas sobre la cabecera blanca entre líneas turquesa (y≈22..139) y la caja QR blanca.

| Zona | Píxeles (x, y, w×h) | Notas |
|------|---------------------|--------|
| Logo | `90, 28, 544×52` | contain, centrado; sin logo → no se dibuja |
| Nombre (con logo) | `50, 84, 624×48` | 1–2 líneas, auto-tamaño 18→9 pt |
| Nombre (sin logo) | `50, 32, 624×100` | aprovecha cabecera |
| QR | `455, 762, 225×228` | interior de la caja blanca (pad ~10 px del borde turquesa) + quiet zone 4 % |

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
- [ ] (Opcional) sustituir PNG por export ≥ 2480×3508 si se quiere más nitidez de impresión
