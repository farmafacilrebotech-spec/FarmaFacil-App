# Manual de usuario — Farmacia (pilotos)

**Versión:** producción `origin/main` @ `00e8de4` · `https://app.farmafacil.solutions`  
**Audiencia:** personal de farmacia (titular / administrador / farmacéutico / empleado).  
**Índice:** [INDICE_PANTALLAS.md](INDICE_PANTALLAS.md) · **Pruebas:** [../pruebas/PLAN_MAESTRO_PRUEBAS.md](../pruebas/PLAN_MAESTRO_PRUEBAS.md)

Este manual describe **solo funcionalidades disponibles en producción**. Lo no publicado está al final, en *Pendiente de publicación o validación*.

**Capturas:** ninguna captura de UI de panel farmacia verificada en el repo. Ver [capturas/README.md](capturas/README.md). En cada procedimiento: **Captura pendiente**.

## Roles (producción)

| Rol | Nombre habitual | Gestiona usuarios |
|---|---|---|
| `PHARMACY_OWNER` | Titular | ADMIN, PHARMACIST, STAFF |
| `PHARMACY_ADMIN` | Administrador | PHARMACIST, STAFF |
| `PHARMACIST` | Farmacéutico | No |
| `STAFF` | Empleado | No |

---

## 1. Acceso y recuperación de contraseña

### 1.1 Iniciar sesión

| | |
|---|---|
| **Objetivo** | Entrar al panel |
| **Pantalla** | SCR-AUTH-001 `/login` |
| **Captura** | Captura pendiente — obtener en local/preview con usuario de prueba; anonimizar email |
| **Prueba** | TC-FAR-001 |

**Requisitos:** usuario invitado y activo.

**Pasos:** 1) Abrir `/login`. 2) Email y contraseña. 3) Enviar. 4) Si aplica, elegir farmacia (SCR-AUTH-008) o aceptar invitaciones (SCR-AUTH-007).

**Resultado esperado:** `/f/[pharmacyId]/dashboard`.

**Errores habituales:** contraseña incorrecta; invitación pendiente; farmacia no operable.

### 1.2 Primer acceso (invitación)

SCR-AUTH-004 / SCR-AUTH-006 · **Prueba** TC-FAR-002 · **Captura pendiente**  
Abrir enlace del correo, definir contraseña si se pide y aceptar membresía.

### 1.3 Recuperar contraseña

SCR-AUTH-002 → SCR-AUTH-003 · **Prueba** TC-FAR-003 · **Captura pendiente**  
«¿Olvidaste tu contraseña?» en login → correo → nueva contraseña.

---

## 2. Dashboard

SCR-FAR-001 · **Prueba** TC-FAR-010 · **Captura pendiente**

**Objetivo:** resumen del día y accesos a pedidos, catálogo y dispositivos.  
**Resultado esperado:** datos coherentes con la actividad de la farmacia.

---

## 3. Gestión de pedidos

SCR-FAR-002 · **Prueba** TC-FAR-020 (permisos STAFF: TC-FAR-021) · **Captura pendiente**

**Objetivo:** revisar y actualizar solicitudes (QR, kiosko, etc.).

**Pasos:** 1) Pedidos. 2) Filtrar. 3) Abrir detalle. 4) Si su rol permite gestionar: actualizar estado / valoración / WhatsApp según botones visibles.

**Resultado esperado:** estado actualizado; el cliente sigue el progreso en su canal.

**Errores habituales:** sin permiso de gestión; valoración pendiente cuando el flujo la exige.

---

## 4. Catálogo y stock

SCR-FAR-003 · **Prueba** TC-FAR-030 · **Captura pendiente**

**Pasos:** buscar/filtrar → editar visibilidad, datos o stock → guardar.  
**Resultado esperado:** cambio visible en catálogo QR/kiosko según configuración.

---

## 5. Importación Excel

SCR-FAR-003 (diálogo import) · **Prueba** TC-FAR-031 · **Captura pendiente**

**Requisitos:** catálogo en modo propio (`own`).  
**Pasos:** importar → revisar válidas/errores → confirmar.  
**Errores:** columnas incorrectas; modo genérico sin import propia.

---

## 6. Estadísticas

Resumen en el dashboard (SCR-FAR-001). **Prueba** TC-FAR-011. No hay módulo de analítica avanzada publicado.

---

## 7. Activación y vinculación de kiosko

SCR-FAR-009 · pairing SCR-KSK-001 · **Pruebas** TC-FAR-050, TC-KSK-001 · **Captura pendiente**

**Requisitos:** módulo kiosko activo.

**Pasos:** 1) Dispositivos. 2) Generar código. 3) En la tablet, `/k/pair` e introducir código.

**Resultado esperado:** dispositivo listado; `/k` muestra bienvenida.

**Uso en sala:** SCR-KSK-002…005. Iconos de tiles (referencia de producto, no captura de pantalla): [capturas/kiosko/referencia-assets/](capturas/kiosko/referencia-assets/).

---

## 8. Configuración

SCR-FAR-010 · **Prueba** TC-FAR-060 · **Captura pendiente**  
Revisar datos de farmacia y, si el rol lo permite, resumen de suscripción/módulos.

---

## 9. Gestión de usuarios

SCR-FAR-008 · **Pruebas** TC-FAR-070…072 · **Captura pendiente**  
Solo OWNER/ADMIN. Invitar roles permitidos; no crear OWNER desde ADMIN; no suspenderse a sí mismo.

---

## 10. Asistente IA

SCR-FAR-006 / SCR-FAR-007 · **Pruebas** TC-FAR-080, TC-FAR-081 · **Captura pendiente**  
Solo si el módulo está contratado. Configurar mensajes/FAQs y atender consultas. Si el entitlement está apagado, la pantalla lo indica.

---

## Pendiente de publicación o validación (no usar en piloto como disponible)

| Tema | Estado | Notas |
|---|---|---|
| Clientes (SCR-FAR-004) | placeholder | ModulePlaceholder |
| Ofertas/promociones (SCR-FAR-005) | placeholder | ModulePlaceholder |
| Impresión física de ticket | APK Android no en `origin/main` | Ver captura desarrollo USB: `capturas/kiosko/desarrollo/FUT-ANDROID_diagnostico-usb.jpg` (**DESARROLLO**) |
| Mockup bienvenida tablet | mockup | `capturas/kiosko/desarrollo/MOCKUP_…` — **no es captura real** |
| Rediseño móvil catálogo QR | otra rama | No forma parte de este baseline |

**Limitaciones conocidas en producción:** sin módulo clientes/promos; listado SA de pedidos es otro rol/placeholder.
