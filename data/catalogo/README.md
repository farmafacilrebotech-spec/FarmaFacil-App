# Catálogo maestro FarmaFácil (100)

## Archivo oficial

`Catalogo_Maestro_FarmaFacil_100.xlsx`

- Hoja `Catalogo maestro`: 100 filas FF-GEN-001 … FF-GEN-100
- Hoja `Reglas de uso`: modalidad Piloto/General vs Personalizado

## Validación local

Artefacto generado (no inventa datos): `_validated_master.json`

```bash
node --experimental-strip-types --test lib/catalog/master-catalog.test.ts
```

## Migraciones (NO aplicadas aún)

| Orden | Archivo | Contenido |
|------:|---------|-----------|
| 1 | `054_master_catalog_generic_v1.sql` | Tabla maestra + seed 100 + `catalog_mode` + attach/sync/set_mode + guard RLS |
| 2 | `055_master_catalog_modes_public_v1.sql` | Prep/readiness 100, kiosko filtrado, `ff_public_catalog_list_v1` |

Aplicar solo en staging tras autorización explícita.
