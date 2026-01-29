'use client';

import { Id } from 'convex/_generated/dataModel';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';

import type { AssignLicensesData, Department } from '../types';

interface AssignLicensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  availableSeats: number;
  totalSeats: number;
  onAssign: (data: AssignLicensesData) => Promise<{ success: boolean; successCount: number }>;
}

export function AssignLicensesDialog({
  open,
  onOpenChange,
  departments,
  availableSeats,
  totalSeats,
  onAssign,
}: AssignLicensesDialogProps) {
  const [emailsText, setEmailsText] = useState('');
  const [role, setRole] = useState<'student' | 'advisor'>('student');
  const [selectedProgram, setSelectedProgram] = useState<Id<'departments'> | 'none'>('none');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleAssign = async () => {
    const emails = Array.from(
      new Set(
        emailsText
          .split(/[\n,]+/)
          .map((e) => e.trim())
          .filter(Boolean),
      ),
    );

    if (emails.length === 0) return;

    setIsAssigning(true);
    try {
      const result = await onAssign({
        emails,
        role,
        departmentId: selectedProgram !== 'none' ? selectedProgram : undefined,
      });

      if (result.success) {
        onOpenChange(false);
        setEmailsText('');
        setSelectedProgram('none');
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'email,first_name,last_name,program,cohort,role,tags\nstudent1@university.edu,John,Doe,Computer Science,2024,student,"tag1,tag2"\nstudent2@university.edu,Jane,Smith,Business,2024,student,"tag3"';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const handleImportCsv = async (file: File) => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const emailsFromCsv = Array.from(
        text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
      ).map((m) => m[0]);
      const combined = [emailsText, emailsFromCsv.join('\n')].filter(Boolean).join('\n');
      setEmailsText(combined);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Student Licenses</DialogTitle>
          {totalSeats > 0 && (
            <div className="text-sm text-muted-foreground">
              Available seats: {availableSeats} of {totalSeats}
            </div>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Program/Department</Label>
            <Select
              value={selectedProgram}
              onValueChange={(value) => setSelectedProgram(value as Id<'departments'> | 'none')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a program/department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific program</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept._id} value={dept._id}>
                    {dept.name} {dept.code && `(${dept.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Student Emails</Label>
            <Textarea
              placeholder={`Enter one email per line or comma-separated\nExample:\nstudent1@university.edu\nstudent2@university.edu`}
              rows={6}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
            />
            <div className="text-xs text-muted-foreground mt-1">
              <strong>Note:</strong> An activation email will be sent to each address, allowing
              recipients to activate their account and access university resources. No prior signup
              required.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Assign role:</Label>
            <div className="flex gap-2">
              <Button
                variant={role === 'student' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRole('student')}
              >
                Student
              </Button>
              <Button
                variant={role === 'advisor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRole('advisor')}
              >
                Advisor / Staff
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              Download CSV Template
            </Button>
            <input
              id="studentEmailsCsvAssign"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleImportCsv(f);
                  e.target.value = ''; // Reset to allow re-importing same file
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('studentEmailsCsvAssign')?.click()}
              disabled={isImporting}
            >
              {isImporting ? 'Parsing...' : 'Import CSV'}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || !emailsText.trim()}>
            {isAssigning ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
