# Recorridos E2E

**Baseline:** `origin/main` (PR #13 / `344b53c`).  
**Plan:** [PLAN_MAESTRO_PRUEBAS.md](PLAN_MAESTRO_PRUEBAS.md) · **Matriz:** [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv) · **Incidencias:** [INCIDENCIAS.md](INCIDENCIAS.md)  
**Capturas:** [../manuales/capturas/README.md](../manuales/capturas/README.md) · **SQL:** [evidencias/sql/](evidencias/sql/)

Anonimizar siempre nombre, teléfono y correo en documentación pública (versiones redactadas en `capturas/cliente|farmacia`; originales en `evidencias/interno`).

---

## E2E-A … E2E-E

Sin cambio de estado respecto al cierre E2E-F (A/C/D/E no ejecutados o parciales; B parcial). Detalle histórico en commits previos del plan.

---

## E2E-F — Creación y vinculación de solicitudes QR

| | |
|---|---|
| **Alcance SUPERADA** | Creación y vinculación autenticado vs invitado |
| **Fuera de alcance** | Valoración, confirmación importe, preparación, cobro, entrega, TC-CLI-033 |
| **Casos** | TC-CLI-003, TC-CLI-030, TC-CLI-031, TC-CLI-032, TC-FAR-020 |
| **Estado** | **SUPERADA** (2026-11-05) |

### E2E-F-POS-VINC — #0011 «Usar mis datos»

Evidencias:

- [confirmacion_0011](../manuales/capturas/cliente/SCR-PUB-002_confirmacion_0011_prod.png)
- [mis_pedidos_0011](../manuales/capturas/cliente/SCR-CLI-010_mis_pedidos_0011_prod.png)
- [panel_farmacia_0011](../manuales/capturas/farmacia/SCR-FAR-002_pedido_0011_panel_prod.png)
- [SQL-0011](evidencias/sql/SQL-0011_vinculado_anonimizado.txt)

### E2E-F-NEG-INV — #0013 invitado

Evidencias:

- [confirmacion_0013](../manuales/capturas/cliente/SCR-PUB-002_confirmacion_invitado_0013_prod.png)
- [mis_pedidos_sin_0013](../manuales/capturas/cliente/SCR-CLI-010_mis_pedidos_sin_0013_prod.png)
- [detalle_farmacia_0013](../manuales/capturas/farmacia/SCR-FAR-002_detalle_pedido_invitado_0013_prod.png)
- [SQL-0013](evidencias/sql/SQL-0013_invitado_anonimizado.txt)

---

## E2E-G — Acceso multifarmacia (EN CURSO · 2026-11-05)

| | |
|---|---|
| **Caso matriz** | TC-FAR-073 (reutiliza invitación TC-FAR-070; aislamiento TC-ISO-003) |
| **Pantallas** | SCR-AUTH-007 · SCR-AUTH-008 · SCR-FAR-002 |
| **Estado** | **EN CURSO** — no SUPERADA |
| **Observado** | Invitación pending Empleado a Farmacia Pruebas Producción; tras aceptar, selector con Farmacia Total PRO (OWNER) + Pruebas Producción (Empleado); Pedidos de Total PRO sin mezclar otras (UI) |
| **Pendiente** | Cambio a 2ª farmacia; restricciones rol Empleado; aislamiento servidor/RLS; incorporar PNG |
| **Capturas reservadas** | `SCR-FAR-MULTI-001…004` (sin archivos todavía) |

---

## Registro

| Recorrido | Fecha | Resultado | Evidencia |
|---|---|---|---|
| E2E-F (creación/vinculación) | 2026-11-05 | **SUPERADA** | cliente/farmacia/historico + sql |
| E2E-F-POS-VINC | 2026-11-05 | SUPERADA | #0011 |
| E2E-F-NEG-INV | 2026-11-05 | SUPERADA | #0013 |
| E2E-G multifarmacia | 2026-11-05 | **EN CURSO** | nombres MULTI reservados; PNG pendientes |

## Siguiente oleada

1. Cerrar E2E-G / TC-FAR-073 (capturas + pendientes)  
2. Valoración de precios / líneas  
3. Confirmación de importe  
4. Preparación → listo → entrega  
5. Cobro  
6. TC-CLI-033 token invitado 
