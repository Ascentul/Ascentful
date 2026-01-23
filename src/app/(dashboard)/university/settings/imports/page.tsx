'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { parseCSV } from '@/lib/csv-utils';

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ParsedRow {
  externalStudentId?: string;
  studentEmail?: string;
  studentName?: string;
  outcomeStatus: 'unknown' | 'known' | 'partial';
  outcomeType?:
    | 'employed_fulltime'
    | 'employed_parttime'
    | 'continuing_education'
    | 'military'
    | 'volunteer'
    | 'seeking'
    | 'not_seeking';
  employerName?: string;
  jobTitle?: string;
  salary?: number;
  city?: string;
  state?: string;
  country?: string;
  gradSchoolName?: string;
  gradSchoolProgram?: string;
}

// CSV column mappings
const CSV_COLUMNS = {
  external_student_id: 'externalStudentId',
  student_id: 'externalStudentId',
  id: 'externalStudentId',
  email: 'studentEmail',
  student_email: 'studentEmail',
  name: 'studentName',
  student_name: 'studentName',
  full_name: 'studentName',
  outcome_status: 'outcomeStatus',
  status: 'outcomeStatus',
  outcome_type: 'outcomeType',
  type: 'outcomeType',
  employer: 'employerName',
  employer_name: 'employerName',
  company: 'employerName',
  job_title: 'jobTitle',
  title: 'jobTitle',
  position: 'jobTitle',
  salary: 'salary',
  annual_salary: 'salary',
  city: 'city',
  state: 'state',
  country: 'country',
  grad_school: 'gradSchoolName',
  grad_school_name: 'gradSchoolName',
  graduate_school: 'gradSchoolName',
  program: 'gradSchoolProgram',
  grad_school_program: 'gradSchoolProgram',
} as const;

const OUTCOME_STATUS_MAP: Record<string, 'unknown' | 'known' | 'partial'> = {
  unknown: 'unknown',
  known: 'known',
  partial: 'partial',
  pending: 'unknown',
  confirmed: 'known',
  unconfirmed: 'partial',
};

const OUTCOME_TYPE_MAP: Record<string, ParsedRow['outcomeType']> = {
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

function mapRowToData(headers: string[], row: string[]): ParsedRow {
  const data: Partial<ParsedRow> = {};

  headers.forEach((header, index) => {
    const value = row[index]?.trim();
    if (!value) return;

    const mappedKey = CSV_COLUMNS[header as keyof typeof CSV_COLUMNS];
    if (!mappedKey) return;

    switch (mappedKey) {
      case 'externalStudentId':
      case 'studentEmail':
      case 'studentName':
      case 'employerName':
      case 'jobTitle':
      case 'city':
      case 'state':
      case 'country':
      case 'gradSchoolName':
      case 'gradSchoolProgram':
        data[mappedKey] = value;
        break;
      case 'outcomeStatus':
        data.outcomeStatus = OUTCOME_STATUS_MAP[value.toLowerCase()] || 'unknown';
        break;
      case 'outcomeType':
        data.outcomeType = OUTCOME_TYPE_MAP[value.toLowerCase()];
        break;
      case 'salary':
        const numValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numValue)) data.salary = numValue;
        break;
    }
  });

  return {
    outcomeStatus: 'unknown',
    ...data,
  } as ParsedRow;
}

