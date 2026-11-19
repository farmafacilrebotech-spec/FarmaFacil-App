# PRE-05D — Correcciones de presentación (2026-11-19)

## Alcance

Presentación del presupuesto corporativo tras recepción real validada de F0TQ. Sin nuevo envío real. Dry-run restaurado.

## Correcciones

| Área | Cambio |
|---|---|
| Paginación PDF | CSS A4 fijo (`height/max-height: 297mm`, `overflow: hidden`, tipografía más compacta). F0TQ = **2 páginas** (antes 3 con pie huérfano). |
| Tabla cuotas | Cabecera `Importe` (implantación mantiene `Importe neto`). |
| Etiquetas | `Coste recurrente anualizado sin IVA` / `Coste recurrente anualizado con IVA`. |
| Logo | `farmafacil-mark.png` (recurso oficial plateado/turquesa). CSS `border-radius: 50%`. Sin SVG simplificado. |
| Correo | Logo oficial en cabecera (`www…/images/logo/farmafacil-logo.png`). Vigencia `DD/MM/AAAA`. Cuerpo breve + PDF adjunto. |

## Envío real previo (sin repetir)

| Campo | Valor |
|---|---|
| Presupuesto | `FF-PRE-20261118-F0TQ` |
| Estado comercial | **Enviado** |
| Destinatario | `pruebas@farmafacil.solutions` |
| Resend id | `01a1ee59-ce8c-7d05-8a86-570d83a372cf` |
| Enviado | 2026-11-18 11:10:26 UTC |

## Evidencia PDF

`docs/commercial/evidencias/PRE05D-F0TQ-corregido.pdf` (2 páginas A4).

## Pruebas

- Unit quotes/PDF/HTML: **14/14**
- Unit email comercial: **2/2**
- Unit commercial-ui: **34/34**
- E2E `commercial-quote-pdf` + EMAIL-10 circuito: **6/6**
- Entorno: `:3070` · `commercial_dry=1` · `corporate_dry=1`
