
import * as admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  console.warn(
    'FIREBASE_SERVICE_ACCOUNT_JSON is not set. Firebase Admin SDK will not be initialized. Push notifications will not work.'
  );
} else {
  try {
    // This is the most robust way to parse a JSON string from an environment variable
    // that may have escaping issues with newlines.
    const serviceAccount = JSON.parse(serviceAccountJson);

    // The private_key needs to have its escaped newlines replaced with actual newlines.
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    
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
