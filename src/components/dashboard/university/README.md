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

- [ ] Create shared types
- [ ] Extract ExportDialog
- [ ] Extract EditStudentDialog
- [ ] Extract DeleteStudentDialog
- [ ] Extract OverviewTab
- [ ] Extract AnalyticsTab
- [ ] Extract StudentsTab
- [ ] Extract chart components
- [ ] Create useUniversityData hook
- [ ] Final cleanup and testing
