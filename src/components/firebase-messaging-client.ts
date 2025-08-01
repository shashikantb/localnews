

'use client';

import { useEffect } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

// This component handles the client-side logic for Firebase Cloud Messaging.
// It's responsible for initializing Firebase and handling foreground messages.
// Token registration is now handled by the PostFeedClient component.

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

      try {
          const messaging = getMessaging(app);
          
          // Handle foreground messages (when the app is open and visible)
           onMessage(messaging, (payload) => {
              console.log('Message received in foreground. ', payload);
              const notificationTitle = payload.notification?.title || 'New Notification';
              const notificationOptions = {
                  body: payload.notification?.body || '',
                  icon: '/icons/icon-192x192.png'
              };
              new Notification(notificationTitle, notificationOptions);
          });

      } catch (error) {
          console.error('An error occurred while setting up Firebase messaging.', error);
      }
    };
    
    setupFirebaseMessaging();

  }, []); // The empty dependency array ensures this runs only once on mount.

  return null; // This component does not render anything.
};

export default FirebaseMessagingClient;
