# Estructura definitiva — documentación viva FarmaFácil

**Versión estructura:** 1.0 · **Fecha:** 2026-11-12  
**Rama:** `feature/help-center-living-docs`

## 1. Árbol canónico en repositorio

```text
docs/
  gobernanza/
    AUDITORIA_DOCUMENTAL.md      # inventario y gaps
    ESTRUCTURA_DEFINITIVA.md     # este documento
    CHECKLIST_CIERRE_FUNCIONAL.md
    HISTORIAL_VERSIONES.md       # releases producto
  pruebas/                       # INTERNO — solo SuperAdmin Total in-app
    PLAN_MAESTRO_PRUEBAS.md
    MATRIZ_PRUEBAS.csv           # fuente de verdad de casos
    RECORRIDOS_E2E.md
    INCIDENCIAS.md
    REGISTRO_PR.md               # índice PR → casos / evidencias
    evidencias/
      emails-pr25/
      sql/                       # anonimizado
      # interno/ → gitignore (PII)
  manuales/                      # visibles según audiencia
    INDICE_PANTALLAS.md
    MANUAL_SA_TOTAL.md           # (evolucionar desde MANUAL_SUPERADMIN)
    MANUAL_SA_COMERCIAL.md       # nuevo
    MANUAL_SA_SOPORTE.md         # nuevo
    MANUAL_FARMACIA_TITULAR.md   # (evolucionar MANUAL_FARMACIA)
    MANUAL_FARMACIA_EQUIPO.md    # farmacéutico / empleados
    MANUAL_KIOSKO.md             # nuevo
    MANUAL_CLIENTE.md
    capturas/{superadmin,farmacia,cliente,kiosko,historico}/
  releases/                      # GO/NO-GO y notas de publicación
    project-roadmap-fase1.md
    pr21-*.md …
  contratos/                     # jurídico (ya en main)
  references/                    # assets diseño
```

**Migración desde nombres actuales:** no borrar aún `MANUAL_SUPERADMIN.md` / `MANUAL_FARMACIA.md`; crear stubs que apuntan y migrar capítulos en PRs sucesivas.

## 2. Estados de caso de prueba (obligatorios)

| Estado | Uso |
|--------|-----|
| `pendiente` | Documentado, sin ejecución |
| `en_desarrollo` | Feature en rama / staging |
| `prueba_tecnica_ok` | Smoke/unit/E2E técnico con evidencia; sin OK de usuario |
| `pendiente_validacion_usuario` | Técnica OK; falta validación Pilar/equipo |
| `validado_usuario` | Validación explícita registrada |
| `publicado_produccion` | En `main` + deploy verificado + docs alineadas |
| `incidencia` | Fallo abierto (enlazar `INC-*`) |

Compatibilidad con matriz actual: mapear `No ejecutada→pendiente`, `Correcta→` solo si hay evidencia; si fue prod usuario → `validado_usuario` o `publicado_produccion`.

## 3. Campos mínimos por caso (`MATRIZ_PRUEBAS.csv`)

Mantener columnas actuales y añadir cuando se regenere:

`ID;Modulo;Funcionalidad;Rol;Pantalla_ID;Ruta;Requisitos;Pasos;Resultado_esperado;Resultado_obtenido;Estado;Fecha;Entorno;PR;Commit;Evidencia;Incidencia;Validacion_usuario;Manual_ref;Prioridad;Tipo;Escritura`

## 4. Manuales — capítulos

Cada capítulo:

1. Objetivo  
2. Perfiles autorizados  
3. Cómo acceder  
4. Pasos  
5. Capturas reales (sin secretos/PII)  
6. Campos y botones  
7. Errores frecuentes  
8. FAQ  
9. Fecha de actualización + versión app / commit  

Solo comportamientos reales. Lo no publicado va en sección «Pendiente de publicación».

## 5. Audiencias Centro de ayuda (backend)

| Audiencia | Contenido | Pruebas internas |
|-----------|-----------|------------------|
| SuperAdmin Total | Todos los manuales + pruebas + releases + incidencias + instalación | Sí |
| SuperAdmin Comercial | Manual comercial + novedades plan + soporte | No |
| SuperAdmin Soporte | Manual soporte + farmacia ops + kiosko + FAQs | No |
| Farmacia (titular/admin) | Manual farmacia + kiosko + tutoriales + FAQs + contacto + novedades plan | No |
| Farmacia (farmacéutico/empleado) | Manual equipo + FAQs acotadas | No |
| Cliente | Manual cliente (catálogo, pedidos, cuenta) | No |

La ocultación de menú **no basta**: `requireHelpDocAccess(docId)` en server actions / loaders.

## 6. Funcionalidades Centro de ayuda (fases)

| Fase | Entrega |
|------|---------|
| **A (esta rama)** | Hub por audiencia, índice estático, markdown versionado, gate permisos, enlace a docs |
| **B** | Buscador, navegación capítulos, fecha actualización visible |
| **C** | PDF, ayuda contextual por módulo, historial cambios UI |

## 7. Regla de cierre de funcionalidad

Ninguna feature se cierra sin:

1. Desarrollo completado  
2. Pruebas técnicas documentadas  
3. Validación funcional registrada  
4. Plan/matriz actualizados  
5. Manual(es) actualizados  
6. Publicación autorizada y verificada  
7. `HISTORIAL_VERSIONES.md` actualizado  

Staging → estado `en_desarrollo` / `prueba_tecnica_ok` / `pendiente_validacion_usuario`.  
Tras publish → `publicado_produccion`.

## 8. Integración con Emails PR #25

- Casos nuevos `TC-EML-*` en matriz con estado `en_desarrollo` / `prueba_tecnica_ok`.  
- Evidencias: `docs/pruebas/evidencias/emails-pr25/`.  
- Manual SA Total: capítulo Emails marcado **pendiente de publicación**.  
- No exponer a farmacias/clientes.
