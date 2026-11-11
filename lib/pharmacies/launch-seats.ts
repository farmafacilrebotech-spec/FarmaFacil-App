import { createClient } from '@/lib/supabase/server';
import { LAUNCH_2027_MAX_SLOTS } from '@/lib/pharmacies/commercial-assign-pricing';

export type LaunchSeatsSummary = {
  cohortKey: 'launch_2027';
  maxSlots: number;
  usedSlots: number;
  remaining: number;
  pharmacyHasActiveSeat: boolean;
};

export async function getLaunch2027SeatsSummary(
  pharmacyId?: string | null
): Promise<LaunchSeatsSummary> {
  const supabase = createClient();
  const { data: counter } = await supabase
    .from('commercial_launch_cohort_counters')
    .select('max_slots, used_slots')
    .eq('cohort_key', 'launch_2027')
    .maybeSingle();

  const maxSlots = counter?.max_slots ?? LAUNCH_2027_MAX_SLOTS;
  const usedSlots = counter?.used_slots ?? 0;

  let pharmacyHasActiveSeat = false;
  if (pharmacyId) {
    const { data: seat } = await supabase
      .from('commercial_launch_seat_reservations')
      .select('id')
      .eq('cohort_key', 'launch_2027')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'active')
      .maybeSingle();
    pharmacyHasActiveSeat = Boolean(seat?.id);
  }

  return {
    cohortKey: 'launch_2027',
    maxSlots,
    usedSlots,
    remaining: Math.max(maxSlots - usedSlots, 0),
    pharmacyHasActiveSeat,
  };
}
