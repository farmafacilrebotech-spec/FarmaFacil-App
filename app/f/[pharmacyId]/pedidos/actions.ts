'use server';

import { revalidatePath } from 'next/cache';

import { confirmPharmacyOrderAmount } from '@/lib/orders/confirm-amount';
import {
  getPharmacyOrderDetail,
  listPharmacyOrders,
} from '@/lib/orders/queries';
import {
  updatePharmacyOrderPaymentStatus,
  updatePharmacyOrderStatus,
} from '@/lib/orders/update-status';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

function revalidateOrders(pharmacyId: string) {
  revalidatePath(`/f/${pharmacyId}/pedidos`);
}

export async function listPharmacyOrdersAction(
  pharmacyId: string,
  options?: { status?: OrderStatus; limit?: number }
) {
  return listPharmacyOrders(pharmacyId, options);
}

export async function getPharmacyOrderDetailAction(
  pharmacyId: string,
  orderId: string
) {
  return getPharmacyOrderDetail(pharmacyId, orderId);
}

export async function updatePharmacyOrderStatusAction(input: {
  pharmacyId: string;
  orderId: string;
  newStatus: OrderStatus;
  currentStatus?: OrderStatus;
}) {
  const result = await updatePharmacyOrderStatus(input);
  if (result.ok) {
    revalidateOrders(input.pharmacyId);
  }
  return result;
}

export async function updatePharmacyOrderPaymentStatusAction(input: {
  pharmacyId: string;
  orderId: string;
  newPaymentStatus: PaymentStatus;
  currentPaymentStatus?: PaymentStatus;
}) {
  const result = await updatePharmacyOrderPaymentStatus(input);
  if (result.ok) {
    revalidateOrders(input.pharmacyId);
  }
  return result;
}

export async function confirmPharmacyOrderAmountAction(input: {
  pharmacyId: string;
  orderId: string;
  amount: number;
}) {
  const result = await confirmPharmacyOrderAmount(input);
  if (result.ok) {
    revalidateOrders(input.pharmacyId);
  }
  return result;
}
