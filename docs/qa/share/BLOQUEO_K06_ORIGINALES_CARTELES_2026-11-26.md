# BLOQUEO K06 — Originales aprobados de carteles (2026-11-26)

**Estado:** `pendiente_validacion_usuario` · **Bloqueo:** faltan los originales aprobados.

## Qué necesitamos

Los **PDF/PNG originales aprobados** (alta resolución, a sangre si aplica) de:

1. **Cartel de acceso QR** (Plantilla 1). Hoy se usa `public/images/posters/pharmacy-qr-a4.png` (HD 4419×6250). Confirmar que es el original definitivo o enviar el correcto.
2. **Cartel publicitario «farmacia en el bolsillo»** (Plantilla 2). Hoy está compuesto por código (`pharmacy-ad-poster.ts`) con el emblema FarmaFácil, captura `kiosk-search.png` dentro de un smartphone dibujado y el QR. **No es una réplica del original Canva**; es una aproximación programática.
3. Si existe, la **variante sin logo de farmacia** de cada cartel (si no, se mantiene la composición actual sin logo).

Sin estos archivos **no se rediseña ni se aproxima ningún elemento gráfico** (smartphone, tipografías, fotografías de producto, composición).

## Qué se ha hecho en K06 (solo defectos claros, sin rediseño)

- Emblema circular FarmaFácil recortado a círculo en el PDF (mismo criterio que `BrandLogo`: sin esquinas negras cuadradas). Aplica al cartel publicitario y al pack de bienvenida.
- Logo de farmacia en el cartel publicitario: ya no se deforma (ajuste *contain* con proporciones reales). Si falta o no se decodifica → variante sin logo, misma composición.
- Vista previa: pestaña nueva con el PDF completo (se reserva la pestaña de forma síncrona antes de generar para evitar el bloqueador de ventanas; fallback y aviso si aun así se bloquea). Imprimir usa el mismo mecanismo.
- Nombres de descarga descriptivos (`farmafacil-cartel-acceso-a4-<public_id>.pdf`…); un UUID nunca se usa como nombre (→ `farmacia`). El título de metadatos del PDF es descriptivo.
- **STAGING (coordinado con K07, prop `isStagingEnv`)**: nombre de archivo con sufijo `-PRUEBA-STAGING`, marca de agua diagonal «PRUEBA - STAGING» (dibujada bajo el QR para no afectar la lectura) y título de metadatos con la etiqueta. El QR de los carteles sigue siendo **siempre la URL de producción** (`isPrintSafePharmacyPublicUrl`).
- **A5 (148×210 mm)** añadido: las zonas del cartel QR están normalizadas y el publicitario escala uniformemente desde A4 (factor 148/210). Diferencia de proporción con A4/√2 ≈ 0,3 % (imperceptible). **Pendiente de validación visual del usuario**, y de contrastar con el original cuando llegue. El pack de bienvenida sigue en A4+A3.

## Límites conocidos / pendientes

- Logos de farmacia con fondo transparente y colores oscuros pueden perderse sobre el fondo negro del cartel publicitario (no se añade placa/halo: sería rediseño).
- La pestaña del visor PDF puede mostrar la URL `blob:` del navegador; el PDF descargado sí usa el nombre descriptivo.
- Tras recibir los originales: comparar píxel a píxel (A4) y reajustar zonas/escala si difieren.
