# Requisitos funcionales — Reorganización SuperAdmin, catálogos y rentabilidad

**Fecha:** 2026-11-25  
**Contexto:** Aceptación manual de la versión integrada en STAGING  
**Estado:** requisitos capturados · **no implementados** · **no autorizan** código, migraciones, permisos, deploy ni ramas de implementación  
**Plan maestro:** `PLAN_MAESTRO_CONSOLIDACION_FARMAFACIL.md` §1.8

---

## 0. Alcance y restricciones de esta entrega documental

| Permitido ahora | Prohibido ahora |
|-----------------|-----------------|
| Documentar decisiones y requisitos | Modificar código funcional |
| Identificar dependencias existentes / pendientes | Crear migraciones |
| Añadir al plan maestro para priorización | Cambiar permisos o credenciales |
| | Desplegar o tocar staging / producción |
| | Abrir ramas de implementación |

Estas propuestas **no** deben considerarse funcionalidades ya implementadas.

---

## 1. Reorganización del menú SuperAdmin

### 1.1 Objetivo

Reorganizar la navegación SuperAdmin en bloques de negocio claros, alineados con roles (Total / Comercial / Soporte) y con el trabajo comercial-operativo real.

### 1.2 Estructura de menú acordada (IA)

```
Dashboard
Farmacias
  ├─ Farmacias en marcha
  ├─ Promociones para farmacias
  └─ Tarifas y simulador
Comercial
  ├─ Cartera de farmacias
  ├─ Agenda comercial y Calendly
  └─ Presupuestos
Proveedores
  ├─ Material de oficina
  ├─ Kioskos
  ├─ Software y servicios
  └─ Información de productos
Gestión App FarmaFácil
  ├─ Inventario kioskos
  ├─ Clientes
  └─ Catálogo
       ├─ Catálogo maestro
       ├─ Catálogo genérico
       ├─ Catálogos personalizados por farmacia
       └─ Categorías y subcategorías
Administración y contabilidad
  ├─ Contratos
  ├─ Facturas emitidas
  ├─ Facturas recibidas
  └─ Bancos y conciliación
Soporte técnico
  ├─ Incidencias y solicitudes
  ├─ Historial de errores de kioskos
  └─ Estado de servicios
Usuarios y accesos
  ├─ SuperAdmin Total
  ├─ SuperAdmin Comercial
  ├─ SuperAdmin Soporte
  └─ Historial de actividad
Emails
Configuración
Centro de ayuda
```

### 1.3 Dashboard (contenido funcional)

El Dashboard debe concentrar indicadores, no sustituir los módulos de detalle:

| Área | Contenido esperado |
|------|--------------------|
| Comercial | Pipeline, conversión, presupuestos, cartera |
| Operativo | Farmacias en marcha, kioskos, incidencias abiertas |
| Económico | Facturación, cobros, márgenes agregados (según rol) |
| Clientes | Actividad PWA / cuentas |
| Pedidos | **Agregados / estadísticas** (no listado operativo SA) |
| IA | Uso y coste por canal |
| Inventario | Stock de activos / alertas de inventario |
| Alertas | Sistema, errores kiosko, servicios |

### 1.4 Pedidos en SuperAdmin

- **Retirar** «Pedidos» como entrada independiente del menú SA.
- Las estadísticas de pedidos viven en **Dashboard**.
- Preservar únicamente accesos a pedidos **individuales** estrictamente necesarios y autorizados (p. ej. soporte puntual, deep-link desde alerta), no un módulo SA de gestión diaria de pedidos.

### 1.5 Estado actual vs destino (dependencias)

Referencia de código existente (menú plano actual, `lib/navigation.ts` en staging integrado):

