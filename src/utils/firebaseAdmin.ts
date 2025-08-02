import admin from "firebase-admin";

if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_B64 is not set, Firebase Admin features will be disabled.");
  } else {
    try {
      const serviceAccountJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_B64,
        "base64"
      ).toString("utf8");

      const serviceAccount = JSON.parse(serviceAccountJson);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin SDK initialized successfully from Base64 env var.");
    } catch (error) {
        console.error("❌ Failed to initialize Firebase Admin from Base64 env var", error);
    }
  }
}

export default admin;
