# University Dashboard Decomposition Plan

This directory will contain decomposed components from the 3,422-line `UniversityDashboard.tsx`.

## Current Structure (Before Decomposition)

The main component has:
- **30+ useState hooks** for various state management
- **10+ useQuery hooks** for data fetching
- **5 main tabs**: overview, analytics, students, departments, usage
- **4+ dialogs**: export, edit student, delete confirmation, assign licenses
- **Multiple useMemo hooks** for data transformation

## Target Structure (After Decomposition)

```
src/components/dashboard/university/
├── README.md (this file)
├── types.ts                           # Shared types
├── hooks/
│   ├── useUniversityData.ts           # Data fetching hooks
│   ├── useStudentFilters.ts           # Student filtering logic
│   └── useAnalyticsData.ts            # Analytics data transformations
├── tabs/
│   ├── OverviewTab.tsx                # ~400 lines
│   ├── AnalyticsTab.tsx               # ~400 lines
│   ├── StudentsTab.tsx                # ~500 lines
│   ├── DepartmentsTab.tsx             # ~200 lines
│   └── UsageTab.tsx                   # ~300 lines
├── dialogs/
│   ├── ExportDialog.tsx               # Export data dialog
│   ├── EditStudentDialog.tsx          # Edit student modal
│   ├── DeleteStudentDialog.tsx        # Delete confirmation
│   └── AssignLicensesDialog.tsx       # Bulk assignment
├── charts/
│   ├── PlatformUsageChart.tsx         # Line chart
│   ├── StudentFunnelChart.tsx         # Bar chart
│   ├── RiskDistributionChart.tsx      # Pie chart
│   └── EngagementByRiskChart.tsx      # Stacked bar
└── cards/
    ├── StatCard.tsx                   # Reusable stat card
    └── AdminShortcutsCard.tsx         # Admin quick links
```

## Decomposition Priority

1. **Phase 1 - Extract Dialogs** (Low risk, immediate value)
   - These are self-contained modals with clear props
   - Easy to test in isolation

2. **Phase 2 - Extract Chart Components** (Medium risk)
   - Charts have clear data dependencies
   - Can be reused across tabs

3. **Phase 3 - Extract Tab Contents** (Higher risk)
   - Each tab becomes its own component
   - Requires careful prop drilling or context

4. **Phase 4 - Extract Custom Hooks** (Final cleanup)
   - Move data fetching to shared hooks
   - Move filtering/transformation logic

## Guidelines

- Each component should be < 300 lines
- Use TypeScript interfaces for all props
- Maintain existing behavior exactly
- Add unit tests for extracted components
- Document breaking changes

## Progress

### Phase 1: Dialogs & Types (Completed)
- [x] Create shared types (`types.ts` - 191 lines)
- [x] Extract ExportReportDialog (`dialogs/ExportReportDialog.tsx` - 75 lines)
- [x] Extract EditStudentDialog (`dialogs/EditStudentDialog.tsx` - 101 lines)
- [x] Extract DeleteStudentDialog (`dialogs/DeleteStudentDialog.tsx` - 55 lines)
- [x] Extract AssignLicensesDialog (`dialogs/AssignLicensesDialog.tsx` - 207 lines)
- [x] Update main component to use extracted dialogs

**Results**: Main component reduced from 3,423 to 3,196 lines (-227 lines)

### Phase 2: Custom Hooks (Completed)
- [x] Create useUniversityData hook (`hooks/useUniversityData.ts` - 104 lines)
- [x] Create useStudentFilters hook (`hooks/useStudentFilters.ts` - 61 lines)
- [x] Create useAnalyticsTransforms hook (`hooks/useAnalyticsTransforms.ts` - 204 lines)
- [x] Update main component to use extracted hooks
- [ ] Create useStudentManagement hook (deferred - handlers use component-level deps)

**Results**: Main component reduced from 3,196 to 3,011 lines (-185 lines)
**Total reduction**: 3,423 → 3,011 lines (-412 lines, -12%)

### Phase 3: Tab Components (Completed)
- [x] Extract DepartmentsTab (`tabs/DepartmentsTab.tsx` - 336 lines)
- [x] Extract UsageTab (`tabs/UsageTab.tsx` - 356 lines)
- [x] Extract OverviewTab (`tabs/OverviewTab.tsx` - 524 lines)
- [x] Extract AnalyticsTab (`tabs/AnalyticsTab.tsx` - 437 lines)
- [x] Extract StudentsTab (`tabs/StudentsTab.tsx` - 510 lines)
- [x] Integrate all tab components into main UniversityDashboard.tsx

**Results**: Main component reduced from 3,011 to 999 lines (-2,012 lines)
**Total reduction**: 3,423 → 999 lines (-2,424 lines, -71%)

### Phase 4: Chart Components (Completed)
- [x] Extract PlatformUsageChart (LineChart for platform usage trends)
- [x] Extract WeeklyActivityChart (BarChart for daily activity)
- [x] Extract DistributionPieChart (Generic pie chart for distributions)
- [x] Extract FeatureUsageBarChart (BarChart for feature usage)
- [x] Extract RiskSegmentChart (PieChart for at-risk student segments)

**Results**: 5 reusable chart components created (~300 lines total)

## Summary of Extracted Code

| Category | Files | Total Lines |
|----------|-------|-------------|
| Types | 1 | 218 |
| Dialogs | 4 | 438 |
| Hooks | 3 | 369 |
| Tabs | 5 | 2,163 |
| Charts | 5 | ~300 |
| **Total** | **18** | **~3,488** |

## Final Results

- **Original component**: 3,423 lines
- **After Phase 1 (Dialogs)**: 3,196 lines (-227)
- **After Phase 2 (Hooks)**: 3,011 lines (-185)
- **After Phase 3 (Tabs)**: 999 lines (-2,012)
- **After Phase 4 (Charts)**: 5 reusable chart components
- **Total reduction**: 71% smaller main component

The refactoring is complete. The main component now focuses on:
- Tab navigation and state management
- Dialog coordination
- Delegating rendering to extracted tab components

Chart components are available for reuse across the application:
- `PlatformUsageChart` - Line chart for platform usage trends
- `WeeklyActivityChart` - Bar chart for daily logins/assignments
- `DistributionPieChart` - Generic pie chart with customizable formatting
- `FeatureUsageBarChart` - Bar chart for feature usage statistics
- `RiskSegmentChart` - Pie chart for at-risk student segments
