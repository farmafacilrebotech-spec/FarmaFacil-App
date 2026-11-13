# Manual — Promoción de lanzamiento 2027 (plazas)

**Estado:** pendiente de publicación · rama `feature/launch-seats-manage`  
**Actualizado:** 13/11/2026  
**Audiencia:** SuperAdmin Total  
**Centro de ayuda:** documentación viva (SA)

## Objetivo

Gestionar las **20 plazas** de la promoción de lanzamiento 2027 (−60 % sobre tarifa lista) sin duplicar contadores ni mezclarlas con el plan contratado.

## Dónde se gestiona

| Pantalla | Qué verá |
|----------|----------|
| Farmacias → Ficha → **Contrato** | Bloque «Promoción de lanzamiento 2027» con estado, fechas, cuota, acciones |
| **Contratos y suscripciones** | Resumen global (20 / reservadas / confirmadas / disponibles), listado e historial |

Ambas pantallas leen la misma fuente: `commercial_launch_cohort_counters` + `commercial_launch_seat_reservations`.

## Reservar

1. Abra la ficha de la farmacia → Contrato.  
2. Elija el plan asociado a la plaza (General / Personalizado / IA).  
3. Pulse **Reservar plaza**.  
4. No se creará una segunda plaza si ya hay una activa (idempotente).

También puede reservarse al **Cambiar plan** marcando el checkbox de promoción (flujo existente).

## Liberar

1. Con una plaza **reservada** (no confirmada), pulse **Liberar plaza**.  
2. Confirme e indique un **motivo** (obligatorio).  
3. Efectos: la plaza vuelve al pool. **No** se desactiva la farmacia, **no** se cambia el plan ni se cancela la suscripción.

Si la plaza está **confirmada / comprometida** (contrato firmado, factura o descuento bloqueado), la liberación simple está bloqueada: siga el procedimiento jurídico/comercial.

## Desactivar o suspender farmacia

Suspender o cancelar la suscripción **no libera** la plaza automáticamente. Si hay reserva pendiente, el panel lo avisa y debe liberarse de forma explícita.

## Permisos

Solo **SuperAdmin Total** puede reservar o liberar plazas.
