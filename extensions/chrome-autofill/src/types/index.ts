/**
 * Ascentul Autofill Extension Types
 *
 * These types are derived from the main Ascentul application schemas
 * to ensure compatibility with the backend API.
 */

// ============================================
// USER & AUTHENTICATION
// ============================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  subscriptionPlan?: 'free' | 'premium' | 'university';
  universityId?: string;
  universityName?: string;
}

export type UserRole =
  | 'individual'
  | 'user'
  | 'student'
  | 'staff'
  | 'university_admin'
  | 'advisor'
  | 'super_admin';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  expiresAt: number | null;
}

export interface AuthTokenPayload {
  nonce: string;
  timestamp: number;
  extensionId: string;
}

// ============================================
// PROFILE DATA
// ============================================

/**
 * Extension profile - derived from convex/schema.ts users table
 */
export interface ExtensionProfile {
  // Contact Info
  name: string;
  email: string;
  phoneNumber?: string;
  phone?: string; // Alias for phoneNumber
  location?: string;
  city?: string;

  // Links
  linkedinUrl?: string;
  githubUrl?: string;
  website?: string;
  websiteUrl?: string; // Alias for website

  // Career Data
  currentPosition?: string;
  currentTitle?: string; // Alias for currentPosition
  currentCompany?: string;
  summary?: string;
  /**
   * Skills as comma-separated string (from backend user profile).
   * Note: ResumeData.skills uses string[] format. The AutofillData interface
   * provides both formats (skills: string, skillsArray: string[]) for flexibility.
   * @see profileStore.getAutofillData for transformation logic
   */
  skills?: string;
  industry?: string;
  experienceLevel?: string;

  // History Arrays (from users table)
  educationHistory: EducationHistoryItem[];
  workHistory: WorkHistoryItem[];
  achievementsHistory: AchievementHistoryItem[];

  // University context for advisor visibility
  universityId?: string;

  // Resume list for selection
  resumes: ResumeListItem[];

  // Metadata
  lastUpdated?: number;
}

export interface EducationHistoryItem {
  id: string;
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: string;
  endYear?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  gpa?: string;
  activities?: string;
  location?: string;
}

export interface WorkHistoryItem {
  id: string;
  role?: string;
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  location?: string;
  summary?: string;
  description?: string;
}

export interface AchievementHistoryItem {
  id: string;
  title?: string;
  description?: string;
  date?: string;
  organization?: string;
}

// ============================================
// RESUME DATA
// ============================================

/**
 * Resume list item for selection in extension
 */
export interface ResumeListItem {
  id: string;
  title: string;
  templateId?: string;
  updatedAt: number;
  createdAt?: number;
  content?: ResumeData;
}

/**
 * Resume type alias for compatibility with DocumentsTab
 * Uses `name` as alias for `title`
 */
export interface Resume {
  id: string;
  name?: string;
  title?: string;
  templateId?: string;
  updatedAt?: number;
  createdAt?: number;
  content?: ResumeData;
}

/**
 * Full resume data structure - from ResumeDocument.tsx
 */
export interface ResumeData {
  contactInfo: ContactInfo;
  summary?: string;
  /**
   * Skills as string array (from resume builder).
   * Note: ExtensionProfile.skills uses comma-separated string format.
   * @see profileStore.getAutofillData for transformation logic
   */
  skills?: string[];
  experience?: Experience[];
  education?: Education[];
  projects?: Project[];
  achievements?: Achievement[];
  certifications?: Certification[];
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  country?: string;
  postalCode?: string;
  photoUrl?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  summary?: string;
  keyContributions?: string[];
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startYear: string;
  endYear: string;
  gpa?: string;
  honors?: string;
}

export interface Project {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string;
  url?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

// ============================================
// APPLICATION TRACKING
// ============================================

export interface JobApplication {
  id: string;
  company: string;
  jobTitle: string;
  url?: string;
  source: string;
  atsPlatform: ATSPlatform;
  status: ApplicationStatus;
  appliedAt: number;
  resumeId?: string;
  notes?: string;
  universityId?: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export type ATSPlatform =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'linkedin'
  | 'indeed'
  | 'taleo'
  | 'icims'
  | 'smartrecruiters'
  | 'unknown';

export interface CreateApplicationRequest {
  company: string;
  jobTitle: string;
  url?: string;
  source?: string;
  atsPlatform?: ATSPlatform;
  resumeId?: string;
  notes?: string;
}

// ============================================
// ATS FIELD MAPPING
// ============================================

export type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'file' | 'date' | 'url';

export interface FieldMapping {
  fieldType: FieldType;
  selectors: string[];
  dataKey: string; // dot notation for nested access (e.g., 'contactInfo.email')
  transform?: (value: unknown) => string;
  priority?: number; // Higher priority = try first
  required?: boolean;
}

export interface ATSDetectionResult {
  detected: boolean;
  platform: ATSPlatform;
  confidence: number;
  jobTitle?: string;
  company?: string;
  jobUrl?: string;
}

export interface FillResult {
  platform: ATSPlatform;
  totalFields: number;
  filledFields: number;
  skippedFields: number;
  errors: string[];
  jobDetails?: {
    company?: string;
    jobTitle?: string;
    url?: string;
  };
}

export interface FieldFillResult {
  fieldKey: string;
  success: boolean;
  skipped: boolean;
  error?: string;
}

// ============================================
// EXTENSION SETTINGS
// ============================================

export interface ExtensionSettings {
  // Autofill Behavior
  showFloatingButton: boolean;
  confirmBeforeFill: boolean;
  autoDetectATS: boolean;
  autoDetect?: boolean; // Alias for autoDetectATS

  // Data Preferences
  fillEEOFields: boolean;
  shareWithAdvisor: boolean; // University users only

  // Notifications
  showFillNotification: boolean;
  showNotifications?: boolean; // Alias for showFillNotification
  showApplicationSaved: boolean;

  // Privacy
  trackApplications: boolean;
  autoLogApplications?: boolean; // Auto-log applications when filling forms

  // Sync
  syncEnabled?: boolean; // Keep data synced with Ascentul account

  // UI
  floatingButtonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  showFloatingButton: true,
  confirmBeforeFill: true,
  autoDetectATS: true,
  autoDetect: true,
  fillEEOFields: false,
  shareWithAdvisor: true,
  showFillNotification: true,
  showNotifications: true,
  showApplicationSaved: true,
  trackApplications: true,
  autoLogApplications: true,
  syncEnabled: true,
  floatingButtonPosition: 'bottom-right',
};

// ============================================
// MESSAGING
// ============================================

export type MessageType =
  | 'FILL_FORM'
  | 'GET_PROFILE'
  | 'LOG_APPLICATION'
  | 'GET_AUTH_STATE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SYNC_PROFILE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_RECENT_APPLICATIONS'
  | 'DETECT_ATS';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  // Session storage (encrypted, cleared on browser close)
  AUTH: 'ascentul_auth',

  // Local storage (persisted)
  PROFILE: 'ascentul_profile',
  SETTINGS: 'ascentul_settings',
  RECENT_APPLICATIONS: 'ascentul_recent_apps',
  PENDING_APPLICATIONS: 'ascentul_pending_apps',
  SELECTED_RESUME_ID: 'ascentul_selected_resume',
  PROFILE_CACHE_TIME: 'ascentul_profile_cache_time',
} as const;

// Cache duration (1 hour)
export const PROFILE_CACHE_DURATION = 60 * 60 * 1000;
