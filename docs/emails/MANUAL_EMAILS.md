# Manual de usuario — Emails corporativos (SuperAdmin)

**Estado:** publicado en producción (PR #25) · aceptación manual pendiente  
**Actualizado:** 12/11/2026  
**Audiencia:** SuperAdmin Total  
**Versión app:** `main` post-PR #25 · https://app.farmafacil.solutions/emails  
**Fuera de alcance:** recepción IMAP

Documento vivo destinado al Centro de ayuda (solo SA Total). No describe envíos masivos ni recepción IMAP.

## Objetivo

Redactar, guardar y enviar correos corporativos 1:1; gestionar plantillas y borradores.

## Cómo acceder

Panel → **Emails** → menú lateral: Recibidos, Enviados, Borradores, Plantillas, Papelera, **Nuevo email**.

## Nuevo email

1. Pulse **Nuevo email**.
2. Elija **Plantilla** o **Sin plantilla**.
3. Seleccione remitente (**De**): cuentas corporativas autorizadas (en fase controlada puede estar limitada por configuración).
4. Complete Para / CC / CCO, asunto y cuerpo (editor con formato).
5. Active o desactive **Incluir firma** (no duplica firmas ya embebidas en plantillas).
6. Acciones: **Adjuntar**, **Enviar**, **Guardar borrador**, **Guardar como plantilla**, **Descartar** (envía el borrador a Papelera si existía).

No aparecen formularios jurídicos en la redacción; el backend sigue bloqueando comerciales sin habilitación (Cartera).

### Envíos en fase controlada (producción)

- Solo usted realiza el envío (botón **Enviar**); no hay envíos automáticos ni masivos.
- Destinatarios restringidos a la allowlist de prueba configurada en el servidor.
- Comercial no autorizado permanece bloqueado.
- Tras enviar: revise **Enviados** (aceptación Resend) y su bandeja Gmail.

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
  - **Pencil** — Abrir borrador.
  - **Trash2** — Enviar a la papelera (confirmación; recuperable).
- **Descartar** en el compositor también mueve a Papelera.

## Enviados

- Historial outbox filtrable por cuenta, estado y búsqueda.
- Acción por icono: **Eye** / **ChevronUp** — Ver u ocultar detalle (tipo, remitente interno, adjuntos, estado proveedor / id Resend cuando exista).

Estados relevantes:

| Etiqueta | Significado |
|----------|-------------|
| Enviado a Resend | Proveedor aceptó el mensaje (`provider_message_id`) |
| Entregado | Webhook de entrega (si está configurado) |
| Error / Rebotado / Bloqueado | Fallo o rechazo |

## Papelera

Borradores descartados; se pueden restaurar o eliminar de forma definitiva según la UI.

## Firmas

- **Incluir firma** en correos sin plantilla: opcional.
- Plantillas con firma embebida (p. ej. Lanzadera): el sistema **no duplica** la firma gestionada.
- Al cambiar el remitente, la firma gestionada se actualiza a la identidad de esa cuenta (si aplica).

## FAQ

**¿Puedo enviar a cualquier destinatario?** En fase controlada, solo a cuentas de la allowlist de prueba.  
**¿Hay recepción en Recibidos?** IMAP queda fuera de esta publicación.  
**¿Se copian borradores de staging?** No.
