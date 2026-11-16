# Límites de cobertura P1 (baseline 8961c23)

**Ninguna prueba P1 usa mocks de red/API** (`page.route`, stubs de fetch, MSW, etc.). Todas hablan con la app real en **3070** + **staging**.

La limitación no es “mock”: es **profundidad** (navegación + aserciones de UI / copy / permisos, sin mutaciones destructivas ni hardware).

## Clasificación por archivo

| Archivo | Tests | Tipo predominante | Limitación |
|---------|------:|-------------------|------------|
| `commercial.spec.ts` | 7 | UI real + textos + tabs; interacción leve en simulador | No reserva/libera plaza; no asigna plan; no genera PDF assert binario |
| `contracts.spec.ts` | 2 | UI + ausencia/bloqueo de firma definitiva | No firma jurídica real; no PDF contractual binario |
| `emails.spec.ts` | 5 | Navegación hub/compose/plantillas; fill asunto opcional | **No envía** email; no valida adjunto en Resend; no assert MIME |
| `catalogs-promotions.spec.ts` | 4 | Rutas + textos; denegación farmacéutico a maestro | No importación masiva; promos puede ser placeholder UI |
| `suppliers-inventory-kiosks.spec.ts` | 4 | **Sobre todo smoke de ruta/UI** | No empareja kiosko físico; no muta inventario; IA sin conversación completa |
| `help-posters.spec.ts` | 2 | Ayuda + pantalla QR/carteles; check anti-prod en copy | No descarga/assert PDF; no imprime |
| `customer-platform-access.spec.ts` | 3 | Seguridad real (denegación `/farmacias`) | Cubre gating, no el circuito completo (eso es P0) |

## Resumen

- **Mocks:** no.
- **Solo navegación / smoke UI:** proveedores, inventario SA, dispositivos, asistente IA, parte de emails/ayuda/promos.
- **Más que navegación (copy/reglas/permisos):** comercial (plazas/pilotos/contratación), contratos (firma bloqueada), acceso cliente vs `/farmacias`, denegación catálogo maestro.
- **Fuera de P1 (manual / futuro):** envío email real, PDF binario, reserva plaza con side-effects, pairing kiosko, tickets, PWA install, Safari iPhone.

P0 sigue siendo la batería de **flujos mutativos** (pedido, carrito, Mis farmacias, RLS, roles).
