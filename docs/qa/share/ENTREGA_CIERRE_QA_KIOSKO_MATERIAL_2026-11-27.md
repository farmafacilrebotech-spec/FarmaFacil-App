# Entrega consolidada — Cierre QA kiosko y material publicitario

**Fecha:** 2026-11-27  
**Rama de trabajo:** `fix/qa-material-pack-cierre-2026-11-27` (`8f4a8d4`)  
**Integración STAGING:** `integration/farmafacil-staging-2026-11-24` (`9ce8eb1`)  
**URL STAGING:** https://farmafacil-staging.vercel.app  

---

## 1. Rama y commit

- Fix: `8f4a8d4` — `fix/qa-material-pack-cierre-2026-11-27`  
- Integración: `9ce8eb1` — merge en `integration/farmafacil-staging-2026-11-24`

Incluye: pack publicitario con originales, logo ticket monocromo, APK 0.2.15-staging, K02–K07 consolidados.

---

## 2. Despliegue STAGING

| Estado | Detalle |
|--------|---------|
| Código | Empujado a GitHub en rama de integración |
| BD staging | Migración **105** (`pharmacy_order_access_tokens` + RPCs) **aplicada y verificada** |
| Vercel | **Pendiente de tu acción:** el CLI no tiene token válido (`vercel login` o Redeploy en dashboard del proyecto `farmafacil-staging`) |

**Acción exacta para desbloquear Vercel**

1. En el Mac: `cd` al worktree y `npx vercel login` (o regenerar token en Vercel → Settings → Tokens).  
2. O bien: Vercel Dashboard → proyecto **farmafacil-staging** → Deployments → Redeploy del commit de `integration/farmafacil-staging-2026-11-24`.  
3. Confirmar que `FF_APP_ENV=staging` y las variables Supabase staging siguen apuntando a `dazfdcj…`.

No se ha desplegado producción.

---

## 3. Migraciones

| Migración | Contenido | Staging |
|-----------|-----------|---------|
| **105_kiosk_order_access_token_v1.sql** | Tokens opacos `/o/{token}` + create order con PVP 0 | Aplicada |
| Colisión 105 ciclo de vida kioskos | **No existe** en el repo ninguna otra 105 de unlink/lifecycle | OK |

---

## 4. Pruebas

| Suite | Resultado |
|-------|-----------|
| `npm run test:pharmacy-qr` (71) | OK |
| `npm run test:kiosk-catalog-display` | OK |
| `npx tsc --noEmit` | OK |
| Android `:app:testStagingDebugUnitTest` | OK |
| Android `assembleStagingDebug` | OK |
| E2E Playwright completo | No reejecutado en este cierre (suite previa verde en integración) |

---

## 5. Material publicitario

### Originales (no modificados)

`docs/qa/share/Referencias_Corporativas/Material_Publicitario/`

### Plantillas implementadas

| Plantilla | Original | Formato | Personalización |
|-----------|----------|---------|-----------------|
| 1 Acceso mostrador | `Cartel_01_Acceso_QR_A5.pdf` | A5 | **Solo QR** (el original no tiene huecos de logo/nombre de farmacia) |
| 2 Flyer | `Flyer_01_Acceso_QR_A6.png` | A6 + pliego A4 | Logo + nombre + QR |
| 3 Publicitario | `Cartel_02_Publicitario_A3.pdf` | A4 o A3 | Logo + nombre + QR (placeholders grises cubiertos) |

**Nota Plantilla 1:** documentada en `NOTA_PLANTILLA1_ACCESO_A5_ZONAS_2026-11-27.md`. Si se requiere logo/nombre en el cartel A5, hace falta arte editable con huecos.

**Pliego 10 flyers:** A6 real = 105×148 → caben **4 por hoja A4** → **3 páginas** (4+4+2) con guías de corte. No se reduce el flyer a caber 10 en una sola hoja.

**STAGING:** materiales usan QR de pruebas por defecto + marca **PRUEBA — STAGING**. QR oficial de producción sigue disponible aparte. `public_id` intacto.

### Pack de bienvenida

1× A5 acceso + pliego 10 flyers + 1× cartel publicitario (A4/A3 elegido).

### Muestras generadas

- Carpeta repo: `docs/qa/share/ENTREGA_MUESTRAS_MATERIAL_2026-11-27/` (PDFs headless + `previews/` + `ticket-logo/`)  
- Escritorio: `/Users/pilar/Desktop/FarmaFacil-Muestras-Material/`  
- Los PDF headless pueden ser pesados; en navegador STAGING se usan JPEG ~300 dpi (`*-print.jpg`) → PDFs mucho más ligeros.

