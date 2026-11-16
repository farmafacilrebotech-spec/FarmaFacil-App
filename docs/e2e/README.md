# FarmaFácil — Playwright E2E (staging)

## Requisitos

- Servidor integrado en **3070** (`integration/farmafacil-release`).
- Supabase staging `dazfdcjscnpfvhcyjddt`.
- Node 20+.

## Credenciales

```bash
npm run test:e2e:prepare
```

Escribe `.env.e2e.local` (gitignored) y fija `E2E_PASSWORD` en cuentas de laboratorio.
**No** usar producción. **No** commitear el archivo.

## Comandos

```bash
# Batería crítica P0 (24 tests — regresión permanente)
npm run test:e2e:p0

# Batería P1 (comercial, emails, catálogos, kioskos, ayuda, …)
npm run test:e2e:p1

# Completa (P0 + P1 + responsive/webkit)
npm run test:e2e:full

# Un archivo
npx playwright test e2e/p0/auth-roles.spec.ts --project=chromium-p0
```

Informe consolidado: `docs/releases/integration/INFORME_P0_P1_20261116.md`.

## Informes

- HTML: `playwright-report/`
- JSON: `tmp/e2e-results.json`
- Traces/screenshots: `test-results/` (solo fallos)

## CI (propuesta)

1. Job `e2e-staging` con secrets `E2E_PASSWORD` + anon URL staging.
2. Arrancar `next start` o preview 3070.
3. `npm run test:e2e:p0`.
4. Subir `playwright-report` como artefacto.
5. **No** apuntar a producción.

## Alcance manual restante

Safari iPhone físico, PWA HTTPS, QR impreso, kiosko Android, tickets, emails reales, PDF visual.
