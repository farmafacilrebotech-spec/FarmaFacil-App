# Baseline congelado — FarmaFácil staging validated

| Campo | Valor |
|-------|--------|
| Tag | `farmafacil-staging-validated-20261116` |
| Commit | `8961c237bdf5523690066fb62f4dd3b529ac30e0` |
| Fecha | 2026-11-16 |
| Resultado E2E | **56/56 PASS** (P0 24 + P1 27 + Responsive/webkit 5) |
| Puerto app | **3070** (`next start`) |
| DB | staging `dazfdcjscnpfvhcyjddt` |
| Producción | **no tocada** |
| `main` | **sin merge** |
| Nuevas funcionalidades | **congeladas** |

## Regla de publicación (obligatoria)

Cualquier corrección posterior a este baseline **debe**:

1. Pasar la batería de regresión correspondiente (mínimo **P0** si el cambio toca auth/pedidos/RLS/catálogo cliente; **P0+P1** si toca módulos P1).
2. Pasar la ejecución global `npm run test:e2e:full` antes de publicar.
3. No desplegar a producción ni mergear a `main` sin gate verde.

Procedimiento: `docs/releases/integration/VALIDATION_GATE.md`.

## Evidencias

- AgentStores: `e2e-evidence-20261116-8961c23/`
- Puntero repo: `docs/releases/integration/evidence-20261116/`
- Informe P0+P1: `docs/releases/integration/INFORME_P0_P1_20261116.md`

## Respaldos

- Staging dump: AgentStores `integration-backups-20261116/staging/public_full.dump` (+ schema/data)
- Git bundle / refs: `integration-backups-20261116/`

## HTTPS PWA (pruebas)

Tunnel Cloudflare Quick Tunnel → `:3070`. Ver `docs/releases/integration/MANUAL_TEST_KIT_20261116.md` y `tmp/https-pwa.url` cuando el túnel esté activo. **No es producción.**
