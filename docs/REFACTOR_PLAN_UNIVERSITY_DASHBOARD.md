# UniversityDashboard.tsx Refactoring Plan

## Executive Summary

The `UniversityDashboard.tsx` component is **3,423 lines** - the largest component in the codebase. This document provides a phased approach to decompose it into maintainable, testable sub-components while preserving functionality.

---

## Current Component Analysis

### Line Count Breakdown

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & State | 1-200 | 35+ useState hooks, 10+ useQuery hooks |
| Data Transformations | 200-450 | useMemo hooks for chart data |
| Helper Functions | 450-937 | Event handlers, mutations, business logic |
| Loading State | 938-948 | Loading spinner |
| Tab Navigation | 948-1024 | Header, buttons, tab switching |
| **Overview Tab** | 1025-1545 | **520 lines** - Stats, charts, quick links |
| **Analytics Tab** | 1546-1975 | **430 lines** - Engagement, features, risk views |
| **Students Tab** | 1976-2484 | **508 lines** - List, progress, filters |
| **Departments Tab** | 2485-2825 | **340 lines** - Department management |
| **Usage Tab** | 2826-3207 | **381 lines** - Platform usage charts |
| **Dialogs** | 3207-3422 | **215 lines** - Edit, Delete, Export, Assign |

### Key Dependencies
- **Convex Queries**: 10 useQuery hooks (overview, students, departments, analytics, studentMetrics, studentProgress, studentFunnel, activeUsersData)
- **Mutations**: 4 (assignStudent, updateStudent, removeStudent, resendInvitation)
- **External Hooks**: useAuth, useUser, useImpersonation, useToast, useRouter

---

## Target Architecture

```
src/components/dashboard/university/
├── index.ts                          # Re-exports
├── types.ts                          # Shared TypeScript interfaces
│
├── UniversityDashboard.tsx           # Main orchestrator (~300 lines)
│
├── hooks/
│   ├── useUniversityData.ts          # All data fetching in one hook
│   ├── useStudentFilters.ts          # Filter state and logic
│   ├── useStudentManagement.ts       # CRUD operations
│   └── useAnalyticsTransforms.ts     # Memoized chart data
│
├── tabs/
│   ├── OverviewTab.tsx               # ~250 lines
│   ├── AnalyticsTab.tsx              # ~250 lines
│   ├── StudentsTab.tsx               # ~300 lines
│   ├── DepartmentsTab.tsx            # ~200 lines
│   └── UsageTab.tsx                  # ~250 lines
│
├── dialogs/
│   ├── ExportReportDialog.tsx        # ~60 lines
│   ├── EditStudentDialog.tsx         # ~80 lines
│   ├── DeleteStudentDialog.tsx       # ~50 lines
│   └── AssignLicensesDialog.tsx      # ~150 lines
│
├── cards/
│   ├── StatCard.tsx                  # Reusable stat card
│   ├── AdminShortcutsCard.tsx        # Quick links for admins
│   └── AtRiskStudentsCard.tsx        # At-risk summary
│
└── charts/
    ├── StudentProgressChart.tsx       # Area chart
    ├── FeatureUsageChart.tsx          # Bar chart
    ├── DepartmentDistributionChart.tsx # Pie chart
    ├── RiskDistributionChart.tsx      # Bar chart
    ├── EngagementByRiskChart.tsx      # Stacked bar
    └── PlatformUsageChart.tsx         # Line chart
```

---

## Phased Implementation

### Phase 1: Extract Shared Types & Dialogs (Low Risk)

**Goal**: Extract self-contained dialog components with clear interfaces.

**Files to Create**:

#### 1.1 `types.ts` (~80 lines)
```typescript
import { Id } from 'convex/_generated/dataModel';

export interface UniversityOverview {
  totalStudents: number;
  activeStudents: number;
  activeLicenses: number;
  licenseCapacity: number;
  departmentDistribution: DepartmentDistribution[];
  unassignedStudents: number;
}

export interface Student {
  _id: Id<'users'>;
  name?: string;
  email: string;
  role: 'student' | 'advisor' | 'staff';
  department_id?: Id<'departments'>;
  last_login?: number;
  created_at: number;
}

export interface StudentProgress {
  userId: Id<'users'>;
  name: string;
  email: string;
  completion: number;
  resumes: number;
  applications: number;
  goals: number;
  projects: number;
}

// ... additional interfaces
```

