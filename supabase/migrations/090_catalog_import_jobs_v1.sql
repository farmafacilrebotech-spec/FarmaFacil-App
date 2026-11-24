-- =============================================================================
-- PROPUESTA 090 — Jobs de importación de catálogo + RPC batch + revert (NO APLICAR)
-- =============================================================================
-- Prerrequisitos: 020/022/054 (pharmacy_products, source, generic),
--   074 (catalog.manage / ff_has_pharmacy_permission), 028 (ff_pharmacy_is_operable),
--   089 (national_code, laboratory, source_family, category_id,
--        classification_status, ff_catalog_categories, ff_catalog_category_aliases,
--        pharmacy_category_import_equivalences).
--
-- pharmacy_category_import_equivalences ya se crea en 089; aquí NO se redefine.
--
-- Autorización explícita requerida. No ejecutar en prod ni staging sin OK.
-- =============================================================================

-- begin;

-- -----------------------------------------------------------------------------
-- 1) Jobs de importación
-- -----------------------------------------------------------------------------
create table if not exists public.pharmacy_catalog_import_jobs (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  status text not null default 'running'
    check (status in (
      'running', 'completed', 'failed', 'reverted', 'partially_reverted'
    )),
  source_filename text,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists pharmacy_catalog_import_jobs_pharmacy_idx
  on public.pharmacy_catalog_import_jobs (pharmacy_id, created_at desc);

create table if not exists public.pharmacy_catalog_import_job_items (
  job_id uuid not null
    references public.pharmacy_catalog_import_jobs (id) on delete cascade,
  product_id uuid references public.pharmacy_products (id) on delete set null,
  row_index integer not null,
  action text not null
    check (action in ('create', 'update', 'skip', 'error')),
  payload jsonb not null default '{}'::jsonb,
  primary key (job_id, row_index)
);

create index if not exists pharmacy_catalog_import_job_items_product_idx
  on public.pharmacy_catalog_import_job_items (product_id)
  where product_id is not null;

comment on table public.pharmacy_catalog_import_jobs is
  '107: trazabilidad de importaciones de catálogo por farmacia (revertible por job).';
comment on table public.pharmacy_catalog_import_job_items is
  '107: una fila por fila importada; action=create permite el revert suave.';

-- -----------------------------------------------------------------------------
-- 2) RLS: lectura para gestores del catálogo; escritura solo vía RPC definer
-- -----------------------------------------------------------------------------
alter table public.pharmacy_catalog_import_jobs enable row level security;
alter table public.pharmacy_catalog_import_job_items enable row level security;

drop policy if exists pharmacy_catalog_import_jobs_select
  on public.pharmacy_catalog_import_jobs;
create policy pharmacy_catalog_import_jobs_select
  on public.pharmacy_catalog_import_jobs
  for select to authenticated
  using (
    public.ff_has_platform_permission('platform.pharmacies.write')
    or public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
  );

drop policy if exists pharmacy_catalog_import_job_items_select
  on public.pharmacy_catalog_import_job_items;
create policy pharmacy_catalog_import_job_items_select
  on public.pharmacy_catalog_import_job_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.pharmacy_catalog_import_jobs j
      where j.id = job_id
        and (
          public.ff_has_platform_permission('platform.pharmacies.write')
          or public.ff_has_pharmacy_permission(j.pharmacy_id, 'catalog.manage')
        )
    )
  );

