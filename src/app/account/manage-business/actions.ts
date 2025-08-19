
'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { 
    addBusinessServiceDb, getBusinessServicesDb, updateBusinessServiceDb, deleteBusinessServiceDb, 
    getBusinessHoursDb, updateBusinessHoursDb,
    getBusinessResourcesDb, addBusinessResourceDb, updateBusinessResourceDb, deleteBusinessResourceDb
} from '@/lib/db';
import type { NewBusinessService, BusinessHour, NewBusinessResource } from '@/lib/db-types';

export async function getBusinessServices() {
    const { user } = await getSession();
    if (!user) {
        return [];
    }
    return getBusinessServicesDb(user.id);
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
export async function getBusinessHours() {
    const { user } = await getSession();
    if (!user) {
        return [];
    }
    return getBusinessHoursDb(user.id);
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
export async function getBusinessResources() {
    const { user } = await getSession();
    if (!user) {
        return [];
    }
    return getBusinessResourcesDb(user.id);
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
