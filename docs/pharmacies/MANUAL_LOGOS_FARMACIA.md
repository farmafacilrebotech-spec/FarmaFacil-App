# Manual de usuario — Logos de farmacia (SuperAdmin)

**Estado:** **publicado en producción**  
**Versión:** `5d61f8b` (PR #26)  
**Actualizado:** 12/11/2026  
**URL:** https://app.farmafacil.solutions  
**Audiencia:** SuperAdmin con `platform.pharmacies.write`

## Objetivo

Ver y gestionar el logo de cada farmacia en el panel. El logo alimenta la ficha, el listado, el selector de farmacia y el cartel QR.

## Dónde se ve

| Pantalla | Comportamiento |
|----------|----------------|
| `/farmacias` (listado) | Logo real o iniciales si no hay logo / falla la imagen |
| `/farmacias/[id]` → General | Logo en cabecera |
| `/farmacias/[id]` → Personalización | Vista previa + gestión (subir / reemplazar / eliminar) |
| Dashboard (últimas farmacias) | Mismo criterio que el listado |
| Selector de farmacia (cabecera) | Usa `logo_url` si está disponible |

Las imágenes se muestran con **proporciones originales** (`object-contain`), sin recortar ni estirar.

## Cómo cambiar el logo

1. Abra la ficha de la farmacia.
2. Vaya a **Personalización**.
3. Suba, reemplace o elimine el logo (PNG / JPEG / WebP, máx. 2 MB).
4. Tras guardar, el listado `/farmacias` y el dashboard se actualizan (revalidación de servidor).

## Permisos

- **Solo SuperAdmin** autorizado puede subir, reemplazar o eliminar logos.
- Owner / Admin / Farmacéutico / STAFF: no pueden modificar el logo (solicitud escrita → SA).
- Los colores y mensajes de branding operativo siguen las reglas de rol existentes (no confundir con identidad).

## FAQ

**¿Sin logo qué se muestra?** Iniciales sobre el color de la farmacia.  
**¿Si la URL del logo falla?** Se vuelve a iniciales automáticamente.  
**¿El cartel QR usa el mismo logo?** Sí, `pharmacy_branding.logo_url`.
