'use client';

import { useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from 'convex/_generated/api';
import { useMutation } from 'convex/react';
import {
  AlertTriangle,
  Camera,
  Download,
  Key,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import React, { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AutoUpdatesSettings } from '@/components/account/AutoUpdatesSettings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
// Import UI components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

// Password change form schema
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

function AccountPageContent() {
  const { user: clerkUser } = useUser();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // For password change
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    company: '',
    location: '',
    website: '',
    bio: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar mutations - always call hooks unconditionally
  const generateAvatarUploadUrlMutation = useMutation(api.avatar.generateAvatarUploadUrl);
  const updateUserAvatarMutation = useMutation(api.avatar.updateUserAvatar);
  const updateUserMutation = useMutation(api.users.updateUser);

  // Prefill profile form from user data (only when not actively editing)
  React.useEffect(() => {
    if (user && clerkUser && !isEditingProfile) {
      setProfileForm({
        name: user.name || clerkUser.fullName || '',
        email: user.email || clerkUser.emailAddresses?.[0]?.emailAddress || '',
        jobTitle: user.job_title || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        bio: user.bio || '',
      });
    }
  }, [user, clerkUser, isEditingProfile]);

  // Password form
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handlePasswordChange = async (data: PasswordChangeFormValues) => {
    setIsLoading(true);
    try {
      if (!clerkUser) throw new Error('No user found');

      await clerkUser.updatePassword({
        newPassword: data.newPassword,
        currentPassword: data.currentPassword,
        signOutOfOtherSessions: false,
      });

      toast({
        title: 'Password changed',
        description: 'Your password has been changed successfully.',
        variant: 'success',
      });
      setIsChangingPassword(false);
      passwordForm.reset();
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({
        title: 'Error',
        description:
          error?.errors?.[0]?.message ||
          'Failed to change password. Please check your current password and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // GDPR Data Export handler
  const handleDataExport = async () => {
    setIsExportingData(true);
    try {
      const response = await fetch('/api/gdpr/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the filename from the response header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] || `personal-data-export-${new Date().toISOString().split('T')[0]}.json`;

      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Data exported successfully',
        description: 'Your personal data has been downloaded as a JSON file.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Data export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingData(false);
    }
  };

  // GDPR Account Deletion handler
  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      toast({
        title: 'Confirmation required',
        description: "Please type 'DELETE MY ACCOUNT' to confirm.",
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingDeletion(true);
    try {
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'User requested deletion via account settings',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to request account deletion');
      }

      toast({
        title: 'Deletion requested',
        description: result.message,
        variant: 'success',
      });

      setShowDeleteConfirmation(false);
      setDeleteConfirmText('');

      // If immediate deletion, sign out
      if (result.deletionType === 'immediate') {
        await signOut();
      }
    } catch (error: any) {
      console.error('Account deletion error:', error);
      toast({
        title: 'Deletion failed',
        description: error.message || 'Failed to request account deletion. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadUrl = await generateAvatarUploadUrlMutation();
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResult.ok) throw new Error('Failed to upload image');

      const { storageId } = await uploadResult.json();

      if (clerkUser?.id) {
        await updateUserAvatarMutation({
          clerkId: clerkUser.id,
          storageId,
        });
        toast({
          title: 'Profile picture updated',
          description: 'Your profile picture has been updated successfully',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const effectiveClerkId = clerkUser?.id || user?.clerkId;

  if (!clerkUser && !effectiveClerkId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Account Settings */}
      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>Manage your profile picture and account preferences</CardDescription>
            {/* Profile form stays visible for tests */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingProfile(true)}
                aria-label="Edit Profile"
              >
                Edit Profile
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-gray-200">
                  <AvatarImage
                    src={
                      user?.profile_image ||
                      clerkUser?.imageUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || clerkUser?.firstName || 'User')}&background=0C29AB&color=fff`
                    }
                  />
                  <AvatarFallback>
                    {(user?.name || clerkUser?.firstName || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Profile Picture</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update your profile picture across the app
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  id="profile-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('profile-upload')?.click()}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Change Picture
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <div>
                <h4 className="font-medium">Profile Details</h4>
                <p className="text-sm text-muted-foreground">Update website and bio</p>
              </div>

              {isEditingProfile && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={profileForm.email}
                      readOnly
                      aria-readonly="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sign-in email is managed by Clerk.{' '}
                      <Button asChild variant="link" className="px-0 h-auto font-normal">
                        <Link href="/user">Change sign-in email in Clerk</Link>
                      </Button>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      name="jobTitle"
                      placeholder="Your role"
                      value={profileForm.jobTitle}
                      onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Full name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      name="company"
                      placeholder="Current company"
                      value={profileForm.company}
                      onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="City, Country"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      placeholder="https://example.com"
                      value={profileForm.website}
                      onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      placeholder="Tell us about yourself (max 500 characters)"
                      value={profileForm.bio}
                      maxLength={500}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setProfileForm({ ...profileForm, bio: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">{profileForm.bio.length}/500</p>
                  </div>
                  {profileError && <p className="text-sm text-destructive">{profileError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileError(null);
                        if (user && clerkUser) {
                          setProfileForm({
                            name: user.name || clerkUser.fullName || '',
                            email: user.email || clerkUser.emailAddresses?.[0]?.emailAddress || '',
                            jobTitle: user.job_title || '',
                            company: user.company || '',
                            location: user.location || '',
                            website: user.website || '',
                            bio: user.bio || '',
                          });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isSavingProfile}
                      onClick={async () => {
                        const urlPattern = /^https?:\/\/.+/i;
                        if (profileForm.website && !urlPattern.test(profileForm.website)) {
                          setProfileError('Please enter a valid URL');
                          return;
                        }
                        if (profileForm.bio.length > 500) {
                          setProfileError('Bio must be 500 characters or less');
                          return;
                        }
                        setProfileError(null);
                        if (effectiveClerkId) {
                          setIsSavingProfile(true);
                          try {
                            await updateUserMutation({
                              clerkId: effectiveClerkId,
                              updates: {
                                name: profileForm.name,
                                // email is managed by Clerk and synced via webhook - not editable here
                                bio: profileForm.bio,
                                job_title: profileForm.jobTitle,
                                company: profileForm.company,
                                location: profileForm.location,
                                website: profileForm.website,
                              },
                            });
                            toast({
                              title: 'Profile updated',
                              description: 'Your profile has been updated successfully.',
                              variant: 'success',
                            });
                            setIsEditingProfile(false);
                          } catch (error) {
                            console.error('Profile update error:', error);
                            toast({
                              title: 'Error',
                              description: 'Failed to update profile. Please try again.',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsSavingProfile(false);
                          }
                        } else {
                          toast({
                            title: 'Error',
                            description: 'Unable to save profile. Please try again.',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>Manage your account security and authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Password</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Change your account password</p>
                </div>
                <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
                  Change Password
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <LogOut className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Sign Out</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button variant="outline" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <AutoUpdatesSettings />

        {/* GDPR Data Rights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Privacy Rights
            </CardTitle>
            <CardDescription>Exercise your data privacy rights under GDPR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {/* Data Export */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Export Your Data</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Download all your personal data in JSON format (GDPR Article 20)
                  </p>
                </div>
                <Button variant="outline" onClick={handleDataExport} disabled={isExportingData}>
                  {isExportingData ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>
              </div>

              {/* Account Deletion */}
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    <h3 className="font-medium text-red-700">Delete Account</h3>
                  </div>
                  <p className="text-sm text-red-600/80 mt-1">
                    Permanently delete your account and all associated data (GDPR Article 17)
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteConfirmation(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Your rights under GDPR:</strong> You have the right to access, rectify, and
                delete your personal data. When you request deletion, your account will enter a
                30-day grace period during which you can cancel the request. After 30 days, your
                data will be permanently deleted. Some data may be retained for legal compliance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="space-y-4">
              <p>
                This action will permanently delete your account and all associated data after a
                30-day grace period.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                <strong>Warning:</strong> This includes all your:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Applications and job tracking data</li>
                  <li>Resumes and cover letters</li>
                  <li>Goals and projects</li>
                  <li>Networking contacts</li>
                  <li>AI coaching conversations</li>
                  <li>All other personal data</li>
                </ul>
              </div>
              <p>You can cancel this request anytime during the 30-day grace period.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <strong>DELETE MY ACCOUNT</strong> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmation(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleAccountDeletion}
              disabled={isRequestingDeletion || deleteConfirmText !== 'DELETE MY ACCOUNT'}
            >
              {isRequestingDeletion ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isChangingPassword} onOpenChange={setIsChangingPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one</DialogDescription>
          </DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your new password" {...field} />
                    </FormControl>
                    <FormDescription>
                      Password must be at least 8 characters and include uppercase, lowercase, and a
                      number.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangingPassword(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
