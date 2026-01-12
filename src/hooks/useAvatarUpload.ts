import { api } from 'convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';

import { useToast } from '@/hooks/use-toast';

export function useAvatarUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const generateUploadUrl = useMutation(api.avatar.generateAvatarUploadUrl);
  const updateUserAvatar = useMutation(api.avatar.updateUserAvatar);

  const uploadAvatar = async (file: File, clerkId: string): Promise<boolean> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return false;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return false;
    }

    setIsUploading(true);
    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload image');
      }

      const { storageId } = await uploadResult.json();
      if (!storageId) {
        throw new Error('Invalid upload response: missing storageId');
      }

      // Update user's avatar in database
      await updateUserAvatar({
        clerkId,
        storageId,
      });

      toast({
        title: 'Profile picture updated',
        description: 'Your profile picture has been updated successfully',
        variant: 'success',
      });

      return true;
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadAvatar,
    isUploading,
  };
}
