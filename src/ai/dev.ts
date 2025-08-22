'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createUserDb, getUserByEmailDb, getUserByIdDb, updateUserProfilePictureDb, updateUserNameDb, deleteUserDb, createPendingRegistration, getPendingRegistrationByOtp, deletePendingRegistration, createPasswordResetToken, getPasswordResetToken, deletePasswordResetToken, updateUserPasswordDb } from '@/lib/db';
import type { NewUser, User, UserStatus, PendingRegistration } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { sendOtp } from '@/ai/flows/send-otp-flow';
import { sendPasswordResetOtp } from '@/ai/flows/send-password-reset-flow';
import { customAlphabet } from 'nanoid';

const USER_COOKIE_NAME = 'user-auth-token';

// Use a fallback secret for development if not set, but log a strong warning.
const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    // In production, the secret is absolutely mandatory.
    console.error('----------------------------------------------------------------');
    console.error('FATAL: A secure JWT_SECRET environment variable must be set for production.');
    console.error('Application will not function correctly without it.');
    console.error('----------------------------------------------------------------');
}
const JWT_SECRET = new TextEncoder().encode(secret || 'fallback-secret-for-jwt-that-is-at-least-32-bytes-long');

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('----------------------------------------------------------------');
  console.warn('WARNING: JWT_SECRET environment variable is not set. Using a temporary, insecure fallback secret.');
  console.warn('THIS IS NOT SAFE FOR PRODUCTION. Please set a secure secret in your .env.local file.');
  console.warn('----------------------------------------------------------------');
}


export async function encrypt(payload: any) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10y') // Set session to expire in 10 years
    .sign(JWT_SECRET);
}

async function decrypt(token: string): Promise<any | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // This will happen if the token is invalid or the secret is wrong.
    console.error('Failed to verify JWT:', error);
    return null;
  }
}

export async function signUp(newUser: NewUser): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = newUser.email.toLowerCase();
    const existingUser = await getUserByEmailDb(emailLower);
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists.' };
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordhash = await bcrypt.hash(newUser.passwordplaintext, salt);

    // Generate OTP
    const nanoid = customAlphabet('1234567890', 6);
    const otp = nanoid();

    // Store pending registration
    await createPendingRegistration({ ...newUser, email: emailLower, passwordhash }, otp);

    // Send OTP email
    await sendOtp({
      name: newUser.name,
      email: emailLower,
      otp: otp,
    });

    return { success: true };

  } catch (error: any) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message || 'An unknown error occurred during sign up.' };
  }
}

export async function verifyOtpAndCreateUser(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const pendingUser = await getPendingRegistrationByOtp(email, otp);

    if (!pendingUser) {
      return { success: false, error: 'Invalid or expired OTP. Please try again.' };
    }

    const userData: NewUser = {
        name: pendingUser.name,
        email: pendingUser.email,
        role: pendingUser.role as any, // Cast because the type is slightly different
        countryCode: '', // Not needed for final creation
        mobilenumber: pendingUser.mobilenumber || '',
        business_category: pendingUser.business_category,
        business_other_category: pendingUser.business_other_category,
        referral_code: pendingUser.referral_code,
        passwordplaintext: '' // Not needed, we already have the hash
    };
    
    // Pass the pre-hashed password to createUserDb
    const user = await createUserDb({ ...userData, passwordplaintext: pendingUser.passwordhash }, 'approved');

    if (!user) {
        throw new Error("Failed to create user account after verification.");
    }
    
    await deletePendingRegistration(email);

    // Log the user in immediately
    await login(email, '', true, pendingUser.passwordhash);

    return { success: true };
  } catch (error: any) {
    console.error('OTP verification error:', error);
    return { success: false, error: error.message || 'An unexpected server error occurred.' };
  }
}