export default function BatchImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const universityId = user?.university_id as Id<'universities'> | undefined;

  // Queries
  const cohorts = useQuery(
    api.graduation_outcomes.getCohortsByInstitution,
    universityId ? { institutionId: universityId } : 'skip',
  );

  // Mutations
  const bulkUpsert = useMutation(api.graduation_outcomes.bulkUpsertOutcomes);

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedCohort, setSelectedCohort] = useState<Id<'graduation_cohorts'> | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  // Preview query - manually fetched
  const previewImport = useQuery(
    api.graduation_outcomes.previewOutcomeImport,
    selectedCohort && parsedData.length > 0
      ? { cohortId: selectedCohort, outcomes: parsedData }
      : 'skip',
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);

        if (headers.length === 0) {
          toast({
            title: 'Invalid File',
            description: 'Could not parse CSV headers.',
            variant: 'destructive',
          });
          return;
        }

        const parsed = rows.map((row) => mapRowToData(headers, row));
        setParsedData(parsed);
        toast({
          title: 'File Loaded',
          description: `Parsed ${parsed.length} rows from CSV.`,
        });
      };
      reader.readAsText(file);
    },
    [toast],
  );

  const handlePreview = useCallback(() => {
    if (!selectedCohort) {
      toast({
        title: 'Select Cohort',
        description: 'Please select a cohort before previewing.',
        variant: 'destructive',
      });
      return;
    }
    if (parsedData.length === 0) {
      toast({
        title: 'No Data',
        description: 'Please upload a CSV file first.',
        variant: 'destructive',
      });
      return;
    }
    setStep('preview');
  }, [selectedCohort, parsedData, toast]);

  const handleConfirmImport = async () => {
    if (!selectedCohort || parsedData.length === 0) return;

    setStep('importing');
    setIsLoading(true);

    try {
      // Generate external outcome IDs for each row
      const outcomesWithIds = parsedData.map((row, index) => {
        const identifier = row.externalStudentId || row.studentEmail || '';
        const normalizedId = identifier.toLowerCase().trim();
        // Fall back to row index if no identifier to prevent ID collisions
        const externalOutcomeId = normalizedId
          ? `${selectedCohort}_${normalizedId}`
          : `${selectedCohort}_row_${index}`;
        return {
          externalOutcomeId,
          ...row,
        };
      });

      const result = await bulkUpsert({
        cohortId: selectedCohort,
        outcomes: outcomesWithIds,
        dataSource: 'survey',
        skipIfManuallyEdited: true,
      });

      setImportResult(result);
      setStep('complete');

      toast({
        title: 'Import Complete',
        description: `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped} outcomes.`,
      });
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
        variant: 'destructive',
      });
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult(null);
  };

  const downloadTemplate = () => {
    const headers = [
      'external_student_id',
      'student_email',
      'student_name',
      'outcome_status',
      'outcome_type',
      'employer_name',
      'job_title',
      'salary',
      'city',
      'state',
      'country',
      'grad_school_name',
      'grad_school_program',
    ];
    const sampleRow = [
      'STU001',
      'john.doe@university.edu',
      'John Doe',
      'known',
      'employed_fulltime',
      'Google',
      'Software Engineer',
      '120000',
      'San Francisco',
      'CA',
      'USA',
      '',
      '',
    ];

    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graduate_outcomes_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No university access.</p>
      </div>
    );
  }

  const selectedCohortData = cohorts?.find((c) => c._id === selectedCohort);

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/u/admin/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Batch Import Outcomes</h1>
          <p className="text-muted-foreground">
            Import graduate outcomes from CSV with identity resolution and preview.
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {(['upload', 'preview', 'importing', 'complete'] as ImportStep[]).map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-primary-500 text-white'
                  : step === 'complete' || ['upload', 'preview', 'importing'].indexOf(step) > i
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {step === 'complete' || ['upload', 'preview', 'importing'].indexOf(step) > i ? (
                <Check className="h-4 w-4" />
              ) : (
                <span>{i + 1}</span>
              )}
              <span className="capitalize">{s === 'importing' ? 'Import' : s}</span>
            </div>
            {i < 3 && <ChevronRight className="h-4 w-4 text-neutral-400" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with graduate outcome data. The system will match students and
              preview changes before importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cohort Selection */}
            <div className="space-y-2">
              <Label>Select Cohort *</Label>
              <Select
                value={selectedCohort || ''}
                onValueChange={(v) => setSelectedCohort(v as Id<'graduation_cohorts'>)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a graduation cohort..." />
                </SelectTrigger>
                <SelectContent>
                  {cohorts?.map((cohort) => (
                    <SelectItem key={cohort._id} value={cohort._id}>
                      {cohort.graduation_term.charAt(0).toUpperCase() +
                        cohort.graduation_term.slice(1)}{' '}
                      {cohort.graduation_year}
                      {cohort.degree_level && ` (${cohort.degree_level})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>CSV File</Label>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-8 hover:border-primary-500 hover:bg-neutral-50 transition-colors">
                <FileSpreadsheet className="mb-4 h-12 w-12 text-neutral-400" />
                <p className="mb-2 text-lg font-medium">Drop CSV file here or click to upload</p>
                <p className="text-sm text-muted-foreground">Supports .csv files up to 10MB</p>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {/* Parsed Data Summary */}
            {parsedData.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>File Parsed Successfully</AlertTitle>
                <AlertDescription>
                  Found {parsedData.length} rows. Click &quot;Preview Import&quot; to see how
                  records will be matched and imported.
                </AlertDescription>
              </Alert>
            )}

            {/* Expected Columns Info */}
            <div className="rounded-lg bg-neutral-50 p-4">
              <h4 className="mb-2 font-medium">Expected CSV Columns</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-neutral-700">Required (one of):</span>
                  <ul className="ml-4 list-disc">
                    <li>external_student_id / student_id / id</li>
                    <li>email / student_email</li>
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">Optional:</span>
                  <ul className="ml-4 list-disc">
                    <li>name, outcome_status, outcome_type</li>
                    <li>employer_name, job_title, salary</li>
                    <li>city, state, country</li>
                    <li>grad_school_name, grad_school_program</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handlePreview} disabled={!selectedCohort || parsedData.length === 0}>
                Preview Import
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
            <CardDescription>
              Review how records will be matched and imported for{' '}
              <strong>
                {selectedCohortData?.graduation_term} {selectedCohortData?.graduation_year}
              </strong>{' '}
              cohort.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            {previewImport && (
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-4">
                    <span className="text-2xl font-bold">{previewImport.summary.total}</span>
                    <span className="text-sm text-muted-foreground">Total Rows</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-4">
                    <span className="text-2xl font-bold text-green-600">
                      {previewImport.summary.willCreate}
                    </span>
                    <span className="text-sm text-muted-foreground">Will Create</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-4">
                    <span className="text-2xl font-bold text-blue-600">
                      {previewImport.summary.willUpdate}
                    </span>
                    <span className="text-sm text-muted-foreground">Will Update</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-4">
                    <span className="text-2xl font-bold text-purple-600">
                      {previewImport.summary.identityMatched}
                    </span>
                    <span className="text-sm text-muted-foreground">Identity Matched</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-4">
                    <span className="text-2xl font-bold text-red-600">
                      {previewImport.summary.hasErrors}
                    </span>
                    <span className="text-sm text-muted-foreground">Has Errors</span>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Warnings */}
            {previewImport && previewImport.summary.needsReview > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Review Needed</AlertTitle>
                <AlertDescription>
                  {previewImport.summary.needsReview} rows have low-confidence identity matches.
                  These will be imported but may need manual review.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview Table */}
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">
                  All Rows ({previewImport?.summary.total || 0})
                </TabsTrigger>
                <TabsTrigger value="create">
                  Creating ({previewImport?.summary.willCreate || 0})
                </TabsTrigger>
                <TabsTrigger value="update">
                  Updating ({previewImport?.summary.willUpdate || 0})
                </TabsTrigger>
                <TabsTrigger value="errors">
                  Errors ({previewImport?.summary.hasErrors || 0})
                </TabsTrigger>
              </TabsList>

              {['all', 'create', 'update', 'errors'].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-4">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Identifier</TableHead>
                          <TableHead>Identity Match</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewImport?.preview
                          .filter((row) => {
                            if (tab === 'all') return true;
                            if (tab === 'create') return row.action === 'create';
                            if (tab === 'update') return row.action === 'update';
                            if (tab === 'errors') return row.validationErrors.length > 0;
                            return true;
                          })
                          .slice(0, 50)
                          .map((row) => (
                            <TableRow key={row.rowIndex}>
                              <TableCell className="font-mono text-sm">
                                {row.rowIndex + 1}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px] truncate font-medium">
                                  {row.identifierUsed}
                                </div>
                                {row.data.studentName && (
                                  <div className="text-sm text-muted-foreground">
                                    {row.data.studentName}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {row.identityMatch.matched ? (
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                    <div>
                                      <Badge variant="outline" className="bg-green-50">
                                        {row.identityMatch.confidence}
                                      </Badge>
                                      {row.identityMatch.userName && (
                                        <div className="text-xs text-muted-foreground">
                                          {row.identityMatch.userName}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <UserX className="h-4 w-4 text-neutral-400" />
                                    <Badge variant="secondary">No Match</Badge>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={row.action === 'create' ? 'default' : 'secondary'}
                                  className={
                                    row.action === 'create'
                                      ? 'bg-green-500'
                                      : row.action === 'update'
                                        ? 'bg-blue-500 text-white'
                                        : ''
                                  }
                                >
                                  {row.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {row.data.outcomeStatus}
                                  {row.data.outcomeType && (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      / {row.data.outcomeType.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {row.validationErrors.length > 0 ? (
                                  <div className="text-sm text-red-600">
                                    {row.validationErrors.join(', ')}
                                  </div>
                                ) : row.data.employerName ? (
                                  <div className="text-sm text-muted-foreground">
                                    {row.data.employerName}
                                    {row.data.jobTitle && ` - ${row.data.jobTitle}`}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {previewImport && previewImport.preview.length > 50 && (
                      <div className="border-t p-4 text-center text-sm text-muted-foreground">
                        Showing first 50 rows of {previewImport.preview.length}
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={!previewImport || previewImport.summary.hasErrors > 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Confirm Import ({previewImport?.summary.total || 0} rows)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary-500" />
            <h3 className="mb-2 text-lg font-semibold">Importing Outcomes...</h3>
            <p className="text-muted-foreground">
              Please wait while we process {parsedData.length} records.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && importResult && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-2xl font-bold">Import Complete</h3>
            <p className="mb-6 text-muted-foreground">
              Successfully processed {importResult.total} outcome records.
            </p>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col items-center py-4">
                  <span className="text-3xl font-bold">{importResult.total}</span>
                  <span className="text-sm text-muted-foreground">Total Processed</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center py-4">
                  <span className="text-3xl font-bold text-green-600">{importResult.created}</span>
                  <span className="text-sm text-muted-foreground">Created</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center py-4">
                  <span className="text-3xl font-bold text-blue-600">{importResult.updated}</span>
                  <span className="text-sm text-muted-foreground">Updated</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center py-4">
                  <span className="text-3xl font-bold text-neutral-400">
                    {importResult.skipped}
                  </span>
                  <span className="text-sm text-muted-foreground">Skipped</span>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <Alert variant="destructive" className="mb-6 max-w-lg">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{importResult.errors.length} Errors</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc pl-4">
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...and {importResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleReset}>
                Import More
              </Button>
              <Link href={`/university/outcomes`}>
                <Button>View Outcomes</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
