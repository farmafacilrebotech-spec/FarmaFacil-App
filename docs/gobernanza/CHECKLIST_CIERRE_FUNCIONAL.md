# Checklist de cierre de funcionalidad (obligatorio en cada PR)

Copiar en la descripción del PR y marcar solo con evidencia.

## Desarrollo
- [ ] Alcance implementado en la rama
- [ ] Sin secretos / PII en diffs ni capturas públicas
- [ ] Permisos backend reales (no solo ocultar UI)

## Pruebas
- [ ] Casos añadidos/actualizados en `docs/pruebas/MATRIZ_PRUEBAS.csv`
- [ ] Estado correcto (`en_desarrollo` … `publicado_produccion` / `incidencia`)
- [ ] Evidencias enlazadas (ruta bajo `docs/pruebas/evidencias/` o capturas)
- [ ] `docs/pruebas/REGISTRO_PR.md` actualizado
- [ ] Incidencias abiertas en `INCIDENCIAS.md` si aplica

## Validación
- [ ] Validación funcional registrada (quién / cuándo) o marcado `pendiente_validacion_usuario`
- [ ] No se declara «cerrado» sin validación cuando el flujo es de negocio

## Manuales / ayuda
- [ ] Manual(es) de audiencia afectados actualizados
- [ ] Funciones no publicadas marcadas «pendiente de publicación»
- [ ] Entrada en Centro de ayuda / catálogo `lib/help/catalog.ts` si aplica

## Publicación
- [ ] Autorización explícita para merge / SQL prod / deploy
- [ ] Verificación post-deploy
- [ ] `docs/gobernanza/HISTORIAL_VERSIONES.md` actualizado
- [ ] Roadmap actualizado si cambia el estado del módulo
