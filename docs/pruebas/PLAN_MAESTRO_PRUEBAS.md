# Plan maestro de pruebas funcionales — FarmaFácil

**Baseline:** `origin/main` @ `00e8de4` · **Fecha plan:** 2026-11-03  
**Alcance:** pruebas documentadas, **no ejecutadas** en esta entrega.  
**Artefactos:** [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv) · [MATRIZ_PRUEBAS.xlsx](MATRIZ_PRUEBAS.xlsx) · [RECORRIDOS_E2E.md](RECORRIDOS_E2E.md)

**2ª revisión:** 76 casos (CSV canónico + Excel con filtros, freeze, desplegables Estado/Prioridad y hoja Resumen). Estados iniciales: No ejecutada.  
**Manuales:** [Farmacia](../manuales/MANUAL_FARMACIA.md) · [Cliente](../manuales/MANUAL_CLIENTE.md) · [SuperAdmin](../manuales/MANUAL_SUPERADMIN.md) · [Índice](../manuales/INDICE_PANTALLAS.md)

## 1. Objetivos

- Verificar flujos publicados antes de pilotos.
- Separar producción de placeholders / worktrees WIP.
- Vincular cada caso a pantalla (`SCR-*`) y procedimiento de manual.
- Registrar evidencia sin inventar capturas.

## 2. Estados de caso

| Estado | Significado |
|---|---|
| No ejecutada | Documentada; pendiente de corrida |
| Correcta | Pasó |
| Fallida | No cumplió resultado esperado |
| Bloqueada | Dependencia externa / bug previo |
| No aplicable | Feature no publicada o fuera de rol |

## 3. Prioridades

| Prioridad | Uso |
|---|---|
| P0 | Bloqueante piloto (login, pedidos, catálogo, pairing, aislamiento cuentas) |
| P1 | Importante (usuarios farmacia, asistente, inventario SA, tarifas) |
| P2 | Secundario / UX / responsive |
| P3 | Futuro / placeholder |

## 4. Entornos

| Entorno | URL | Escrituras |
|---|---|---|
| Producción | `https://app.farmafacil.solutions` | Solo con autorización + datos de prueba |
| Local | `http://127.0.0.1:3010` (u otro) | Preferible para negativas y E2E |
| Preview Vercel | URL de deployment de rama | Indicar commit |

Las pruebas con escritura en producción se marcan: **Requiere autorización y entorno/datos de prueba**.

## 5. Roles de prueba

| Rol de prueba | Credenciales | Notas |
|---|---|---|
| SA Total | datos de prueba | |
| Soporte | datos de prueba | Nav reducida |
| Farmacia OWNER/ADMIN/PHARMACIST/STAFF | datos de prueba | Jerarquía invitaciones |
| Cliente | datos de prueba | Separar de sesión profesional |
| Invitado / Kiosko | sin cuenta / dispositivo emparejado | |

## 6. Tipos de prueba

- **Positivas:** flujo feliz.
- **Negativas:** credenciales malas, token caducado, entitlement off.
- **Permisos:** STAFF vs OWNER; Soporte vs SA; cliente vs `/f`.
- **Responsive:** móvil 375–430 px en QR catálogo y cuenta.

## 7. Matriz

La matriz detallada está en CSV (UTF-8, separador `;`) para Excel / Numbers:

→ [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv) (fuente) · → [MATRIZ_PRUEBAS.xlsx](MATRIZ_PRUEBAS.xlsx) (operativa)

Columnas: `ID;Modulo;Rol;Pantalla_ID;Ruta;Requisitos;Datos_prueba;Pasos;Resultado_esperado;Resultado_obtenido;Estado;Prioridad;Evidencia;Incidencia;Fecha;Responsable;Tipo;Escritura;Manual_ref`

## 8. Recorridos E2E

→ [RECORRIDOS_E2E.md](RECORRIDOS_E2E.md) (A–F)

## 9. Criterios de entrada / salida

**Entrada:** baseline desplegado conocido; usuarios de prueba; farmacia piloto operable; kiosko de lab si E2E-D.  
**Salida piloto:** P0 en Correcta; P1 sin Fallida abierta; placeholders marcados No aplicable; capturas anonimizadas adjuntas.

## 10. Lo que este plan no cubre

- Carga / stress.
- Seguridad ofensiva.
- Migraciones SQL.
- Ramas WIP no mergeadas (solo listadas como No aplicable / futuro).
