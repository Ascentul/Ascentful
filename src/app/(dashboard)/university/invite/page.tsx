'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { AlertCircle, Download, FileText, Mail, Plus, Upload, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

export default function UniversityInviteStudentsPage() {
  const { user, isAdmin, subscription } = useAuth();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  // Access control: Only university_admin or super_admin can invite students
  // subscription.isUniversity is NOT sufficient - it includes regular students
  const canAccess = !!user && (isAdmin || user.role === 'university_admin');

  const departments = useQuery(
    api.university_admin.listDepartments,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  ) as any[] | undefined;

  // Note: Student creation will be handled by the assignStudentByEmail API function

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [manualAddModalOpen, setManualAddModalOpen] = useState(false);

  // Form states
  const [inviteForm, setInviteForm] = useState({
    emails: '',
    departmentId: 'none',
    customMessage: '',
  });
  const [manualForm, setManualForm] = useState({
    email: '',
    departmentId: 'none',
  });
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You do not have access to invite students.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle CSV file upload
  const handleCsvUpload = async () => {
    if (!csvFile || !clerkUser?.id) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('clerkId', clerkUser.id);

      const response = await fetch('/api/university/import-students', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: `Successfully imported ${result.imported} students`,
          variant: 'success',
        });
        setCsvFile(null);
      } else {
        throw new Error('Failed to import students');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle email invitations
  const handleInvite = async () => {
    if (!inviteForm.emails.trim() || !clerkUser?.id) return;

    setLoading(true);
    try {
      const emails = inviteForm.emails
        .split('\n')
        .map((e) => e.trim())
        .filter((e) => e && e.includes('@'));

      if (emails.length === 0) {
        toast({
          title: 'Error',
          description: 'Please enter at least one valid email address',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Call the API endpoint to send invitation emails
      const response = await fetch('/api/university/send-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitations');
      }

      const result = await response.json();

      toast({
        title: 'Invitations Sent',
        description: `Successfully sent ${result.successful} invitation${result.successful !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        variant: 'success',
      });

      setInviteModalOpen(false);
      setInviteForm({ emails: '', departmentId: 'none', customMessage: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle manual student assignment
  const handleManualAdd = async () => {
    if (!manualForm.email.trim() || !clerkUser?.id) return;

    setLoading(true);
    try {
      // Use the assignStudentByEmail function to assign the student to the university
      await fetch('/api/university/assign-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: clerkUser.id,
          email: manualForm.email.trim(),
          role: 'user',
        }),
      });

      toast({
        title: 'Success',
        description: 'Student assigned to university successfully',
        variant: 'success',
      });
      setManualAddModalOpen(false);
      setManualForm({ email: '', departmentId: 'none' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign student',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const csvContent =
      'name,email,department_code\nJohn Doe,john@example.com,CS\nJane Smith,jane@example.com,ENG';
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-6 w-6" /> Invite Students
        </h1>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setInviteModalOpen(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Send email invitations to multiple students
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setManualAddModalOpen(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Manually
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Add individual students manually</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Import students from CSV file</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
                <div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('csv-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>
              {csvFile && (
                <Button onClick={handleCsvUpload} disabled={loading} className="w-full">
                  {loading ? 'Importing...' : `Import ${csvFile.name}`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Import Students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium">CSV Format</h3>
              <p className="text-sm text-muted-foreground">
                Use the template above with columns: name, email, department_code
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium">Department Codes</h3>
              <p className="text-sm text-muted-foreground">
                Use the department code from your departments list. Leave blank for no department
                assignment.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium">Email Invitations</h3>
              <p className="text-sm text-muted-foreground">
                Students will receive an email with instructions to join your university on
                Ascentful.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Invitations Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Student Invitations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emails">Student Emails</Label>
              <Textarea
                id="emails"
                placeholder="Enter student emails, one per line"
                value={inviteForm.emails}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, emails: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="department">Department (Optional)</Label>
              <Select
                value={inviteForm.departmentId}
                onValueChange={(value) =>
                  setInviteForm((prev) => ({ ...prev, departmentId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments?.map((dept: any) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="message">Custom Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation"
                value={inviteForm.customMessage}
                onChange={(e) =>
                  setInviteForm((prev) => ({ ...prev, customMessage: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={loading || !inviteForm.emails.trim()}>
              {loading ? 'Sending...' : 'Send Invitations'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Modal */}
      <Dialog open={manualAddModalOpen} onOpenChange={setManualAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter student's email address"
                value={manualForm.email}
                onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Student must already have an account on Ascentful
              </div>
            </div>
            <div>
              <Label htmlFor="dept">Department (Optional)</Label>
              <Select
                value={manualForm.departmentId}
                onValueChange={(value) =>
                  setManualForm((prev) => ({ ...prev, departmentId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments?.map((dept: any) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualAdd} disabled={loading || !manualForm.email.trim()}>
              {loading ? 'Adding...' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
