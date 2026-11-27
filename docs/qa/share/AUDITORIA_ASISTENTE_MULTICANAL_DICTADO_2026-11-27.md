# Auditoría técnica — Asistente IA multicanal y dictado por voz (§12)

**Fecha:** 2026-11-27  
**Rama auditada:** `integration/farmafacil-staging-2026-11-24` · tip `5964016`  
**Estado:** auditoría + plan · **no autoriza** consumo de servicios de pago, deploy a producción ni recompilación obligatoria del APK 0.2.15  
**Propuesta de origen (cliente):** `docs/qa/PROPUESTA_ASISTENTE_AREA_CLIENTE_2026-11-23.md`  
**Plan maestro:** `PLAN_MAESTRO_CONSOLIDACION_FARMAFACIL.md` §1.6 / §1.9 / Fase 4–4b  

---

## 0. Separación explícita respecto a K02–K07

| Entrega | Contenido | Relación con dictado |
|---------|-----------|----------------------|
| **K02–K07 (cerrada en código)** | Ticket, precios, UI kiosko, material publicitario, QR staging/prod | **No se retrasa** |
| **APK TEST 0.2.15** | Logo monocromo, impresión ICOD, QR seguimiento | **Respaldo vigente** — no modificar para dictado |
| **§12 Asistente multicanal + voz** | Canal `/e`, metering por canal, micrófono | **Entrega separada** |

Criterio: cualquier incompatibilidad del dictado se documenta y se saca de la aceptación física del kiosko ya preparada.

---

## 1. Menú lateral SuperAdmin — ¿integrado?

**No.** En la rama vigente el menú sigue siendo **plano** en `lib/navigation.ts` (Dashboard, Farmacias, Inventario, Proveedores, Clientes, Catálogo, Taxonomía, Pedidos, …).

La reorganización por bloques (Farmacias / Comercial / Proveedores / Gestión App / Admin. y contabilidad / Soporte / Usuarios) está **solo documentada**:

- `PLAN_MAESTRO_CONSOLIDACION_FARMAFACIL.md` §1.8 — *«pendiente de priorización e implementación · no implementado»*
- `REQUISITOS_FUNCIONALES_SUPERADMIN_REORG_CATALOGOS_RENTABILIDAD_2026-11-25.md` — requisitos capturados, **sin código**

No forma parte de esta auditoría de implementación; sigue en **Fase 7+** del plan maestro.

---

## 2. Situación del asistente (hechos verificados)

| Superficie | ¿Existe? | Notas |
|------------|----------|--------|
| Kiosko `/k/asistente` | Sí | Motor completo en `lib/kiosk/assistant/*` (safety, prompt, catalog-search, openai, rate-limit, cost, entitlement, consults) |
| Panel farmacia `/f/…/asistente` | Sí | Settings + bandeja de consultas |
| Área cliente `/e/<publicId>` | **No** | Propuesta 4.1 autorizada como **diseño**; fases 0–4 pendientes de autorización de código |
| Dictado / micrófono | **No** | Cero usos de `MediaRecorder`, `SpeechRecognition`, `getUserMedia` audio en TS/TSX; sin Whisper |
| Canal en consultas | Parcial | Mig 046: `channel ∈ {kiosk, customer_portal}` en turnos/consultas; runtime kiosko solo escribe `kiosk` |
| Uso económico mensual | Agregado | `pharmacy_assistant_usage_monthly`: requests + tokens + coste estimado **sin** dimensión canal ni STT |
| OPENAI en staging Vercel | Pendiente usuaria | Clave no en repo; sin autorización de consumo real |

Piezas reutilizables (~80 % del motor) ya listadas en la propuesta del 2026-11-23; siguen vigentes.

---

## 3. Viabilidad del dictado por plataforma

Requisito de producto: **sin escucha permanente**; activación voluntaria; UI de grabación visible; cancelable; transcripción **editable** antes de enviar; **sin TTS** en v1; no retener audio innecesario; no loguear contenido sensible.

### 3.1 Matriz

| Entorno | Micrófono | API viable | Riesgo | ¿Hace falta APK? |
|---------|-----------|------------|--------|------------------|
| **Kiosko Android K2101** (WebView app) | Hardware: confirmar en físico (USB/host tablet) | `getUserMedia` + `MediaRecorder` **solo si** el WebView concede permiso | Hoy: **sin** `RECORD_AUDIO` en manifest; `WebChromeClient` **sin** `onPermissionRequest` → el mic **no** se concederá | **Sí** — APK nuevo (≥ 0.2.16-staging) |
| **WebView app Android** (mismo shell kiosko) | Igual que arriba | Igual | Permisos nativos + origen HTTPS staging/prod | Sí |
| **Chrome Android** (PWA/cliente web) | Sí (permiso runtime) | MediaRecorder (`audio/webm;codecs=opus`) o Web Speech (Chrome) | Web Speech envía a servicio Google; preferir MediaRecorder→servidor propio | No |
| **Safari iPhone** | Sí (gesto de usuario) | MediaRecorder → `audio/mp4` / AAC; Web Speech **parcial** | Bloqueo de pantalla corta el mic; MIME distinto | No |
| **PWA instalada iPhone** | Sí con matices | MediaRecorder fiable; Web Speech **poco fiable / inconsistente** en standalone | Preferir **solo** MediaRecorder + STT servidor | No |
| **Chrome desktop** | Sí | MediaRecorder o Web Speech | OK para QA | No |

