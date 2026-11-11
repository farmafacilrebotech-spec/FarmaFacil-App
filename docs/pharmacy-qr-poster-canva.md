# Cartel QR A4 — integración plantilla Canva

## Enfoque
1. Diseñar el cartel completo en **Canva** (A4 vertical).
2. Exportar **PNG de alta resolución** (recomendado ≥ 2480×3508 px ≈ 300 dpi).
3. La app **solo** inserta:
   - Nombre real de la farmacia
   - QR de `https://app.farmafacil.solutions/e/{publicId}`

No rediseñar el cartel en TypeScript/jsPDF.

## Dónde colocar el asset
```
public/images/posters/pharmacy-qr-a4.png
```
(crear la carpeta al añadir el fichero; no hay PNG inventado en el repo).

## Qué hay que indicar al integrar
Medidas en **milímetros** desde la esquina superior izquierda de la hoja A4 (210×297):

| Zona | Campos en `PHARMACY_QR_POSTER_LAYOUT` |
|------|----------------------------------------|
| Nombre | `name.rect` `{ x, y, w, h }`, `fontSizePt`, `color`, `align`, `fontStyle`, `configured: true` |
| QR | `qr.rect` `{ x, y, w, h }`, `configured: true` |
| Fondo | `backgroundSrc: '/images/posters/pharmacy-qr-a4.png'` |

Archivo de config: `lib/pharmacies/pharmacy-qr-poster-layout.ts`.

## Checklist al recibir el Canva
- [ ] PNG A4 en `public/images/posters/pharmacy-qr-a4.png`
- [ ] Coordenadas nombre (mm) y estilo tipográfico acordados
- [ ] Coordenadas caja QR (mm); dejar margen blanco suficiente en la plantilla o en la zona
- [ ] `configured: true` en nombre y QR
- [ ] Probar descarga desde «QR de mi farmacia» con nombre largo
- [ ] Escanear QR del PDF → URL canónica de producción

## Mientras tanto
- PNG/SVG del QR siguen disponibles.
- PDF responde con mensaje de plantilla pendiente.
- PR #23 permanece en draft hasta aprobación visual del Canva integrado.
