# Plan maestro de pruebas funcionales — FarmaFácil

**Baseline producto:** `origin/main` @ `9a445dd` (PR #24) · **Fecha plan:** 2026-11-03 · **Última corrida documentada:** 2026-11-05 · **Auditoría estructura:** 2026-11-12  
**Alcance actual:** cierre **E2E-F** (creación y vinculación de solicitudes QR) en producción; ampliación pendiente PR #21–#25.  
**Artefactos:** [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv) · [MATRIZ_PRUEBAS.xlsx](MATRIZ_PRUEBAS.xlsx) · [RECORRIDOS_E2E.md](RECORRIDOS_E2E.md) · [INCIDENCIAS.md](INCIDENCIAS.md) · [REGISTRO_PR.md](REGISTRO_PR.md) · [Auditoría](../gobernanza/AUDITORIA_DOCUMENTAL.md)

**Matriz:** 77 casos (CSV canónico + Excel vía `_gen_matriz.py`; incluye TC-FAR-073).  
**Resumen ejecución (2026-11-05):** Correcta **5** · Fallida **0** · No ejecutada **72** · Bloqueada **0**.  
*(TC-FAR-073 documenta avance parcial en `Resultado_obtenido` pero permanece **No ejecutada** hasta cerrar pendientes.)*  
**Manuales:** [Farmacia](../manuales/MANUAL_FARMACIA.md) · [Cliente](../manuales/MANUAL_CLIENTE.md) · [SuperAdmin](../manuales/MANUAL_SUPERADMIN.md) · [Índice](../manuales/INDICE_PANTALLAS.md)  
**Capturas:** [../manuales/capturas/cliente/](../manuales/capturas/cliente/) · [../manuales/capturas/farmacia/](../manuales/capturas/farmacia/) · [../manuales/capturas/historico/](../manuales/capturas/historico/) · [evidencias/sql/](evidencias/sql/) · `evidencias/interno/` (PII, **gitignore**)  
**Índice capturas:** [../manuales/capturas/README.md](../manuales/capturas/README.md)

## 1. Objetivos

- Verificar flujos publicados antes de pilotos.
- Separar producción de placeholders / worktrees WIP.
- Vincular cada caso a pantalla (`SCR-*`) y procedimiento de manual.
- Registrar evidencia sin inventar capturas ni datos personales.

## 2. Estados de caso

### 2.1 Estados vivos (obligatorios a partir de 2026-11-12)

| Estado | Significado |
|---|---|
| `pendiente` | Documentada; pendiente de corrida |
| `en_desarrollo` | Feature en rama / staging |
| `prueba_tecnica_ok` | Smoke/unit/E2E técnico con evidencia; sin OK de usuario |
| `pendiente_validacion_usuario` | Técnica OK; falta validación explícita |
| `validado_usuario` | Validación de usuario registrada |
| `publicado_produccion` | En producción verificada + docs alineadas |
| `incidencia` | Fallo abierto (enlazar INC-*) |

Ver [ESTRUCTURA_DEFINITIVA.md](../gobernanza/ESTRUCTURA_DEFINITIVA.md). **No marcar como superada sin evidencia.**

### 2.2 Valores históricos en la matriz CSV (compatibilidad)

| Valor CSV | Equivalente vivo |
|---|---|
| No ejecutada | `pendiente` |
| Correcta | Solo si hay evidencia; E2E-F prod → tratar como `validado_usuario` / `publicado_produccion` |
| Fallida | `incidencia` |
| Bloqueada | `pendiente` + dependencia |
| No aplicable | Fuera de rol / no publicada |

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
| Cliente | datos de prueba | Separar de sesión profesional; **anonimizar** en docs públicos |
| Invitado / Kiosko | sin cuenta / dispositivo emparejado | |

## 6. Tipos de prueba

- **Positivas:** flujo feliz.
- **Negativas:** credenciales malas, token caducado, entitlement off; también «invitado no vincula».
- **Permisos:** STAFF vs OWNER; Soporte vs SA; cliente vs `/f`.
- **Responsive:** móvil 375–430 px en QR catálogo y cuenta.

## 7. Matriz

→ [MATRIZ_PRUEBAS.csv](MATRIZ_PRUEBAS.csv) (fuente) · → [MATRIZ_PRUEBAS.xlsx](MATRIZ_PRUEBAS.xlsx) (operativa)

Columnas: `ID;Modulo;Rol;Pantalla_ID;Ruta;Requisitos;Datos_prueba;Pasos;Resultado_esperado;Resultado_obtenido;Estado;Prioridad;Evidencia;Incidencia;Fecha;Responsable;Tipo;Escritura;Manual_ref`

Casos E2E-F en **Correcta:** TC-CLI-003, TC-CLI-030, TC-CLI-031, TC-CLI-032, TC-FAR-020.  
Multifarmacia: **TC-FAR-073** (No ejecutada / avance parcial documentado; ver §10 y MANUAL_FARMACIA §1.4).

## 8. Recorridos E2E

→ [RECORRIDOS_E2E.md](RECORRIDOS_E2E.md) (A–F)

**E2E-F (creación/vinculación QR):** SUPERADA (2026-11-05) — tramos E2E-F-POS-VINC (#0011) y E2E-F-NEG-INV (#0013).

## 8bis. Control de versiones de evidencia

| Nivel | Significado | Ejemplo E2E-F |
|---|---|---|
| Probado en producción | Ejecutado en `app.farmafacil.solutions` | #0011 / #0013 |
| Corrección visual aprobada en rama | Preview local/rama | `historico/SCR-CLI-010_mis_pedidos_0011_corregido_preview_rama.png` |
| Corrección desplegada y verificada en producción | Merge + deploy + UI | INC-QR-001/002 resueltas |
| Pendiente de prueba | No ejecutada | Valoración, prep, cobro, entrega |

## 9. Criterios de entrada / salida

**Entrada:** baseline desplegado conocido; usuarios de prueba; farmacia piloto operable.  
**Salida parcial (E2E-F):** creación/vinculación QR autenticado e invitado Correcta; incidencias de etiquetas cerradas.  
**Salida piloto completa:** P0 restantes en Correcta; capturas anonimizadas; ciclo de vida del pedido (valoración→entrega) cubierto.

## 10. Próximas pruebas (obligatorias tras E2E-F)

1. **TC-FAR-073 multifarmacia (en curso):** incorporar PNG `SCR-FAR-MULTI-001…004`; completar cambio a 2ª farmacia, restricciones Empleado y aislamiento servidor (cruzar con TC-ISO-003).  
2. Valoración de precios / líneas.  
3. Confirmación de importe por farmacia.  
4. Preparación → listo para recoger → entrega.  
5. Cobro / estados de pago.  
6. TC-CLI-033 seguimiento por token (si el canal invitado lo usa).

## 11. Lo que este plan no cubre

- Carga / stress.
- Seguridad ofensiva.
- Migraciones SQL.
- Borrado de pedidos de prueba (#0011, #0013 se conservan).