### 3.2 Estrategia técnica recomendada (única ruta cross-platform)

1. **Cliente:** botón mic → `getUserMedia({ audio: true })` → `MediaRecorder` con MIME detectado (`webm/opus` o `mp4/aac`) → stop / cancel → Blob en memoria.  
2. **UI:** indicador «Grabando…», temporizador corto (p. ej. máx. 30–45 s), cancelar descarta el Blob.  
3. **Servidor:** `POST` multipart a endpoint de transcripción (p. ej. Whisper `whisper-1` u OpenAI Audio) → texto → se vuelve al **textarea** (editable) → el usuario confirma y entonces se llama al turno del asistente.  
4. **No** usar Web Speech API como único camino (Safari/PWA). Puede ser *acelerador opcional* solo en Chrome si se activa feature flag, nunca dependencia.  
5. **Privacidad:** borrar Blob al cancelar/enviar; no persistir audio; no incluir audio ni transcript crudo en logs de aplicación; rate-limit STT aparte del chat.

### 3.3 Coste orientativo (sin contratar)

| Servicio | Uso | Orden de magnitud (orientativo) |
|----------|-----|----------------------------------|
| Chat (gpt-4o-mini u homólogo) | Ya modelado en `cost.ts` | Tokens in/out → `estimated_cost_cents` |
| Transcripción (Whisper) | Por minuto de audio | ~0,006 USD/min (referencia pública OpenAI; verificar tarifa vigente al autorizar) |
| Almacenamiento audio | **0** en v1 (no guardar) | — |

Los márgenes internos y precios de coste **solo SuperAdmin Total** (ya alineado con plan §1.6).

### 3.4 Impacto APK

| Pregunta | Respuesta |
|----------|-----------|
| ¿0.2.15 necesita dictado para aceptar K02–K07? | **No** |
| ¿El dictado en kiosko requiere nuevo APK? | **Sí** (`RECORD_AUDIO`, `onPermissionRequest` filtrado por origen FarmaFácil, posiblemente `MODIFICATION` de WebSettings) |
| ¿Cliente web/PWA necesita APK? | **No** |
| ¿Respaldo? | Conservar `FarmaFacil-TEST-0.2.15-staging.apk` en Escritorio / `docs/qa/share/ENTREGA_APK_TEST/` |

---

## 4. Control económico multicanal — gaps

### Ya existe

- Entitlement `assistant_ai` por farmacia + límites mensuales.  
- Reserva/finalización atómica de turnos kiosko (`ff_kiosk_assistant_begin/finalize_turn_v1`).  
- Estimación de coste chat (`estimateAssistantCostCents`).  
- Canal en **consultas al farmacéutico** y turnos cliente (`kiosk` \| `customer_portal`).  
- Gates K04: módulo off → «Acércate al mostrador»; consulta farmacéutico solo si autorizado.

### Falta para §12

| Gap | Acción |
|-----|--------|
| Uso mensual **sin** `channel` | Extender metering (tabla satélite o columnas JSON) `kiosk` / `customer_portal` + totales compartidos |
| Contadores STT | `transcription_seconds`, `transcription_cost_cents`, modelo STT |
| Modelo chat por turno | Persistir `model` usado (hoy env `OPENAI_MODEL`) |
| Endpoint público `/e/…/asistente` | Gate entitlement + rate-limit IP/sesión + coste **sin** sesión kiosko |
| UI SuperAdmin Total | Desglose canal + STT + acumulado mensual (márgenes internos) |
| Feature flags | `assistant_customer_web`, `assistant_voice_dictation` (off en prod hasta autorización) |

Límites: **un cupo compartido** farmacia/mes entre canales; el desglose es informativo, el tope es conjunto (decisión ya en plan §1.6).

---

## 5. Qué se puede implementar sin regresiones (orden)

### Entrega A — sin APK, sin STT de pago (siguiente STAGING cuando se autorice código)

1. Gate + API turno canal `customer_portal` reutilizando `lib/kiosk/assistant/*`.  
2. UI `/e` (bottom sheet) detrás de flag + entitlement.  
3. Consulta farmacéutico desde `/e` → bandeja existente.  
4. Dimensión `channel` en uso mensual (migración nueva **≠ 105**).  
5. Tests: entitlement, aislamiento multifarmacia, rate-limit, coste conjunto.  
6. **Sin** micrófono en UI (campo texto únicamente).

