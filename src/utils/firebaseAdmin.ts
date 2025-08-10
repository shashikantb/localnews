import admin from "firebase-admin";
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Firebase Admin
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

// Initialize Genkit AI
const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  // Disabling these features is crucial to prevent Next.js build errors,
  // as they pull in server-side dependencies incompatible with Webpack.
  enableTracingAndMetrics: false,
});

// Getter function for the AI instance
export function getAi() {
    return ai;
}

export default admin;
