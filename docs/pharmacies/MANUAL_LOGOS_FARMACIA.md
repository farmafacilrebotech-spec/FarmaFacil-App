# Manual de usuario — Logos de farmacia (SuperAdmin)

**Estado:** validación visual del listado **aprobada** · PR independiente pendiente de merge/deploy  
**Actualizado:** 2026-11-12  
**Audiencia:** SuperAdmin con `platform.pharmacies.write`  
**Rama:** `fix/pr23-pharmacy-list-logos`

## Objetivo

Ver y gestionar el logo de cada farmacia en el panel. El logo alimenta la ficha, el listado, el selector de farmacia y el cartel QR.

## Preview local (validación)

Para ver el listado con logos reales (staging):  
http://127.0.0.1:3050/farmacias  

No usar el puerto `:3040` (módulo Emails / otra rama).

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
3. Suba, reemplace o elimine el logo (PNG / JPEG / WebP, límite documentado en UI).
4. Tras guardar, el listado `/farmacias` y el dashboard se actualizan (revalidación de servidor).

## Permisos

- **Solo SuperAdmin** autorizado puede subir, reemplazar o eliminar logos.
- Owner / Admin / Farmacéutico / STAFF: no pueden modificar el logo (solicitud escrita → SA).
- Los colores y mensajes de branding operativo siguen las reglas de rol existentes (no confundir con identidad).

## FAQ

**¿Sin logo qué se muestra?** Iniciales sobre el color de la farmacia.  
**¿Si la URL del logo falla?** Se vuelve a iniciales automáticamente.  
**¿El cartel QR usa el mismo logo?** Sí, `pharmacy_branding.logo_url`.
