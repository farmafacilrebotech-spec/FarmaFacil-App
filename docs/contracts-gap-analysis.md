# Contratos FarmaFácil — estado post-implementación

Estado: **2026-10-31**. Sin despliegue. Worktree `feature/commercial-contracts-v1`.

## Arquitectura

- **Plantilla maestra única:** `legal/contracts/v1/master-template.ts` (`FF-MARCO-v1`)
- **Estructura:** `docs/contratos/fuentes/Contrato_Marco_FarmaFacil_Seleccion_Plan.docx`
- **Modalidades:** condiciones de `02` Catálogo, `03` Catálogo+IA, `04` Completo+kiosco
- **Generador:** `lib/contracts/` (preview + PDF)
- **Piloto** y **Anexo de Encargo:** separados (`legal/contracts/piloto/`, `legal/contracts/anexo-encargo/`)
- **Importes:** solo snapshot del presupuesto aceptado (`v` + referencia)

## Gates

| Acción | ReBoTech pendiente | Jurídico pendiente | Marcadores/campos vacíos |
|---|---|---|---|
| Guardar / consultar borrador | permitido | permitido | permitido |
| Vista previa (BORRADOR) | permitido | permitido | permitido |
| PDF borrador (marca BORRADOR) | permitido | permitido | permitido |
| PDF firmable / emisión definitiva | **bloqueado** | **bloqueado** | **bloqueado** |
| Firma | **bloqueado** | **bloqueado** | **bloqueado** |
| Email | solo si Resend configurado; «enviado» solo con id del proveedor | adjunta borrador si no listo | adjunta borrador |

Aceptar presupuesto **no** firma ni activa el servicio.

## Campos que siguen pendientes

### ReBoTech (bloquean firma / definitiva)

- Razón social exacta confirmada (`STATUS.rebotech.legalName` / `FF_LEGAL_NAME`)
- CIF (`FF_CIF`)
- Domicilio (`FF_LEGAL_ADDRESS`)
- Representante + DNI/NIE + cargo
- `STATUS.rebotech.entityConfirmed = true` (y/o `FF_REBOTECH_LEGAL_CONFIRMED=true`)

### Jurídico

- `STATUS.json` → `legalApproval: "approved"` tras revisión

### Operativos (completar antes de firma)

- Soporte: `[completar antes de firma]`, `[canal]`
- Vigencia: duración, renovación, preaviso, subsanación
- Activación, forma de pago inicial, día de cargo
- Kiosco (si Completo): modelo, serie, estado, entrega/ubicación, devolución

### Farmacia (ficha / pantalla Contratos)

- legal_name, CIF, dirección
- Representante, NIF, cargo (captura en UI; aún no hay columnas BD dedicadas)

### Anexo Encargo

- Documento independiente; muchos `[●]` en la fuente; fuera del generador comercial
