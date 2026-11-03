# Manual de usuario — Cliente (pilotos)

**Versión:** producción `origin/main` @ `00e8de4` · `https://app.farmafacil.solutions`  
**Audiencia:** clientes finales (QR, web, PWA).  
**Índice:** [INDICE_PANTALLAS.md](INDICE_PANTALLAS.md) · **Pruebas:** [../pruebas/PLAN_MAESTRO_PRUEBAS.md](../pruebas/PLAN_MAESTRO_PRUEBAS.md)

Solo funcionalidades **publicadas**. Lo no verificado o futuro está en *Pendiente de publicación o validación*.

> Use `publicId` en `/e/[publicId]/…`. El panel profesional `/f/[pharmacyId]/…` no es para clientes.

**Capturas de UI:** pendientes en todos los procedimientos (ver [capturas/README.md](capturas/README.md)).

---

## 1. Registro

SCR-CLI-003 `/cuenta/registro` · SCR-CLI-007 `/e/[publicId]/cuenta/registro` · **TC-CLI-001** · Captura pendiente  

**Pasos:** abrir enlace/QR → registro → completar datos → enviar.  
**Resultado:** cuenta creada (suele requerir confirmar email).  
**Errores:** email ya usado; farmacia no operable.

## 2. Confirmación de email

Correo + auth callback · **TC-CLI-002** · Captura pendiente  
Abrir el enlace del mensaje. Si caduca, solicitar reenvío.

## 3. Inicio de sesión

SCR-CLI-002 / SCR-CLI-006 · **TC-CLI-003** · Captura pendiente  
Email y contraseña → hub `/cuenta` o cuenta de farmacia `/e/.../cuenta`.  
**Móvil:** navegador habitual; no use `/login` de personal salvo que también trabaje en farmacia.

## 4. Recuperación de contraseña

SCR-AUTH-002 / SCR-AUTH-003 · **TC-CLI-004** · Captura pendiente  
Desde «olvidé mi contraseña» si aparece en la entrada.

## 5. Hub, perfil y cuenta en farmacia

| Sección | Pantalla | Prueba |
|---|---|---|
| Hub PWA | SCR-CLI-001 `/cuenta` | TC-CLI-010 |
| Cuenta contextual | SCR-CLI-005 | TC-CLI-012 |
| Perfil | SCR-CLI-008 | TC-CLI-011 |

Captura pendiente en todas. Actualice datos del perfil y compruebe al volver a entrar.

## 6. Direcciones

SCR-CLI-009 · **TC-CLI-013** · Captura pendiente  
Alta / edición / baja según la UI.

## 7. Mis farmacias (guardar y quitar)

SCR-CLI-004 · **TC-CLI-014** · Captura pendiente  

1. Guardar/seguir farmacia desde catálogo o cuenta (si el botón aparece).  
2. Revisar **Mis farmacias**.  
3. Quitar si ya no desea asociarla.

## 8. Acceso desde QR

SCR-PUB-001 / SCR-PUB-002 · **TC-CLI-020** · Captura pendiente  
Escanear QR → landing o catálogo → navegar como invitado o con cuenta.  
**Móvil:** cámara o navegador; misma sesión si pide con cuenta.

## 9. Catálogo y búsqueda

SCR-PUB-002 · **TC-CLI-021** (móvil: TC-CLI-022) · Captura pendiente  
Buscar y filtrar. Leer avisos de la farmacia.

## 10. Pedido con cuenta

**TC-CLI-030** · Captura pendiente  
Login → añadir productos → confirmar → ver en **Mis pedidos** (SCR-CLI-010).

## 11. Pedido como invitado

**TC-CLI-031** · seguimiento SCR-PUB-003 `/q/[token]` · **TC-CLI-033** · Captura pendiente  
Sin cuenta; seguimiento por token/WhatsApp. **No** aparece en Mis pedidos hasta vincular.

**Error habitual:** mezclar sesión profesional y cliente en el mismo navegador.

## 12. Mis pedidos

SCR-CLI-010 · **TC-CLI-032** · Captura pendiente  
Solo pedidos de su cuenta.

## 13. Instalación PWA (móvil)

**TC-CLI-040**, **TC-CLI-041** · Captura pendiente  
«Añadir a pantalla de inicio» / Instalar. Compruebe iconos/manifest si valida en pruebas. No sustituye al kiosko de sala.

## 14. Privacidad y cierre de sesión

SCR-LEG-001 / SCR-LEG-002 · **TC-CLI-050** · Captura pendiente  
Leer legales; cerrar sesión; no debe ver pedidos ni perfil.

---

## Pendiente de publicación o validación

| Tema | Estado |
|---|---|
| Rediseño visual móvil del catálogo QR | Rama `feature/qr-catalog-mobile-redesign` — no en baseline `00e8de4` |
| Promociones avanzadas | Placeholder en panel farmacia/SA |
| Capturas de UI de cuenta/catálogo | Pendientes de sesión controlada con datos de prueba |

No espere acceso a `/f/...` ni SuperAdmin como cliente.
