
'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { addBusinessServiceDb, getBusinessServicesDb, updateBusinessServiceDb, deleteBusinessServiceDb } from '@/lib/db';
import type { NewBusinessService } from '@/lib/db-types';

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
