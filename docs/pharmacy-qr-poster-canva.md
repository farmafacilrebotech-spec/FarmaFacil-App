# Cartel QR A4 — plantilla Canva integrada

## Asset
`public/images/posters/pharmacy-qr-a4.png`  
Export Canva alta resolución (**4419×6250** px). El diseño fijo no se redibuja en código.

## Composición dinámica

Dos rectángulos **independientes** medidos desde la anotación de referencia
(724×1024 → escala ≈6.1036 sobre HD 4419×6250), entre las líneas turquesa:

| Zona | Píxeles HD | Notas |
|------|------------|--------|
| Logo (roja) | `275, 177, 604×610` | Solo logo, contain centrado; vacía si no hay logo |
| Nombre (verde) | `983, 177, 3180×623` | Solo nombre; **no se mueve** si falta logo |
| QR | `2777, 4651, 1373×1392` | Interior caja blanca + quiet zone 4 % |

Layout: `lib/pharmacies/pharmacy-qr-poster-layout.ts`  
Helpers: `lib/pharmacies/pharmacy-qr-poster-compose.ts` (contain + contraste)  
`pdfDownloadEnabled: **false**` hasta aprobación visual.  
Las guías rojo/verde **nunca** van al PDF final (solo script A/B de revisión).

### Logo
- Fuente: `pharmacy_branding.logo_url`
- `contain` dentro de `logoRect` (+ margen interior)
- Sin logo → zona roja vacía
- Fallo de carga → error explícito

### Nombre
- Siempre en `nameRect` (zona verde)
- Color primario si contraste ≥ 3; si no, `#0B0B0B`
- Máx. 2 líneas; auto-tamaño

### QR
URL canónica: `https://app.farmafacil.solutions/e/{publicId}`  
Nunca localhost/staging.

## Revisión local
```bash
# Primero: validar zonas A (guías) vs B (limpio)
node scripts/generate-pharmacy-qr-poster-zone-ab.mjs

# Tras OK visual de zonas:
node scripts/generate-pharmacy-qr-poster-review.mjs
```
Salida gitignored: `public/_review_clients_qr/` (+ copia en `~/Desktop/farmafacil-cartel-review/`).

## Checklist post-aprobación
- [ ] OK visual de Pilar
- [ ] `pdfDownloadEnabled: true`
- [x] PNG alta resolución 4419×6250 integrado
- [x] Composición headerBand compartida
