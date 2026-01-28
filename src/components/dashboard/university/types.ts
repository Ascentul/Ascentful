import { Id } from 'convex/_generated/dataModel';

// ==========================================
// Core Entity Types
// ==========================================

export interface Student {
  _id: Id<'users'>;
  clerkId?: string;
  name?: string;
  email: string;
  role: 'student' | 'advisor' | 'staff' | 'user';
  department_id?: Id<'departments'>;
  last_login?: number;
  last_active?: number;
  created_at?: number;
  activation_token?: string;
  imageUrl?: string;
  engagement_status?: 'at_risk' | 'moderate' | 'active';
}

export interface Department {
  _id: Id<'departments'>;
  name: string;
  code?: string;
  university_id: Id<'universities'>;
}

export interface UniversityOverview {
  totalStudents: number;
  activeStudents: number;
  activeLicenses: number;
  licenseCapacity: number;
  departmentDistribution: DepartmentDistribution[];
  unassignedStudents: number;
  departments?: number;
  newStudentsThisMonth?: number;
  studentGrowthPercent?: number;
}

export interface DepartmentDistribution {
  name: string;
  count: number;
  percentage: number;
}

// ==========================================
// Analytics Types
// ==========================================

export interface StudentMetrics {
  totalResumes: number;
  totalGoals: number;
  totalApplications: number;
  totalCoverLetters: number;
  totalProjects: number;
  avgCareerCompletion: number;
}

export interface StudentProgress {
  userId?: Id<'users'>;
  studentId?: Id<'users'>;
  name: string;
  email?: string;
  completion: number;
  resumes: number;
  applications: number;
  goals: number;
  projects?: number;
  coverLetters?: number;
}

export interface StudentFunnelData {
  stage: string;
  count: number;
}

export interface ActiveUserData {
  date: string;
  activeUsers: number;
}

export interface DepartmentStats {
  name: string;
  students: number;
  activeRate: number;
}

// ==========================================
// Chart Data Types
// ==========================================

export interface ChartDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

export interface FeatureUsageData {
  feature: string;
  usage: number;
}

export interface RiskSegmentData {
  segment: string;
  count: number;
  color: string;
}

export interface FeatureEngagementByRisk {
  feature: string;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}

export interface PlatformUsageData {
  month: string;
  goals: number;
  applications: number;
  resumes: number;
  coverLetters: number;
}

export interface ActivityData {
  day: string;
  logins: number;
  registrations?: number;
  assignments?: number;
}

export interface ActiveUsersData {
  data: { date: string; students: number; advisors: number }[];
  totalStudents: number;
  totalAdvisors: number;
}

export interface StudentFunnelResponse {
  funnel: { stage: string; count: number; percent: number }[];
}

// ==========================================
// Form Data Types
// ==========================================

export interface EditStudentFormData {
  name: string;
  email: string;
  role: string;
}

export interface AssignLicensesData {
  emails: string[];
  role: 'student' | 'advisor';
  departmentId?: Id<'departments'>;
}

// ==========================================
// Filter Types
// ==========================================

export type RoleFilter = 'all' | 'student' | 'advisor' | 'staff';
export type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';
export type AnalyticsView = 'engagement' | 'features' | 'risk';
export type UsageView = 'overview' | 'features' | 'programs';
export type ViewMode = 'table' | 'grid';

export interface FilterState {
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  searchQuery: string;
}

export interface FilterHandlers {
  setRoleFilter: (filter: RoleFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setSearchQuery: (query: string) => void;
}

// ==========================================
// Dialog Props Types
// ==========================================

export interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFilename: string;
  onExport: (filename: string) => Promise<void>;
}

export interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  formData: EditStudentFormData;
  onFormChange: (data: EditStudentFormData) => void;
  onSave: () => Promise<void>;
  isLoading: boolean;
}

export interface DeleteStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export interface AssignLicensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  availableSeats: number;
  totalSeats: number;
  onAssign: (data: AssignLicensesData) => Promise<{ success: boolean; successCount: number }>;
}
