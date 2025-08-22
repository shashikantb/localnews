

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { updateUserMobileDb, updateUserBusinessCategoryDb, updateUserStatusDb, updateUserLocationDb } from '@/lib/db';
import { z } from 'zod';
import type { UpdateBusinessCategory } from '@/lib/db-types';

const mobileSchema = z.object({
    countryCode: z.string().min(1, 'Country code is required.'),
    mobilenumber: z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number.'),
});

export async function updateUserMobile(data: { countryCode: string; mobilenumber: string }) {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  const validation = mobileSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }
  
  try {
    const fullMobileNumber = `${validation.data.countryCode}${validation.data.mobilenumber}`;
    await updateUserMobileDb(user.id, fullMobileNumber);
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Failed to update mobile number.' };
  }
}

export async function updateUserBusinessCategory(data: UpdateBusinessCategory) {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  try {
    await updateUserBusinessCategoryDb(user.id, data);
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Failed to update business category.' };
  }
}

export async function requestBusinessVerification(): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user || user.role !== 'Business') {
    return { success: false, error: 'Only business users can request verification.' };
  }

  try {
    const updatedUser = await updateUserStatusDb(user.id, 'pending_verification');
    if (updatedUser) {
      revalidatePath(`/users/${user.id}`);
      return { success: true };
    }
    return { success: false, error: 'Failed to update status.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUserLocationAction(latitude: number, longitude: number): Promise<{ success: boolean; error?: string; }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        await updateUserLocationDb(user.id, latitude, longitude);
        revalidatePath(`/users/${user.id}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to update location.' };
    }
}
