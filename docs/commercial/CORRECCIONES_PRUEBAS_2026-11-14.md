# FarmaFácil — Correcciones comerciales (2026-11-14)

## Entorno verificado

| Ítem | Valor |
|---|---|
| Worktree | `.worktrees/launch-seats-manage` |
| Rama | `feature/launch-seats-manage` |
| Preview | `http://127.0.0.1:3060` |
| Staging Supabase | `dazfdcjscnpfvhcyjddt` |
| Emails (no tocado) | `:3065` / `emails-postprod` |
| Producción | Intacta |

## Migraciones aplicadas en staging

- `091` alta farmacia sin trial automático  
- `092` extensión caducidad plaza  
- `093` assign plan desacoplado de plaza  
- `094` reserva titular  
- `095` activación piloto con plan G/P/IA (`trial_plan_sku`)  
- `096` estado `cancelled` + `commercial_quote_documents`  

No se reaplicó 056 (RPC assign ya existía vía 083).

## Incidencias corregidas

1. **Simulador** — Ofertas: Tarifa normal | Lanzamiento 2027. Proyección 2027/2028/2029+ centralizada en `buildCommercialYearProjection`. Sin reserva de plaza al simular/guardar.  
2. **Pilotos** — No es 4º plan. Prep sin reloj; activación con plan explícito; «Comprobar preparación»; ampliación/finalización.  
3. **Contratación** — Farmacia por nombre; sin UUID/RPC/056 en UI ordinaria; dominios separados; assign no reserva plaza.  
4. **Cuota kiosko** — Etiqueta centralizada `KIOSK_USAGE_FEE_LABEL_ES`.  
5. **PDF** — Generación servidor A4 (jsPDF), descarga/envío idénticos; vínculo en meta + tabla documentos.  
6. **Email** — Cuerpo breve + PDF adjunto; registro best-effort en `email_sends`.  
7. **Presupuestos** — Estados + Anulado; nombres de plan en castellano; sin sobrescribir enviados.  

## Pruebas unitarias

`node --experimental-strip-types --test lib/tarifas/simulator.test.ts` — proyección control:

- Inicial 1.280 € · 2027 rec. 1.056 € · neto 2.336 € · IVA incl. 2.826,56 €  
- 2028 rec. 1.407 € · 2029 rec. 1.758 €  

## Pendiente manual en UI :3060

- Envío real a destinatario interno autorizado + comprobar Emails > Enviados  
- Ciclo piloto preparado → activo → ampliado → finalizado  
- Confirmar independencia plaza vs assign  
- Firma jurídica sigue bloqueada (contratos)  
