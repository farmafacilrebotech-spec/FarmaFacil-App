# Gate de validación obligatorio (post-baseline)

Aplica a **cualquier corrección** sobre `integration/farmafacil-release` tras el tag `farmafacil-staging-validated-20261116`.

## Suites permanentes

| Suite | Comando | Uso |
|-------|---------|-----|
| P0 | `npm run test:e2e:p0` | Regresión crítica siempre |
| P1 | `npm run test:e2e:p1` | Si el cambio toca comercial/emails/catálogos/kioskos/IA/ayuda/carteles/proveedores |
| Responsive | `npm run test:e2e:responsive` | Si toca layout / shell / mobile |
| Global | `npm run test:e2e:full` | **Obligatorio antes de publicar** |

Atajo local:

```bash
npm run validate:release
```

(`scripts/validate-release.sh` — prepare + full contra 3070)

## Orden recomendado tras un fix

1. Arrancar/verificar 3070 (`FF_3070_MODE=prod` / daemon).
2. `npm run test:e2e:prepare`
3. Ejecutar suite afectada; si hay fallo, corregir y repetir.
4. Re-ejecutar **P0** (siempre) + suites relacionadas.
5. `npm run test:e2e:full` antes de cualquier publicación.
6. Conservar HTML/JSON en `playwright-report/` y `tmp/e2e-results.json`.

## CI

Workflow: `.github/workflows/e2e-staging.yml`

- Disparo: `workflow_dispatch` y pull_request hacia ramas `integration/**` (cuando exista PR).
- Apunta **solo** a staging (`dazfdcjscnpfvhcyjddt`).
- **Nunca** producción.
- Secrets requeridos (GitHub): ver comentarios del workflow.

Hasta que los secrets CI estén cargados, el gate local `validate:release` es la fuente de verdad operativa.

## Fuera de alcance del gate automático

Hardware, PWA HTTPS físico, QR impreso, tickets, email real, PDF visual — checklist en `MANUAL_TEST_KIT_20261116.md`. No sustituyen las 56 E2E.
