# Registro PR → pruebas y evidencias

**Actualizado:** 2026-11-12  
**Regla:** no marcar `publicado_produccion` ni `validado_usuario` sin evidencia y registro explícito.

| PR | Commit tip (aprox.) | Módulo | Evidencia documental | Estado documental |
|----|---------------------|--------|----------------------|-------------------|
| #13 | `344b53c` | Pedidos QR etiquetas | INC-QR-001/002 + capturas prod | `publicado_produccion` (etiquetas) |
| #21 | ver GO publication | Proveedores + inventario | `docs/releases/pr21-go-nogo-*.md` · smokes staging | `prueba_tecnica_ok` (staging); validación usuario / matriz pendientes |
| #22 | ver GO | UI planes/tarifas | `docs/releases/pr22-go-nogo.md` | `prueba_tecnica_ok` / GO condicional UI |
| #23 | ver GO | Clientes QR / carteles | `docs/releases/pr23-go-nogo.md` + capturas + TC-CLI/FAR E2E-F | Parcial: E2E-F `validado_usuario`/`publicado`; resto ciclo pedido `pendiente` |
| #24 | `9a445dd` (merge main) | Activación planes comerciales | `docs/releases/commercial-plans-activation-go-nogo.md` | En `main`; casos matriz + manual **faltan** → no cerrar como validado en plan |
| #25 | rama `feature/emails-phase-b-send` | Emails corporativos | `docs/releases/emails/*` · `evidencias/emails-pr25/` | `en_desarrollo` / `prueba_tecnica_ok` local; **sin push**; pendiente validación usuario |

## Casos ya en matriz con evidencia (extracto)

| ID | Estado matriz | Evidencia |
|----|---------------|-----------|
| TC-CLI-003 | Correcta | capturas login/cuenta prod |
| TC-CLI-030 | Correcta | pedido #0011 vinculado |
| TC-CLI-031 | Correcta | invitado #0013 |
| TC-CLI-032 | Correcta | Mis pedidos etiquetas |
| TC-FAR-020 | Correcta | panel farmacia pedido |

## Casos a crear (pendientes de alta en CSV)

| ID propuesto | Módulo | PR | Estado inicial |
|--------------|--------|----|----------------|
| TC-SA-SUP-* | Proveedores | #21 | `prueba_tecnica_ok` o `pendiente` según evidencia por caso |
| TC-SA-INV-* | Inventario kioskos | #21 | idem |
| TC-SA-TAR-* | Tarifas / planes | #22/#24 | `pendiente` |
| TC-EML-001… | Emails compositor/plantillas/firmas | #25 | `prueba_tecnica_ok` (staging) tras validar checklist en `_review_emails` |

## Emails PR #25 — checklist técnico observado (staging :3040)

Fuente: `evidencias/emails-pr25/test-results.json` + capturas.

- Listado único plantillas + Sin plantilla  
- Archivo quita del desplegable  
- 8 remitentes  
- Sin UI legal en compositor  
- Breadcrumbs ES  
- Sin firma duplicada en Lanzadera  
- Confirmación al cambiar remitente  
- Comercial bloqueado sin ack (política)

**Validación de usuario:** pendiente. **Producción:** no.