#### 1.2 `ExportReportDialog.tsx` (~60 lines)
```typescript
interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFilename: string;
  onExport: (filename: string) => void;
}
```

#### 1.3 `EditStudentDialog.tsx` (~80 lines)
```typescript
interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onSave: (data: EditStudentFormData) => Promise<void>;
  isLoading: boolean;
}
```

#### 1.4 `DeleteStudentDialog.tsx` (~50 lines)
```typescript
interface DeleteStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}
```

#### 1.5 `AssignLicensesDialog.tsx` (~150 lines)
```typescript
interface AssignLicensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  availableSeats: number;
  totalSeats: number;
  onAssign: (data: AssignLicensesData) => Promise<{ success: boolean; count: number }>;
}
```

**Verification**:
- [ ] All dialogs render correctly in isolation
- [ ] TypeScript compilation passes
- [ ] Dialog state management works (open/close)
- [ ] Form submissions trigger correct callbacks

---

### Phase 2: Extract Custom Hooks (Medium Risk)

**Goal**: Move data fetching and state logic into reusable hooks.

#### 2.1 `useUniversityData.ts` (~100 lines)
Consolidates all Convex queries:
```typescript
export function useUniversityData(clerkUserId: string | undefined) {
  const overview = useQuery(api.university_admin.getOverview, ...);
  const students = useQuery(api.university_admin.listStudents, ...);
  const departments = useQuery(api.university_admin.listDepartments, ...);
  const analytics = useQuery(api.university_admin.getUniversityAnalytics, ...);
  const studentMetrics = useQuery(api.university_admin.getStudentMetrics, ...);
  const studentProgress = useQuery(api.university_admin.getStudentProgress, ...);
  const studentFunnel = useQuery(api.analytics.getUniversityStudentFunnel, ...);
  const activeUsersData = useQuery(api.analytics.getUniversityActiveUsersOverTime, ...);

  const isLoading = !overview || !students || !departments;

  return {
    overview,
    students,
    departments,
    analytics,
    studentMetrics,
    studentProgress,
    studentFunnel,
    activeUsersData,
    isLoading,
  };
}
```

#### 2.2 `useStudentFilters.ts` (~60 lines)
```typescript
export function useStudentFilters(students: Student[]) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = useMemo(() => {
    // filtering logic
  }, [students, roleFilter, statusFilter, searchQuery]);

  return {
    filters: { roleFilter, statusFilter, searchQuery },
    setters: { setRoleFilter, setStatusFilter, setSearchQuery },
    filteredStudents,
  };
}
```

#### 2.3 `useStudentManagement.ts` (~80 lines)
```typescript
export function useStudentManagement(clerkUserId: string) {
  const assignStudent = useMutation(api.university_admin.assignStudentByEmail);
  const updateStudent = useMutation(api.university_admin.updateStudentByAdmin);
  const removeStudent = useMutation(api.university_admin.removeStudentFromUniversity);
  const resendInvitation = useMutation(api.admin_users.regenerateActivationToken);

  // State for edit/delete dialogs
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);

  // Handler functions
  const handleAssign = async (...) => { ... };
  const handleUpdate = async (...) => { ... };
  const handleDelete = async (...) => { ... };

  return { ... };
}
```

#### 2.4 `useAnalyticsTransforms.ts` (~120 lines)
All the useMemo transformations for chart data:
```typescript
export function useAnalyticsTransforms(data: UniversityDataResult) {
  const departmentDistributionData = useMemo(() => { ... }, [data.overview]);
  const topFeaturesData = useMemo(() => { ... }, [data.studentMetrics]);
  const progressCompletionData = useMemo(() => { ... }, [data.studentProgress]);
  const atRiskStudentsData = useMemo(() => { ... }, [data.studentProgress]);
  const featureEngagementByRisk = useMemo(() => { ... }, [data.studentProgress]);

  return {
    departmentDistributionData,
    topFeaturesData,
    progressCompletionData,
    atRiskStudentsData,
    featureEngagementByRisk,
  };
}
```

**Verification**:
- [ ] Hooks can be tested in isolation
- [ ] No duplicate data fetching
- [ ] Memoization works correctly (no unnecessary recalculations)
- [ ] Main component refactored to use hooks

---

### Phase 3: Extract Tab Components (Higher Risk)

