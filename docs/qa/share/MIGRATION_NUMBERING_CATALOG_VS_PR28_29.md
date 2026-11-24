# Numeración migraciones catálogo vs PR #28 / #29

- Tip de `main` / esta rama: última migración numerada **088**.
- PR #29 (`fix/entrega1-cierre-tecnico-fase0`) introduce borrador  
  `supabase/migrations/drafts/106_visible_name_public_surfaces_v1.sql.draft`  
  → **106 queda reservado para visible_name**, no para catálogo.
- Catálogo Fase B usa por tanto:
  - `supabase/proposed/089_catalog_taxonomy_import_v1.sql`
  - `supabase/proposed/090_catalog_import_jobs_v1.sql`
- **No aplicar** 089/090 en staging ni prod hasta autorización explícita.
- **No aplicar** 105.
