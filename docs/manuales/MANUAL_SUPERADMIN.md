# Manual de usuario — SuperAdmin / Soporte

> **Documento interno FarmaFácil** (no entregar a farmacias piloto como manual de usuario).

**Versión documentada:** App FarmaFácil en producción (`origin/main` @ `00e8de4`).  
**Audiencia:** equipo FarmaFácil (operaciones, comercial, soporte).  
**Índice:** [INDICE_PANTALLAS.md](INDICE_PANTALLAS.md) · **Pruebas:** [../pruebas/PLAN_MAESTRO_PRUEBAS.md](../pruebas/PLAN_MAESTRO_PRUEBAS.md)

**URL producción:** `https://app.farmafacil.solutions`  
Capturas: **Captura pendiente** en todos los procedimientos (ver [capturas/README.md](capturas/README.md)).

---

## Perfiles (producción)

| Perfil | Acceso típico en nav | Notas |
|---|---|---|
| **SuperAdmin Total** | Dashboard, Farmacias, Inventario kioskos, Catálogo maestro, Tarifas, Usuarios*, Perfil, y rutas placeholder | Control total de plataforma |
| **SuperAdmin Comercial** | Misma base SA donde el rol lo permita; **no** documentar CRM cartera / contratos legales como publicados | Cartera comercial y contratos formales: **futuro** (FUT-CARTERA, FUT-069) |
| **SuperAdmin Soporte** | En producción: **Farmacias** + **Inventario kioskos** | Alcance reducido a operación de farmacias y activos |

\* `/usuarios` y `/usuarios/[id]` están como **stub / placeholder** en este baseline: no asuma gestión completa de usuarios de plataforma.

Las escrituras en producción (altas, cambios de estado, asignaciones) requieren **autorización y datos de prueba**.

---

## 1. Inicio de sesión

| | |
|---|---|
| **Pantalla** | SCR-AUTH-001 `/login` |
| **Prueba** | TC-SA-001 |

1. Abra `/login`.
2. Introduzca credenciales de personal FarmaFácil.
3. Continúe por SCR-AUTH-005 hasta `/dashboard` (o la home de su rol).

**Errores habituales:** usuario sin rol SA/Soporte; sesión de farmacia distinta en el mismo navegador.

---

## 2. Dashboard

| | |
|---|---|
| **Pantalla** | SCR-SA-001 `/dashboard` |
| **Estado** | **parcial** |
| **Prueba** | TC-SA-010 |

Vista de resumen. En este baseline, acciones de cliente / pedido / promo del dashboard pueden estar **deshabilitadas**. No use el dashboard como módulo de pedidos globales.

---

## 3. Alta y gestión de farmacias

### 3.1 Listado

| | |
|---|---|
| **Pantalla** | SCR-SA-002 `/farmacias` |
| **Roles** | SUPERADMIN, SOPORTE |
| **Prueba** | TC-SA-020 |

Busque y filtre farmacias. Import/Export de listado: **deshabilitado** en producción documentada.

### 3.2 Nueva farmacia

| | |
|---|---|
| **Pantalla** | SCR-SA-003 `/farmacias/nueva` |
| **Roles** | SUPERADMIN |
| **Prueba** | TC-SA-021 |
| **Marca** | Requiere autorización y entorno/datos de prueba |

1. Abra **Nueva farmacia**.
2. Complete datos obligatorios (nombre, identificadores, contacto, etc. según formulario).
3. Guarde.

**Resultado esperado:** la farmacia aparece en el listado; puede abrirse la ficha SCR-SA-004.

### 3.3 Ficha y estados

| | |
|---|---|
| **Pantalla** | SCR-SA-004 `/farmacias/[id]` |
| **Estado** | **parcial** |
| **Prueba** | TC-SA-022 |

Revise datos, suscripción/módulos (kiosko, asistente), invitaciones al titular y estado operativo.

**Limitaciones en este baseline**

- Pestañas **Clientes** / **Actividad**: no ready.
- Sección **Contrato** en ficha: puede ser mock / no el módulo legal formal.
- No documente el ciclo de vida completo de directorio (FUT-070) como disponible.

---

## 4. Usuarios y permisos (plataforma)

| | |
|---|---|
| **Pantallas** | SCR-SA-011 `/usuarios` · SCR-SA-012 `/usuarios/[id]` |
| **Estado** | **placeholder / stub** |
| **Prueba** | TC-SA-030 → No aplicable / Bloqueada hasta implementación |

La gestión operativa de usuarios **de farmacia** se hace desde la ficha / invitaciones y el panel de la farmacia (SCR-FAR-008), no desde este stub.

**Perfil:** SCR-SA-013 `/perfil` (parcial) — datos del usuario SA/Soporte autenticado.

