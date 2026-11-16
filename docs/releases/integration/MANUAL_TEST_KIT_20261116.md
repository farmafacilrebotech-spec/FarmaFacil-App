# Kit de pruebas manuales — baseline 2026-11-16

**No repetir** las 56 pruebas E2E ya en verde. Solo lo no automatizable / hardware / HTTPS.

Tag: `farmafacil-staging-validated-20261116` · Commit: `8961c23` · App: **3070** · DB: staging.

## URLs locales (LAN)

| Uso | URL |
|-----|-----|
| Login | http://127.0.0.1:3070/login |
| LAN Mac | http://192.168.1.16:3070/login |
| QR / catálogo Fase7 | http://127.0.0.1:3070/e/2mo6cq0yjss6ratr |
| Mis farmacias (cliente) | http://127.0.0.1:3070/cuenta/mis-farmacias |
| Tarifas (SA) | http://127.0.0.1:3070/tarifas |
| Contratos (SA) | http://127.0.0.1:3070/contratos |
| Emails inbox (SA) | http://127.0.0.1:3070/emails/inbox |
| Ayuda | http://127.0.0.1:3070/ayuda |
| QR/carteles tenant | http://127.0.0.1:3070/f/98ea2742-5b57-4271-8448-b132cae70598/qr |
| Dispositivos | http://127.0.0.1:3070/f/98ea2742-5b57-4271-8448-b132cae70598/dispositivos |
| Asistente | http://127.0.0.1:3070/f/98ea2742-5b57-4271-8448-b132cae70598/asistente |
| Panel `/farmacias` (solo SA; cliente = denegado) | http://127.0.0.1:3070/farmacias |

## HTTPS PWA (pruebas, no producción)

```bash
npm run https:pwa
# o: bash scripts/https-pwa-tunnel.sh
```

Lee la URL vigente en `tmp/https-pwa.url` (subdominio `*.trycloudflare.com`). **Cambia en cada arranque** del túnel; no es hostname estable ni producción.

Comprobado operativo el 2026-11-16 (HTTP 200 vía Quick Tunnel → `:3070`). Si ves Cloudflare **530**, reinicia el túnel (`kill $(cat tmp/https-pwa.pid)` + `npm run https:pwa`).

Usar esa base para: instalar PWA, Safari iPhone, escanear QR apuntando al host HTTPS.

## Farmacias de laboratorio

| Alias | Nombre | UUID | publicId |
|-------|--------|------|----------|
| Fase7 | TEST Fase7 QR Requests 20261021 | `98ea2742-5b57-4271-8448-b132cae70598` | `2mo6cq0yjss6ratr` |
| Staging1 | Farmacia Staging 1 | `187c908e-1f21-4db9-92f4-eae0e79ad2a2` | `91dntkqzz29hscvt` |

## Usuarios (password vía `npm run test:e2e:prepare` → `E2E_PASSWORD` en `.env.e2e.local`)

| Rol | Email |
|-----|-------|
| SuperAdmin | `emails.sa.075-emails-stage@farmafacil.test` |
| Propietario | `catalog.owner.074@farmafacil.test` |
| Administrador | `catalog.admin.074@farmafacil.test` |
| Farmacéutico | `catalog.pharmacist.074@farmafacil.test` |
| Empleado | `catalog.staff.074@farmafacil.test` |
| Cliente A | `cliente.test3070@farmafacil.test` |
| Cliente B | `lab.cliente.b.clientsqr@farmafacil.test` |
| Outsider | `catalog.outsider.074@farmafacil.test` |

No commitear contraseñas. Regenerar con `npm run test:e2e:prepare` antes de la sesión manual.

## Checklist manual reducida

1. Safari iPhone físico → LAN o HTTPS túnel  
2. Instalación PWA (requiere HTTPS)  
3. Escaneo QR impreso (URL HTTPS o LAN estable)  
4. Kiosko Android físico / emparejamiento  
5. Impresión/corte tickets  
6. Recepción real de un email de laboratorio (asunto/links staging)  
7. Revisión visual PDF carteles / presupuestos / contratos  

## Pedidos históricos (solo lectura)

`#0029`, `#0033`, `#0034`, `#0035` — no modificar.
