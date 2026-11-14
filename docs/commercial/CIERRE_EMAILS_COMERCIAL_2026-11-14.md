# Cierre Emails + Comercial — 2026-11-14

## Correcciones realizadas (Emails :3065)

1. **Bloqueo comercial manual eliminado** — El envío 1:1 ya no exige Cartera/ack/base legal. Queda aviso informativo no bloqueante.
2. **Selector Cartera** — Botón «Seleccionar de Cartera de farmacias» + diálogo/buscador. Integración preparada; **sin datos inventados** (tabla Cartera aún no disponible).
3. **Pérdida de contenido de plantillas** — Causa raíz: `contentEditable` destruía el HTML tabular al teclear. Solución: plantilla en bloque `contenteditable=false` + nota opcional editable; al enviar se antepone la nota sin tocar el diseño.
4. **Estados** — Detalle proveedor ya no duplica «Aceptado por Resend» junto al historial.
5. **Firmas/imágenes** — Se mantiene `provider-html` + assets HTTPS públicos (`www` / `app.farmafacil.solutions`).

## Causa raíz (plantillas)

El compositor cargaba el HTML corporativo completo en un `contentEditable` libre. Al escribir (p. ej. «3065»), el DOM del navegador colapsaba tablas/estructura; el payload a Resend quedaba en nota + firma. Gmail ocultaba el pie tras «…» (clipping).

## Comercial :3060 (ajustes finales)

- Tarjeta plaza: **Confirmar plaza** (turquesa) + **Liberar plaza** (secundario turquesa).
- Confirmación vía `ff_confirm_launch_seat_v1` (no piloto / no plan / no cobros).
- Economía 2027/2028/2029 desde motor.
- «Reservada por» con fallback a `profiles`.
- Historial de eventos en castellano.
- PDF presupuesto ↔ Emails: registro `email_sends` best-effort **tras** Resend OK; fallo de registro **no** reenvía.

## Migraciones

| Ámbito | Números | Estado |
|---|---|---|
| Emails | 090 | En worktree emails (sin conflicto con 091+) |
| Comercial | 091–096 | Aplicadas en staging |

Sin migraciones nuevas en este cierre Emails. Numeración compatible: Emails ≤090, Comercial ≥091.

## Ramas / commits base

| Preview | Rama | Commit base |
|---|---|---|
| :3065 | `fix/emails-postprod-signatures-sent` | `53e0512` (+ cambios locales sin commit) |
| :3060 | `feature/launch-seats-manage` | `3c6ac70` (+ cambios locales; ahead 1) |

**No hay PR nuevas creadas en este cierre.** Commits exactos de integración: pendientes de commit/aprobación.

## Orden de integración propuesto

1. Merge Emails (`090` + composer/policy) → main staging.
2. Merge Comercial (`091–096` + UI) → main staging.
3. Validación manual conjunta :3060 + :3065.
4. Producción solo tras aprobación expresa.

## Rollback

- Código: revert de merges de rama.
- SQL: no revertir 091–096 en caliente sin plan; 090 Emails es aditiva.

## Pendientes reales

- Validación manual Emails (Lanzadera/piloto + nota «3065», asuntos únicos).
- Validación plaza Confirmar/Liberar en ficha.
- Envío presupuesto + comprobar Emails > Enviados (registro best-effort).
- Cartera: modelo de autorizaciones aún no existe.
- Typecheck: errores previos ajenos (`pdf-parse`, `jspdf` tipings, `downlevelIteration`).
- **No desplegar a producción** hasta aprobación.
