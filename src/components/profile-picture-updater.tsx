

'use client';

import { useState, type ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, XCircle } from 'lucide-react';
import { updateUserProfilePicture } from '@/app/auth/actions';
import { getSignedUploadUrl } from '@/app/actions';
import { Progress } from './ui/progress';

export default function ProfilePictureUpdater() {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview(null);
    setFile(null);

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, etc.).');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image is too large. Max size is 10MB.');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  // Revoke object URL when the component unmounts or the preview changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleRemoveImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setFile(null);
    if ((document.getElementById('profile-picture-input') as HTMLInputElement)) {
      (document.getElementById('profile-picture-input') as HTMLInputElement).value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 1. Get signed URL from server
      const signedUrlResult = await getSignedUploadUrl(file.name, file.type);
      if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
        throw new Error(signedUrlResult.error || 'Could not prepare file for upload.');
      }

      // 2. Upload file directly to GCS
      const uploadResult = await fetch(signedUrlResult.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResult.ok) {
        const errorBody = await uploadResult.text();
        console.error("GCS Upload Error:", { status: uploadResult.status, body: errorBody });
        throw new Error(`Upload to cloud storage failed. Please check browser console for details.`);
      }

      // 3. Update the user profile with the new public URL
      const result = await updateUserProfilePicture(signedUrlResult.publicUrl);

      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Your profile picture has been updated.',
        });
        router.refresh();
      } else {
        throw new Error(result.error || 'An unexpected error occurred while saving the picture URL.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected server error occurred.');
    } finally {
      setIsUploading(false);
    }
  };
  
  const isProcessing = isUploading;
  let buttonText = 'Save Changes';
  if (isUploading) buttonText = 'Uploading...';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <label
          htmlFor="profile-picture-input"
          className="block w-full cursor-pointer p-6 border-2 border-dashed rounded-lg text-center hover:border-primary hover:bg-muted"
        >
          {preview ? (
            <div className="relative group w-32 h-32 mx-auto">
              <Image
                src={preview}
                alt="Profile preview"
                className="rounded-full object-cover"
                fill
                sizes="128px"
              />
              <button
                type="button"
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(ev) => { ev.preventDefault(); handleRemoveImage(); }}
                aria-label="Remove image"
              >
                <XCircle className="h-8 w-8 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-muted-foreground">
              <UploadCloud className="h-10 w-10" />
              <span>Click to upload or drag & drop</span>
              <span className="text-xs">PNG or JPG, up to 10MB</span>
            </div>
          )}
        </label>
        <Input
          id="profile-picture-input"
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </div>

      {isUploading && <Progress value={100} className="w-full h-2 animate-pulse" />}

      <Button type="submit" disabled={!file || isProcessing} className="w-full">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {buttonText}
      </Button>
    </form>
  );
}
