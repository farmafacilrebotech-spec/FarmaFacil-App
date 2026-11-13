# Pruebas Emails — PR #25 (documento vivo)

**Fecha:** 12/11/2026  
**Rama:** `feature/emails-phase-b-send` → `main`  
**Estado global:** preflight técnico OK · **publicado / en publicación** · **aceptación manual pendiente (usuaria)**

## Publicación

| Campo | Valor |
|-------|--------|
| Rollback app | tip `main` previo al merge #25 (docs logos `c34eeab` / app logos `5d61f8b`) |
| Migraciones prod | `085` → `086` → `087` → `088` (sobre `075` ya presente) |
| Backup pre-SQL | dump local `email_drafts`+`email_sends` (0 filas) + `wal_level=logical` |
| Datos staging→prod | **No** (borradores/destinatarios/adjuntos) |
| IMAP | Fuera de alcance |

## Controles de seguridad (producción)

| Control | Valor / comportamiento |
|---------|------------------------|
| `FF_CORPORATE_EMAIL_SEND_ENABLED` | `1` |
| `FF_CORPORATE_EMAIL_DRY_RUN` | `0` (live Resend; solo tras click de usuaria) |
| `FF_CORPORATE_EMAIL_TEST_RECIPIENTS` | allowlist de prueba (cuentas autorizadas de la usuaria) |
| `FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS` | claves de remitente para pruebas (p. ej. `pilar` + otras corporativas) |
| `RESEND_API_KEY` / `EMAIL_FROM` | ya existentes; no rotados en esta publicación |
| Comercial | Bloqueado sin Cartera / ack |
| Masivo / campañas / auto-envío | No |
| Agente | **No** envía correos por iniciativa propia |

## Pruebas técnicas (pre-merge)

| ID / check | Resultado |
|------------|-----------|
| Firma en código (`applySignaturePolicy`) | PASS — con firma / sin firma / sin duplicar plantilla |
| Allowlist destinatarios | PASS |
| Rebase sobre `main` (incluye PR #26 logos) | PASS |
| Typecheck | PASS (fixes Set/custom slug) |
| Tests email unitarios | PASS |
| Build Next | PASS |
| Migraciones identificadas | `085`,`086`,`087`,`088` (prod tenía solo `075`) |

## Pruebas de aceptación en producción (pendientes de la usuaria)

| # | Caso | Estado |
|---|------|--------|
| 1 | Nuevo email sin plantilla, **con** firma | pendiente |
| 2 | Nuevo email sin plantilla, **sin** firma | pendiente |
| 3 | Plantilla Lanzadera sin firma duplicada | pendiente |
| 4 | Cambio de remitente y firma correspondiente | pendiente |
| 5 | Envío con dos adjuntos | pendiente |
| 6 | Enviados / Borradores / Papelera | pendiente |
| 7 | Recepción efectiva en Gmail | pendiente |

## Incidencias previas (staging)

| ID | Incidencia | Estado |
|----|------------|--------|
| INC-EML-001…005 | UI borradores/plantillas/migas/iconos | Resueltas en rama |

## Evidencias staging

`_review_emails/` (iconos, compositor, checklist primer envío staging).