| Destino (IA) | Existente hoy | Pendiente / parcial |
|--------------|---------------|---------------------|
| Dashboard enriquecido | `/dashboard` básico | Indicadores comerciales/económicos/IA/pedidos agregados |
| Farmacias en marcha | `/farmacias` | Subnavegación / filtros “en marcha” |
| Promociones | `/promociones` (marcado pendiente de esquema) | Modelo + UX bajo Farmacias |
| Tarifas y simulador | `/tarifas` | Mover bajo Farmacias (IA) |
| Cartera | Propuesta / Fase 1 plan maestro | Módulo + nav Comercial |
| Agenda / Calendly | No consolidado en SA | Integración comercial |
| Presupuestos | Parcial vía tarifas / quotes | Homogeneizar bajo Comercial + Cartera |
| Proveedores (4 subtipos) | `/proveedores` | Segmentación por tipo de producto/servicio |
| Inventario kioskos | `/inventario-kioskos` | Agrupar bajo Gestión App |
| Clientes | `/clientes` | Idem |
| Catálogo (maestro/genérico/personalizado) | `/catalogo` + taxonomía | Modelo A/B/C explícito (§2) |
| Categorías y subcategorías | `/catalogo/taxonomia` (etiqueta «Taxonomía») | Renombrar + UX (§2.5) |
| Contratos | `/contratos` | Bajo Admin. y contabilidad |
| Facturas emitidas/recibidas | Parcial / contabilidad | Módulos SA dedicados |
| Bancos y conciliación | Parcial | Completar bajo Admin. |
| Incidencias / errores kiosko / estado servicios | Parcial o ausente | Soporte técnico |
| Usuarios por rol SA | `/usuarios` | Vistas/filtros Total/Comercial/Soporte + historial |
| Emails / Config / Ayuda | Existentes | Mantener primer nivel |
| Pedidos menú SA | `/pedidos` | **Retirar** de nav; stats → Dashboard |

### 1.6 Criterios de aceptación (cuando se implemente)

1. Menú SA refleja la IA de §1.2 (agrupado, no lista plana actual).  
2. No existe entrada top-level «Pedidos» para SA.  
3. Dashboard muestra al menos KPIs agregados de pedidos y alertas.  
4. Visibilidad por rol (Total / Comercial / Soporte) alineada a bloques.  
5. Deep-links a pedido individual solo donde el permiso lo autorice.

---

## 2. Arquitectura de catálogos

### 2.1 Tres catálogos diferenciados

| Id | Nombre | Definición |
|----|--------|------------|
| **A** | Genérico | Productos genéricos de parafarmacia (proyección comercial; sin inventar PVP) |
| **B** | Maestro | Repositorio central de referencias farmacia/parafarmacia: CN, EAN, marca, laboratorio, categoría, subcategoría, descripción, imagen, fuente |
| **C** | Personalizado | Referencias vinculadas al maestro, con precio, promociones y configuración comercial **propia de cada farmacia** |

Relación: **C → B** (obligatorio vínculo al maestro). **A** puede alimentarse/derivarse del maestro sin confundirse con PVP de farmacia.

### 2.2 Identidad y deduplicación

- Clave preferente: **CN válido**.
- Si no hay CN: **EAN fiable**.
- Resolución de conflictos: **sin sobrescritura arbitraria**; conservar fuentes, marcar discrepancia, decisión explícita (manual o regla documentada).
- Centralizar **imágenes** y **clasificación** (categorías/subcategorías).

### 2.3 Restricciones de producto

- **Medicamentos** fuera de canales públicos de solicitud y venta, conforme a restricciones aplicables.
- Política de **stock opcional y no bloqueante** (ya aprobada): ausencia de stock no impide solicitud/flujo donde la política lo permita.

### 2.4 Taxonomía / categorías

- Integrar Taxonomía **dentro de Catálogo**.
- Nombre de UI: **«Categorías y subcategorías»** (no «Taxonomía» en la interfaz habitual).
- Completar **iconos corporativos** y cobertura de subcategorías.
- Eliminar de la UI habitual términos técnicos: `slug`, `seed`, `legacy`, `active`, referencias a migraciones.

### 2.5 Incidencia conocida (revisión posterior)

En pantalla puede aparecer aviso de **migración 089 pendiente**, mientras la entrega integrada comunicó **089/090 aplicadas en staging**.  
**Acción:** revisar discrepancia UI vs estado real de migraciones **después** de la aceptación manual; **no** tocar migraciones ni código en esta entrega documental.

### 2.6 Dependencias existentes (orientativas)

| Área | Existente | Pendiente |
|------|-----------|-----------|
| Catálogo maestro / genérico / stock opcional | Migraciones 089–091 y plan catálogos 2026-11-24 | Exponer A/B/C con claridad en UI y permisos |
| Taxonomía | `/catalogo/taxonomia` | Rename UX, iconos, ocultar jerga técnica |
| Personalizado por farmacia | Flujos parciales por tenant | Modelo C unificado + vínculo maestro |
| Dedup CN/EAN | Reglas parciales en import | Motor de conflictos no destructivo |
| Medicamentos / canales públicos | Restricciones parciales | Gate consistente solicitud/venta |

### 2.7 Criterios de aceptación (cuando se implemente)