---

## 6. APK TEST

| Campo | Valor |
|-------|--------|
| Archivo a copiar al pendrive | **`FarmaFacil-TEST-0.2.15-staging.apk`** |
| Ubicación 1 | `/Users/pilar/Desktop/FarmaFacil-APK-TEST/FarmaFacil-TEST-0.2.15-staging.apk` |
| Ubicación 2 | `docs/qa/share/ENTREGA_APK_TEST/FarmaFacil-TEST-0.2.15-staging.apk` |
| Package | `solutions.farmafacil.kiosk.staging.debug` |
| versionName | `0.2.15-staging-debug` |
| URL | `https://farmafacil-staging.vercel.app/k` |
| Firma | Debug (instalable por USB sin ADB) |

Instalar **sin** desinstalar producción ni tocar su vinculación.

---

## 7. Logo ticket (comparación)

| Recurso | Uso |
|---------|-----|
| `Logo_FarmaFacil_Ticket_Monocromo.svg` | Referencia maestra |
| `Logo_FarmaFacil_Ticket_Monocromo.png` | Raster corporativo (sin alpha Canva) |
| `ff_ticket_logo.png` (512 B/W) | Activo en APK (umbral puro B/N) |
| `ff_ticket_logo_prev.png` | Respaldo del logo anterior |

Previews: `ENTREGA_MUESTRAS_MATERIAL_2026-11-27/ticket-logo/`

K02 se mantiene: sin texto FARMAFÁCIL bajo el logo, nº grande, pendientes, un mensaje de pago, QR `/o/{token}`, eslogan.

---

## 8. Incidencias resueltas en este cierre

- Originales corporativos integrados (A5 / A6 / A3–A4)  
- Pack bienvenida = 12 piezas lógicas (1+10+1)  
- UI SuperAdmin tres plantillas + pliego + pack  
- QR staging por defecto en materiales de prueba  
- Logo monocromo térmico  
- APK 0.2.15 compilada  
- Mig 105 verificada sin colisión  

---

## 9. Bloqueos reales pendientes (acciones tuyas)

1. **Redeploy Vercel staging** (login/token o dashboard).  
2. **OPENAI_API_KEY en Vercel → farmafacil-staging** (Environment Staging), valor **distinto de producción**, sin pegarlo en el repo.  
   - Después: en SA → farmacia **TEST Fase7** → entitlement asistente demo/contrato con límite mensual bajo (p. ej. 50).  
   - Consultas farmacéutico: OFF salvo prueba explícita → UI «Acércate al mostrador».  
3. **Instalar APK** por pendrive y validar ticket físico.  
4. **Opcional Plantilla 1:** si quieres logo/nombre en cartel A5, aportar PDF/Canva editable con huecos.  
5. **Medicamentos fuera de canales públicos** — sigue bloqueante pre-lanzamiento (otra línea de catálogo).  
6. **No contratar** consumo OpenAI de pago sin tu OK explícito.

---

## 10. Checklist aceptación manual (reducido)

### Web STAGING (tras redeploy)
- [ ] Login SA → Farmacia Fase7 → QR  
- [ ] Tres plantillas: preview (pestaña limpia), PDF, imprimir  
- [ ] Pliego 10 flyers (3 hojas A4)  
- [ ] Pack bienvenida  
- [ ] Material con marca PRUEBA — STAGING y QR staging  
- [ ] QR producción PNG/SVG sigue disponible aparte  
- [ ] Catálogo/kiosko web: precio 0 → Consultar precio / Pendiente valoración  
- [ ] Pedido kiosko web → ticket con QR `/o/…`  

### Kiosko físico (APK 0.2.15)
- [ ] Un solo banner STAGING  
- [ ] Ticket: logo nuevo, sin FARMAFÁCIL bajo logo, QR escaneable  
- [ ] Precios pendientes coherentes  
- [ ] Asistente: textos correctos; con clave OpenAI responde; sin clave mensaje claro  

---

## 11. Acciones exactas que debes hacer tú

1. Redeploy **farmafacil-staging** (Vercel).  
2. Añadir `OPENAI_API_KEY` (y opcional `OPENAI_MODEL=gpt-4o-mini`) solo en Staging.  
3. Copiar `FarmaFacil-TEST-0.2.15-staging.apk` al pendrive e instalar en K2101.  
4. Generar/imprimir muestras desde la UI SA y contrastar con originales.  
5. Escanear QR de ticket y de carteles de prueba.  
