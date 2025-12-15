'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  FileText,
  Link as LinkIcon,
  Loader2,
  Mic,
  MicOff,
  Settings2,
  Video,
  VideoOff,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type InputType = 'title_company' | 'jd_text' | 'jd_link';
type InterviewMode = 'neutral' | 'supportive' | 'pressure';

interface RoleProfile {
  _id: string;
  job_title: string;
  company_name?: string;
  role_summary?: string;
  competencies?: Array<{
    id: string;
    name: string;
    weight: number;
    description?: string;
  }>;
  created_at: number;
}

const STEPS = [
  { id: 'role', title: 'Select Role', description: 'Choose or create a role profile' },
  { id: 'configure', title: 'Configure', description: 'Set interview preferences' },
  { id: 'permissions', title: 'Permissions', description: 'Grant mic/camera access' },
];

export default function NewInterviewPracticePage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Role selection state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [createNewProfile, setCreateNewProfile] = useState(false);

  // New profile form state
  const [inputType, setInputType] = useState<InputType>('title_company');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobLevel, setJobLevel] = useState('');
  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');

  // Configuration state
  const [mode, setMode] = useState<InterviewMode>('neutral');
  const [questionCount, setQuestionCount] = useState(5);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // Permissions state
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [permissionsChecked, setPermissionsChecked] = useState(false);

  // Fetch existing role profiles
  const { data: roleProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['/api/interview-practice/role-profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/interview-practice/role-profile');
      const data = await response.json();
      return data.roleProfiles || [];
    },
    enabled: !!user?.clerkId,
  });

  // Create role profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: {
      input_type: InputType;
      job_title: string;
      company_name?: string;
      job_level?: string;
      job_description_text?: string;
      job_url?: string;
    }) => {
      const response = await apiRequest('POST', '/api/interview-practice/role-profile', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/interview-practice/role-profile'] });
      setSelectedProfileId(data.roleProfile._id);
      setCreateNewProfile(false);
      toast({
        title: 'Role Profile Created',
        description: 'AI has analyzed the role and extracted key competencies.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to create role profile',
        variant: 'destructive',
      });
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      role_profile_id: string;
      mode: InterviewMode;
      question_count_target: number;
      camera_enabled: boolean;
      consent: { mic: boolean; camera: boolean; timestamp: number };
    }) => {
      const response = await apiRequest('POST', '/api/interview-practice/session', data);
      return response.json();
    },
    onSuccess: (data) => {
      router.push(`/interview-practice/session/${data.session._id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to create session',
        variant: 'destructive',
      });
    },
  });

  // Check permissions
  const checkPermissions = useCallback(async () => {
    try {
      // Check microphone
      const micResult = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      setHasMicPermission(micResult.state === 'granted');

      // Check camera if enabled
      if (cameraEnabled) {
        const camResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setHasCameraPermission(camResult.state === 'granted');
      } else {
        setHasCameraPermission(true); // Not needed
      }

      setPermissionsChecked(true);
    } catch {
      // Fallback: try to request permissions
      setPermissionsChecked(true);
    }
  }, [cameraEnabled]);

  // Request microphone permission
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
      toast({
        title: 'Microphone Access Granted',
        description: 'You can now record your interview responses.',
        variant: 'success',
      });
    } catch {
      setHasMicPermission(false);
      toast({
        title: 'Microphone Access Denied',
        description: 'Please enable microphone access in your browser settings.',
        variant: 'destructive',
      });
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasCameraPermission(true);
      toast({
        title: 'Camera Access Granted',
        description: 'Your camera is now enabled for practice.',
        variant: 'success',
      });
    } catch {
      setHasCameraPermission(false);
      toast({
        title: 'Camera Access Denied',
        description: 'Please enable camera access in your browser settings.',
        variant: 'destructive',
      });
    }
  };

  // Check permissions when reaching step 2
  useEffect(() => {
    if (currentStep === 2 && !permissionsChecked) {
      checkPermissions();
    }
  }, [currentStep, permissionsChecked, checkPermissions]);

  // Handle profile creation
  const handleCreateProfile = async () => {
    if (!jobTitle.trim()) {
      toast({
        title: 'Job Title Required',
        description: 'Please enter a job title to continue.',
        variant: 'destructive',
      });
      return;
    }

    createProfileMutation.mutate({
      input_type: inputType,
      job_title: jobTitle,
      company_name: companyName || undefined,
      job_level: jobLevel || undefined,
      job_description_text: jdText || undefined,
      job_url: jdUrl || undefined,
    });
  };

  // Handle session start
  const handleStartSession = async () => {
    if (!selectedProfileId) {
      toast({
        title: 'Role Required',
        description: 'Please select or create a role profile.',
        variant: 'destructive',
      });
      return;
    }

    createSessionMutation.mutate({
      role_profile_id: selectedProfileId,
      mode,
      question_count_target: questionCount,
      camera_enabled: cameraEnabled,
      consent: {
        mic: hasMicPermission === true,
        camera: cameraEnabled && hasCameraPermission === true,
        timestamp: Date.now(),
      },
    });
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return selectedProfileId !== null || createNewProfile;
      case 1:
        return true;
      case 2:
        return hasMicPermission === true && (cameraEnabled ? hasCameraPermission === true : true);
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && createNewProfile) {
      handleCreateProfile();
      return;
    }
    if (currentStep === 2) {
      handleStartSession();
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const selectedProfile = roleProfiles.find((p: RoleProfile) => p._id === selectedProfileId);

  if (!isLoaded || !clerkUser || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/interview-practice">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Interview Practice
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">
              New Practice Session
            </h1>
            <p className="text-sm text-muted-foreground">
              Set up your mock interview in a few simple steps
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    index < currentStep
                      ? 'bg-primary border-primary text-white'
                      : index === currentStep
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {index < currentStep ? <Check className="h-5 w-5" /> : <span>{index + 1}</span>}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`text-sm font-medium ${index === currentStep ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-20 sm:w-32 h-0.5 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        {/* Step 0: Role Selection */}
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle>Select a Role Profile</CardTitle>
              <CardDescription>
                Choose an existing role or create a new one for your practice session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Profiles */}
              {isLoadingProfiles ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : roleProfiles.length > 0 ? (
                <div>
                  <Label className="mb-3 block">Your Saved Roles</Label>
                  <RadioGroup
                    value={createNewProfile ? '' : selectedProfileId || ''}
                    onValueChange={(value: string) => {
                      setSelectedProfileId(value);
                      setCreateNewProfile(false);
                    }}
                  >
                    <div className="grid gap-3">
                      {roleProfiles.map((profile: RoleProfile) => (
                        <div key={profile._id}>
                          <RadioGroupItem
                            value={profile._id}
                            id={profile._id}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={profile._id}
                            className="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-gray-50"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{profile.job_title}</p>
                              {profile.company_name && (
                                <p className="text-sm text-muted-foreground">
                                  {profile.company_name}
                                </p>
                              )}
                              {profile.competencies && profile.competencies.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {profile.competencies.slice(0, 4).map((c) => (
                                    <Badge key={c.id} variant="secondary" className="text-xs">
                                      {c.name}
                                    </Badge>
                                  ))}
                                  {profile.competencies.length > 4 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{profile.competencies.length - 4} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              ) : null}

              {/* Create New Profile Toggle */}
              <div>
                <Button
                  variant={createNewProfile ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => {
                    setCreateNewProfile(!createNewProfile);
                    setSelectedProfileId(null);
                  }}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Create New Role Profile
                </Button>
              </div>

              {/* New Profile Form */}
              {createNewProfile && (
                <div className="border rounded-lg p-4 space-y-4 bg-gray-50/50">
                  <div>
                    <Label className="mb-2 block">Input Method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={inputType === 'title_company' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('title_company')}
                        className="justify-start"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Title
                      </Button>
                      <Button
                        type="button"
                        variant={inputType === 'jd_text' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('jd_text')}
                        className="justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Job Description
                      </Button>
                      <Button
                        type="button"
                        variant={inputType === 'jd_link' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('jd_link')}
                        className="justify-start"
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        URL
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="jobTitle">Job Title *</Label>
                        <Input
                          id="jobTitle"
                          placeholder="e.g., Software Engineer"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyName">Company (Optional)</Label>
                        <Input
                          id="companyName"
                          placeholder="e.g., Google"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                        />
                      </div>
                    </div>

                    {inputType === 'title_company' && (
                      <div>
                        <Label htmlFor="jobLevel">Level (Optional)</Label>
                        <Input
                          id="jobLevel"
                          placeholder="e.g., Senior, L5, Manager"
                          value={jobLevel}
                          onChange={(e) => setJobLevel(e.target.value)}
                        />
                      </div>
                    )}

                    {inputType === 'jd_text' && (
                      <div>
                        <Label htmlFor="jdText">Job Description</Label>
                        <Textarea
                          id="jdText"
                          placeholder="Paste the job description here..."
                          rows={6}
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                        />
                      </div>
                    )}

                    {inputType === 'jd_link' && (
                      <div>
                        <Label htmlFor="jdUrl">Job Posting URL</Label>
                        <Input
                          id="jdUrl"
                          type="url"
                          placeholder="https://..."
                          value={jdUrl}
                          onChange={(e) => setJdUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          We&apos;ll extract the job description from this URL
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Step 1: Configuration */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configure Your Session
              </CardTitle>
              <CardDescription>Customize your interview experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Role Display */}
              {selectedProfile && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Practicing for:</p>
                  <p className="font-medium">{selectedProfile.job_title}</p>
                  {selectedProfile.company_name && (
                    <p className="text-sm text-muted-foreground">{selectedProfile.company_name}</p>
                  )}
                </div>
              )}

              {/* Interview Mode */}
              <div>
                <Label className="mb-3 block">Interview Style</Label>
                <RadioGroup value={mode} onValueChange={(v: string) => setMode(v as InterviewMode)}>
                  <div className="grid gap-3">
                    <div>
                      <RadioGroupItem value="supportive" id="supportive" className="peer sr-only" />
                      <Label
                        htmlFor="supportive"
                        className="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:bg-green-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-green-700">Supportive</p>
                          <p className="text-sm text-muted-foreground">
                            Encouraging tone with helpful hints. Great for building confidence.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Beginner
                        </Badge>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="neutral" id="neutral" className="peer sr-only" />
                      <Label
                        htmlFor="neutral"
                        className="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-blue-700">Neutral</p>
                          <p className="text-sm text-muted-foreground">
                            Balanced and professional. Simulates a typical interview experience.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          Recommended
                        </Badge>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="pressure" id="pressure" className="peer sr-only" />
                      <Label
                        htmlFor="pressure"
                        className="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-orange-700">Pressure</p>
                          <p className="text-sm text-muted-foreground">
                            Challenging questions and follow-ups. Prepares you for tough interviews.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Advanced
                        </Badge>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Question Count */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Number of Questions</Label>
                  <span className="text-sm font-medium">{questionCount}</span>
                </div>
                <Slider
                  value={[questionCount]}
                  onValueChange={([v]: number[]) => setQuestionCount(v)}
                  min={3}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Quick (3)</span>
                  <span>Full (10)</span>
                </div>
              </div>

              {/* Camera Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {cameraEnabled ? (
                    <Video className="h-5 w-5 text-primary" />
                  ) : (
                    <VideoOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Enable Camera</p>
                    <p className="text-sm text-muted-foreground">
                      Practice your on-camera presence (optional)
                    </p>
                  </div>
                </div>
                <Button
                  variant={cameraEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                >
                  {cameraEnabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Permissions */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Grant Permissions</CardTitle>
              <CardDescription>
                We need access to your microphone{cameraEnabled ? ' and camera' : ''} to conduct the
                interview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Microphone Permission */}
              <div
                className={`p-4 rounded-lg border-2 ${hasMicPermission === true ? 'border-green-500 bg-green-50' : hasMicPermission === false ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {hasMicPermission === true ? (
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <Mic className="h-5 w-5 text-white" />
                      </div>
                    ) : hasMicPermission === false ? (
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                        <MicOff className="h-5 w-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Mic className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">Microphone Access</p>
                      <p className="text-sm text-muted-foreground">
                        {hasMicPermission === true
                          ? 'Microphone ready to record'
                          : hasMicPermission === false
                            ? 'Access denied - please enable in browser settings'
                            : 'Required for voice recording'}
                      </p>
                    </div>
                  </div>
                  {hasMicPermission !== true && (
                    <Button onClick={requestMicPermission}>Grant Access</Button>
                  )}
                  {hasMicPermission === true && <Check className="h-6 w-6 text-green-500" />}
                </div>
              </div>

              {/* Camera Permission (if enabled) */}
              {cameraEnabled && (
                <div
                  className={`p-4 rounded-lg border-2 ${hasCameraPermission === true ? 'border-green-500 bg-green-50' : hasCameraPermission === false ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {hasCameraPermission === true ? (
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Video className="h-5 w-5 text-white" />
                        </div>
                      ) : hasCameraPermission === false ? (
                        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                          <VideoOff className="h-5 w-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Video className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">Camera Access</p>
                        <p className="text-sm text-muted-foreground">
                          {hasCameraPermission === true
                            ? 'Camera ready'
                            : hasCameraPermission === false
                              ? 'Access denied - please enable in browser settings'
                              : 'Optional for video preview'}
                        </p>
                      </div>
                    </div>
                    {hasCameraPermission !== true && (
                      <Button onClick={requestCameraPermission}>Grant Access</Button>
                    )}
                    {hasCameraPermission === true && <Check className="h-6 w-6 text-green-500" />}
                  </div>
                </div>
              )}

              {/* Session Summary */}
              <div className="p-4 rounded-lg bg-gray-50 border">
                <h4 className="font-medium mb-3">Session Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{selectedProfile?.job_title}</span>
                  </div>
                  {selectedProfile?.company_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span>{selectedProfile.company_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Style</span>
                    <span className="capitalize">{mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Questions</span>
                    <span>{questionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Camera</span>
                    <span>{cameraEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              {/* Ready Notice */}
              {hasMicPermission === true &&
                (cameraEnabled ? hasCameraPermission === true : true) && (
                  <Alert className="border-green-200 bg-green-50">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Ready to Start!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      All permissions granted. Click &quot;Start Interview&quot; to begin your
                      practice session.
                    </AlertDescription>
                  </Alert>
                )}

              {hasMicPermission === false && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Microphone Required</AlertTitle>
                  <AlertDescription>
                    Microphone access is required for interview practice. Please enable it in your
                    browser settings.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            !canProceed() || createProfileMutation.isPending || createSessionMutation.isPending
          }
        >
          {createProfileMutation.isPending || createSessionMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {currentStep === 0 ? 'Analyzing Role...' : 'Starting...'}
            </>
          ) : currentStep === 2 ? (
            <>
              Start Interview
              <Mic className="h-4 w-4 ml-2" />
            </>
          ) : currentStep === 0 && createNewProfile ? (
            <>
              Create & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
