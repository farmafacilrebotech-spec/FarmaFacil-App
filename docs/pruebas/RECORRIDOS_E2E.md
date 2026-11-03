# Recorridos E2E (documentados, no ejecutados)

**Baseline:** `origin/main` @ `00e8de4`  
**Plan:** [PLAN_MAESTRO_PRUEBAS.md](PLAN_MAESTRO_PRUEBAS.md) · **Matriz:** [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv)

Cada recorrido enlaza casos `TC-*`. Campos Resultado obtenido / Fecha / Responsable / Evidencia: vacíos hasta ejecución.  
Escrituras: **Requiere autorización y entorno/datos de prueba** salvo pasos de solo lectura.

---

## E2E-A — Alta de farmacia → configuración → catálogo → primer pedido

| | |
|---|---|
| **Objetivo** | De alta SA a primer pedido operable |
| **Roles** | SA Total → Farmacia OWNER/ADMIN → Cliente o invitado |
| **Casos** | TC-SA-021, TC-SA-022, TC-FAR-001, TC-FAR-060, TC-FAR-030, TC-FAR-031 (si own), TC-CLI-020, TC-CLI-030 o TC-CLI-031, TC-FAR-020 |
| **Prioridad** | P0 |

**Pasos de alto nivel**

1. SA crea farmacia (SCR-SA-003) y deja estado operable + invita titular.
2. Titular hace primer acceso / login y entra al dashboard (SCR-FAR-001).
3. Configura datos (SCR-FAR-010) y catálogo (SCR-FAR-003); importa Excel si aplica.
4. Cliente/QR realiza un pedido (SCR-PUB-002).
5. Farmacia gestiona el pedido (SCR-FAR-002).

**Resultado esperado:** pedido visible y accionable en panel farmacia; seguimiento cliente según canal.

**Bloqueos conocidos:** import/export listado SA deshabilitado; módulos clientes/promos placeholder.

---

## E2E-B — Cliente → registro → guardar farmacia → pedido → Mis pedidos

| | |
|---|---|
| **Objetivo** | Ciclo cuenta cliente |
| **Roles** | Cliente |
| **Casos** | TC-CLI-001, TC-CLI-002, TC-CLI-003, TC-CLI-014, TC-CLI-030, TC-CLI-032 |
| **Prioridad** | P0 |

1. Registro (SCR-CLI-007 o SCR-CLI-003) y confirmación email.
2. Login y guardar farmacia → SCR-CLI-004.
3. Pedido autenticado desde SCR-PUB-002.
4. Verificar SCR-CLI-010 Mis pedidos.

**Resultado esperado:** pedido solo en la cuenta correcta; aislamiento frente a otras farmacias/cuentas.

---

## E2E-C — SuperAdmin → oportunidad → presupuesto → contrato → alta

| | |
|---|---|
| **Objetivo** | Embudo comercial completo |
| **Estado del recorrido** | **Parcial / mayormente No aplicable en producción** |
| **Casos** | TC-SA-040 (N/A), TC-SA-050 (tarifas sí), TC-SA-051 (contratos N/A), TC-SA-021 |
| **Prioridad** | P3 hasta publicación FUT-CARTERA / FUT-069 |

**Qué sí se puede probar hoy:** simulador `/tarifas` + alta manual de farmacia.  
**Qué no:** CRM oportunidad, contratos legales UI, ciclo directorio 070.

Marcar tramos faltantes como **No aplicable** y no fallar el piloto por ellos.

---

## E2E-D — Inventario → asignación → pairing → pedido → impresión → soporte

| | |
|---|---|
| **Objetivo** | Cadena kiosko física |
| **Roles** | SA/Soporte → Farmacia → dispositivo kiosko |
| **Casos** | TC-SA-060, TC-SA-061, TC-FAR-050, TC-KSK-001, TC-KSK-010, TC-FAR-020, TC-SA-070 (N/A historial errores) |
| **Prioridad** | P0 (hasta carrito); impresión P1 condicionada a APK |

1. Alta/recepción activo (SCR-SA-005/006) y asignación a farmacia.
2. Farmacia genera pairing (SCR-FAR-009); tablet SCR-KSK-001.
3. Catálogo/carrito kiosko (SCR-KSK-003/005) → pedido.
4. Impresión vía bridge Android si el dispositivo lo soporta (**APK no en origin/main**).
5. Soporte: ficha activo + farmacia; historial errores FUT-066 → N/A.

**Bloqueo:** sin APK/hardware, marcar impresión como Bloqueada / No aplicable.

---

## E2E-E — Cuenta dual → acceso profesional → acceso cliente → aislamiento

| | |
|---|---|
| **Objetivo** | Misma persona con rol farmacia y cuenta cliente no mezcla datos |
| **Casos** | TC-FAR-001, TC-CLI-003, TC-ISO-001, TC-ISO-002, TC-ISO-003, TC-ISO-004, TC-ISO-005 |
| **Prioridad** | P0 |

1. Login profesional `/login` → `/f/...` (pedidos de la farmacia).
2. Cerrar sesión o ventana privada.
3. Login cliente `/cuenta/entrar` o `/e/.../cuenta/entrar`.
4. Verificar que Mis pedidos no muestra datos de otras cuentas ni panel SA.
5. Intentar URL `/f/...` o `/dashboard` como cliente → acceso denegado / redirección (SCR-SYS-002).

**Resultado esperado:** aislamiento de datos y rutas por rol.

---

## E2E-F — Pedido autenticado frente a pedido invitado

| | |
|---|---|
| **Objetivo** | Diferencias de seguimiento y persistencia |
| **Casos** | TC-CLI-030, TC-CLI-031, TC-CLI-032, TC-CLI-033, TC-FAR-020 |
| **Prioridad** | P0 |

1. Pedido con cuenta → aparece en SCR-CLI-010.
2. Pedido invitado → no en Mis pedidos; sí seguimiento `/q/[token]` si aplica.
3. Farmacia ve ambos tipos en SCR-FAR-002 según diseño.

**Resultado esperado:** reglas de vinculación claras; sin fuga de pedidos ajenos.

---

## Registro de ejecución (plantilla)

| Recorrido | Fecha | Responsable | Entorno | Resultado | Evidencia | Incidencias |
|---|---|---|---|---|---|---|
| E2E-A | | | | No ejecutada | | |
| E2E-B | | | | No ejecutada | | |
| E2E-C | | | | No ejecutada | | |
| E2E-D | | | | No ejecutada | | |
| E2E-E | | | | No ejecutada | | |
| E2E-F | | | | No ejecutada | | |