---

## 5. Cartera comercial, contactos y seguimiento

| | |
|---|---|
| **Estado** | **no_publicado** (FUT-CARTERA; worktree de plantilla import) |
| **Prueba** | TC-SA-040 → No aplicable |

No hay procedimiento en producción. No invente pantallas CRM.

---

## 6. Simulador de precios y presupuestos

| | |
|---|---|
| **Pantalla** | SCR-SA-010 `/tarifas` |
| **Estado** | **produccion** (tarifas / simulador) |
| **Prueba** | TC-SA-050 |

Use el simulador de tarifas según la UI publicada.  
Los **presupuestos comerciales formales** ligados a contrato legal no están en el módulo de contratos publicado (placeholder Fase 4 / FUT-069). Distinga:

- Simulación de precios en `/tarifas` → **disponible**.
- Flujo oportunidad → presupuesto → contrato firmado → alta: **parcial / futuro** (ver recorrido E2E-C).

---

## 7. Contratos

| | |
|---|---|
| **Pantalla** | SCR-SA-017 `/contratos` |
| **Estado** | **placeholder** (Fase 4; WIP en otra rama) |
| **Prueba** | TC-SA-051 → No aplicable en producción |

Existen documentos fuente en `docs/contratos/` del repo (plantillas Word), **no** son la UI de gestión.

---

## 8. Inventario físico de kioskos

### 8.1 Listado

| | |
|---|---|
| **Pantalla** | SCR-SA-005 `/inventario-kioskos` |
| **Roles** | SUPERADMIN, SOPORTE |
| **Prueba** | TC-SA-060 |

Altas por lote, conteos y búsqueda de activos según la UI.

### 8.2 Detalle, asignación y reparaciones

| | |
|---|---|
| **Pantalla** | SCR-SA-006 `/inventario-kioskos/[assetId]` |
| **Prueba** | TC-SA-061 |
| **Marca** | Escrituras: requiere autorización y datos de prueba |

Asigne a farmacia, registre estados (p. ej. reparación) y revise historial operativo **disponible en la pantalla**.

### 8.3 Pegatina / código

| | |
|---|---|
| **Pantallas** | SCR-SA-007 pegatina · SCR-SA-008 resolución por código |
| **Prueba** | TC-SA-062 |

Imprima o muestre la pegatina; el código redirige al detalle.

**Emparejamiento en farmacia:** SCR-FAR-009 + SCR-KSK-001 (manual de farmacia).

---

## 9. Historial de errores (kiosko)

| | |
|---|---|
| **Estado** | **no_publicado** (FUT-066) |
| **Prueba** | TC-SA-070 → No aplicable |

---

## 10. Compras a proveedores

| | |
|---|---|
| **Estado** | **no_publicado** (FUT-068) |
| **Prueba** | TC-SA-071 → No aplicable |

---

## 11. Catálogo maestro

| | |
|---|---|
| **Pantalla** | SCR-SA-009 `/catalogo` |
| **Prueba** | TC-SA-080 |

Gestione el catálogo maestro de plataforma (productos base que las farmacias pueden usar según su modo).

---

## 12. Estadísticas

Resumen en SCR-SA-001. No hay módulo analítico avanzado publicado. Pedidos/clientes/promos SA son placeholder (SCR-SA-014…016).

**Prueba:** TC-SA-011.

---

## 13. Calendario

| | |
|---|---|
| **Estado** | **no_publicado** (FUT-AGENDA) |
| **Prueba** | TC-SA-090 → No aplicable |

---

## 14. Comunicaciones y correos

No hay bandeja de comunicaciones comerciales publicada en el panel SA de este baseline.  
Existe lógica de correo en el código (p. ej. outreach / invitaciones); **no** documente una UI de campañas como disponible.

**Prueba:** TC-SA-091 → pendiente / no aplicable según alcance.

Ayuda SA: SCR-SA-019 `/ayuda` — **placeholder**.  
Configuración SA: SCR-SA-018 — **placeholder**.

---

## Procedimientos futuros (no producción)

Documentados solo para trazabilidad con el plan de pruebas:

1. CRM cartera + import plantilla.
2. Contratos legales (069) y ciclo de vida directorio (070).
3. Historial errores kiosko (066) y compras proveedores (068).
4. Calendario / agenda.
5. Gestión completa de usuarios plataforma (sustituir stubs).

Cuando se publiquen, actualizar este manual, el índice y la matriz (estado → produccion).

**Material desarrollo (no producción):** diagnóstico USB Android en `capturas/kiosko/desarrollo/FUT-ANDROID_diagnostico-usb.jpg` (APK fuera de `origin/main`).
