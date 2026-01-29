'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Award,
  Briefcase,
  Calendar,
  Camera,
  ExternalLink,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  // Check if this is the user's own profile
  const isOwnProfile = currentUser?.id === userId;

  // Fetch user data
  const userData = useQuery(api.users.getUserByClerkId, { clerkId: userId });
  const projects = useQuery(api.projects.getUserProjects, { clerkId: userId });
  const achievements = useQuery(api.achievements.getUserAchievements, { clerkId: userId });

  // Fetch current viewer's data to check if they're a university admin
  const viewerData = useQuery(
    api.users.getUserByClerkId,
    currentUser?.id ? { clerkId: currentUser.id } : 'skip',
  );

  // Resolve storage IDs to URLs for profile and cover images
  const profileImageUrl = useQuery(
    api.avatar.getUserProfileImageUrl,
    userData?.profile_image ? { storageId: userData.profile_image } : 'skip',
  );
  const coverImageUrl = useQuery(
    api.avatar.getUserProfileImageUrl,
    userData?.cover_image ? { storageId: userData.cover_image } : 'skip',
  );

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const updateUserMutation = useMutation(api.users.updateUserById);
  const generateUploadUrl = useMutation(api.avatar.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.avatar.updateUserAvatar);
  const updateCoverImage = useMutation(api.avatar.updateUserCoverImage);

  const user = userData as any;
  const viewer = viewerData as any;

  // Check if viewer is a university admin viewing a student from their university
  const isUniversityAdminViewing =
    viewer &&
    viewer.role === 'university_admin' &&
    user &&
    user.university_id === viewer.university_id &&
    user.role === 'user' &&
    !isOwnProfile;

  // Initialize admin notes when user data loads
  React.useEffect(() => {
    if (user && isUniversityAdminViewing) {
      setAdminNotes(user.university_admin_notes || '');
    }
  }, [user, isUniversityAdminViewing]);

  // Handle loading and error states
  if (userData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (userData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-4">
            The user profile you're looking for doesn't exist or you don't have permission to view
            it.
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const handleSaveAdminNotes = async () => {
    if (!user._id) return;
    setIsSavingNotes(true);
    try {
      await updateUserMutation({
        id: user._id,
        updates: {
          university_admin_notes: adminNotes,
        },
      });
      toast({
        title: 'Notes Saved',
        description: 'University admin notes have been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save notes',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  /**
   * Handle cover image upload - uploads to Convex storage and persists URL
   */
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Show preview immediately using synchronous URL.createObjectURL
    const previewUrl = URL.createObjectURL(file);
    setCoverImage(previewUrl);

    try {
      // Generate upload URL and upload file
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await response.json();

      // Save to database
      await updateCoverImage({ clerkId: currentUser.id, storageId });

      // Clean up preview URL since we'll use the resolved URL from storage
      URL.revokeObjectURL(previewUrl);
      setCoverImage(null);

      toast({
        title: 'Cover image updated',
        description: 'Your cover image has been saved',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload cover image. Please try again.',
        variant: 'destructive',
      });
      setCoverImage(null);
      URL.revokeObjectURL(previewUrl);
    }
  };

  /**
   * Handle profile image upload - uploads to Convex storage and persists URL
   */
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Show preview immediately using synchronous URL.createObjectURL
    const previewUrl = URL.createObjectURL(file);
    setProfileImage(previewUrl);

    try {
      // Generate upload URL and upload file
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await response.json();

      // Save to database
      await updateAvatar({ clerkId: currentUser.id, storageId });

      // Clean up preview URL since we'll use the resolved URL from storage
      URL.revokeObjectURL(previewUrl);
      setProfileImage(null);

      toast({
        title: 'Profile image updated',
        description: 'Your profile image has been saved',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload profile image. Please try again.',
        variant: 'destructive',
      });
      setProfileImage(null);
      URL.revokeObjectURL(previewUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Cover Image */}
      <div className="relative h-64 bg-gradient-to-r from-blue-600 to-indigo-700">
        {(coverImage || coverImageUrl) && (
          <Image src={(coverImage || coverImageUrl)!} alt="Cover" fill className="object-cover" />
        )}
        {isOwnProfile && (
          <label className="absolute bottom-4 right-4 cursor-pointer">
            <Button size="sm" variant="secondary" asChild>
              <span>
                <Camera className="h-4 w-4 mr-2" />
                Change Cover
              </span>
            </Button>
            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </label>
        )}
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        {/* Profile Header */}
        <div className="relative -mt-20 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Profile Image */}
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden relative">
                {profileImage || profileImageUrl ? (
                  <Image
                    src={(profileImage || profileImageUrl)!}
                    alt={user.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <div className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-200 hover:bg-gray-50">
                    <Camera className="h-4 w-4 text-gray-600" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Name and Title */}
            <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.name}</h1>
              {user.job_title && (
                <p className="text-xl text-gray-600 mb-3">
                  {user.job_title}
                  {user.company && <span> @ {user.company}</span>}
                </p>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {user.location}
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${user.email}`} className="hover:text-blue-600">
                      {user.email}
                    </a>
                  </div>
                )}
              </div>

              {/* Social Links */}
              <div className="flex gap-2">
                {user.linkedin_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </a>
                  </Button>
                )}
                {user.github_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={user.github_url} target="_blank" rel="noopener noreferrer">
                      <Github className="h-4 w-4 mr-2" />
                      GitHub
                    </a>
                  </Button>
                )}
                {user.website && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={user.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* About/Bio */}
            {user.bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{user.bio}</p>
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {user.skills && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.skills.split(',').map((skill: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {skill.trim()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Work Experience */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <CardTitle>Work Experience</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {user.current_position ? (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{user.current_position}</h3>
                        <p className="text-sm text-gray-600">
                          {user.current_company || 'Company Name'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>Present</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No work experience added yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                  <CardTitle>Education</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {user.education ? (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{user.education}</h3>
                        <p className="text-sm text-gray-600">
                          {user.university_name || 'University'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No education added yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Projects */}
            {projects && projects.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-5 w-5 text-purple-600" />
                    <CardTitle>Projects</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.map((project: any) => (
                      <div key={project._id} className="border-l-2 border-purple-200 pl-4">
                        <h3 className="font-semibold">{project.title}</h3>
                        {project.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.technologies.map((tech: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(project.url || project.github_url) && (
                          <div className="flex gap-2 mt-2">
                            {project.url && /^https?:\/\//i.test(project.url) && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Live Demo
                              </a>
                            )}
                            {project.github_url && (
                              <a
                                href={project.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Github className="h-3 w-3" />
                                Code
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Achievements */}
            {achievements && achievements.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-600" />
                    <CardTitle>Achievements & Certifications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {achievements.map((achievement: any) => (
                      <div key={achievement._id} className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Award className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{achievement.title}</h3>
                          {achievement.description && (
                            <p className="text-xs text-gray-600 mt-1">{achievement.description}</p>
                          )}
                          {achievement.earned_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(achievement.earned_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* University Admin Notes - Only visible to university admins */}
            {isUniversityAdminViewing && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-900">
                    <Award className="h-5 w-5" />
                    University Admin Notes (Private)
                  </CardTitle>
                  <p className="text-sm text-amber-700">
                    These notes are only visible to university administrators and will not be shown
                    to the student.
                  </p>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this student's progress, concerns, or action items..."
                    className="min-h-[120px] bg-white"
                  />
                  <Button
                    onClick={handleSaveAdminNotes}
                    disabled={isSavingNotes}
                    className="mt-3"
                    size="sm"
                  >
                    {isSavingNotes ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Notes
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
