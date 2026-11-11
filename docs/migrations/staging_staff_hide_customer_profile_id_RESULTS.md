# Resultados — staff_hide customer_profile_id (staging)

**Fecha:** 2026-11-11  
**Proyecto:** `dazfdcjscnpfvhcyjddt`  
**SQL aplicado:** v1 + v1b + **v1c** (RPC área cliente)  
**Prod:** **no** aplicado

## Smoke (`scripts/staging-staff-hide-customer-profile-id-smoke.mjs`)

| Prueba | Resultado |
|--------|-----------|
| RPCs pharmacy clients presentes | PASS |
| `authenticated` sin SELECT `customer_profile_id` | PASS |
| STAFF PostgREST `customer_profile_id` | DENY |
| STAFF pedidos ops (nombre/tel/status) | ALLOW |
| STAFF RPC list clients | forbidden |
| Owner/Admin/Farmacéutico RPC list | ok + aislamiento otras farmacias |
| Owner PostgREST `customer_profile_id` | DENY (usa RPC) |
| Cliente RPC `ff_list_my_customer_orders_v1` | ok |
| Cliente PostgREST `customer_profile_id` | DENY |

## Nota v1c

Tras v1b, filtrar por `customer_profile_id` en PostgREST rompe el área cliente.  
`v1c` añade `ff_list_my_customer_orders_v1`; la app usa esa RPC.
