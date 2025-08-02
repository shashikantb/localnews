
'use server';

import { getAllUsersWithDeviceTokensDb } from '@/lib/db';
import admin from '@/utils/firebaseAdmin';
import type { MulticastMessage } from 'firebase-admin/messaging';

export async function sendLpPointsNotification(): Promise<{ success: boolean; error?: string; successCount?: number; failureCount?: number }> {
  if (!admin.apps.length) {
    return { success: false, error: 'Firebase Admin not configured. Cannot send notifications.' };
  }
  
  try {
    const usersWithTokens = await getAllUsersWithDeviceTokensDb();
    if (usersWithTokens.length === 0) {
      return { success: false, error: 'No users with registered devices found.' };
    }

    const messages: MulticastMessage[] = usersWithTokens.map(user => {
      const yesterdayPoints = user.yesterday_points || 0;
      const title = yesterdayPoints > 0 
          ? `You earned ${yesterdayPoints} LP points yesterday! 🎉`
          : 'Check your LP Points! ✨';
      
      const body = `Your total is now ${user.total_points}. Keep pulsing to earn more!`;

      return {
          token: user.token,
          notification: { title, body },
          data: {
              user_auth_token: user.user_auth_token || ''
          },
          android: { priority: 'high' as const },
          apns: { payload: { aps: { 'content-available': 1 } } }
      }
    });

    // Firebase allows sending up to 500 messages at a time.
    // For larger scale, we would need to batch this. For now, this is sufficient.
    const batchResponse = await admin.messaging().sendEach(messages as any[]);
    
    console.log(`Notifications sent: ${batchResponse.successCount} success, ${batchResponse.failureCount} failures.`);

    if (batchResponse.failureCount > 0) {
      batchResponse.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${usersWithTokens[idx].token}:`, resp.error);
        }
      });
    }

    return { success: true, successCount: batchResponse.successCount, failureCount: batchResponse.failureCount };

  } catch (error: any) {
    console.error('Error sending LP points notification:', error);
    return { success: false, error: 'An unexpected server error occurred.' };
  }
}
