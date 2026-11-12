# Manual de usuario — Emails corporativos (SuperAdmin)

**Estado:** pendiente de publicación (PR #25 · staging)  
**Actualizado:** 2026-11-12  
**Audiencia:** SuperAdmin Total  
**Versión app:** preview local / rama `feature/emails-phase-b-send`

Documento vivo destinado al Centro de ayuda (solo SA Total). No describe envíos masivos ni recepción IMAP (aún no disponible).

## Objetivo

Redactar, guardar y enviar correos corporativos 1:1; gestionar plantillas y borradores.

## Cómo acceder

Panel → **Emails** → menú lateral: Recibidos, Enviados, Borradores, Plantillas, Papelera, **Nuevo email**.

## Nuevo email

1. Pulse **Nuevo email**.
2. Elija **Plantilla** o **Sin plantilla**.
3. Seleccione remitente (**De**): 8 cuentas corporativas.
4. Complete Para / CC / CCO, asunto y cuerpo (editor con formato).
5. Active o desactive **Incluir firma** (no duplica firmas ya embebidas en plantillas).
6. Acciones: **Adjuntar**, **Enviar**, **Guardar borrador**, **Guardar como plantilla**, **Descartar** (envía el borrador a Papelera si existía).

No aparecen formularios jurídicos en la redacción; el backend sigue bloqueando comerciales sin habilitación.

## Plantillas

Listado único (sin grupos Sistema/Guardadas). Acciones por icono compacto (tooltip + `aria-label`):

| Icono | Acción | Efecto |
|-------|--------|--------|
| Send (turquesa) | Usar | Abre un correo nuevo con esa plantilla; no la modifica |
| Pencil | Editar | Editor de la plantilla original (mismo ID) |
| Copy | Duplicar | Crea plantilla independiente |
| Archive | Archivar / Restaurar | Archivadas no aparecen en el desplegable del compositor |
| Trash2 (rojo) | Eliminar | Confirma; no borra borradores vinculados |

**Nueva plantilla:** crea una plantilla desde cero (`/emails/compose?newTemplate=1`).

Títulos y asuntos se muestran completos (`line-clamp-2`; sin truncado forzado a una línea).

### Editar plantilla

Campos: nombre interno, remitente (para previsualizar firma), asunto, cuerpo WYSIWYG, Incluir firma.  
Botón **Guardar cambios** actualiza la plantilla existente.

## Borradores

- Listado filtrable por cuenta y búsqueda.
- Acciones por icono (mismo estilo que Plantillas):
  - **Pencil** — Abrir borrador (recupera asunto, cuerpo, destinatarios y adjuntos).
  - **Trash2** — Enviar a la papelera (confirmación; recuperable; no borra definitivamente).
- **Descartar** en el compositor también mueve a Papelera.

## Enviados

- Historial outbox filtrable por cuenta, estado y búsqueda.
- Acción por icono: **Eye** / **ChevronUp** — Ver u ocultar detalle (tipo, remitente interno, adjuntos, estado proveedor).

## Recibidos

Bandeja de entrada aún no conectada (fase IMAP posterior). Sin acciones de mensaje por ahora.

## Papelera

Borradores descartados. Acciones por icono:

| Icono | Acción | Efecto |
|-------|--------|--------|
| ArchiveRestore | Restaurar | Vuelve a Borradores |
| Trash2 (rojo) | Eliminar definitivamente | Confirmación; borrado irreversible |

## Errores frecuentes

- No poder abrir Borradores por error de serialización: corregido (títulos resueltos en servidor).
- Firma duplicada al usar plantilla con firma: desactivar «Incluir firma» o dejar la detección automática.
- Envío comercial bloqueado: esperado hasta Cartera de farmacias.

## FAQ

**¿Usar modifica la plantilla?** No. Solo **Editar** + Guardar cambios.  
**¿Archivar Lanzadera la quita del desplegable?** Sí.  
**¿Eliminar en Borradores borra el correo?** No: lo mueve a Papelera.  
**¿Se regeneran plantillas en cada despliegue?** No.
