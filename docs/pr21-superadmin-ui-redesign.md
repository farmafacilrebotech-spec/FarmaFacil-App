# SuperAdmin UI — listados + modales

## Publicación (sin merge/deploy)

| Ámbito | PR | Commit |
|--------|----|--------|
| Proveedores + Inventario + Compras kioskos | [#21](https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/21) | `42cad24` |
| Suscripción + planes comerciales | [#22](https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/22) (base: rama PR #21) | `a1d03e5` |

## Preview local

http://127.0.0.1:3021/proveedores · http://127.0.0.1:3021/inventario-kioskos · http://127.0.0.1:3021/farmacias/[id] (Contrato; requiere checkout PR #22)

## Riesgos

- Planes General/Personalizado/IA pueden aparecer «no asignable» si no hay filas activas en `plans` (borrador 056 / catálogo técnico).
- RPC `ff_change_pharmacy_plan_v1` puede seguir limitado a claves legacy en DB; la UI no inventa filas ni migra farmacias.
- Activos KSK «Pendiente de identificar» no se reasignan automáticamente a otros estados.
- No se aplicaron migraciones en producción.
