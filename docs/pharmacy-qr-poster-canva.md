# Cartel QR A4 — plantilla Canva integrada

## Asset
`public/images/posters/pharmacy-qr-a4.png`  
Export Canva alta resolución (**4419×6250** px). El diseño fijo no se redibuja en código.

## Composición dinámica

Logo y nombre se reparten dentro de un **contenedor común** (`headerBand`) entre las dos líneas turquesa (~y 145..840).

| Zona | Píxeles HD | Notas |
|------|------------|--------|
| Header band | `280, 145, 3859×695` | Contenedor logo+nombre |
| QR | `2777, 4651, 1373×1392` | Interior caja blanca + quiet zone 4 % |

Lógica: `lib/pharmacies/pharmacy-qr-poster-compose.ts`  
Layout: `lib/pharmacies/pharmacy-qr-poster-layout.ts`  
`pdfDownloadEnabled: **false**` hasta aprobación visual.

### Logo
- Fuente: `pharmacy_branding.logo_url`
- `contain` (nunca cover/stretch); sin fondo/marco
- Horizontal → más ancho; circular/cuadrado → más alto
- Recorte seguro de márgenes transparentes excesivos
- Sin logo → zona vacía y nombre con más protagonismo
- Fallo de carga → error explícito (no se genera cartel “correcto”)

### Nombre
- Color primario del branding si contraste ≥ 3 sobre blanco; si no, `#0B0B0B`
- Máx. 2 líneas; tamaño según longitud y slot
- Sin logo: tipografía hasta 20 pt, centrado en el band

### QR
URL canónica: `https://app.farmafacil.solutions/e/{publicId}`  
Nunca localhost/staging.

## Revisión local
```bash
node scripts/generate-pharmacy-qr-poster-review.mjs
```
Salida gitignored: `public/_review_clients_qr/` (+ copia en `~/Desktop/farmafacil-cartel-review/`).  
Genera 9 variantes + `comparativa-9-variantes.png` + `ejemplo-cartel-a4.pdf`.

## Checklist post-aprobación
- [ ] OK visual de Pilar
- [ ] `pdfDownloadEnabled: true`
- [x] PNG alta resolución 4419×6250 integrado
- [x] Composición headerBand compartida
