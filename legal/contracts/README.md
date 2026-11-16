# Contratos FarmaFácil

## Plantilla maestra (única)

- Código versionado: `v1/master-template.ts` (`FF-MARCO-v1`)
- Estructura: `docs/contratos/fuentes/Contrato_Marco_FarmaFacil_Seleccion_Plan.docx`
- Condiciones de modalidad: Catálogo / Catálogo+IA / Completo+kiosco en `docs/contratos/fuentes/`
- Generador único: `lib/contracts/` (preview + PDF desde la misma plantilla)
- Importes: solo del snapshot del presupuesto aceptado (nunca de las tablas Word)

## Estado jurídico y ReBoTech

Actualizar `STATUS.json` solo tras confirmación explícita:

1. `legalApproval: "approved"` cuando jurídico apruebe la plantilla.
2. `rebotech.entityConfirmed: true` y todos los campos legales de ReBoTech cuando la sociedad esté constituida y los datos confirmados.

Hasta entonces: borradores y vista previa sí; firma y emisión definitiva no.

## Separados (no entran en el generador comercial)

- Piloto: `piloto/` + fuente `01_Contrato_Piloto_FarmaFacil.docx`
- Anexo de Encargo de Tratamiento: `anexo-encargo/` + fuente `05_Anexo_Encargo_Tratamiento_FarmaFacil.docx`

## Borradores legacy

`drafts/*.md` quedan obsoletos; el motor usa solo la plantilla maestra v1.
