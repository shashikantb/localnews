import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Use a different env var name that's less likely to conflict with platform-injected vars.
  const serviceAccountB64 =
    process.env.LP_FIREBASE_SERVICE_ACCOUNT_B64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT_B64;

  if (!serviceAccountB64) {
    console.warn(
      'LP_FIREBASE_SERVICE_ACCOUNT_B64 is not set, Firebase Admin features will be disabled.'
    );
  } else {
    try {
      const serviceAccountJson = Buffer.from(
        serviceAccountB64,
        'base64'
      ).toString('utf8');

      const serviceAccount = JSON.parse(serviceAccountJson);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error(
        '❌ Failed to initialize Firebase Admin from Base64 env var. Ensure the variable is a valid, non-quoted, single-line Base64 string.',
        error
      );
    }
  }
}

export default admin;
