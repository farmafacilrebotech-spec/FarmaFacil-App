# Informe PRE-05C — correcciones finales

Rama: `integration/farmafacil-release` · Staging `:3070` · Sin producción.

## 1. Causa del error de estados / reintento

El dry-run registraba `emailSends.status = 'sent'` y pasaba el presupuesto a **Enviado**, aunque no hubiera Resend. La UI además trataba cualquier `emailStatus !== 'sent'` como fallo, de modo que un estado `simulated` se mostraba como error.

## 2. Correcciones

| Área | Cambio |
|---|---|
| Dry-run | Status `simulated`; **no** cambia estado comercial; UI «Simulado (sin correo)» |
| Reintento | Permitido; toast de simulación; F0TQ restaurado a Borrador con trazabilidad |
| Logo | `farmafacil-mark.svg` (circular) en lugar del PNG cuadrado negro |
| Periodicidad anual | «Coste recurrente anualizado»; software anual / kiosko mensual con IVA; evolución «equiv. prepago anual» |
| Allowlist | Añadido `pruebas@farmafacil.solutions` (entre comillas) |
| Envío real | Preparado, **no ejecutado** — ver `PRE05C_ENVIO_REAL_PENDIENTE.md` |

### F0TQ

- Antes: `sent` + dry_run falso positivo.
- Después: `draft`; envío marcado `simulated`; nota de corrección en historial.

## 3. Pruebas

| Suite | Resultado |
|---|---|
| `test:commercial-quotes` | 13/13 |
| `test:commercial-ui` | 33/33 |
| E2E PRE-05C + comercial + EMAIL-10 circuito | **16/16** |
| Allowlist `pruebas@` | OK; terceros bloqueados |

## 4. Gate integrado

`:3070` activo · login 200 · dry-run ON · EMAIL-10 sin regresión.

## 5. Pendiente de cierre PRE-05

Autorización expresa de la usuaria para un **único** envío real a `pruebas@farmafacil.solutions` (daemon con dry-run OFF solo para esa prueba).
