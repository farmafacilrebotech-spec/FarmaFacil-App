# Bloque Clientes + QR (PR #23) — cierre funcional y seguridad

Estado: **funcional y seguridad de Clientes cerrados en staging**.  
Cartel PDF comercial: **pendiente de plantilla Canva** (no se diseña en código).

## Clientes (cerrado)

### Alcance
- Listado y ficha de clientes con pedidos vinculados a **esa** farmacia vía `pharmacy_orders.customer_profile_id`.
- No es el directorio “Mis farmacias” del consumidor.
- Rutas tenant: `/f/{id}/clientes` y `/f/{id}/clientes/[customerProfileId]`.

### Roles
| Rol | Clientes | QR imprimible |
|-----|----------|---------------|
| Owner / Admin | Sí | Sí |
| Farmacéutico | Sí | No |
| STAFF | No (UI + gate RSC) | No |

Gates: `roleCanViewPharmacyClients` / `roleCanManagePharmacyQr` + `requirePharmacyClientsAccess` / `requirePharmacyQrAccess`.

### Datos
- Agregación solo desde pedidos de la farmacia activa (RLS + filtro `pharmacy_id`).
- Preferencia de lectura: RPC `ff_list_pharmacy_linked_clients_v1` / detalle con gate de rol.
- Fallback a `SELECT` directo si las RPC no existen (entornos sin el SQL de staging).

### Seguridad STAFF (staging)
Problema: con `GRANT SELECT` de tabla, STAFF podía leer `customer_profile_id` por PostgREST y enumerar UUIDs.

Corrección documentada en `docs/migrations/`:
1. `staging_staff_hide_customer_profile_id_v1.sql` — RPCs + helper de rol.
2. `staging_staff_hide_customer_profile_id_v1b.sql` — `REVOKE` SELECT de tabla + `GRANT` por columnas **sin** `customer_profile_id`.
3. Notas: `staging_staff_hide_customer_profile_id_NOTES.md`.

Pedidos de STAFF siguen operativos (no seleccionan esa columna).  
**Producción:** este endurecimiento **no** está aplicado; no desplegar desde este PR sin decisión explícita.

### Tests
- `npm run test:pharmacy-clients`
- Validado en staging: Owner/Admin/Farmacéutico/STAFF, aislamiento entre farmacias.

## QR (parcialmente cerrado)

### Cerrado
- Pantalla `/f/{id}/qr` (Owner/Admin).
- URL canónica de impresión: `https://app.farmafacil.solutions/e/{publicId}` (`pharmacyPrintPublicUrl` / `isPrintSafePharmacyPublicUrl`).
- Descargas **PNG** y **SVG** del QR (sin plantilla Canva).
- Rechazo de localhost / staging en artefactos de impresión.

### Pendiente (Canva)
- PDF A4 = PNG de fondo (export Canva) + superposición dinámica de:
  1. Logo de la farmacia (`pharmacy_branding.logo_url`, contain; sin logo → no marcador)
  2. Nombre real de la farmacia (auto-tamaño, 1–2 líneas)
  3. QR real de la URL pública canónica
- Código preparado en:
  - `lib/pharmacies/pharmacy-qr-poster-layout.ts` (zonas relativas 0..1 + `pdfDownloadEnabled`)
  - `lib/pharmacies/pharmacy-qr-poster-fit.ts` / `pharmacy-qr-poster.ts`
- **PNG Canva no recibido aún** → zonas `configured: false`.
- Descarga PDF del panel **desactivada** hasta aprobación visual (`pdfDownloadEnabled: false`).
- **No** inventar plantilla ni coordenadas a ciegas.
- Instrucciones: `docs/pharmacy-qr-poster-canva.md`.

## Fuera de alcance de este PR
- Merge / deploy / migraciones en producción.
- Mezcla con PR #21 / #22.
- Diseño definitivo del cartel (Canva, fuera de repo hasta export).
