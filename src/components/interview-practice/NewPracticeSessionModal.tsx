'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
  Plus,
  Settings2,
  Video,
  VideoOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import type { InputType, RoleSnapshot, SessionMode } from '@/lib/interview-practice/types';
import { apiRequest } from '@/lib/queryClient';

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

interface NewPracticeSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRoleProfileId?: string;
}

type Step = 'role' | 'configure' | 'permissions';

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'role', title: 'Choose Role', description: 'Select or enter a role' },
  { id: 'configure', title: 'Configure', description: 'Set preferences' },
  { id: 'permissions', title: 'Start', description: 'Grant access' },
];

export function NewPracticeSessionModal({
  open,
  onOpenChange,
  defaultRoleProfileId,
}: NewPracticeSessionModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('role');

  // Role selection mode
  const [roleMode, setRoleMode] = useState<'saved' | 'new'>('new');

  // Saved role selection
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    defaultRoleProfileId ?? null,
  );

  // New role form state
  const [inputType, setInputType] = useState<InputType>('title_company');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobLevel, setJobLevel] = useState('');
  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [saveRoleForLater, setSaveRoleForLater] = useState(false);

  // Configuration state
  const [mode, setMode] = useState<SessionMode>('neutral');
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
      return data.profiles || [];
    },
    enabled: !!user?.clerkId && open,
  });

  // Reset state when modal opens (only on initial open, not when roleProfiles changes mid-flow)
  useEffect(() => {
    if (open) {
      setCurrentStep('role');
      setRoleMode(defaultRoleProfileId ? 'saved' : roleProfiles.length > 0 ? 'saved' : 'new');
      setSelectedProfileId(defaultRoleProfileId ?? null);
      setJobTitle('');
      setCompanyName('');
      setJobLevel('');
      setJdText('');
      setJdUrl('');
      setSaveRoleForLater(false);
      setMode('neutral');
      setQuestionCount(5);
      setCameraEnabled(false);
      setPermissionsChecked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset on open/defaultRoleProfileId change, not roleProfiles.length
  }, [open, defaultRoleProfileId]);

  // Create role profile mutation (only if saving)
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
      toast({
        title: 'Role Saved',
        description: 'Your role has been saved for future practice sessions.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to save role',
        variant: 'destructive',
      });
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      role_profile_id?: string;
      role_snapshot?: RoleSnapshot;
      mode: SessionMode;
      question_count_target: number;
      camera_enabled: boolean;
      consent: { mic: boolean; camera: boolean; timestamp: number };
    }) => {
      const response = await apiRequest('POST', '/api/interview-practice/session', data);
      return response.json();
    },
    onSuccess: (data) => {
      onOpenChange(false);
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
      const micResult = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      setHasMicPermission(micResult.state === 'granted');

      if (cameraEnabled) {
        const camResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setHasCameraPermission(camResult.state === 'granted');
      } else {
        setHasCameraPermission(true);
      }

      setPermissionsChecked(true);
    } catch {
      // Browser doesn't support permissions API - will prompt on request
      setHasMicPermission(null);
      setHasCameraPermission(cameraEnabled ? null : true);
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

  // Check permissions when reaching permissions step
  useEffect(() => {
    if (currentStep === 'permissions' && !permissionsChecked) {
      checkPermissions();
    }
  }, [currentStep, permissionsChecked, checkPermissions]);

  // Get role data for display
  const getRoleDisplayData = () => {
    if (roleMode === 'saved' && selectedProfileId) {
      const profile = roleProfiles.find((p: RoleProfile) => p._id === selectedProfileId);
      return profile ? { job_title: profile.job_title, company_name: profile.company_name } : null;
    }
    if (roleMode === 'new' && jobTitle) {
      return { job_title: jobTitle, company_name: companyName || undefined };
    }
    return null;
  };

  const roleDisplayData = getRoleDisplayData();

  // Handle session start
  const handleStartSession = async () => {
    let savedProfileId: string | undefined;

    // If using new role and wants to save it first
    if (roleMode === 'new' && saveRoleForLater) {
      try {
        const result = await createProfileMutation.mutateAsync({
          input_type: inputType,
          job_title: jobTitle,
          company_name: companyName || undefined,
          job_level: jobLevel || undefined,
          job_description_text: jdText || undefined,
          job_url: jdUrl || undefined,
        });
        savedProfileId = result.roleProfile._id;
      } catch {
        // onError already shows feedback; abort session creation
        return;
      }
    }

    // Create session
    const sessionData: {
      role_profile_id?: string;
      role_snapshot?: RoleSnapshot;
      mode: SessionMode;
      question_count_target: number;
      camera_enabled: boolean;
      consent: { mic: boolean; camera: boolean; timestamp: number };
    } = {
      mode,
      question_count_target: questionCount,
      camera_enabled: cameraEnabled,
      consent: {
        mic: hasMicPermission === true,
        camera: cameraEnabled && hasCameraPermission === true,
        timestamp: Date.now(),
      },
    };

    if (roleMode === 'saved' && selectedProfileId) {
      sessionData.role_profile_id = selectedProfileId;
    } else if (roleMode === 'new' && saveRoleForLater && savedProfileId) {
      // Use the newly created profile
      sessionData.role_profile_id = savedProfileId;
    } else if (roleMode === 'new') {
      // Use role snapshot
      sessionData.role_snapshot = {
        input_type: inputType,
        job_title: jobTitle,
        company_name: companyName || undefined,
        job_level: jobLevel || undefined,
        job_description_text: jdText || undefined,
        job_url: jdUrl || undefined,
      };
    }

    createSessionMutation.mutate(sessionData);
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 'role':
        if (roleMode === 'saved') return selectedProfileId !== null;
        return jobTitle.trim().length > 0;
      case 'configure':
        return true;
      case 'permissions':
        return hasMicPermission === true && (cameraEnabled ? hasCameraPermission === true : true);
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 'role') {
      setCurrentStep('configure');
    } else if (currentStep === 'configure') {
      setCurrentStep('permissions');
    } else if (currentStep === 'permissions') {
      await handleStartSession();
    }
  };

  const handleBack = () => {
    if (currentStep === 'configure') {
      setCurrentStep('role');
    } else if (currentStep === 'permissions') {
      setCurrentStep('configure');
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isLoading = createProfileMutation.isPending || createSessionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            New Practice Session
          </DialogTitle>
          <DialogDescription>Set up your mock interview in a few quick steps</DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between py-4 border-b">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors text-sm ${
                    index < stepIndex
                      ? 'bg-primary border-primary text-white'
                      : index === stepIndex
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {index < stepIndex ? <Check className="h-4 w-4" /> : <span>{index + 1}</span>}
                </div>
                <p
                  className={`text-xs mt-1 ${index === stepIndex ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                >
                  {step.title}
                </p>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${index < stepIndex ? 'bg-primary' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Role Selection */}
          {currentStep === 'role' && (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={roleMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRoleMode('new');
                    setSelectedProfileId(null);
                  }}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Enter New Role
                </Button>
                {roleProfiles.length > 0 && (
                  <Button
                    variant={roleMode === 'saved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleMode('saved')}
                    className="flex-1"
                  >
                    <Briefcase className="h-4 w-4 mr-1" />
                    Use Saved Role
                  </Button>
                )}
              </div>

              {/* New Role Form */}
              {roleMode === 'new' && (
                <div className="space-y-4 p-4 rounded-lg border bg-gray-50/50">
                  <div>
                    <Label className="mb-2 block text-xs text-muted-foreground">Input Method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={inputType === 'title_company' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('title_company')}
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        Title
                      </Button>
                      <Button
                        type="button"
                        variant={inputType === 'jd_text' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('jd_text')}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Paste JD
                      </Button>
                      <Button
                        type="button"
                        variant={inputType === 'jd_link' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputType('jd_link')}
                      >
                        <LinkIcon className="h-3 w-3 mr-1" />
                        URL
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="jobTitle" className="text-sm">
                        Job Title *
                      </Label>
                      <Input
                        id="jobTitle"
                        placeholder="e.g., Software Engineer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyName" className="text-sm">
                        Company
                      </Label>
                      <Input
                        id="companyName"
                        placeholder="e.g., Google"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {inputType === 'title_company' && (
                    <div>
                      <Label htmlFor="jobLevel" className="text-sm">
                        Level
                      </Label>
                      <Input
                        id="jobLevel"
                        placeholder="e.g., Senior, L5, Manager"
                        value={jobLevel}
                        onChange={(e) => setJobLevel(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {inputType === 'jd_text' && (
                    <div>
                      <Label htmlFor="jdText" className="text-sm">
                        Job Description
                      </Label>
                      <Textarea
                        id="jdText"
                        placeholder="Paste the job description here..."
                        rows={4}
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {inputType === 'jd_link' && (
                    <div>
                      <Label htmlFor="jdUrl" className="text-sm">
                        Job Posting URL
                      </Label>
                      <Input
                        id="jdUrl"
                        type="url"
                        placeholder="https://..."
                        value={jdUrl}
                        onChange={(e) => setJdUrl(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Save for later toggle */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Checkbox
                      id="saveRole"
                      checked={saveRoleForLater}
                      onCheckedChange={(checked) => setSaveRoleForLater(checked === true)}
                    />
                    <Label htmlFor="saveRole" className="text-sm cursor-pointer">
                      Save this role for future practice sessions
                    </Label>
                  </div>
                </div>
              )}

              {/* Saved Roles List */}
              {roleMode === 'saved' && (
                <div className="space-y-2">
                  {isLoadingProfiles ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : roleProfiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No saved roles yet</p>
                      <Button variant="link" onClick={() => setRoleMode('new')} className="mt-2">
                        Enter a new role instead
                      </Button>
                    </div>
                  ) : (
                    <RadioGroup
                      value={selectedProfileId || ''}
                      onValueChange={(value) => setSelectedProfileId(value)}
                    >
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {roleProfiles.map((profile: RoleProfile) => (
                          <div key={profile._id}>
                            <RadioGroupItem
                              value={profile._id}
                              id={profile._id}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={profile._id}
                              className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-gray-50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{profile.job_title}</p>
                                {profile.company_name && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {profile.company_name}
                                  </p>
                                )}
                              </div>
                              {profile.competencies && profile.competencies.length > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {profile.competencies.length} skills
                                </Badge>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configuration */}
          {currentStep === 'configure' && (
            <div className="space-y-4">
              {/* Selected Role Display */}
              {roleDisplayData && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Practicing for:</p>
                  <p className="font-medium">{roleDisplayData.job_title}</p>
                  {roleDisplayData.company_name && (
                    <p className="text-sm text-muted-foreground">{roleDisplayData.company_name}</p>
                  )}
                </div>
              )}

              {/* Interview Mode */}
              <div>
                <Label className="mb-2 block">Interview Style</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as SessionMode)}>
                  <div className="space-y-2">
                    <div>
                      <RadioGroupItem value="supportive" id="supportive" className="peer sr-only" />
                      <Label
                        htmlFor="supportive"
                        className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:bg-green-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-green-700">Supportive</p>
                          <p className="text-xs text-muted-foreground">
                            Encouraging with helpful hints
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600 text-xs"
                        >
                          Beginner
                        </Badge>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="neutral" id="neutral" className="peer sr-only" />
                      <Label
                        htmlFor="neutral"
                        className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-blue-700">Neutral</p>
                          <p className="text-xs text-muted-foreground">Balanced and professional</p>
                        </div>
                        <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                          Recommended
                        </Badge>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="pressure" id="pressure" className="peer sr-only" />
                      <Label
                        htmlFor="pressure"
                        className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-orange-700">Pressure</p>
                          <p className="text-xs text-muted-foreground">Challenging follow-ups</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-orange-600 border-orange-600 text-xs"
                        >
                          Advanced
                        </Badge>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Question Count */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Number of Questions</Label>
                  <span className="text-sm font-medium">{questionCount}</span>
                </div>
                <Slider
                  value={[questionCount]}
                  onValueChange={([v]) => setQuestionCount(v)}
                  min={3}
                  max={10}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Quick (3)</span>
                  <span>Full (10)</span>
                </div>
              </div>

              {/* Camera Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  {cameraEnabled ? (
                    <Video className="h-4 w-4 text-primary" />
                  ) : (
                    <VideoOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Enable Camera</p>
                    <p className="text-xs text-muted-foreground">Practice on-camera presence</p>
                  </div>
                </div>
                <Button
                  variant={cameraEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                >
                  {cameraEnabled ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Permissions */}
          {currentStep === 'permissions' && (
            <div className="space-y-4">
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
                          ? 'Ready to record'
                          : hasMicPermission === false
                            ? 'Please enable in browser'
                            : 'Required for voice recording'}
                      </p>
                    </div>
                  </div>
                  {hasMicPermission !== true && (
                    <Button onClick={requestMicPermission} size="sm">
                      Grant
                    </Button>
                  )}
                  {hasMicPermission === true && <Check className="h-5 w-5 text-green-500" />}
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
                              ? 'Please enable in browser'
                              : 'For video preview'}
                        </p>
                      </div>
                    </div>
                    {hasCameraPermission !== true && (
                      <Button onClick={requestCameraPermission} size="sm">
                        Grant
                      </Button>
                    )}
                    {hasCameraPermission === true && <Check className="h-5 w-5 text-green-500" />}
                  </div>
                </div>
              )}

              {/* Session Summary */}
              <div className="p-4 rounded-lg bg-gray-50 border">
                <h4 className="font-medium mb-3 text-sm">Session Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{roleDisplayData?.job_title}</span>
                  </div>
                  {roleDisplayData?.company_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span>{roleDisplayData.company_name}</span>
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
                </div>
              </div>

              {/* Ready Notice */}
              {hasMicPermission === true &&
                (cameraEnabled ? hasCameraPermission === true : true) && (
                  <Alert className="border-green-200 bg-green-50">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Ready to Start!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      All set. Click Start Interview to begin.
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 'role' || isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {saveRoleForLater ? 'Saving & Starting...' : 'Starting...'}
              </>
            ) : currentStep === 'permissions' ? (
              <>
                Start Interview
                <Mic className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
