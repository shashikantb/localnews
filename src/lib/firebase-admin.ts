
import * as admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  console.warn(
    'FIREBASE_SERVICE_ACCOUNT_JSON is not set. Firebase Admin SDK will not be initialized. Push notifications will not work.'
  );
} else {
  try {
    // Correct the formatting of the private key.
    // Environment variables can escape newlines, causing JSON.parse to fail.
    const correctedJsonString = serviceAccountJson.replace(/\\n/g, '\n');
    const serviceAccount = JSON.parse(correctedJsonString);
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    }
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON or initializing Firebase Admin SDK:', error);
  }
}

export { admin };
