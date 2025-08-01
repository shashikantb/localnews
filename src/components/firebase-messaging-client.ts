
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
      if (!getApps().length) {
        initializeApp(firebaseConfig);
      } else {
        getApp();
      }

      // Check for a custom interface provided by the native Android app's WebView.
      // If this exists, we assume we are inside the app and can get the token directly.
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(async () => {
          const token = window.Android.getFCMToken();
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
        // This is a standard web browser, so do nothing.
        // The notification permission request is handled by the user clicking the "Notifications" button.
        console.log("Not inside Android WebView. Notification setup will be user-initiated.");
      }
    };
    
    // Directly invoke the setup function.
    setupFirebaseMessaging();

  }, []); // The empty dependency array ensures this runs only once on mount.

  return null; // This component does not render anything.
};

export default FirebaseMessagingClient;
