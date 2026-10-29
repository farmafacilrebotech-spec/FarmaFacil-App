# Propuesta visual — catálogo digital FarmaFácil

**Estado:** iconos de las **8 categorías** del maestro integrados en el catálogo público QR
(`/e/[publicId]/catalogo`) vía `lib/catalog/category-icons.ts`. Los 12 SVG de `formats/`
siguen siendo solo propuesta de envases (no categorías).

## Cómo abrir la vista previa

1. Abre en el navegador el archivo:
   - `public/images/catalog-proposal/preview.html`
2. O, con un servidor estático desde la raíz del repo:
   ```bash
   npx --yes serve public/images/catalog-proposal -p 4177
   ```
   y visita `http://127.0.0.1:4177/preview.html`.

## Paleta usada

| Color | Hex | Uso |
|-------|-----|-----|
| Turquesa FarmaFácil | `#2EC4C7` | Forma principal |
| Gris oscuro (marca) | `#0F2A2E` | Acentos / contraste |
| Plateado | `#A8B5B8` | Secundario |

Referencia de marca en el proyecto: `public/images/logos/farmafacil-mark.svg`, pantallas kiosko (`#2EC4C7`).

## Iconos de categoría (`categories/`)

| Archivo | Uso previsto |
|---------|----------------|
| `cuidado-facial.svg` | Categoría cuidado facial |
| `cuidado-corporal.svg` | Cuidado corporal e higiene |
| `proteccion-solar.svg` | Protección solar |
| `higiene-bucodental.svg` | Higiene bucodental |
| `cuidado-capilar.svg` | Cuidado capilar |
| `bebe-maternidad.svg` | Bebé y maternidad |
| `primeros-auxilios.svg` | Primeros auxilios y cuidado en casa |
| `bienestar-estacional.svg` | Bienestar y cuidado estacional |

## Ilustraciones de formato (`formats/`)

Recursos genéricos reutilizables por tipo de envase / producto visual (sin marcas ni textos):

| Archivo | Uso previsto |
|---------|----------------|
| `botella.svg` | Botellas |
| `bote.svg` | Botes / tarros |
| `tubo.svg` | Tubos |
| `dosificador.svg` | Envases con dosificador / pump |
| `spray.svg` | Sprays |
| `caja.svg` | Cajas y paquetes |
| `aposito-venda.svg` | Apósitos y vendas |
| `termometro.svg` | Termómetro |
| `aparato-cuidado.svg` | Aparatos sencillos de cuidado en casa |
| `cepillo-bucodental.svg` | Cepillo y productos de higiene bucodental |
| `cuidado-infantil.svg` | Productos de cuidado infantil (forma lúdica neutra) |
| `higiene-menstrual.svg` | Productos de higiene menstrual (forma abstracta) |

## Convenciones técnicas

- SVG real, `viewBox="0 0 128 128"`, símbolo centrado.
- Fondo transparente (sin rectángulo de fondo a pantalla completa).
- Estilo plano, sin degradados, sombras ni 3D.
- No sustituyen los PNG de bienvenida del kiosko en `public/images/kiosk/`.

## Fuera de alcance de esta carpeta

- Integración en UI, base de datos, seeds o mapeo a categorías reales.
- Copias de marcas / envases / catálogos comerciales.
