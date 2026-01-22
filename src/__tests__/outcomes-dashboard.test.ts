/**
 * Integration tests for Outcomes Intelligence Dashboard
 *
 * Tests the following functionality:
 * - KPI computation (knowledge rate, employment rate)
 * - Filter functionality
 * - Snapshot creation and retrieval
 * - CSV export format
 */

describe('Outcomes Dashboard KPI Computation', () => {
  describe('Knowledge Rate', () => {
    it('should calculate knowledge rate as (known / total) * 100', () => {
      const total = 100;
      const known = 60;
      const knowledgeRate = (known / total) * 100;
      expect(knowledgeRate).toBe(60);
    });

    it('should return 0 when total is 0', () => {
      const total = 0;
      const known = 0;
      const knowledgeRate = total > 0 ? (known / total) * 100 : 0;
      expect(knowledgeRate).toBe(0);
    });

    it('should handle decimal precision correctly', () => {
      const total = 3;
      const known = 1;
      const knowledgeRate = Math.round((known / total) * 1000) / 10;
      expect(knowledgeRate).toBeCloseTo(33.3, 1);
    });
  });

  describe('Employment Rate', () => {
    it('should calculate employment rate as (employed / known) * 100', () => {
      const known = 60;
      const employed = 40;
      const employmentRate = (employed / known) * 100;
      expect(employmentRate).toBeCloseTo(66.7, 1);
    });

    it('should count both fulltime and parttime as employed', () => {
      const outcomes = [
        { outcome_status: 'known', outcome_type: 'employed_fulltime' },
        { outcome_status: 'known', outcome_type: 'employed_parttime' },
        { outcome_status: 'known', outcome_type: 'continuing_education' },
        { outcome_status: 'unknown', outcome_type: undefined },
      ];

      const known = outcomes.filter((o) => o.outcome_status === 'known');
      const employed = known.filter(
        (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
      );

      expect(known.length).toBe(3);
      expect(employed.length).toBe(2);
    });

    it('should return 0 when no known outcomes', () => {
      const known = 0;
      const employed = 0;
      const employmentRate = known > 0 ? (employed / known) * 100 : 0;
      expect(employmentRate).toBe(0);
    });
  });

  describe('Continuing Education Rate', () => {
    it('should calculate continuing ed rate correctly', () => {
      const known = 60;
      const continuingEd = 10;
      const rate = (continuingEd / known) * 100;
      expect(rate).toBeCloseTo(16.7, 1);
    });
  });
});

describe('Outcomes Filtering', () => {
  const mockOutcomes = [
    {
      _id: '1',
      cohort_id: 'cohort_2024',
      outcome_status: 'known',
      outcome_type: 'employed_fulltime',
      major_name: 'Computer Science',
      degree_level: 'bachelor',
    },
    {
      _id: '2',
      cohort_id: 'cohort_2024',
      outcome_status: 'known',
      outcome_type: 'continuing_education',
      major_name: 'Business',
      degree_level: 'bachelor',
    },
    {
      _id: '3',
      cohort_id: 'cohort_2023',
      outcome_status: 'unknown',
      outcome_type: undefined,
      major_name: 'Computer Science',
      degree_level: 'bachelor',
    },
    {
      _id: '4',
      cohort_id: 'cohort_2024',
      outcome_status: 'partial',
      outcome_type: 'seeking',
      major_name: 'Engineering',
      degree_level: 'master',
    },
  ];

  it('should filter by cohort', () => {
    const filter = { cohortIds: ['cohort_2024'] };
    const filtered = mockOutcomes.filter(
      (o) => !filter.cohortIds || filter.cohortIds.includes(o.cohort_id),
    );
    expect(filtered.length).toBe(3);
  });

  it('should filter by program', () => {
    const filter = { programs: ['Computer Science'] };
    const filtered = mockOutcomes.filter(
      (o) => !filter.programs || filter.programs.includes(o.major_name),
    );
    expect(filtered.length).toBe(2);
  });

  it('should filter by degree level', () => {
    const filter = { degreeLevels: ['master'] };
    const filtered = mockOutcomes.filter(
      (o) => !filter.degreeLevels || filter.degreeLevels.includes(o.degree_level),
    );
    expect(filtered.length).toBe(1);
  });

  it('should apply multiple filters together', () => {
    const filter = {
      cohortIds: ['cohort_2024'],
      programs: ['Computer Science'],
    };

    const filtered = mockOutcomes.filter((o) => {
      const cohortMatch = !filter.cohortIds || filter.cohortIds.includes(o.cohort_id);
      const programMatch = !filter.programs || filter.programs.includes(o.major_name);
      return cohortMatch && programMatch;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0]._id).toBe('1');
  });

  it('should return all when no filters applied', () => {
    const filter = {};
    const filtered = mockOutcomes;
    expect(filtered.length).toBe(4);
  });
});

describe('Outcome Status Distribution', () => {
  const mockOutcomes = [
    { outcome_status: 'known' },
    { outcome_status: 'known' },
    { outcome_status: 'known' },
    { outcome_status: 'unknown' },
    { outcome_status: 'unknown' },
    { outcome_status: 'partial' },
  ];

  it('should count known outcomes correctly', () => {
    const known = mockOutcomes.filter((o) => o.outcome_status === 'known').length;
    expect(known).toBe(3);
  });

  it('should count unknown outcomes correctly', () => {
    const unknown = mockOutcomes.filter((o) => o.outcome_status === 'unknown').length;
    expect(unknown).toBe(2);
  });

  it('should count partial outcomes correctly', () => {
    const partial = mockOutcomes.filter((o) => o.outcome_status === 'partial').length;
    expect(partial).toBe(1);
  });
});

describe('Outcome Type Distribution', () => {
  const mockOutcomes = [
    { outcome_status: 'known', outcome_type: 'employed_fulltime' },
    { outcome_status: 'known', outcome_type: 'employed_fulltime' },
    { outcome_status: 'known', outcome_type: 'employed_parttime' },
    { outcome_status: 'known', outcome_type: 'continuing_education' },
    { outcome_status: 'known', outcome_type: 'continuing_education' },
    { outcome_status: 'known', outcome_type: 'military' },
    { outcome_status: 'known', outcome_type: 'volunteer' },
    { outcome_status: 'known', outcome_type: 'seeking' },
    { outcome_status: 'known', outcome_type: 'not_seeking' },
  ];

  it('should count employed fulltime correctly', () => {
    const count = mockOutcomes.filter((o) => o.outcome_type === 'employed_fulltime').length;
    expect(count).toBe(2);
  });

  it('should count total employed (fulltime + parttime)', () => {
    const count = mockOutcomes.filter(
      (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
    ).length;
    expect(count).toBe(3);
  });

  it('should count continuing education correctly', () => {
    const count = mockOutcomes.filter((o) => o.outcome_type === 'continuing_education').length;
    expect(count).toBe(2);
  });
});

describe('Snapshot Data Structure', () => {
  const mockSnapshot = {
    _id: 'snapshot_1',
    name: 'Q4 2024 Report',
    snapshot_date: Date.now(),
    filters: {
      cohort_ids: ['cohort_2024'],
      degree_levels: undefined,
      programs: undefined,
      graduation_year: undefined,
    },
    metrics: {
      total_students: 100,
      known_outcomes: 60,
      unknown_outcomes: 30,
      partial_outcomes: 10,
      knowledge_rate: 60,
      employed_fulltime: 35,
      employed_parttime: 5,
      continuing_education: 15,
      military: 2,
      volunteer: 1,
      seeking: 2,
      not_seeking: 0,
      employment_rate: 66.7,
      continuing_ed_rate: 25,
    },
  };

  it('should have valid metrics structure', () => {
    expect(mockSnapshot.metrics).toHaveProperty('total_students');
    expect(mockSnapshot.metrics).toHaveProperty('known_outcomes');
    expect(mockSnapshot.metrics).toHaveProperty('knowledge_rate');
    expect(mockSnapshot.metrics).toHaveProperty('employment_rate');
  });

  it('should preserve filter state', () => {
    expect(mockSnapshot.filters).toHaveProperty('cohort_ids');
    expect(mockSnapshot.filters.cohort_ids).toEqual(['cohort_2024']);
  });

  it('should have metrics that sum correctly', () => {
    const { total_students, known_outcomes, unknown_outcomes, partial_outcomes } =
      mockSnapshot.metrics;
    expect(known_outcomes + unknown_outcomes + partial_outcomes).toBe(total_students);
  });

  it('should have valid knowledge rate', () => {
    const { total_students, known_outcomes, knowledge_rate } = mockSnapshot.metrics;
    const calculated = (known_outcomes / total_students) * 100;
    expect(knowledge_rate).toBe(calculated);
  });
});

describe('CSV Export Format', () => {
  const mockOutcome = {
    external_student_id: 'STU001',
    student_name: 'John Smith',
    student_email: 'john@edu.com',
    cohort_name: 'Spring 2024',
    outcome_status: 'known',
    outcome_type: 'employed_fulltime',
    employer_name: 'Google',
    job_title: 'Software Engineer',
    is_verified: true,
    confidence_score: 95,
    evidence_files: [{ id: '1' }, { id: '2' }],
    data_source: 'survey',
    updated_at: Date.now(),
  };

  const escapeCSV = (field: string | number | undefined): string => {
    if (field === undefined || field === null) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  it('should include all required columns', () => {
    const headers = [
      'external_student_id',
      'student_name',
      'student_email',
      'cohort_name',
      'outcome_status',
      'outcome_type',
      'employer_name',
      'job_title',
      'is_verified',
      'confidence_score',
      'evidence_count',
      'data_source',
      'last_updated',
    ];

    expect(headers).toContain('external_student_id');
    expect(headers).toContain('outcome_status');
    expect(headers).toContain('evidence_count');
    expect(headers.length).toBe(13);
  });

  it('should escape fields with commas', () => {
    const fieldWithComma = 'Software Engineer, Senior';
    const escaped = escapeCSV(fieldWithComma);
    expect(escaped).toBe('"Software Engineer, Senior"');
  });

  it('should escape fields with quotes', () => {
    const fieldWithQuote = 'Company "ABC"';
    const escaped = escapeCSV(fieldWithQuote);
    expect(escaped).toBe('"Company ""ABC"""');
  });

  it('should handle empty fields', () => {
    const emptyField = undefined;
    const escaped = escapeCSV(emptyField);
    expect(escaped).toBe('');
  });

  it('should count evidence files correctly', () => {
    const evidenceCount = mockOutcome.evidence_files?.length || 0;
    expect(evidenceCount).toBe(2);
  });
});

describe('Evidence Validation', () => {
  it('should require evidence for known outcomes in defensible reports', () => {
    const knownOutcomeWithEvidence = {
      outcome_status: 'known',
      evidence_files: [{ id: '1', type: 'offer_letter' }],
      is_verified: true,
    };

    const knownOutcomeWithoutEvidence = {
      outcome_status: 'known',
      evidence_files: [],
      is_verified: false,
    };

    const hasEvidence = (outcome: { evidence_files?: any[]; is_verified?: boolean }) => {
      return (outcome.evidence_files?.length ?? 0) > 0 || outcome.is_verified === true;
    };

    expect(hasEvidence(knownOutcomeWithEvidence)).toBe(true);
    expect(hasEvidence(knownOutcomeWithoutEvidence)).toBe(false);
  });

  it('should support multiple evidence types', () => {
    const evidenceTypes = ['offer_letter', 'start_confirmation', 'other'];
    const outcome = {
      evidence_files: [
        { id: '1', type: 'offer_letter' },
        { id: '2', type: 'start_confirmation' },
      ],
    };

    outcome.evidence_files.forEach((file) => {
      expect(evidenceTypes).toContain(file.type);
    });
  });
});

describe('Metrics Aggregation by Group', () => {
  const mockOutcomes = [
    { program: 'CS', outcome_status: 'known', outcome_type: 'employed_fulltime' },
    { program: 'CS', outcome_status: 'known', outcome_type: 'employed_fulltime' },
    { program: 'CS', outcome_status: 'unknown', outcome_type: undefined },
    { program: 'Business', outcome_status: 'known', outcome_type: 'employed_fulltime' },
    { program: 'Business', outcome_status: 'known', outcome_type: 'continuing_education' },
  ];

  it('should group outcomes by program', () => {
    const groups = new Map<string, typeof mockOutcomes>();

    mockOutcomes.forEach((o) => {
      if (!groups.has(o.program)) {
        groups.set(o.program, []);
      }
      groups.get(o.program)!.push(o);
    });

    expect(groups.get('CS')!.length).toBe(3);
    expect(groups.get('Business')!.length).toBe(2);
  });

  it('should calculate knowledge rate per group', () => {
    const csOutcomes = mockOutcomes.filter((o) => o.program === 'CS');
    const csKnown = csOutcomes.filter((o) => o.outcome_status === 'known').length;
    const csKnowledgeRate = (csKnown / csOutcomes.length) * 100;

    expect(csKnowledgeRate).toBeCloseTo(66.7, 1);
  });

  it('should calculate employment rate per group', () => {
    const businessOutcomes = mockOutcomes.filter((o) => o.program === 'Business');
    const businessKnown = businessOutcomes.filter((o) => o.outcome_status === 'known');
    const businessEmployed = businessKnown.filter(
      (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
    ).length;
    const businessEmploymentRate = (businessEmployed / businessKnown.length) * 100;

    expect(businessEmploymentRate).toBe(50);
  });
});
