

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { getAppointmentsForCustomerDb, updateAppointmentStatusDb } from '@/lib/db';
import type { CustomerAppointment, AppointmentStatus } from '@/lib/db-types';

export async function getMyBookings(): Promise<CustomerAppointment[]> {
    const { user } = await getSession();
    if (!user) return [];
    
    return getAppointmentsForCustomerDb(user.id);
}

export async function cancelMyBooking(appointmentId: number): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        // The last parameter `isCustomer` should be true.
        const result = await updateAppointmentStatusDb(appointmentId, 'cancelled', user.id, true);
        if (!result) {
            return { success: false, error: 'Appointment not found or you do not have permission to cancel it.' };
        }
        revalidatePath('/account/my-bookings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
