
import { Storage } from '@google-cloud/storage';

const gcsBucketName = process.env.GCS_BUCKET_NAME;
const gcsServiceAccountJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
const googleAppCredsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let storage: Storage | null = null;
let gcsWarningShown = false;

// Determine if GCS is configured properly for either production (JSON content) or development (file path)
const isGcsConfigured = gcsBucketName && (gcsServiceAccountJson || googleAppCredsFile);

if (!isGcsConfigured) {
  if (!gcsWarningShown) {
    console.warn('----------------------------------------------------------------');
    console.warn('WARNING: GCS environment variables are not fully set.');
    console.warn('Please provide either GCS_BUCKET_NAME and GCS_SERVICE_ACCOUNT_JSON (for production) OR GCS_BUCKET_NAME and GOOGLE_APPLICATION_CREDENTIALS (for local dev).');
    console.warn('File upload functionality will be disabled.');
    console.warn('----------------------------------------------------------------');
    gcsWarningShown = true;
  }
} else {
  try {
    let storageOptions: { credentials?: any; projectId?: string } = {};

    if (gcsServiceAccountJson) {
      // Production/Cloud Run: Use the JSON content directly
      const credentials = JSON.parse(gcsServiceAccountJson);
      storageOptions.credentials = credentials;
      storageOptions.projectId = credentials.project_id;
    } 
    // The google-cloud/storage library automatically uses GOOGLE_APPLICATION_CREDENTIALS if it's set
    // so we don't need an 'else if (googleAppCredsFile)' block. It's the default fallback.

    storage = new Storage(storageOptions);
    console.log('Google Cloud Storage client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Google Cloud Storage. Please check your service account credentials.', error);
  }
}

export const getGcsClient = (): Storage | null => {
  return storage;
};

export const getGcsBucketName = (): string | undefined => {
  return gcsBucketName;
};
