/**
 * NACE National Benchmarks
 *
 * National average data from NACE First Destination Survey reports.
 * Used to compare institutional outcomes against industry standards.
 *
 * Source: NACE First Destination Survey Reports
 * Note: These are illustrative benchmarks. Actual NACE data requires membership.
 * Update annually with latest NACE survey results.
 *
 * Last updated: 2024
 */

// ============================================================================
// OVERALL OUTCOME BENCHMARKS
// ============================================================================

export interface NACEBenchmark {
  metric: string;
  nationalAverage: number;
  description: string;
  source: string;
}

/**
 * NACE national averages for key outcome metrics.
 * Based on Class of 2023 data.
 */
export const NACE_OUTCOME_BENCHMARKS: Record<string, NACEBenchmark> = {
  career_outcomes_rate: {
    metric: 'Career Outcomes Rate',
    nationalAverage: 86.3,
    description: '(Employed + Continuing Ed + Military/Service) / (Known - Not Seeking)',
    source: 'NACE FDS Class of 2023',
  },
  knowledge_rate: {
    metric: 'Knowledge Rate',
    nationalAverage: 65.2,
    description: 'Percentage of graduates with known outcomes',
    source: 'NACE FDS Class of 2023',
  },
  employment_rate: {
    metric: 'Employment Rate',
    nationalAverage: 58.4,
    description: 'Percentage employed (full-time + part-time)',
    source: 'NACE FDS Class of 2023',
  },
  continuing_ed_rate: {
    metric: 'Continuing Education Rate',
    nationalAverage: 21.8,
    description: 'Percentage pursuing graduate/professional education',
    source: 'NACE FDS Class of 2023',
  },
};

// ============================================================================
// SALARY BENCHMARKS BY FIELD
// ============================================================================

export interface SalaryBenchmark {
  field: string;
  medianSalary: number;
  percentile25: number;
  percentile75: number;
}

/**
 * NACE national salary benchmarks by broad field of study.
 * Median starting salaries for Class of 2023 graduates.
 */
export const NACE_SALARY_BENCHMARKS: SalaryBenchmark[] = [
  {
    field: 'Computer Science',
    medianSalary: 75000,
    percentile25: 62000,
    percentile75: 95000,
  },
  {
    field: 'Engineering',
    medianSalary: 73000,
    percentile25: 60000,
    percentile75: 88000,
  },
  {
    field: 'Business',
    medianSalary: 58000,
    percentile25: 48000,
    percentile75: 72000,
  },
  {
    field: 'Health Sciences',
    medianSalary: 55000,
    percentile25: 45000,
    percentile75: 68000,
  },
  {
    field: 'Communications',
    medianSalary: 48000,
    percentile25: 40000,
    percentile75: 58000,
  },
  {
    field: 'Social Sciences',
    medianSalary: 46000,
    percentile25: 38000,
    percentile75: 56000,
  },
  {
    field: 'Humanities',
    medianSalary: 44000,
    percentile25: 36000,
    percentile75: 54000,
  },
  {
    field: 'Education',
    medianSalary: 42000,
    percentile25: 36000,
    percentile75: 50000,
  },
];

/**
 * Overall national median salary (all fields combined)
 */
export const NACE_OVERALL_MEDIAN_SALARY = 56000;

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

export type ComparisonStatus = 'above' | 'at' | 'below';

export interface BenchmarkComparison {
  status: ComparisonStatus;
  difference: number;
  percentageDifference: number;
}

/**
 * Compare an institutional metric against the national benchmark.
 * Returns comparison status and difference.
 */
export function compareToBenchmark(
  value: number,
  benchmarkKey: keyof typeof NACE_OUTCOME_BENCHMARKS,
): BenchmarkComparison {
  const benchmark = NACE_OUTCOME_BENCHMARKS[benchmarkKey];
  if (!benchmark) {
    return { status: 'at', difference: 0, percentageDifference: 0 };
  }

  const difference = value - benchmark.nationalAverage;
  const percentageDifference =
    benchmark.nationalAverage > 0
      ? Math.round((difference / benchmark.nationalAverage) * 1000) / 10
      : 0;

  // Within 2% is considered "at" benchmark
  const threshold = 2;
  let status: ComparisonStatus;
  if (difference > threshold) {
    status = 'above';
  } else if (difference < -threshold) {
    status = 'below';
  } else {
    status = 'at';
  }

  return {
    status,
    difference: Math.round(difference * 10) / 10,
    percentageDifference,
  };
}

/**
 * Compare salary against the national median.
 */
export function compareSalaryToBenchmark(medianSalary: number): BenchmarkComparison {
  const difference = medianSalary - NACE_OVERALL_MEDIAN_SALARY;
  const percentageDifference = Math.round((difference / NACE_OVERALL_MEDIAN_SALARY) * 1000) / 10;

  const threshold = NACE_OVERALL_MEDIAN_SALARY * 0.05; // 5% threshold
  let status: ComparisonStatus;
  if (difference > threshold) {
    status = 'above';
  } else if (difference < -threshold) {
    status = 'below';
  } else {
    status = 'at';
  }

  return {
    status,
    difference,
    percentageDifference,
  };
}

/**
 * Get display styling based on comparison status.
 */
export function getComparisonStyles(status: ComparisonStatus): {
  textColor: string;
  bgColor: string;
  icon: '↑' | '→' | '↓';
} {
  switch (status) {
    case 'above':
      return {
        textColor: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: '↑',
      };
    case 'below':
      return {
        textColor: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: '↓',
      };
    default:
      return {
        textColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: '→',
      };
  }
}
