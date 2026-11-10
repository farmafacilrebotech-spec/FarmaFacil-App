# Limpieza de datos DEMO del comparador (PR #21)

Marcador: `DEMO-PR21-COMPARE` / `tax_id LIKE 'DEMO-PR21-%'`.

Solo staging (`dazfdcjscnpfvhcyjddt`). No ejecutar en producción.

## Qué se elimina

- Líneas y presupuestos `[DEMO] …`
- Proveedores con `tax_id` `DEMO-PR21-ALPHA|BETA|GAMMA`

No se crean pedidos confirmados ni facturas; no hace falta limpiar POs.

## SQL de limpieza (idempotente)

```sql
BEGIN;

DELETE FROM public.platform_supplier_quote_lines
WHERE quote_id IN (
  SELECT q.id
  FROM public.platform_supplier_quotes q
  JOIN public.platform_suppliers p ON p.id = q.supplier_id
  WHERE p.tax_id LIKE 'DEMO-PR21-%'
     OR q.title LIKE '[DEMO]%'
     OR coalesce(q.notes, '') LIKE '%DEMO-PR21-COMPARE%'
);

DELETE FROM public.platform_supplier_quote_documents
WHERE quote_id IN (
  SELECT q.id
  FROM public.platform_supplier_quotes q
  JOIN public.platform_suppliers p ON p.id = q.supplier_id
  WHERE p.tax_id LIKE 'DEMO-PR21-%'
     OR q.title LIKE '[DEMO]%'
);

DELETE FROM public.platform_supplier_quotes
WHERE supplier_id IN (
  SELECT id FROM public.platform_suppliers WHERE tax_id LIKE 'DEMO-PR21-%'
)
OR title LIKE '[DEMO]%'
OR coalesce(notes, '') LIKE '%DEMO-PR21-COMPARE%';

DELETE FROM public.platform_supplier_contacts
WHERE supplier_id IN (
  SELECT id FROM public.platform_suppliers WHERE tax_id LIKE 'DEMO-PR21-%'
);

DELETE FROM public.platform_supplier_activity
WHERE supplier_id IN (
  SELECT id FROM public.platform_suppliers WHERE tax_id LIKE 'DEMO-PR21-%'
);

DELETE FROM public.platform_suppliers
WHERE tax_id LIKE 'DEMO-PR21-%';

COMMIT;
```

## Re-seed

```bash
node scripts/staging-seed-demo-quote-compare.mjs
```

Idempotente: no duplica proveedores ni presupuestos con el mismo título DEMO.
