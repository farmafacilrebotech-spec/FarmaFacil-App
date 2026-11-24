-- =============================================================================
-- PROPUESTA 106 — Taxonomía FarmaFácil + campos import (NO APLICAR)
-- =============================================================================
-- Autorización explícita requerida. No ejecutar en prod ni staging sin OK.
-- Conserva las 8 categorías del maestro vía tabla de alias / seed.
-- =============================================================================

-- begin;

create table if not exists public.ff_catalog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_src text,
  sort_order int not null default 100,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'internal')),
  is_commercial boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ff_catalog_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.ff_catalog_categories (id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order int not null default 100,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'internal')),
  unique (category_id, slug)
);

-- Estado interno no comercial
insert into public.ff_catalog_categories (slug, name, sort_order, status, is_commercial)
values ('pending_classification', 'Pendiente de clasificar', 9999, 'internal', false)
on conflict (slug) do nothing;

-- 26 categorías comerciales (seed inicial; iconos a completar en app)
insert into public.ff_catalog_categories (slug, name, sort_order, status, is_commercial) values
  ('dermocosmetica', 'Dermocosmética', 10, 'active', true),
  ('higiene_personal', 'Higiene personal', 20, 'active', true),
  ('salud_bucodental', 'Salud bucodental', 30, 'active', true),
  ('cuidado_capilar', 'Cuidado capilar', 40, 'active', true),
  ('proteccion_solar', 'Protección solar', 50, 'active', true),
  ('bebe_infantil', 'Bebé e infantil', 60, 'active', true),
  ('embarazo_maternidad', 'Embarazo y maternidad', 70, 'active', true),
  ('nutricion_dietetica', 'Nutrición y dietética', 80, 'active', true),
  ('vitaminas_complementos', 'Vitaminas y complementos', 90, 'active', true),
  ('herboristeria_fitoterapia', 'Herboristería y fitoterapia', 100, 'active', true),
  ('salud_digestiva', 'Salud digestiva', 110, 'active', true),
  ('descanso_bienestar', 'Descanso y bienestar', 120, 'active', true),
  ('sexualidad_salud_intima', 'Sexualidad y salud íntima', 130, 'active', true),
  ('ortopedia', 'Ortopedia', 140, 'active', true),
  ('optica_cuidado_ocular', 'Óptica y cuidado ocular', 150, 'active', true),
  ('cuidado_auditivo', 'Cuidado auditivo', 160, 'active', true),
  ('cuidado_pies', 'Cuidado de los pies', 170, 'active', true),
  ('botiquin_primeros_auxilios', 'Botiquín y primeros auxilios', 180, 'active', true),
  ('equipamiento_sanitario', 'Equipamiento sanitario', 190, 'active', true),
  ('incontinencia_cuidado_mayor', 'Incontinencia y cuidado del mayor', 200, 'active', true),
  ('deporte_recuperacion', 'Deporte y recuperación', 210, 'active', true),
  ('salud_respiratoria', 'Salud respiratoria', 220, 'active', true),
  ('repelentes_proteccion', 'Repelentes y protección', 230, 'active', true),
  ('mascotas', 'Mascotas', 240, 'active', true),
  ('belleza_maquillaje', 'Belleza y maquillaje', 250, 'active', true),
  ('otros_productos', 'Otros productos', 260, 'active', true)
on conflict (slug) do nothing;

-- Alias de conservación maestro → nueva taxonomía
create table if not exists public.ff_catalog_category_aliases (
  legacy_name text primary key,
  category_slug text not null references public.ff_catalog_categories (slug)
);

insert into public.ff_catalog_category_aliases (legacy_name, category_slug) values
  ('Cuidado facial', 'dermocosmetica'),
  ('Cuidado corporal e higiene', 'higiene_personal'),
  ('Higiene bucodental', 'salud_bucodental'),
  ('Cuidado capilar', 'cuidado_capilar'),
  ('Protección solar', 'proteccion_solar'),
  ('Bebé y maternidad', 'bebe_infantil'),
  ('Primeros auxilios y cuidado en casa', 'botiquin_primeros_auxilios'),
  ('Bienestar y cuidado estacional', 'descanso_bienestar')
on conflict (legacy_name) do nothing;

alter table public.pharmacy_products
  add column if not exists national_code text,
  add column if not exists laboratory text,
  add column if not exists source_family text,
  add column if not exists source_subfamily text,
  add column if not exists category_id uuid references public.ff_catalog_categories (id),
  add column if not exists subcategory_id uuid references public.ff_catalog_subcategories (id),
  add column if not exists classification_status text
    check (classification_status in (
      'classified', 'pending_classification', 'excluded_medicine', 'review'
    ));

create index if not exists pharmacy_products_national_code_idx
  on public.pharmacy_products (pharmacy_id, national_code)
  where national_code is not null;

create index if not exists pharmacy_products_category_id_idx
  on public.pharmacy_products (pharmacy_id, category_id);

-- Destacadas por farmacia (orden local; no altera taxonomía global)
create table if not exists public.pharmacy_featured_categories (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  category_id uuid not null references public.ff_catalog_categories (id) on delete cascade,
  sort_order int not null default 100,
  primary key (pharmacy_id, category_id)
);

-- Equivalencias de import (farmacia + proveedor + familia origen)
create table if not exists public.pharmacy_category_import_equivalences (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  supplier_key text,
  source_format text,
  source_family text not null,
  source_subfamily text,
  category_id uuid not null references public.ff_catalog_categories (id),
  subcategory_id uuid references public.ff_catalog_subcategories (id),
  confirmed_by uuid,
  confirmed_at timestamptz not null default now(),
  unique (pharmacy_id, supplier_key, source_format, source_family, source_subfamily)
);

-- RLS: esqueleto (ajustar a helpers ff_has_platform_permission / membership)
alter table public.ff_catalog_categories enable row level security;
alter table public.ff_catalog_subcategories enable row level security;
alter table public.pharmacy_featured_categories enable row level security;
alter table public.pharmacy_category_import_equivalences enable row level security;

-- Políticas concretas: completar en apply autorizado (lectura autenticada;
-- escritura solo PLATFORM_SUPERADMIN / entitlements.manage equivalente).

-- rollback; -- mantener comentado; usar rollback en ensayos
-- commit;
