'use client';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Link2,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ImportSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (count: number) => void;
}

type Step = 1 | 2 | 3;

// Mock detected columns from CSV
const mockDetectedColumns = [
  { name: 'Email Address', sample: 'sarah.chen@student.pepperdine.edu' },
  { name: 'Current Status', sample: 'Interviewing' },
  { name: 'Companies Applied To', sample: 'Deloitte, BCG, McKinsey' },
  { name: 'Blockers', sample: 'Need help with case interviews' },
  { name: 'Confidence Level', sample: '4' },
];

const columnMappingOptions = [
  { value: '', label: 'Skip this column' },
  { value: 'email', label: 'Student Email' },
  { value: 'status', label: 'Current Status' },
  { value: 'companies', label: 'Companies' },
  { value: 'blockers', label: 'Blocker Notes' },
  { value: 'confidence', label: 'Confidence Level' },
  { value: 'notes', label: 'Additional Notes' },
];

// Mock preview rows
const mockPreviewRows = [
  ['sarah.chen@student.pepperdine.edu', 'Interviewing', 'Deloitte, BCG', 'Case prep help', '4'],
  ['michael.torres@student.pepperdine.edu', 'Applying', 'Google, Meta', '', '3'],
  ['emma.johnson@student.pepperdine.edu', 'Offered', 'Goldman Sachs', '', '5'],
];

export function ImportSurveyModal({ isOpen, onClose, onImportComplete }: ImportSurveyModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [autoReminders, setAutoReminders] = useState({
    sms48hr: true,
    email72hr: true,
  });
  const [importing, setImporting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setColumnMappings({});
      setAutoReminders({ sms48hr: true, email72hr: true });
      setImporting(false);
    }
  }, [isOpen]);

  // Initialize default mappings
  useEffect(() => {
    if (step === 2 && Object.keys(columnMappings).length === 0) {
      const defaults: Record<string, string> = {};
      mockDetectedColumns.forEach((col, idx) => {
        // Auto-map based on column names
        if (col.name.toLowerCase().includes('email')) defaults[col.name] = 'email';
        else if (col.name.toLowerCase().includes('status')) defaults[col.name] = 'status';
        else if (col.name.toLowerCase().includes('blocker')) defaults[col.name] = 'blockers';
        else if (col.name.toLowerCase().includes('confidence')) defaults[col.name] = 'confidence';
        else if (col.name.toLowerCase().includes('compan')) defaults[col.name] = 'companies';
      });
      setColumnMappings(defaults);
    }
  }, [step, columnMappings]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx'))) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleMappingChange = (column: string, value: string) => {
    setColumnMappings((prev) => ({ ...prev, [column]: value }));
  };

  const handleImport = async () => {
    setImporting(true);

    console.log('Importing survey:', {
      file: file?.name,
      columnMappings,
      autoReminders,
    });

    // Simulate import
    await new Promise((r) => setTimeout(r, 1500));

    toast.success('42 survey responses imported successfully');

    setImporting(false);
    onImportComplete?.(42);
    onClose();
  };

  const canProceedFromStep1 = !!file;
  const canProceedFromStep2 = columnMappings['Email Address'] === 'email';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Survey Results
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 && 'Upload your survey data'}
            {step === 2 && 'Map columns to fields'}
            {step === 3 && 'Review and import'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                s === step
                  ? 'bg-primary-500 text-white'
                  : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500',
              )}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
          ))}
        </div>

        <div className="py-4">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary-500 bg-primary-50'
                    : file
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-300 hover:border-slate-400',
                )}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-slate-900">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 mb-2">Drag and drop your CSV or Excel file here</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {/* Connect Options */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500 mb-3">Or connect directly:</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled className="opacity-50">
                    <Link2 className="h-4 w-4 mr-2" />
                    Qualtrics
                  </Button>
                  <Button variant="outline" size="sm" disabled className="opacity-50">
                    <Link2 className="h-4 w-4 mr-2" />
                    Google Forms
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Map the columns from your file to student data fields.
              </p>

              {/* Column Mappings */}
              <div className="space-y-3">
                {mockDetectedColumns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{col.name}</p>
                      <p className="text-xs text-slate-500">Sample: {col.sample}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <select
                      value={columnMappings[col.name] || ''}
                      onChange={(e) => handleMappingChange(col.name, e.target.value)}
                      className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {columnMappingOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="pt-4 border-t border-slate-200">
                <Label className="mb-2 block">Preview (first 3 rows)</Label>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        {mockDetectedColumns.map((col) => (
                          <th
                            key={col.name}
                            className="px-3 py-2 text-left text-xs font-medium text-slate-500"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mockPreviewRows.map((row, idx) => (
                        <tr key={idx}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 text-slate-600">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800">42 responses ready to import</span>
                </div>
                <ul className="text-sm text-green-700 space-y-1 ml-7">
                  <li>38 existing students will be updated</li>
                  <li>4 new students will be created</li>
                </ul>
              </div>

              {/* Auto-Reminder Settings */}
              <div className="space-y-3">
                <Label>Auto-Reminder Settings for Non-Responders</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReminders.sms48hr}
                    onChange={(e) =>
                      setAutoReminders((prev) => ({ ...prev, sms48hr: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Send SMS reminder after 48 hours</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReminders.email72hr}
                    onChange={(e) =>
                      setAutoReminders((prev) => ({ ...prev, email72hr: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Send email reminder after 72 hours</span>
                </label>
              </div>

              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-slate-500" />
                <span className="text-sm text-slate-600">{file?.name}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={importing}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            Cancel
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 ? !canProceedFromStep1 : !canProceedFromStep2}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import 42 Responses
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