**Goal**: Each tab becomes its own focused component.

#### 3.1 `OverviewTab.tsx` (~250 lines)
```typescript
interface OverviewTabProps {
  overview: UniversityOverview;
  studentMetrics: StudentMetrics;
  studentProgress: StudentProgress[];
  studentFunnel: StudentFunnelData[];
  isUniversityAdmin: boolean;
  chartData: {
    departmentDistribution: ChartData[];
    topFeatures: ChartData[];
    progressCompletion: ChartData[];
  };
}
```

Includes:
- Admin shortcuts card
- 4 stat cards (active students, completion, applications, engagement)
- Student funnel chart
- Feature usage bar chart
- Department distribution pie chart
- Progress completion chart

#### 3.2 `AnalyticsTab.tsx` (~250 lines)
```typescript
interface AnalyticsTabProps {
  activeUsersData: ActiveUserData[];
  atRiskStudentsData: RiskData[];
  featureEngagementByRisk: FeatureRiskData[];
  topFeaturesData: FeatureData[];
}
```

Includes:
- Sub-tab navigation (engagement, features, risk)
- Active users line chart (engagement view)
- Top features bar chart (features view)
- Risk distribution and feature engagement by risk (risk view)

#### 3.3 `StudentsTab.tsx` (~300 lines)
```typescript
interface StudentsTabProps {
  students: Student[];
  studentProgress: StudentProgress[];
  filters: FilterState;
  onFilterChange: FilterHandlers;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (student: Student) => void;
  onResendInvitation: (student: Student) => void;
  isUniversityAdmin: boolean;
}
```

Includes:
- Sub-tabs: List view, Progress view
- Filter controls (role, status, search)
- View toggle (table/grid)
- Student table with actions
- Student progress table with metrics

#### 3.4 `DepartmentsTab.tsx` (~200 lines)
```typescript
interface DepartmentsTabProps {
  departments: Department[];
  departmentStats: DepartmentStats[];
}
```

Includes:
- Department list with stats
- Student counts per department
- Activity metrics

#### 3.5 `UsageTab.tsx` (~250 lines)
```typescript
interface UsageTabProps {
  platformUsageData: UsageData[];
  topFeaturesData: FeatureData[];
  departments: Department[];
  timeFilter: string;
  onTimeFilterChange: (filter: string) => void;
  programFilter: string;
  onProgramFilterChange: (filter: string) => void;
}
```

Includes:
- Time/program filter controls
- Sub-tabs: Overview, Features, Programs
- Platform usage line chart
- Feature usage breakdown
- Program-level analytics

**Verification**:
- [ ] Each tab renders identically to before
- [ ] Tab switching works correctly
- [ ] Props are properly typed
- [ ] No regressions in functionality

---

### Phase 4: Extract Chart Components (Polish)

**Goal**: Create reusable chart components that can be used across the app.

#### Chart Components to Extract:
1. `StudentProgressChart.tsx` - Area chart for student growth
2. `FeatureUsageChart.tsx` - Horizontal bar chart for feature adoption
3. `DepartmentDistributionChart.tsx` - Pie chart with legend
4. `RiskDistributionChart.tsx` - Bar chart for risk segments
5. `EngagementByRiskChart.tsx` - Stacked bar chart
6. `PlatformUsageChart.tsx` - Multi-line chart

Each chart component:
```typescript
interface ChartProps<T> {
  data: T[];
  height?: number;
  colors?: string[];
  showLegend?: boolean;
}
```

**Verification**:
- [ ] Charts render correctly with provided data
- [ ] Responsive sizing works
- [ ] Tooltips display correctly
- [ ] Empty state handling

---

## Final Main Component Structure

After all phases, `UniversityDashboard.tsx` becomes ~300 lines:

