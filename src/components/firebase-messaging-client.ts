
'use client';

import { useEffect } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { registerDeviceToken } from '@/app/actions';

// This component handles the client-side logic for Firebase Cloud Messaging.
// It's responsible for requesting notification permission and registering the device token.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const FirebaseMessagingClient = () => {
  useEffect(() => {
    // This effect runs once on the client when the app loads.
    const setupFirebaseMessaging = async () => {
      // Ensure this runs only on the client side and that service workers are supported.
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
      }

      // Check if all required Firebase config keys are present
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId) {
        console.warn("Firebase client configuration is incomplete. Push notifications will be disabled.");
        return;
      }

      // Initialize Firebase
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

      // Check for a custom interface provided by the native Android app's WebView.
      // If this exists, we assume we are inside the app and can get the token directly.
      if ((window as any).Android && typeof (window as any).Android.getFCMToken === 'function') {
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(async () => {
          const token = (window as any).Android.getFCMToken();
          if (token) {
            clearInterval(interval);
            console.log('FCM Token from Android WebView:', token);
            // Register the token with the server
            await registerDeviceToken(token);
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              console.warn('Could not retrieve FCM token from Android WebView after multiple attempts.');
            }
          }
        }, 1000);
      } else {
        // This is a standard web browser. We will now handle requesting permission and getting the token.
        console.log("Not inside Android WebView. Standard web push notification flow will be used.");

        try {
            const messaging = getMessaging(app);
            
            // Check if permission was already granted
            if(Notification.permission === 'granted') {
                console.log('Notification permission already granted.');
                const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                if (!vapidKey) {
                    console.error("VAPID key is missing in environment variables (NEXT_PUBLIC_FIREBASE_VAPID_KEY). Cannot generate web token.");
                    return;
                }
                const currentToken = await getToken(messaging, { vapidKey: vapidKey });
                if (currentToken) {
                    console.log('FCM Token:', currentToken);
                    await registerDeviceToken(currentToken);
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                }
            } else if (Notification.permission === 'default') {
                console.log('Requesting notification permission...');
                // The permission request should be initiated by a user gesture, e.g., a button click.
                // This logic is now handled by the button in `PostFeedClient`.
            }

            // Handle foreground messages
             onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);
                // You can display a custom notification/toast here
                const notificationTitle = payload.notification?.title || 'New Notification';
                const notificationOptions = {
                    body: payload.notification?.body || '',
                    icon: '/icons/icon-192x192.png'
                };
                new Notification(notificationTitle, notificationOptions);
            });

        } catch (error) {
            console.error('An error occurred while setting up messaging.', error);
        }
      }
    };
    
    // Directly invoke the setup function.
    setupFirebaseMessaging();

  }, []); // The empty dependency array ensures this runs only once on mount.

  return null; // This component does not render anything.
};

export default FirebaseMessagingClient;