-- Sin políticas INSERT/UPDATE/DELETE: solo las RPC SECURITY DEFINER escriben.
revoke all on public.pharmacy_catalog_import_jobs from anon, authenticated;
revoke all on public.pharmacy_catalog_import_job_items from anon, authenticated;
grant select on public.pharmacy_catalog_import_jobs to authenticated;
grant select on public.pharmacy_catalog_import_job_items to authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPC: import batch (upsert por ean / national_code / sku dentro de la farmacia)
--
-- p_rows: array jsonb, máx. 500 filas. Claves por fila (snake_case):
--   row_index, name, sku, ean, national_code, brand, laboratory, category,
--   source_family, source_subfamily, description, price, stock, min_stock,
--   price_provided, stock_provided, min_stock_provided
--
-- Idempotencia: si p_job_id ya existe (misma farmacia), las filas con
-- (job_id, row_index) ya procesadas (create/update/skip) se cuentan como
-- «replayed» y no se vuelven a aplicar. p_finalize cierra el job.
--
-- Solo se actualizan productos con source manual|import (nunca generic/demo).
-- Update: no pisa con vacíos; precio/stock solo si *_provided = true.
-- -----------------------------------------------------------------------------
create or replace function public.ff_pharmacy_products_import_batch_v1(
  p_pharmacy_id uuid,
  p_rows jsonb,
  p_job_id uuid default null,
  p_source_filename text default null,
  p_finalize boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
  v_job_pharmacy uuid;
  v_job_status text;
  v_row jsonb;
  v_ord integer;
  v_idx integer;
  v_name text;
  v_sku text;
  v_ean text;
  v_cn text;
  v_brand text;
  v_lab text;
  v_category text;
  v_family text;
  v_subfamily text;
  v_desc text;
  v_price numeric;
  v_stock integer;
  v_min_stock integer;
  v_price_provided boolean;
  v_stock_provided boolean;
  v_min_stock_provided boolean;
  v_cat_id uuid;
  v_match_id uuid;
  v_match_source text;
  v_new_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_replayed integer := 0;
  v_error_rows jsonb := '[]'::jsonb;
  v_skip_reason text;
begin
  if v_uid is null then
    raise exception 'catalog_import: sesión requerida'
      using errcode = '42501';
  end if;

  if p_pharmacy_id is null then
    raise exception 'catalog_import: pharmacy_id requerido'
      using errcode = '22023';
  end if;

  -- Permiso: plataforma (escritura) o catalog.manage con farmacia operable.
  if not (
    public.ff_has_platform_permission('platform.pharmacies.write')
    or (
      public.ff_has_pharmacy_permission(p_pharmacy_id, 'catalog.manage')
      and public.ff_pharmacy_is_operable(p_pharmacy_id)
    )
  ) then
    raise exception 'catalog_permission: se requiere catalog.manage'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'catalog_import: p_rows debe ser un array jsonb'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'catalog_import: sin filas'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'catalog_import: máximo 500 filas por llamada'
      using errcode = '22023';
  end if;

  -- Job (idempotente por p_job_id).
  v_job_id := coalesce(p_job_id, gen_random_uuid());
  insert into public.pharmacy_catalog_import_jobs (
    id, pharmacy_id, status, source_filename, created_by
  )
  values (
    v_job_id, p_pharmacy_id, 'running', nullif(btrim(p_source_filename), ''), v_uid
  )
  on conflict (id) do nothing;

  -- Serializa batches concurrentes del mismo job.
  select j.pharmacy_id, j.status
    into v_job_pharmacy, v_job_status
  from public.pharmacy_catalog_import_jobs j
  where j.id = v_job_id
  for update;

  if v_job_pharmacy is distinct from p_pharmacy_id then
    raise exception 'catalog_import: el job pertenece a otra farmacia'
      using errcode = '42501';
  end if;
  if v_job_status in ('reverted', 'partially_reverted', 'failed') then
    raise exception 'catalog_import: job cerrado (%)', v_job_status
      using errcode = '22023';
  end if;

  for v_row, v_ord in
    select e.value, e.ordinality::integer
    from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
  loop
    v_idx := coalesce((v_row ->> 'row_index')::integer, v_ord);

    -- Replay: fila ya aplicada en una llamada anterior del mismo job.
    if exists (
      select 1
      from public.pharmacy_catalog_import_job_items i
      where i.job_id = v_job_id
        and i.row_index = v_idx
        and i.action in ('create', 'update', 'skip')
    ) then
      v_replayed := v_replayed + 1;
      continue;
    end if;

    begin
      v_name := nullif(btrim(v_row ->> 'name'), '');
      v_sku := nullif(btrim(v_row ->> 'sku'), '');
      v_ean := nullif(btrim(v_row ->> 'ean'), '');
      v_cn := nullif(btrim(v_row ->> 'national_code'), '');
      v_brand := nullif(btrim(v_row ->> 'brand'), '');
      v_lab := nullif(btrim(v_row ->> 'laboratory'), '');
      v_family := nullif(btrim(v_row ->> 'source_family'), '');
      v_subfamily := nullif(btrim(v_row ->> 'source_subfamily'), '');
      v_desc := nullif(btrim(v_row ->> 'description'), '');
      -- Misma regla que la app: sin categoría FF se conserva la familia origen.
      v_category := nullif(btrim(v_row ->> 'category'), '');
      v_price_provided := coalesce((v_row ->> 'price_provided')::boolean, false);
      v_stock_provided := coalesce((v_row ->> 'stock_provided')::boolean, false);
      v_min_stock_provided :=
        coalesce((v_row ->> 'min_stock_provided')::boolean, false);
      v_price := (v_row ->> 'price')::numeric;
      v_stock := (v_row ->> 'stock')::integer;
      v_min_stock := (v_row ->> 'min_stock')::integer;
      v_skip_reason := null;
      v_match_id := null;
      v_match_source := null;
      v_cat_id := null;

      if v_name is null or length(v_name) < 2 then
        v_skip_reason := 'nombre_invalido';
      end if;

      -- Matching dentro de la farmacia: ean > código nacional > sku.
      if v_skip_reason is null then
        if v_ean is not null then
          select p.id, p.source into v_match_id, v_match_source
          from public.pharmacy_products p
          where p.pharmacy_id = p_pharmacy_id and p.ean = v_ean
          limit 1;
        end if;
        if v_match_id is null and v_cn is not null then
          select p.id, p.source into v_match_id, v_match_source
          from public.pharmacy_products p
          where p.pharmacy_id = p_pharmacy_id and p.national_code = v_cn
          limit 1;
          if v_match_id is null then
            -- Compatibilidad: CN guardado antes como sku o ean.
            select p.id, p.source into v_match_id, v_match_source
            from public.pharmacy_products p
            where p.pharmacy_id = p_pharmacy_id
              and (p.sku = v_cn or p.ean = v_cn)
            limit 1;
          end if;
        end if;
        if v_match_id is null and v_sku is not null then
          select p.id, p.source into v_match_id, v_match_source
          from public.pharmacy_products p
          where p.pharmacy_id = p_pharmacy_id and p.sku = v_sku
          limit 1;
        end if;

        if v_match_id is not null and v_match_source not in ('manual', 'import') then
          v_skip_reason := 'producto_no_editable_' || v_match_source;
        end if;
      end if;

      if v_skip_reason is not null then
        insert into public.pharmacy_catalog_import_job_items
          (job_id, product_id, row_index, action, payload)
        values (
          v_job_id, v_match_id, v_idx, 'skip',
          v_row || jsonb_build_object('reason', v_skip_reason)
        )
        on conflict (job_id, row_index) do update
          set product_id = excluded.product_id,
              action = excluded.action,
              payload = excluded.payload;
        v_skipped := v_skipped + 1;
        continue;
      end if;

      -- Categoría oficial: nombre/slug FF, alias legacy o equivalencia confirmada.
      if v_category is not null then
        select c.id into v_cat_id
        from public.ff_catalog_categories c
        where c.is_commercial
          and (lower(c.name) = lower(v_category) or c.slug = lower(v_category))
        limit 1;
        if v_cat_id is null then
          select c.id into v_cat_id
          from public.ff_catalog_category_aliases a
          join public.ff_catalog_categories c on c.slug = a.category_slug
          where lower(a.legacy_name) = lower(v_category)
          limit 1;
        end if;
      elsif v_family is not null then
        select e.category_id into v_cat_id
        from public.pharmacy_category_import_equivalences e
        where e.pharmacy_id = p_pharmacy_id
          and lower(e.source_family) = lower(v_family)
          and (
            e.source_subfamily is null
            or lower(e.source_subfamily) = lower(coalesce(v_subfamily, ''))
          )
        order by (e.source_subfamily is not null) desc
        limit 1;
      end if;

      -- Texto legacy de categoría: la categoría FF o, si no, la familia origen.
      v_category := coalesce(v_category, v_family);

      if v_match_id is not null then
        update public.pharmacy_products p
        set
          name = v_name,
          source = 'import',
          sku = coalesce(v_sku, p.sku),
          ean = coalesce(v_ean, p.ean),
          national_code = coalesce(v_cn, p.national_code),
          brand = coalesce(v_brand, p.brand),
          laboratory = coalesce(v_lab, p.laboratory),
          category = coalesce(v_category, p.category),
          source_family = coalesce(v_family, p.source_family),
          source_subfamily = coalesce(v_subfamily, p.source_subfamily),
          description = coalesce(v_desc, p.description),
          price = case
            when v_price_provided and v_price is not null then v_price
            else p.price
          end,
          stock = case
            when v_stock_provided and v_stock is not null then v_stock
            else p.stock
          end,
          min_stock = case
            when v_min_stock_provided and v_min_stock is not null then v_min_stock
            else p.min_stock
          end,
          category_id = coalesce(v_cat_id, p.category_id),
          classification_status = case
            when v_cat_id is not null then 'classified'
            when p.category_id is null
              and nullif(btrim(v_row ->> 'category'), '') is null
              and v_family is not null then 'pending_classification'
            else p.classification_status
          end,
          updated_by = v_uid
        where p.id = v_match_id
          and p.pharmacy_id = p_pharmacy_id
          and p.source in ('manual', 'import');

        insert into public.pharmacy_catalog_import_job_items
          (job_id, product_id, row_index, action, payload)
        values (v_job_id, v_match_id, v_idx, 'update', v_row)
        on conflict (job_id, row_index) do update
          set product_id = excluded.product_id,
              action = excluded.action,
              payload = excluded.payload;
        v_updated := v_updated + 1;
      else
        insert into public.pharmacy_products (
          pharmacy_id, sku, ean, national_code, name, description, brand,
          laboratory, category, source_family, source_subfamily,
          price, stock, min_stock, is_active, is_featured, source,
          availability_status, category_id, classification_status,
          created_by, updated_by
        )
        values (
          p_pharmacy_id, v_sku, v_ean, v_cn, v_name, v_desc, v_brand,
          v_lab, v_category, v_family, v_subfamily,
          case when v_price_provided and v_price is not null then v_price else 0 end,
          case when v_stock_provided and v_stock is not null then v_stock else 0 end,
          case
            when v_min_stock_provided and v_min_stock is not null then v_min_stock
            else 0
          end,
          true, false, 'import',
          'available', v_cat_id,
          case
            when v_cat_id is not null then 'classified'
            when v_family is not null then 'pending_classification'
            else null
          end,
          v_uid, v_uid
        )
        returning id into v_new_id;

        insert into public.pharmacy_catalog_import_job_items
          (job_id, product_id, row_index, action, payload)
        values (v_job_id, v_new_id, v_idx, 'create', v_row)
        on conflict (job_id, row_index) do update
          set product_id = excluded.product_id,
              action = excluded.action,
              payload = excluded.payload;
        v_created := v_created + 1;
      end if;
    exception when others then
      -- La subtransacción de este bloque se revierte; el resto del batch sigue.
      v_errors := v_errors + 1;
      v_error_rows := v_error_rows || jsonb_build_array(
        jsonb_build_object('row_index', v_idx, 'message', sqlerrm)
      );
      insert into public.pharmacy_catalog_import_job_items
        (job_id, product_id, row_index, action, payload)
      values (
        v_job_id, null, v_idx, 'error',
        jsonb_build_object('row', v_row, 'error', sqlerrm)
      )
      on conflict (job_id, row_index) do update
        set product_id = null,
            action = 'error',
            payload = excluded.payload;
    end;
  end loop;

  update public.pharmacy_catalog_import_jobs j
  set
    summary = jsonb_build_object(
      'created', coalesce((j.summary ->> 'created')::integer, 0) + v_created,
      'updated', coalesce((j.summary ->> 'updated')::integer, 0) + v_updated,
      'skipped', coalesce((j.summary ->> 'skipped')::integer, 0) + v_skipped,
      'errors', coalesce((j.summary ->> 'errors')::integer, 0) + v_errors,
      'batches', coalesce((j.summary ->> 'batches')::integer, 0) + 1
    ),
    status = case when p_finalize then 'completed' else j.status end,
    finished_at = case when p_finalize then now() else j.finished_at end,
    source_filename = coalesce(j.source_filename, nullif(btrim(p_source_filename), ''))
  where j.id = v_job_id;

  return jsonb_build_object(
    'job_id', v_job_id,
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'errors', v_errors,
    'replayed', v_replayed,
    'error_rows', v_error_rows
  );
end;
$$;

comment on function public.ff_pharmacy_products_import_batch_v1(
  uuid, jsonb, uuid, text, boolean
) is
  '107: upsert batch (<=500) por ean/national_code/sku, source=import. Requiere catalog.manage o platform.pharmacies.write. Idempotente por job_id+row_index.';

revoke all on function public.ff_pharmacy_products_import_batch_v1(
  uuid, jsonb, uuid, text, boolean
) from public;
grant execute on function public.ff_pharmacy_products_import_batch_v1(
  uuid, jsonb, uuid, text, boolean
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) RPC: revert suave por job
--
-- Solo desactiva (is_active=false) productos CREADOS por el job (items
-- action=create) con source=import que no se modificaron después:
-- updated_at ~= created_at (tolerancia 1 s). No se usa source_ref porque su
-- índice único por farmacia impide marcar varios productos con el mismo job.
-- No toca productos actualizados (update) ni borra filas. Re-ejecutable.
-- -----------------------------------------------------------------------------
create or replace function public.ff_pharmacy_products_import_revert_v1(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_pharmacy_id uuid;
  v_created_total integer;
  v_reverted integer;
  v_modified integer;
  v_already_inactive integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'catalog_import: sesión requerida'
      using errcode = '42501';
  end if;
  if p_job_id is null then
    raise exception 'catalog_import: job_id requerido'
      using errcode = '22023';
  end if;

  select j.pharmacy_id into v_pharmacy_id
  from public.pharmacy_catalog_import_jobs j
  where j.id = p_job_id
  for update;

  if v_pharmacy_id is null then
    raise exception 'catalog_import: job no encontrado'
      using errcode = 'P0002';
  end if;

  if not (
    public.ff_has_platform_permission('platform.pharmacies.write')
    or (
      public.ff_has_pharmacy_permission(v_pharmacy_id, 'catalog.manage')
      and public.ff_pharmacy_is_operable(v_pharmacy_id)
    )
  ) then
    raise exception 'catalog_permission: se requiere catalog.manage'
      using errcode = '42501';
  end if;

  select count(*)::integer into v_created_total
  from public.pharmacy_catalog_import_job_items i
  where i.job_id = p_job_id
    and i.action = 'create'
    and i.product_id is not null;

  with candidates as (
    select p.id
    from public.pharmacy_catalog_import_job_items i
    join public.pharmacy_products p on p.id = i.product_id
    where i.job_id = p_job_id
      and i.action = 'create'
      and p.pharmacy_id = v_pharmacy_id
      and p.source = 'import'
      and p.is_active
      and p.updated_at <= p.created_at + interval '1 second'
    for update of p
  ),
  upd as (
    update public.pharmacy_products p
    set is_active = false,
        updated_by = v_uid
    from candidates c
    where p.id = c.id
    returning p.id
  )
  select count(*)::integer into v_reverted from upd;

  select count(*)::integer into v_already_inactive
  from public.pharmacy_catalog_import_job_items i
  join public.pharmacy_products p on p.id = i.product_id
  where i.job_id = p_job_id
    and i.action = 'create'
    and not p.is_active;

  -- Creados por el job que siguen activos (editados después): no se tocan.
  select count(*)::integer into v_modified
  from public.pharmacy_catalog_import_job_items i
  join public.pharmacy_products p on p.id = i.product_id
  where i.job_id = p_job_id
    and i.action = 'create'
    and p.is_active;

  v_status := case when v_modified = 0 then 'reverted' else 'partially_reverted' end;

  update public.pharmacy_catalog_import_jobs j
  set
    status = v_status,
    finished_at = coalesce(j.finished_at, now()),
    summary = j.summary || jsonb_build_object(
      'revert', jsonb_build_object(
        'at', now(),
        'by', v_uid,
        'reverted', v_reverted,
        'kept_active_modified', v_modified
      )
    )
  where j.id = p_job_id;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', v_status,
    'created_by_job', v_created_total,
    'reverted', v_reverted,
    'already_inactive', v_already_inactive - v_reverted,
    'kept_active_modified', v_modified
  );
end;
$$;

comment on function public.ff_pharmacy_products_import_revert_v1(uuid) is
  '107: revert suave: is_active=false solo en productos creados por el job y no modificados después.';

revoke all on function public.ff_pharmacy_products_import_revert_v1(uuid) from public;
grant execute on function public.ff_pharmacy_products_import_revert_v1(uuid)
  to authenticated;

-- rollback; -- mantener comentado; usar rollback en ensayos
-- commit;

-- DOWN (manual, desarrollo):
-- drop function if exists public.ff_pharmacy_products_import_revert_v1(uuid);
-- drop function if exists public.ff_pharmacy_products_import_batch_v1(uuid, jsonb, uuid, text, boolean);
-- drop table if exists public.pharmacy_catalog_import_job_items;
-- drop table if exists public.pharmacy_catalog_import_jobs;
