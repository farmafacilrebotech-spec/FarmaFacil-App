# Incidencias de prueba — FarmaFácil

Registro documental. Sin modificar producción desde este documento.

## INC-QR-001 — Etiqueta de estado en Mis pedidos

| Campo | Valor |
|---|---|
| **ID** | INC-QR-001 |
| **Detectada** | 03–04/11/2026 (pedido #0011, Farmacia Pruebas) |
| **Entorno** | Producción `https://app.farmafacil.solutions` |
| **Síntoma** | Mis pedidos mostraba `Request_pending` en lugar de «Pendiente de confirmar». |
| **Casos** | TC-CLI-032 · TC-CLI-030 |
| **Corrección** | PR #13 · commit `344b53c` |
| **Evidencia antes** | [historico/SCR-CLI-010_mis_pedidos_0011_antes_correccion.png](../manuales/capturas/historico/SCR-CLI-010_mis_pedidos_0011_antes_correccion.png) |
| **Evidencia preview rama** | [historico/SCR-CLI-010_mis_pedidos_0011_corregido_preview_rama.png](../manuales/capturas/historico/SCR-CLI-010_mis_pedidos_0011_corregido_preview_rama.png) |
| **Verificación producción** | [cliente/SCR-CLI-010_mis_pedidos_0011_prod.png](../manuales/capturas/cliente/SCR-CLI-010_mis_pedidos_0011_prod.png) — «Pendiente de confirmar» |
| **Estado** | **Resuelta en producción** |

## INC-QR-002 — Importe no confirmado como euros

| Campo | Valor |
|---|---|
| **ID** | INC-QR-002 |
| **Detectada** | 03–04/11/2026 (#0011) |
| **Síntoma** | 9,95 € con `amount_confirmed_at IS NULL`. |
| **Esperado** | «Importe pendiente de confirmar». |
| **Corrección** | Misma PR #13 |
| **SQL anonimizado** | [sql/SQL-0011_vinculado_anonimizado.txt](evidencias/sql/SQL-0011_vinculado_anonimizado.txt) |
| **Verificación producción** | Misma captura Mis pedidos #0011 |
| **Estado** | **Resuelta en producción** |

## Fuera de alcance

Valoración, confirmación de importe por farmacia, preparación, cobro y entrega: pendientes de prueba (no son estas INC).
