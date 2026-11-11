/**
 * Agregación pura de pedidos → clientes vinculados (sin I/O).
 * Criterio: customer_profile_id no nulo; datos de contacto solo de esos pedidos.
 */

export type LinkedOrderSeed = {
  customerProfileId: string;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
};

export type AggregatedLinkedClient = {
  customerProfileId: string;
  displayName: string;
  phone: string | null;
  firstLinkedAt: string;
  lastOrderAt: string;
  orderCount: number;
};

function pickDisplayName(names: Array<string | null | undefined>): string {
  for (const n of names) {
    const t = (n ?? '').trim();
    if (t) return t;
  }
  return 'Cliente';
}

export function aggregateLinkedClientsFromOrders(
  rows: LinkedOrderSeed[],
  limit = 200
): AggregatedLinkedClient[] {
  const byCustomer = new Map<
    string,
    {
      names: string[];
      phones: string[];
      first: string;
      last: string;
      count: number;
    }
  >();

  for (const raw of rows) {
    const cid = raw.customerProfileId;
    if (!cid) continue;
    const cur = byCustomer.get(cid) ?? {
      names: [],
      phones: [],
      first: raw.createdAt,
      last: raw.createdAt,
      count: 0,
    };
    cur.count += 1;
    if (raw.customerName?.trim()) cur.names.push(raw.customerName.trim());
    if (raw.customerPhone?.trim()) cur.phones.push(raw.customerPhone.trim());
    if (raw.createdAt < cur.first) cur.first = raw.createdAt;
    if (raw.createdAt > cur.last) cur.last = raw.createdAt;
    byCustomer.set(cid, cur);
  }

  return Array.from(byCustomer.entries())
    .map(([customerProfileId, agg]) => ({
      customerProfileId,
      displayName: pickDisplayName(agg.names),
      phone: agg.phones[0] ?? null,
      firstLinkedAt: agg.first,
      lastOrderAt: agg.last,
      orderCount: agg.count,
    }))
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt))
    .slice(0, Math.min(Math.max(limit, 1), 200));
}
