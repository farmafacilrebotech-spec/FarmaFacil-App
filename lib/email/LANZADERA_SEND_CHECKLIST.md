# Email Lanzadera — preparación final (pendiente de autorización)

**Estado:** plantilla visual aprobada · HTML Resend listo · **envío deshabilitado**  
(`LANZADERA_PRODUCT_SEND_ENABLED = false`, `sendEnabled: false`)

## Remitente (solo esta plantilla)

- From: `Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>`
- Reply-To: `pilar@farmafacil.solutions`
- **No** se modifica `EMAIL_FROM` global (`contacto@…`).

## Assets HTTPS (HTML de envío)

| Asset | URL | Estado |
|-------|-----|--------|
| Logo | `https://www.farmafacil.solutions/images/logo/farmafacil-logo.png` | OK 200 |
| Icono QR | `https://app.farmafacil.solutions/images/kiosk/kiosk-qr.png` | OK 200 |
| Icono kiosko | `https://app.farmafacil.solutions/images/kiosk/kiosk-search.png` | OK 200 |
| Icono IA | `https://app.farmafacil.solutions/images/kiosk/kiosk-ai.png` | OK 200 |
| Foto firma | `https://www.farmafacil.solutions/images/email/firma-pilar.png` | **404 — pendiente** |

## Publicación de la fotografía (sin ejecutar)

La web corporativa `www.farmafacil.solutions` es un proyecto **aparte** (Vercel):

- Repo local: `Desktop/Proyectos/Web_Farmafácil`
- Remote: `github.com/farmafacilrebotech-spec/farmafacil`
- Logo actual vive en `public/images/logo/`

**Opción recomendada (solo foto, sin tocar FarmaFacil-App):**

1. Copiar `FarmaFacil-App/public/images/email/firma-pilar.png`  
   → `Web_Farmafácil/public/images/email/firma-pilar.png`
2. Commit + push **solo** en el repo de la web corporativa (autorización tuya).
3. Esperar deploy Vercel de ese sitio.
4. Verificar: HTTP **200** + `Content-Type: image/png` en la URL preferida.

**No recomendado aquí:** deploy de la app Next.js (`app.farmafacil.solutions`) solo para esta foto.

**No hay** en este entorno un mecanismo de subida aislada (CLI Vercel no disponible / sin credenciales de upload puntual) que publique el PNG sin un deploy del sitio corporativo.

## Prueba de envío (preparada, no ejecutada)

```ts
import { sendLanzaderaTestEmail } from '@/lib/email/lanzadera-outreach';
// (también reexportado desde @/lib/email/lanzadera-send)

// Tras tu autorización + foto en 200 + LANZADERA_PRODUCT_SEND_ENABLED=true:
await sendLanzaderaTestEmail({
  to: 'TU_DIRECCION@ejemplo.com',
  authorizeSend: true,
  confirmPhrase: 'LANZADERA_TEST_SEND',
});
```

Hasta entonces la función responde `code: 'disabled'` o `not_authorized`.

## Qué falta para enviar

1. Tu autorización para publicar la foto en la web corporativa.
2. Confirmación HTTP 200 de la URL de la foto.
3. Tu autorización para poner `LANZADERA_PRODUCT_SEND_ENABLED = true`.
4. Dirección de prueba que indiques.
5. (Opcional) confirmación de que `pilar@` recibe respuestas.
6. Autorización final para enviar a Lanzadera.

## Vista previa SuperAdmin

`/emails/lanzadera`