```typescript
export function UniversityDashboard() {
  // Auth hooks
  const { user: clerkUser } = useUser();
  const { user } = useAuth();
  const { getEffectiveRole } = useImpersonation();
  const { toast } = useToast();
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Data fetching
  const data = useUniversityData(clerkUser?.id);
  const chartData = useAnalyticsTransforms(data);

  // Student management
  const studentMgmt = useStudentManagement(clerkUser?.id);
  const filters = useStudentFilters(data.students);

  // Dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Role checks
  const effectiveRole = getEffectiveRole();
  const isUniversityAdmin = hasUniversityAdminAccess(effectiveRole);

  // Loading state
  if (data.isLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        onExport={() => setExportDialogOpen(true)}
        onAssign={() => setAssignDialogOpen(true)}
        availableSeats={data.overview.licenseCapacity - data.overview.activeLicenses}
        isUniversityAdmin={isUniversityAdmin}
      />

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab {...overviewProps} />}
      {activeTab === 'analytics' && <AnalyticsTab {...analyticsProps} />}
      {activeTab.startsWith('students') && <StudentsTab {...studentsProps} />}
      {activeTab === 'departments' && <DepartmentsTab {...departmentsProps} />}
      {activeTab === 'usage' && <UsageTab {...usageProps} />}

      {/* Dialogs */}
      <ExportReportDialog open={exportDialogOpen} ... />
      <EditStudentDialog open={studentMgmt.editDialogOpen} ... />
      <DeleteStudentDialog open={studentMgmt.deleteDialogOpen} ... />
      <AssignLicensesDialog open={assignDialogOpen} ... />
    </div>
  );
}
```

---

## Implementation Checklist

### Phase 1: Dialogs & Types
- [ ] Create `src/components/dashboard/university/types.ts`
- [ ] Create `dialogs/ExportReportDialog.tsx`
- [ ] Create `dialogs/EditStudentDialog.tsx`
- [ ] Create `dialogs/DeleteStudentDialog.tsx`
- [ ] Create `dialogs/AssignLicensesDialog.tsx`
- [ ] Update main component to use extracted dialogs
- [ ] Verify all dialog functionality works
- [ ] Run type check

### Phase 2: Custom Hooks
- [ ] Create `hooks/useUniversityData.ts`
- [ ] Create `hooks/useStudentFilters.ts`
- [ ] Create `hooks/useStudentManagement.ts`
- [ ] Create `hooks/useAnalyticsTransforms.ts`
- [ ] Update main component to use hooks
- [ ] Verify data fetching still works
- [ ] Run type check

### Phase 3: Tab Components
- [ ] Create `tabs/OverviewTab.tsx`
- [ ] Create `tabs/AnalyticsTab.tsx`
- [ ] Create `tabs/StudentsTab.tsx`
- [ ] Create `tabs/DepartmentsTab.tsx`
- [ ] Create `tabs/UsageTab.tsx`
- [ ] Update main component to use tab components
- [ ] Visual regression testing for each tab
- [ ] Run type check

### Phase 4: Chart Components
- [ ] Create `charts/StudentProgressChart.tsx`
- [ ] Create `charts/FeatureUsageChart.tsx`
- [ ] Create `charts/DepartmentDistributionChart.tsx`
- [ ] Create `charts/RiskDistributionChart.tsx`
- [ ] Create `charts/EngagementByRiskChart.tsx`
- [ ] Create `charts/PlatformUsageChart.tsx`
- [ ] Update tab components to use chart components
- [ ] Run type check

### Final Verification
- [ ] Main component is ~300 lines
- [ ] All sub-components are <300 lines
- [ ] TypeScript compilation passes
- [ ] All tabs render correctly
- [ ] All dialogs work correctly
- [ ] No visual regressions
- [ ] Performance is maintained or improved

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Main component lines | 3,423 | ~300 |
| Largest sub-component | N/A | <300 |
| Total files | 1 | ~20 |
| Test coverage | 0% | >80% |
| Maintainability Index | Low | High |

---

## Notes

### Breaking Changes: None
This is a pure refactoring with no API or behavior changes. The component's external interface remains unchanged.

### Rollback Strategy
Each phase can be implemented incrementally. If issues arise:
1. Keep old component in place during development
2. Use feature flag to switch between old/new
3. Only delete old code after thorough testing

### Dependencies
No new dependencies required. Uses existing:
- Recharts for charts
- Radix UI for dialogs
- Convex for data

---

## Timeline Estimate

| Phase | Estimated Effort |
|-------|-----------------|
| Phase 1: Dialogs & Types | 2-3 hours |
| Phase 2: Custom Hooks | 3-4 hours |
| Phase 3: Tab Components | 4-6 hours |
| Phase 4: Chart Components | 2-3 hours |
| Testing & Verification | 2-3 hours |
| **Total** | **13-19 hours** |

---

*Document created: January 27, 2026*
*Last updated: January 27, 2026*
