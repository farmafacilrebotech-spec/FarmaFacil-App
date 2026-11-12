# Capturas de pantalla — estructura definitiva

**Actualizado:** 2026-11-05

## Árbol canónico

```
docs/manuales/capturas/
  cliente/          # Versiones para documentación (PII redactado si aplica)
  farmacia/         # Idem
  historico/        # Antes de corrección INC / preview de rama
  FarmaFacil_Evidencias_Pruebas_QR/   # Pack origen (conservado; no borrar aún)
  kiosko/           # Assets / desarrollo (no E2E pedidos)

docs/pruebas/evidencias/
  sql/              # SQL anonimizado (#0011, #0013)
  interno/capturas/ # Originales únicos CON datos personales (solo equipo)
```

## Inventario E2E QR (contenido único)

| Destino público | SCR (INDICE) | Pedido / nota | PII público |
|---|---|---|---|
| `cliente/SCR-CLI-006_login_cliente_prod.png` | SCR-CLI-006 | Login | Redactado |
| `cliente/SCR-CLI-005_cuenta_farmacia_prod.png` | SCR-CLI-005 | Mi cuenta | Redactado |
| `cliente/SCR-PUB-002_catalogo_qr_prod.png` | SCR-PUB-002 | Catálogo | OK |
| `cliente/SCR-PUB-002_carrito_prod.png` | SCR-PUB-002 | Carrito | OK |
| `cliente/SCR-PUB-002_resumen_elegir_modalidad_prod.png` | SCR-PUB-002 | Resumen · Usar mis datos / invitado | OK |
| `cliente/SCR-PUB-002_elegir_usar_datos_o_invitado_prod.png` | SCR-PUB-002 | Elección modalidad | OK |
| `cliente/SCR-PUB-002_formulario_vinculado_0011_prod.png` | SCR-PUB-002 | Formulario #0011 | Redactado |
| `cliente/SCR-PUB-002_confirmacion_0011_prod.png` | SCR-PUB-002 | Confirmación vinculada #0011 | OK |
| `cliente/SCR-PUB-002_confirmacion_invitado_0013_prod.png` | SCR-PUB-002 | Confirmación invitado #0013 | OK |
| `cliente/SCR-CLI-010_mis_pedidos_0011_prod.png` | SCR-CLI-010 | Mis pedidos #0011 (prod corregido) | OK |
| `cliente/SCR-CLI-010_mis_pedidos_sin_0013_prod.png` | SCR-CLI-010 | Mis pedidos sin #0013 | OK |
| `farmacia/SCR-FAR-002_pedido_0011_panel_prod.png` | SCR-FAR-002 | Panel #0011 | OK |
| `farmacia/SCR-FAR-002_detalle_pedido_invitado_0013_prod.png` | SCR-FAR-002 | Detalle #0013 | Redactado |
| `historico/SCR-CLI-010_mis_pedidos_0011_antes_correccion.png` | SCR-CLI-010 | INC-QR-001/002 | OK |
| `historico/SCR-CLI-010_mis_pedidos_0011_corregido_preview_rama.png` | SCR-CLI-010 | Preview rama (no deploy) | OK |

**Capturas únicas por contenido:** 15  
**Duplicados detectados (SHA-256, no conservados como copia extra en destino):** 6 pares numerados `01_…` ↔ `SCR-…` antiguos.

### Multifarmacia (2026-11-05) — nombres reservados, PNG pendientes

No crear ni marcar como existentes hasta incorporar evidencia real. Pantallas INDICE: SCR-AUTH-007, SCR-AUTH-008, SCR-FAR-002 · caso **TC-FAR-073**.

| Nombre reservado | Destino previsto | Paso |
|---|---|---|
| `farmacia/SCR-FAR-MULTI-001_invitacion_pendiente.png` | SCR-AUTH-007 | Invitación pending Empleado |
| `farmacia/SCR-FAR-MULTI-002_selector_farmacias.png` | SCR-AUTH-008 | Selector con ambas farmacias/roles |
| `farmacia/SCR-FAR-MULTI-003_selector_panel.png` | SCR-AUTH-008 | Selector / panel post-aceptación |
| `farmacia/SCR-FAR-MULTI-004_pedidos_farmacia_activa.png` | SCR-FAR-002 | Pedidos solo de Farmacia Total PRO |

### Corrección de IDs SCR

Los nombres `SCR-CLI-003` (era login), `SCR-CLI-010` (era mi cuenta), `SCR-CLI-030/031/032` (eran TC) y `SCR-FAR-020` (era TC) **no** coincidían con [INDICE_PANTALLAS.md](../INDICE_PANTALLAS.md). Renombrados a SCR-CLI-006, SCR-CLI-005, SCR-PUB-002, SCR-CLI-010, SCR-FAR-002. **No** inventar IDs `SCR-*` nuevos sin fila en el índice: `SCR-FAR-MULTI-*` son **nombres de archivo de evidencia**, no pantallas del índice.

## SQL

| Archivo | Contenido |
|---|---|
| [`../pruebas/evidencias/sql/SQL-0011_vinculado_anonimizado.txt`](../../pruebas/evidencias/sql/SQL-0011_vinculado_anonimizado.txt) | #0011 vinculado |
| [`../pruebas/evidencias/sql/SQL-0013_invitado_anonimizado.txt`](../../pruebas/evidencias/sql/SQL-0013_invitado_anonimizado.txt) | #0013 invitado NULL profile |

## Interno (PII)

Originales sin redactar: `docs/pruebas/evidencias/interno/capturas/`.  
**Git:** el directorio `docs/pruebas/evidencias/interno/` está en `.gitignore` (no versionar).  
**No** enlazar rutas internas en materiales públicos ni incluir el pack PII en commits.

## Kiosko (no E2E pedidos)

`kiosko/referencia-assets/` · `kiosko/desarrollo/` (mockup / APK).
