# Nota · Plantilla 1 (Cartel acceso A5): zonas personalizables

Fecha: 2026-11-27 · Rama `fix/qa-material-pack-cierre-2026-11-27`

- El original `Cartel_01` (`cartel-acceso-qr-a5.png`, 1747×2481 px, A5 a 300 dpi)
  **no tiene huecos para logo ni nombre de la farmacia**. Solo se personaliza
  el **QR** (zona normalizada x 0,3543 · y 0,4095 · w 0,2942 · h 0,2023,
  quiet zone ≈ 4 %).
- El **flyer A6** (`flyer-acceso-qr-a6.png`) sí lleva **logo + nombre + QR**.
- El **cartel publicitario** (A4/A3) lleva logo + nombre + QR; los placeholders
  grises del original se tapan con relleno opaco antes de dibujar.
- Si se quiere logo/nombre en el cartel A5, hace falta un nuevo diseño con esos
  huecos (decisión de diseño pendiente; no se improvisa sobre el original).

## Pliego de 10 flyers

Un A6 (105×148 mm) cabe 2×2 en un A4 (210×297 mm), no 2×5. Los 10 flyers se
imprimen a tamaño real A6 en **3 páginas A4** (4 + 4 + 2) con guías de corte
hairline. Pendiente de confirmación de producto si se prefiere otra
disposición.

## Estado

`prueba_tecnica_ok` (tests de layout/URL/pliego); `pendiente_validacion_usuario`
(revisión visual de los PDFs en staging). No publicado en producción.
