# Staging — RLS identidad de farmacia (v1)

**Estado:** **APLICADO en staging** (2026-11-11). Ver staging_pharmacy_identity_rls_RESULTS.md  
**Proyecto:** `dazfdcjscnpfvhcyjddt`  
**SQL:** `staging_pharmacy_identity_rls_v1.sql` · rollback `…_DOWN.sql`  
**Prod (mismo contenido, tras OK staging):** ver sección «Producción» abajo.

Sustituye el draft estrecho `staging_pharmacy_branding_logo_sa_only_v1.sql` (no aplicar ese).

---

## 1. Auditoría (`branding.update` / `settings.update`)

### Asignación de permisos (roles farmacia)

| Permiso | Roles |
|---------|--------|
| `branding.update` | PHARMACY_OWNER, PHARMACY_ADMIN |
| `branding.view` | OWNER, ADMIN, PHARMACIST, STAFF |
| `settings.update` | OWNER, ADMIN, PHARMACIST |
| `settings.view` | OWNER, ADMIN, PHARMACIST, STAFF |

### Tablas / policies que los usan (únicas)

| Tabla | Policy | Permiso en USING/CHECK |
|-------|--------|-------------------------|
| `pharmacies` | `pharmacies_update` | `settings.update` **← hueco identidad** |
| `pharmacy_branding` | insert/update | `branding.update` **← hueco logo_url** |
| `pharmacy_settings` | insert/update | `settings.update` (ops + `visible_name`) |
| `pharmacy_assistant_settings` | insert/update | `settings.update` (**ops legítimo**) |

### RPC

Ninguna función en `public` referencia esos permission keys en su cuerpo.

### Actions app (ya SA-gated para identidad)

| Action | Tabla | Gate app |
|--------|-------|----------|
| `updatePharmacyGeneralAction` | `pharmacies` | `platform.pharmacies.write` |
| `updatePharmacyPersonalizationAction` | branding colores + settings | SA |
| `uploadPharmacyLogoAction` / `removePharmacyLogoAction` | Storage + `logo_url` | SA |

### Independiente (no usa estos permisos)

Pedidos, catálogo, stock / inventario kiosk, entitlements, entrypoints QR: policies propias. **No se modifican.**

### Grants tabla

`authenticated` tiene UPDATE amplio; la contención real es RLS (+ triggers propuestos). No se revocan grants globales (evitar romper PostgREST).

---

## 2. Campos protegidos vs operativos

### Identidad protegida — solo SuperAdmin (`platform.pharmacies.write`)

| Origen | Campos |
|--------|--------|
| `pharmacies` | `name`, `legal_name`, `cif`, `email`, `phone`, `web`, `address_line`, `postal_code`, `city`, `province`, `country`, `logo_color`, y resto de UPDATE de fila (status/plan/archivo también SA) |
| `pharmacy_branding` | `logo_url` |
| `pharmacy_settings` | `visible_name` (nombre comercial visible / kiosk) |

Cambio operativo de identidad: **solicitud escrita del titular → SuperAdmin.**

### Operativo — Owner/Admin (y Farm vía `settings.update` donde aplique)

| Origen | Campos / uso |
|--------|----------------|
| `pharmacy_settings` | `schedule`, `phone`, `whatsapp`, `email`, `timezone`, `extra`, `catalog_mode` |
| `pharmacy_assistant_settings` | nombre asistente, FAQs, horarios info, etc. |
| `pharmacy_branding` | `primary_color`, `secondary_color`, `accent_color`, `font_family`, `border_radius`, `welcome_message`, `kiosk_wallpaper_url` |

**No se revoca** `settings.update` ni `branding.update` del catálogo de roles: siguen haciendo falta para lo operativo.

---

## 3. Alcance del SQL (mostrar antes de autorizar)

| Objeto | Acción |
|--------|--------|
| `ff_enforce_pharmacy_branding_identity()` | CREATE OR REPLACE + trigger `BEFORE INSERT OR UPDATE OF logo_url` |
| `ff_enforce_pharmacy_settings_identity()` | CREATE OR REPLACE + trigger `BEFORE INSERT OR UPDATE OF visible_name` |
| Policy `pharmacies_update` | DROP + CREATE **solo** `platform.pharmacies.write` |

### Qué NO hace

- No altera Storage `pharmacy-logos` (ya aplicado).
- No borra `branding.update` / `settings.update` de `role_permissions`.
- No toca policies de `pharmacy_settings` / `pharmacy_assistant_settings` / colores branding.
- No escribe datos de negocio ni toca producción `gsnohwsvjxpjfcsstnfd`.

---

## 4. Plan de prueba (tras autorización)

Script: `scripts/staging-pharmacy-identity-rls-smoke.mjs`

1. Escrituras identidad directas: Owner, Admin, Farm, STAFF → **DENY**; SA → **ALLOW**.
2. Escrituras ops: Owner actualiza `pharmacy_settings.schedule` y (si aplica) colores branding → **ALLOW**.
3. Spot-check: membership/catálogo lectura + que policies de pedidos/stock no cambian.

---

## 5. Producción

Mismo SQL, archivo espejo a crear en publish:  
`docs/migrations/prod_pharmacy_identity_rls_v1.sql` (contenido idéntico + header prod + backup/PITR previo).

Orden publish PR #23 sugerido: Storage logos (si no en prod) → identity RLS → app.
