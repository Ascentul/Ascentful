/**
 * University Workspace - Admin Console
 *
 * Landing page for admin-only configuration shortcuts.
 */

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminConsolePage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Admin Console</h1>
        <p className="text-muted-foreground">
          Configuration and operations tools for university administrators.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Manage academic departments and mappings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/u/admin/departments">Open Departments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>Configure courses tied to programs and cohorts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/u/admin/courses">Open Courses</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Invite advisors, staff, and students.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/u/admin/invite">Open Invitations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Engagement rules, signals, and imports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/u/admin/settings">Open Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
