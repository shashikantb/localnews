

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { 
    addBusinessServiceDb, getBusinessServicesDb, updateBusinessServiceDb, deleteBusinessServiceDb, 
    getBusinessHoursDb, updateBusinessHoursDb,
    getBusinessResourcesDb, addBusinessResourceDb, updateBusinessResourceDb, deleteBusinessResourceDb,
    getAppointmentsForBusinessDb, createAppointmentDb
} from '@/lib/db';
import type { NewBusinessService, BusinessHour, NewBusinessResource, Appointment } from '@/lib/db-types';

export async function getBusinessServices(businessId: number) {
    return getBusinessServicesDb(businessId);
}

export async function addBusinessService(service: NewBusinessService) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        await addBusinessServiceDb(user.id, service);
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateBusinessService(serviceId: number, service: NewBusinessService) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        const updated = await updateBusinessServiceDb(serviceId, user.id, service);
        if (!updated) {
            return { success: false, error: 'Service not found or permission denied.' };
        }
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteBusinessService(serviceId: number) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        await deleteBusinessServiceDb(serviceId, user.id);
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

// --- Schedule Actions ---
export async function getBusinessHours(businessId: number) {
    return getBusinessHoursDb(businessId);
}

export async function updateBusinessHours(hours: Omit<BusinessHour, 'id' | 'user_id'>[]) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        await updateBusinessHoursDb(user.id, hours);
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- Resource Actions ---
export async function getBusinessResources(businessId: number) {
    return getBusinessResourcesDb(businessId);
}

export async function addBusinessResource(resource: NewBusinessResource) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        await addBusinessResourceDb(user.id, resource);
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateBusinessResource(resourceId: number, resource: NewBusinessResource) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        const updated = await updateBusinessResourceDb(resourceId, user.id, resource);
        if (!updated) {
            return { success: false, error: 'Resource not found or permission denied.' };
        }
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteBusinessResource(resourceId: number) {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required' };
    }
    try {
        await deleteBusinessResourceDb(resourceId, user.id);
        revalidatePath('/account/manage-business');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- Appointment Actions ---
export async function getAppointmentsForBusiness(businessId: number, date: string): Promise<Appointment[]> {
    return getAppointmentsForBusinessDb(businessId, date);
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'status' | 'created_at' | 'customer_id'>): Promise<{ success: boolean; error?: string; appointment?: Appointment }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required.' };
    }
    
    try {
        const newAppointment = await createAppointmentDb({ ...appointment, customer_id: user.id });
        return { success: true, appointment: newAppointment };
    } catch (error: any) {
        console.error("Error creating appointment:", error);
        return { success: false, error: error.message };
    }
}