1. UI distingue Genérico / Maestro / Personalizado.  
2. Personalizado siempre enlazado a maestro.  
3. Dedup por CN (o EAN) sin pérdida silenciosa de datos.  
4. Categorías bajo Catálogo con nombre acordado e iconos.  
5. Sin jerga técnica en pantallas habituales.  
6. Medicamentos no aparecen en canales públicos de solicitud/venta.  
7. Stock ausente no bloquea flujos donde la política lo permita.

---

## 3. Rentabilidad por farmacia

### 3.1 Objetivo

Incorporar en la **ficha de cada farmacia** una pestaña **Rentabilidad**, accesible **exclusivamente** a **SuperAdmin Total**.

### 3.2 Capacidades requeridas

| Bloque | Requisitos |
|--------|------------|
| Costes | Captación · implantación · kiosko y materiales · desplazamientos · recurrentes (software, infraestructura, IA) · mantenimiento y soporte |
| Ingresos | Alta · hardware · suscripciones |
| Márgenes | Mensual y acumulado |
| Payback | Inversión pendiente de recuperar · fecha estimada · fecha real de recuperación |
| Comparativa | Individual y agregada · entre farmacias y planes |
| Imputación | Facturas y gastos a una farmacia **o** distribución de costes compartidos con criterios **explícitos y auditables** |
| Separación conceptual | Facturación ≠ cobros ≠ rentabilidad económica ≠ flujo de caja |
| Fianzas | Tratar **separadas** de ingresos; no duplicar costes |

### 3.3 Integraciones (reutilizar módulos)

- Contabilidad (facturas emitidas/recibidas, bancos).
- Inventario (kioskos / materiales).
- Proveedores (compras).
- Contratos / suscripciones.
- Cartera comercial (coste de captación / origen comercial).

### 3.4 Seguridad

- Visible solo **SuperAdmin Total**.
- SuperAdmin Comercial / Soporte: **sin acceso** a la pestaña ni a APIs asociadas.
- Trazabilidad de imputaciones y prorrateos (quién, cuándo, criterio).

### 3.5 Estado actual

| Elemento | Estado |
|----------|--------|
| Pestaña Rentabilidad en ficha farmacia | **No existe** |
| Modelo de costes/ingresos por farmacia | **Pendiente** |
| Prorrateo auditable de costes compartidos | **Pendiente** |
| Integración contabilidad ↔ farmacia | Parcial / a diseñar |
| Restricción SA Total | A implementar con permisos existentes (sin cambiar credenciales ahora) |

### 3.6 Criterios de aceptación (cuando se implemente)

1. Pestaña visible solo con rol SA Total.  
2. Muestra costes, ingresos, márgenes y payback definidos en §3.2.  
3. Permite imputar y prorratear con criterio auditable.  
4. No mezcla fianzas con ingresos ni duplica costes.  
5. Distingue facturación, cobros, rentabilidad y caja en la UI o en informes.

---

## 4. Dependencias cruzadas y orden sugerido de implementación

Orden **sugerido** tras cerrar aceptación manual (sujeto a re-priorización explícita):

| Orden | Entrega | Depende de |
|-------|---------|------------|
| 1 | IA menú SA + permisos por bloque | Roles SA existentes; no bloquea pilotos si se aplazá |
| 2 | Catálogos A/B/C + categorías UX | 089–091 / plan catálogos; resolución aviso 089 UI |
| 3 | Rentabilidad SA Total | Contabilidad + contratos + inventario + cartera (mínimo viable de imputación) |

**Relación con Fases 0–6 del plan maestro:** esta línea es **posterior / paralela no bloqueante** para pilotos diciembre (Cartera, PDF, emails dry-run). No desplaza Fase 1–3 salvo decisión explícita de negocio.

---

## 5. Fuera de alcance de la implementación futura inmediata (recordatorio)

- Firma electrónica / cobros reales / envíos comerciales reales.  
- Consultas sanitarias reales del asistente.  
- Sustitución de staging o producción sin autorización.  
- Tratar estas RF como “ya hechas” en demos o checklists de aceptación actuales.

---

## 6. Trazabilidad

| Documento | Uso |
|-----------|-----|
| `PLAN_MAESTRO_CONSOLIDACION_FARMAFACIL.md` §1.8 | Decisión consolidada + priorización |
| Este archivo | Requisitos funcionales detallados |
| `PLAN_CATALOGOS_TAXONOMIA_IMPORT_2026-11-24.md` | Base técnica catálogos previa |
| `ENTREGA_STAGING_INTEGRADO_ACEPTACION_2026-11-24.md` | Contexto staging integrado / 089–090 |
| `PROPUESTA_CARTERA_VS_FARMACIAS_2026-11-23.md` | Comercial / Cartera |
