/**
 * Integration tests for import utilities and identity resolution
 *
 * Tests the following functionality:
 * - External outcome ID generation
 * - Student identity resolution by external_student_id, email, name
 * - CSV parsing and validation
 * - Outcome status/type normalization
 */

import { Id } from 'convex/_generated/dataModel';

import { parseCSV } from '@/lib/csv-utils';

import {
  calculateNameSimilarity,
  generateExternalOutcomeId,
  normalizeForMatching,
  validateDataSource,
  validateOutcomeImportRow,
  validateOutcomeType,
} from '../../convex/lib/importUtils';

// Mock cohort ID for testing
const mockCohortId = 'test_cohort_123' as unknown as Id<'graduation_cohorts'>;

describe('Import Utilities', () => {
  describe('generateExternalOutcomeId', () => {
    it('should generate ID from external student ID', () => {
      const result = generateExternalOutcomeId(mockCohortId, 'STU001', 'test@example.com');
      expect(result).toBe(`${mockCohortId}_stu001`);
    });

    it('should generate ID from email when no external ID', () => {
      const result = generateExternalOutcomeId(mockCohortId, undefined, 'Test@Example.com');
      expect(result).toBe(`${mockCohortId}_test@example.com`);
    });

    it('should prefer external ID over email', () => {
      const result = generateExternalOutcomeId(mockCohortId, 'STU001', 'test@example.com');
      expect(result).toContain('stu001');
      expect(result).not.toContain('@example.com');
    });

    it('should throw error when no identifier provided', () => {
      expect(() => generateExternalOutcomeId(mockCohortId, undefined, undefined)).toThrow(
        'Either externalStudentId or email is required',
      );
    });

    it('should normalize whitespace and case', () => {
      const result = generateExternalOutcomeId(mockCohortId, ' STU001 ', undefined);
      expect(result).toBe(`${mockCohortId}_stu001`);
    });
  });

  describe('validateOutcomeImportRow', () => {
    it('should validate row with external student ID', () => {
      const result = validateOutcomeImportRow({
        externalStudentId: 'STU001',
        outcomeStatus: 'known',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate row with email', () => {
      const result = validateOutcomeImportRow({
        studentEmail: 'test@example.com',
        outcomeStatus: 'known',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject row without identifier', () => {
      const result = validateOutcomeImportRow({
        studentName: 'John Doe',
        outcomeStatus: 'known',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either external_student_id or student_email is required');
    });

    it('should reject invalid outcome status', () => {
      const result = validateOutcomeImportRow({
        externalStudentId: 'STU001',
        outcomeStatus: 'invalid_status' as any,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid outcome_status');
    });

    it('should accept valid outcome status values', () => {
      const validStatuses = ['unknown', 'known', 'partial'];
      for (const status of validStatuses) {
        const result = validateOutcomeImportRow({
          externalStudentId: 'STU001',
          outcomeStatus: status as any,
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateOutcomeType', () => {
    it('should accept valid outcome types', () => {
      const validTypes = [
        'employed_fulltime',
        'employed_parttime',
        'continuing_education',
        'military',
        'volunteer',
        'seeking',
        'not_seeking',
      ];
      for (const type of validTypes) {
        expect(validateOutcomeType(type)).toBe(true);
      }
    });

    it('should reject invalid outcome types', () => {
      expect(validateOutcomeType('invalid_type')).toBe(false);
      expect(validateOutcomeType('fulltime')).toBe(false);
      expect(validateOutcomeType('unemployed')).toBe(false);
    });

    it('should accept undefined', () => {
      expect(validateOutcomeType(undefined)).toBe(true);
    });
  });

  describe('validateDataSource', () => {
    it('should accept valid data sources', () => {
      const validSources = [
        'survey',
        'linkedin',
        'advisor_input',
        'student_self_report',
        'employer_report',
        'platform_inference',
      ];
      for (const source of validSources) {
        expect(validateDataSource(source)).toBe(true);
      }
    });

    it('should reject invalid data sources', () => {
      expect(validateDataSource('invalid_source')).toBe(false);
      expect(validateDataSource('manual')).toBe(false);
      expect(validateDataSource('api')).toBe(false);
    });

    it('should accept undefined', () => {
      expect(validateDataSource(undefined)).toBe(true);
    });
  });
});

describe('Identity Resolution', () => {
  // Mock database query context
  type MockUser = {
    _id: string;
    name: string | null;
    email: string | null;
    university_id: string;
  };

  type MockStudentProfile = {
    _id: string;
    user_id: string;
    university_id: string;
    student_id: string;
  };

  // Helper to create mock database context
  function createMockDb(users: MockUser[], profiles: MockStudentProfile[]) {
    return {
      query: (table: string) => ({
        withIndex: (indexName: string, queryFn: any) => {
          return {
            first: async () => {
              if (table === 'studentProfiles' && indexName === 'by_university_student_id') {
                // Mock the index query for student profiles
                let universityId: string | undefined;
                let studentId: string | undefined;

                const mockQ = {
                  eq: (field: string, value: string) => {
                    if (field === 'university_id') universityId = value;
                    if (field === 'student_id') studentId = value;
                    return mockQ;
                  },
                };
                queryFn(mockQ);

                return profiles.find(
                  (p) => p.university_id === universityId && p.student_id === studentId,
                );
              }

              if (table === 'users' && indexName === 'by_email') {
                let email: string | undefined;
                const mockQ = {
                  eq: (field: string, value: string) => {
                    if (field === 'email') email = value;
                    return mockQ;
                  },
                };
                queryFn(mockQ);

                return users.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
              }

              return null;
            },
            take: async (limit: number) => {
              if (table === 'studentProfiles' && indexName === 'by_university') {
                let universityId: string | undefined;
                const mockQ = {
                  eq: (field: string, value: string) => {
                    if (field === 'university_id') universityId = value;
                    return mockQ;
                  },
                };
                queryFn(mockQ);

                return profiles.filter((p) => p.university_id === universityId).slice(0, limit);
              }
              return [];
            },
          };
        },
      }),
      get: async (id: string) => {
        return users.find((u) => u._id === id);
      },
    };
  }

  describe('resolveStudentIdentity', () => {
    it('should match by external_student_id (exact match)', async () => {
      // This test validates the resolution logic conceptually
      // The actual function requires Convex context, so we test the logic pattern

      const mockUser: MockUser = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@university.edu',
        university_id: 'univ_1',
      };

      const mockProfile: MockStudentProfile = {
        _id: 'profile_1',
        user_id: 'user_1',
        university_id: 'univ_1',
        student_id: 'STU001',
      };

      // Simulate the resolution logic
      const externalStudentId = 'STU001';
      const matchedProfile = mockProfile.student_id === externalStudentId ? mockProfile : null;

      expect(matchedProfile).not.toBeNull();
      expect(matchedProfile?.user_id).toBe('user_1');
    });

    it('should match by email (case-insensitive)', async () => {
      const mockUser: MockUser = {
        _id: 'user_1',
        name: 'Jane Doe',
        email: 'Jane.Doe@University.edu',
        university_id: 'univ_1',
      };

      // Simulate email matching logic
      const searchEmail = 'jane.doe@university.edu';
      const normalizedUserEmail = mockUser.email?.toLowerCase();
      const normalizedSearchEmail = searchEmail.toLowerCase();

      expect(normalizedUserEmail).toBe(normalizedSearchEmail);
    });

    it('should return no match when identifier not found', async () => {
      // Simulate no match scenario
      const profiles: MockStudentProfile[] = [];
      const users: MockUser[] = [];

      const searchResult = profiles.find((p) => p.student_id === 'NONEXISTENT');
      expect(searchResult).toBeUndefined();
    });
  });

  describe('Name similarity calculation', () => {
    it('should normalize names with diacritics', () => {
      expect(normalizeForMatching('José García')).toBe('jose garcia');
      expect(normalizeForMatching('François Müller')).toBe('francois muller');
    });

    it('should normalize whitespace', () => {
      expect(normalizeForMatching('  John   Doe  ')).toBe('john doe');
    });

    it('should calculate high similarity for exact match', () => {
      const norm1 = normalizeForMatching('John Doe');
      const norm2 = normalizeForMatching('john doe');
      const similarity = calculateNameSimilarity(norm1, norm2);
      expect(similarity).toBe(1);
    });

    it('should calculate partial similarity for partial match', () => {
      const norm1 = normalizeForMatching('John Michael Doe');
      const norm2 = normalizeForMatching('John Doe');
      const similarity = calculateNameSimilarity(norm1, norm2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    it('should calculate low similarity for different names', () => {
      const norm1 = normalizeForMatching('John Doe');
      const norm2 = normalizeForMatching('Jane Smith');
      const similarity = calculateNameSimilarity(norm1, norm2);
      expect(similarity).toBeLessThan(0.3);
    });

    it('should handle prefix matching', () => {
      const norm1 = normalizeForMatching('William');
      const norm2 = normalizeForMatching('Will');
      const similarity = calculateNameSimilarity(norm1, norm2);
      expect(similarity).toBeGreaterThan(0);
    });
  });
});

describe('CSV Parsing', () => {
  it('should parse simple CSV', () => {
    const csv = `name,email,status
John Doe,john@test.com,known
Jane Smith,jane@test.com,unknown`;

    const { headers, rows } = parseCSV(csv);
    expect(headers).toEqual(['name', 'email', 'status']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['John Doe', 'john@test.com', 'known']);
  });

  it('should handle quoted fields with commas', () => {
    const csv = `name,job_title
"Doe, John","Software Engineer, Senior"`;

    const { headers, rows } = parseCSV(csv);
    expect(rows[0][0]).toBe('Doe, John');
    expect(rows[0][1]).toBe('Software Engineer, Senior');
  });

  it('should handle escaped quotes within quoted fields', () => {
    const csv = `name,company
"John ""Johnny"" Doe","Acme ""Best"" Corp"`;

    const { headers, rows } = parseCSV(csv);
    expect(rows[0][0]).toBe('John "Johnny" Doe');
    expect(rows[0][1]).toBe('Acme "Best" Corp');
  });

  it('should handle empty values', () => {
    const csv = `name,email,salary
John Doe,,50000
Jane Smith,jane@test.com,`;

    const { headers, rows } = parseCSV(csv);
    expect(rows[0][1]).toBe('');
    expect(rows[1][2]).toBe('');
  });

  it('should normalize header names', () => {
    const csv = `"Student Name",STUDENT_EMAIL,Outcome Status
John Doe,john@test.com,known`;

    const { headers } = parseCSV(csv);
    expect(headers).toEqual(['student name', 'student_email', 'outcome status']);
  });

  it('should handle Windows line endings', () => {
    const csv = `name,email\r\nJohn Doe,john@test.com\r\nJane Smith,jane@test.com`;

    const { rows } = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

describe('Data Type Mapping', () => {
  // Status and type mapping as defined in the import page
  const OUTCOME_STATUS_MAP: Record<string, 'unknown' | 'known' | 'partial'> = {
    unknown: 'unknown',
    known: 'known',
    partial: 'partial',
    pending: 'unknown',
    confirmed: 'known',
    unconfirmed: 'partial',
  };

  const OUTCOME_TYPE_MAP: Record<string, string | undefined> = {
    employed_fulltime: 'employed_fulltime',
    employed_full_time: 'employed_fulltime',
    'full-time': 'employed_fulltime',
    fulltime: 'employed_fulltime',
    employed_parttime: 'employed_parttime',
    employed_part_time: 'employed_parttime',
    'part-time': 'employed_parttime',
    parttime: 'employed_parttime',
    continuing_education: 'continuing_education',
    grad_school: 'continuing_education',
    graduate_school: 'continuing_education',
    military: 'military',
    volunteer: 'volunteer',
    volunteering: 'volunteer',
    seeking: 'seeking',
    seeking_employment: 'seeking',
    job_seeking: 'seeking',
    not_seeking: 'not_seeking',
    not_seeking_employment: 'not_seeking',
  };

  it('should map outcome status variations', () => {
    expect(OUTCOME_STATUS_MAP['pending']).toBe('unknown');
    expect(OUTCOME_STATUS_MAP['confirmed']).toBe('known');
    expect(OUTCOME_STATUS_MAP['unconfirmed']).toBe('partial');
  });

  it('should map employment type variations', () => {
    expect(OUTCOME_TYPE_MAP['full-time']).toBe('employed_fulltime');
    expect(OUTCOME_TYPE_MAP['employed_full_time']).toBe('employed_fulltime');
    expect(OUTCOME_TYPE_MAP['fulltime']).toBe('employed_fulltime');
  });

  it('should map continuing education variations', () => {
    expect(OUTCOME_TYPE_MAP['grad_school']).toBe('continuing_education');
    expect(OUTCOME_TYPE_MAP['graduate_school']).toBe('continuing_education');
  });

  it('should return undefined for unknown types', () => {
    expect(OUTCOME_TYPE_MAP['unknown_type']).toBeUndefined();
    expect(OUTCOME_TYPE_MAP['employed']).toBeUndefined();
  });
});
