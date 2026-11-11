# PR #21 — GO/NO-GO final (pre-SQL)

Fecha: **2026-11-11** · Sin SQL / merge / deploy en esta sesión.

## Veredicto: **NO-GO para publicar ahora**

Bloqueante restante: **backup completo / PITR de Supabase Production no verificado** (el dump lógico parcial no basta como única protección).

---

## 1. OPENAI_API_KEY — no eliminar

### Dependencias actuales en Production (main)

| Uso | Módulo | Estado |
|-----|--------|--------|
| **Asistente kiosk** | `lib/kiosk/assistant/*` + `app/k/asistente/actions.ts` | **En producción hoy**; lee `OPENAI_API_KEY` / `OPENAI_MODEL` |
| Extracción PDF proveedores | `app/(app)/proveedores/quote-pdf-actions.ts` (PR #21) | Código nuevo; **no** debe activarse en 1ª publicación |

**Conclusión:** la clave en Vercel Production **debe permanecer** (asistente). No borrarla.

### Garantía 1ª publicación proveedores

- Flag `SUPPLIER_QUOTE_PDF_AI_ENABLED` (**ausente / false por defecto**).
- Sin flag `1`/`true`, la action de proveedores **no llama a OpenAI** aunque exista la key.
- UI: mensaje “IA desactivada en esta publicación”.
- Tests: `lib/suppliers/supplier-quote-pdf-ai.test.ts`.

No añadir `SUPPLIER_QUOTE_PDF_AI_ENABLED` a Vercel Production en el publish.

---

## 2. Backup completo / PITR

| Artefacto | Estado |
|-----------|--------|
| Dump lógico dirigido (`pre_076_prod_20261111T114435Z/`) | Presente (complementario) |
| Daily backup / PITR en Dashboard Supabase | **NO VERIFICADO** (sin `SUPABASE_ACCESS_TOKEN`; panel no consultado en esta sesión) |

**Requisito para GO:** Pilar confirma en  
`Dashboard → gsnohwsvjxpjfcsstnfd → Database → Backups`  
un backup daily o PITR **recuperable** con timestamp **≤** momento previo al apply 076, y anota fecha/hora + tipo (daily/PITR).

---

## 3. Migraciones listas

Orden: **076 → 077 → 078 → 079 → 080 → 081 → 082**  
Excluir: `079_STAGING_REMEDIATE_chino_duplicates.sql`  
Sin seeds DEMO.

---

## 4. Checklist para pasar a GO

- [x] OPENAI conservada; extracción proveedores hard-off
- [x] Migraciones 076–082 preparadas sin REMEDIATE
- [x] Recovery app: `78d8871` / deploy `7674490724`
- [ ] **Backup completo o PITR verificado por operador**
- [ ] Autorización expresa SQL + merge #21

Cuando el backup esté confirmado: «Autorizo SQL 076–082 + merge/deploy PR #21».
