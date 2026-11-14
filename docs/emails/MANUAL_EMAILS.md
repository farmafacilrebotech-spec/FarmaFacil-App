# Manual de usuario — Emails corporativos (SuperAdmin)

**Estado:** PR #25 en producción · correcciones post-aceptación en curso (`fix/emails-postprod-signatures-sent`)  
**Actualizado:** 13/11/2026  
**Audiencia:** SuperAdmin Total  
**Versión app:** producción = `main` post-PR #25; correcciones en rama de fix (sin merge/deploy sin autorización)  
**Fuera de alcance:** recepción IMAP

Documento vivo destinado al Centro de ayuda (solo SA Total). No describe envíos masivos ni recepción IMAP.

## Objetivo

Redactar, guardar y enviar correos corporativos 1:1; gestionar plantillas, borradores y el historial de enviados como buzón de solo lectura.

## Cómo acceder

Panel → **Emails** → menú lateral: Recibidos, Enviados, Borradores, Plantillas, Papelera, **Nuevo email**.

## Nuevo email

1. Pulse **Nuevo email**.
2. Elija **Plantilla** o **Sin plantilla**.
3. Seleccione remitente (**De**): cuentas corporativas autorizadas (en fase controlada puede estar limitada por configuración).
4. Complete Para / CC / CCO, asunto y cuerpo (editor con formato).
5. Active o desactive **Incluir firma** (no duplica firmas ya embebidas en plantillas).
6. Acciones: **Adjuntar**, **Enviar**, **Guardar borrador**, **Guardar como plantilla**, **Descartar** (envía el borrador a Papelera si existía).

En el cuadro de confirmación de envío verá: destinatarios, asunto, adjuntos y **Firma: Sí / No** (con el nombre de la firma o «incorporada en la plantilla»).

No aparecen formularios jurídicos en la redacción; el backend sigue bloqueando **comerciales** sin habilitación (Cartera).

### Tipos de comunicación

| Tipo | Uso legítimo | Gates comerciales |
|------|--------------|-------------------|
| Operativa | Servicio / operativa interna | No |
| Institucional / Corporativa | Instituciones, aceleradoras, colaboradores (p. ej. Lanzadera) | No |
| Aprovisionamiento | Proveedores / imprentas (presupuesto) | No |
| Comercial | Marketing / prospección (demo, piloto) | Sí (Cartera + ack) |

Estos tipos **no** sirven para eludir restricciones de publicidad comercial.

### Envíos en fase controlada

- Solo usted realiza el envío (botón **Enviar** → **Confirmar**); no hay envíos automáticos ni masivos.
- Si Enviar está deshabilitado, el compositor muestra el motivo (flag de envío, Resend/`EMAIL_FROM`, allowlist).
- Destinatarios (Para / CC / CCO) restringidos a la allowlist de prueba del servidor.
- Comercial no autorizado permanece bloqueado.
- Tras enviar: revise **Enviados** («Aceptado por el proveedor» ≠ entregado) y su bandeja.
- El borrador asociado desaparece de **Borradores** tras un envío correcto.

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

### Editar plantilla

Campos: nombre interno, remitente (para previsualizar firma), asunto, cuerpo WYSIWYG, Incluir firma.  
Botón **Guardar cambios** actualiza la plantilla existente.

## Borradores

- Listado filtrable por cuenta y búsqueda.
- Acciones por icono (mismo estilo que Plantillas):
  - **Pencil** — Abrir borrador.
  - **Trash2** — Enviar a la papelera (confirmación; recuperable).
- **Descartar** en el compositor también mueve a Papelera.
- Tras envío correcto el borrador se marca consumido y **no** reaparece en Borradores ni Papelera.

## Enviados

- Historial outbox filtrable por cuenta, estado y búsqueda.
- Acciones por fila (estética alineada con Borradores/Plantillas):
  - **Eye** — Abrir el correo completo (solo lectura).
  - **Trash2** — Mover a Papelera (la auditoría se conserva).

### Detalle de un enviado

Muestra el snapshot inmutable del envío:

- Asunto, remitente, Para / CC / CCO, fecha y hora
- Cuerpo HTML final realmente enviado (no se reconstruye)
- Firma realmente enviada (Sí/No + nombre)
- Adjuntos originales descargables
- Tipo de comunicación, usuario que envió, estado de entrega

Si un envío antiguo no dispone del HTML final, la UI lo indica expresamente.

Estados relevantes:

| Etiqueta | Significado |
|----------|-------------|
| Pendiente de envío | Aún no aceptado por el proveedor |
| Aceptado por el proveedor | Resend aceptó el mensaje (`accepted`). **No** es entrega al buzón |
| Entregado | Solo con `delivered_at` / webhook (hoy **no** hay webhooks Resend en la app) |
| Error de envío / Rebotado / Bloqueado | Fallo o rechazo |

En el detalle, «Estado de entrega» y «Detalle proveedor» son campos distintos (no se duplica la misma etiqueta).

## Papelera

Dos secciones independientes:

1. **Borradores** — restaurar o eliminar definitivamente.
2. **Enviados** — restaurar a Enviados u ocultar de la vista del usuario (conserva auditoría y evidencias).

## Firmas

- **Incluir firma** en correos sin plantilla: opcional.
- Con firma marcada: el servidor aplica **exactamente una** firma del remitente con imágenes HTTPS públicas.
- Sin firma marcada: no se incluye firma gestionada.
- Plantillas con firma embebida (p. ej. Lanzadera): el sistema **no duplica** la firma gestionada.
- Al cambiar el remitente, la firma gestionada se actualiza a la identidad de esa cuenta.
- Pilar: fotografía y datos personales. Departamentos: logo oficial y datos del equipo.

## FAQ

**¿Puedo enviar a cualquier destinatario?** En fase controlada, solo a cuentas de la allowlist de prueba.  
**¿Hay recepción en Recibidos?** IMAP queda fuera de esta publicación.  
**¿Se copian borradores de staging?** No.  
**¿Accepted = entregado?** No. «Aceptado por el proveedor» solo indica aceptación de Resend.
