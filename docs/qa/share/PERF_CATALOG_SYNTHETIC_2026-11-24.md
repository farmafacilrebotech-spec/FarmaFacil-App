# Rendimiento sintético import catálogo (CPU local, sin BD)

Generado: 2026-11-24T20:27:48.060Z

| Productos | preview ms | plan lotes ms | total CPU ms | inválidas | creates | lotes×100 | payload bytes |
|----------:|-----------:|--------------:|-------------:|----------:|--------:|----------:|--------------:|
| 100 | 0.05 | 0.08 | 0.14 | 0 | 100 | 1 | 14691 |
| 1000 | 0.13 | 0.5 | 0.64 | 0 | 1000 | 10 | 147900 |
| 2000 | 0.19 | 0.34 | 0.53 | 1334 | 1333 | 14 | 197521 |
| 5000 | 0.4 | 0.89 | 1.29 | 3336 | 3332 | 34 | 495392 |
| 10000 | 0.75 | 1.7 | 2.45 | 6670 | 6665 | 67 | 992042 |
| 20000 | 1.54 | 3.51 | 5.04 | 13340 | 13330 | 134 | 1988524 |

Notas:
- Medición **local CPU** (parse/validación/planificación). No incluye latencia PostgREST/Vercel↔Supabase.
- Escritura real en staging ya medida históricamente ~4,5 min (1 insert/fila); código actual usa multi-insert ×100 + lotes cliente.
- Escritura real en BD desechable `:54532` (2026-11-24): batch **500** creates en **~57 ms** (`SMOKE_CATALOG_INTEGRAL_54532_2026-11-24.md`).
- **No se aplicaron migraciones 089/090** en staging/prod.