export async function login(email: string, password?: string, isVerified = false, passwordHash?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = email.toLowerCase();
    const user = await getUserByEmailDb(emailLower);

    if (!user) {
      return { success: false, error: 'Invalid email or password.' };
    }
    
    if (user.status === 'rejected') {
        return { success: false, error: 'Your account has been rejected.' };
    }

    // If coming from OTP verification, we trust the hash. Otherwise, compare passwords.
    const isPasswordValid = isVerified ? (user.passwordhash === passwordHash) : await bcrypt.compare(password!, user.passwordhash);

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const sessionPayload = { userId: user.id };
    const sessionToken = await encrypt(sessionPayload);
    const maxAgeInSeconds = 10 * 365 * 24 * 60 * 60; // 10 years
    const expires = new Date(Date.now() + maxAgeInSeconds * 1000);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const allowInsecure = process.env.ALLOW_INSECURE_LOGIN_FOR_HTTP === 'true';

    cookies().set(USER_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isProduction && !allowInsecure,
      maxAge: maxAgeInSeconds,
      expires: expires,
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}

export async function logout(): Promise<void> {
  cookies().delete(USER_COOKIE_NAME);
  // Revalidate the entire layout to ensure the session is re-read everywhere.
  revalidatePath('/', 'layout');
}

export const getSession = cache(async (): Promise<{ user: User | null }> => {
  const token = cookies().get(USER_COOKIE_NAME)?.value;
  if (!token) {
    return { user: null };
  }

  const payload = await decrypt(token);
  if (!payload || !payload.userId) {
    return { user: null };
  }

  const user = await getUserByIdDb(payload.userId);

  return { user };
});

export async function updateUserProfilePicture(imageUrl: string): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to update your profile picture.' };
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    return { success: false, error: 'No valid image URL provided.' };
  }

  try {
    await updateUserProfilePictureDb(user.id, imageUrl);
    revalidatePath(`/users/${user.id}`);
    revalidatePath('/', 'layout'); // To update the user-nav avatar
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating profile picture for user ${user.id}:`, error);
    return { success: false, error: 'Failed to update profile picture.' };
  }
}

export async function updateUsername(name: string): Promise<{ success: boolean; error?: string; user?: User }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to update your name.' };
  }

  if (!name || name.trim().length < 2) {
    return { success: false, error: 'Name must be at least 2 characters long.' };
  }
  
  if (name.trim().length > 50) {
    return { success: false, error: 'Name cannot exceed 50 characters.' };
  }

  try {
    const updatedUser = await updateUserNameDb(user.id, name.trim());
    if (updatedUser) {
      revalidatePath(`/users/${user.id}`);
      revalidatePath('/', 'layout'); // To update the user-nav
      return { success: true, user: updatedUser };
    }
    return { success: false, error: 'Failed to update username.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}

export async function deleteCurrentUserAccount(): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to delete your account.' };
  }
  
  try {
    // Note: The database is configured with ON DELETE SET NULL for posts.authorid
    // and ON DELETE CASCADE for related data like likes, follows, etc.
    await deleteUserDb(user.id);
    // The logout will handle the redirect, but we can push to be safe
    await logout();
    redirect('/');
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete account for user ${user.id}:`, error);
    return { success: false, error: 'An unexpected server error occurred while deleting your account.' };
  }
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = email.toLowerCase();
    const user = await getUserByEmailDb(emailLower);

    if (!user) {
      // Don't reveal if an email exists or not for security reasons.
      return { success: true };
    }

    const nanoid = customAlphabet('1234567890', 6);
    const otp = nanoid();

    await createPasswordResetToken(emailLower, otp);

    await sendPasswordResetOtp({
      name: user.name,
      email: emailLower,
      otp: otp,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Password reset request error:', error);
    // Fail silently to the user to prevent enumeration attacks, but log the error.
    return { success: true };
  }
}

export async function resetPassword(email: string, otp: string, newPassword: string):Promise<{ success: boolean; error?: string }> {
    try {
        const emailLower = email.toLowerCase();
        const resetToken = await getPasswordResetToken(emailLower, otp);

        if (!resetToken) {
            return { success: false, error: 'Invalid or expired OTP. Please request a new one.' };
        }

        const salt = await bcrypt.genSalt(10);
        const passwordhash = await bcrypt.hash(newPassword, salt);

        await updateUserPasswordDb(emailLower, passwordhash);
        await deletePasswordResetToken(emailLower);

        return { success: true };
    } catch (error: any) {
        console.error('Password reset error:', error);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
}