**Dependencias usuaria:** `OPENAI_API_KEY` staging (clave distinta de prod) + redeploy staging ya pendientes de K07/cierre.

### Entrega B — dictado web (Chrome / Safari / PWA) · autorización de consumo STT

1. Componente mic compartido (kiosko web + `/e`).  
2. Endpoint transcribe + metering STT.  
3. QA en dispositivos reales listados en §3.1.  
4. Kiosko **web en tablet no-WebView** puede probarse; en K2101 el botón mic se oculta o muestra «no disponible en esta versión de app» hasta Entrega C.

### Entrega C — APK ≥ 0.2.16-staging (solo tras aceptar 0.2.15 en físico)

1. `RECORD_AUDIO` + `onPermissionRequest` allowlist host.  
2. Validación en K2101: permiso, cancelación, no escucha permanente, ticket/impresión **sin regresión**.  
3. No tocar package de producción.

### Fuera de alcance inmediato

- TTS / respuestas habladas.  
- Escucha continua.  
- Pedidos desde el chat.  
- Memoria persistente del chat ordinario.  
- Activación en producción.  
- Reorganización menú SA (§1.8).  
- Maestro de catálogo A/B/C (otra línea).

---

## 6. Decisiones de producto aún abiertas (de la propuesta 4.1)

| ID | Tema | Recomendación vigente | ¿Bloquea A? |
|----|------|------------------------|-------------|
| D1 | Anónimo vs cuenta | Anónimo con límites; cuenta para consulta farmacéutico | Parcial — se puede arrancar con solo cuenta en sandbox |
| D2 | Solo con entitlement | Sí | No (regla clara) |
| D3 | Mismo motor | Sí; UX móvil propia | No |
| D4 | Modo generic | Sin inventar PVP/stock | No |
| D5 | Bandeja consultas | `/f/…/asistente/consultas` | No |
| D6 | Quién edita contenido | Matriz permisos | No |
| V1 | ¿Dictado en kiosko físico en la misma entrega que `/e`? | **No** — Entrega C separada | — |
| V2 | Proveedor STT | Whisper vía misma cuenta OpenAI staging, flag off hasta OK | Sí para B |

Revisión legal del aviso IA / anexo encargo (plan §8 puntos 6 y 8) sigue siendo bloqueo para **consultas sanitarias reales** y para prod; no bloquea sandbox staging con farmacias QA.

---

## 7. Inclusión en plan maestro

Queda reflejado en `PLAN_MAESTRO_CONSOLIDACION_FARMAFACIL.md`:

- §1.6 ampliado (multicanal + dictado diferido).  
- **§1.9** nuevo (esta auditoría).  
- Fase 4 = Entrega A (texto).  
- **Fase 4b** = Entregas B+C (voz + APK), explícitamente **no** bloqueantes de K02–K07 ni del APK 0.2.15.

---

## 8. Acciones exactas que debes realizar tú

1. Completar aceptación K02–K07 (redeploy staging, USB APK **0.2.15**, checklist físico) **sin esperar** al dictado.  
2. Cuando autorices código de Entrega A: confirmar D1 (¿anónimo en v1 sandbox?) y permitir rama/migración N+6 channel.  
3. Para cualquier prueba con modelo real: crear/pegar `OPENAI_API_KEY` **solo** en Vercel Staging (nunca en git) y autorizar techo de gasto.  
4. Autorizar por separado el consumo de **transcripción** antes de Entrega B.  
5. Tras validar 0.2.15 en K2101, autorizar APK 0.2.16 si quieres mic en kiosko.

---

## 9. Checklist reducido de aceptación (cuando se implemente)

**Entrega A**

- [ ] Sin entitlement → no hay UI asistente en `/e`  
- [ ] Con entitlement Fase7 → chat texto OK; aislamiento vs otra farmacia  
- [ ] Límite mensual compartido con kiosko  
- [ ] Consulta farmacéutico solo con permiso; si no → «Acércate al mostrador»  
- [ ] SuperAdmin Total ve costes (sin márgenes en otros roles)

**Entrega B**

- [ ] Mic solo con tap; indicador grabando; cancelar  
- [ ] Texto editable antes de enviar  
- [ ] Chrome Android + Safari iPhone + PWA iPhone OK o degradación clara  
- [ ] Audio no persistido; sin logs de transcript

**Entrega C**

- [ ] 0.2.15 intacto como respaldo  
- [ ] 0.2.16 concede mic solo a origen FarmaFácil  
- [ ] Ticket/impresión/QR sin regresión  

---

## 10. Conclusión

- Motor compartido **listo** para multicanal; falta cablear `/e` + metering por canal.  
- Dictado **viable** con MediaRecorder + STT servidor; **bloqueado en K2101** hasta nuevo APK.  
- **No** mezclar dictado con la aceptación del material/ticket ya entregados.  
- Menú SuperAdmin reorganizado: **no** está en la rama; sigue documental.  
- Sin autorización tuya: no hay claves en repo, no hay consumo de pago, no hay prod.
