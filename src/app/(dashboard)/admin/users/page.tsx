'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useAction } from 'convex/react';
import {
  AlertTriangle,
  Crown,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import Image from 'next/image';
import React, { useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { hasPlatformAdminAccess, requiresUniversityAffiliation } from '@/lib/constants/roles';

// Types matching Convex users table
interface UserRow {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  username?: string;
  role:
    | 'individual'
    | 'user'
    | 'student'
    | 'staff'
    | 'university_admin'
    | 'advisor'
    | 'super_admin';
  subscription_plan?: 'free' | 'premium' | 'university' | null; // Cached from Clerk for display (read-only), null for internal roles like staff
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'past_due'; // Cached from Clerk for display (read-only)
  account_status?: 'pending_activation' | 'pending_deletion' | 'active' | 'suspended' | 'deleted';
  is_test_user?: boolean;
  deleted_at?: number;
  deleted_by?: string;
  deleted_reason?: string;
  university_id?: string;
  profile_image?: string;
  created_at: number;
  updated_at: number;
}

// Helper to determine the display plan for a user based on their role and subscription
function getDisplayPlan(user: UserRow): {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
  className?: string;
} {
  // Super admin - distinct styling from staff
  if (hasPlatformAdminAccess(user.role)) {
    return {
      label: 'Admin',
      variant: 'outline',
      className: 'border-red-300 text-red-700 bg-red-50',
    };
  }

  // Staff - internal employees without billing plans
  if (user.role === 'staff') {
    return {
      label: 'Staff',
      variant: 'outline',
      className: 'border-purple-300 text-purple-700 bg-purple-50',
    };
  }

  // University-affiliated roles get university plan
  if (requiresUniversityAffiliation(user.role)) {
    return { label: 'University', variant: 'default', className: 'bg-blue-600' };
  }

  // For individual users, show their actual plan
  if (!user.subscription_plan || user.subscription_plan === 'free') {
    return { label: 'Free', variant: 'secondary' };
  }

  if (user.subscription_plan === 'premium') {
    return { label: 'Premium', variant: 'default' };
  }

  if (user.subscription_plan === 'university') {
    return { label: 'University', variant: 'default', className: 'bg-blue-600' };
  }

  // Fallback
  return { label: user.subscription_plan || 'None', variant: 'secondary' };
}

export default function AdminUsersPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRow['role']>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'premium' | 'university' | 'staff'>(
    'all',
  );
  const [statusFilter, setStatusFilter] = useState<'all' | UserRow['subscription_status']>('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState<
    'all' | 'active' | 'deleted' | 'pending_activation' | 'pending_deletion' | 'suspended'
  >('active'); // Default to active only
  const [universityFilter, setUniversityFilter] = useState<'all' | string>('all');

  // Check permissions using CLERK directly (source of truth for roles)
  const clerkRole = useMemo(
    () => (clerkUser?.publicMetadata as any)?.role as string | undefined,
    [clerkUser?.publicMetadata],
  );
  const canAccess = useMemo(() => clerkRole === 'super_admin', [clerkRole]);
  const shouldQuery = useMemo(
    () => !!(clerkLoaded && canAccess && clerkUser?.id),
    [clerkLoaded, canAccess, clerkUser?.id],
  );

  // Fetch users with minimal fields (optimized for bandwidth, reduced limit)
  const usersResult = useQuery(
    api.users.getAllUsersMinimal,
    shouldQuery ? { clerkId: clerkUser!.id, limit: 50 } : 'skip',
  );

  // Fetch universities for the university column
  const universities = useQuery(
    api.universities.getAllUniversities,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  );

  const updateUser = useMutation(api.users.updateUser);
  const createUserByAdmin = useMutation(api.admin_users.createUserByAdmin);

  // Delete and restore actions (from admin_users_actions.ts - Node.js runtime)
  const softDeleteUser = useAction(api.admin_users_actions.softDeleteUser);
  const hardDeleteUser = useAction(api.admin_users_actions.hardDeleteUser);
  const restoreDeletedUser = useAction(api.admin_users_actions.restoreDeletedUser);
  const markTestUser = useMutation(api.admin_users.markTestUser);

  // Create user mutation for adding new staff users
  const createUser = useMutation(api.users.createUser);

  const users: UserRow[] = useMemo(
    () => (usersResult ? (usersResult.page as any) : []),
    [usersResult],
  );

  // Helper to get university name from university_id
  const getUniversityName = (universityId?: string) => {
    if (!universityId || !universities) return 'None';
    const university = universities.find((u) => u._id === universityId);
    return university?.name || universityId;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesText =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      // Plan filter: 'staff' matches internal roles (staff, super_admin) which have no billing plan
      const matchesPlan =
        planFilter === 'all' ||
        (planFilter === 'staff'
          ? u.role === 'staff' || hasPlatformAdminAccess(u.role)
          : u.subscription_plan === planFilter);
      const matchesStatus = statusFilter === 'all' || u.subscription_status === statusFilter;
      const matchesAccountStatus =
        accountStatusFilter === 'all' || (u.account_status || 'active') === accountStatusFilter;
      const matchesUniversity = universityFilter === 'all' || u.university_id === universityFilter;
      return (
        matchesText &&
        matchesRole &&
        matchesPlan &&
        matchesStatus &&
        matchesAccountStatus &&
        matchesUniversity
      );
    });
  }, [users, search, roleFilter, planFilter, statusFilter, accountStatusFilter, universityFilter]);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    role: UserRow['role'];
    plan: 'free' | 'premium' | 'university';
    status: UserRow['subscription_status'];
  } | null>(null);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard' | null>(null);

  // Pro access state
  const [showProAccessConfirm, setShowProAccessConfirm] = useState(false);
  const [proAccessUser, setProAccessUser] = useState<UserRow | null>(null);
  const [proAccessAction, setProAccessAction] = useState<'grant' | 'revoke'>('grant');
  const [proAccessReason, setProAccessReason] = useState('');
  const [grantingProAccess, setGrantingProAccess] = useState(false);

  // Add staff user state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'staff' as UserRow['role'],
    plan: 'free' as 'free' | 'premium' | 'university',
    sendActivationEmail: true, // Default ON for Staff/Super Admin
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState(false);

  const handleAddUser = async () => {
    if (!newUserForm.name.trim() || !newUserForm.email.trim() || !clerkUser?.id) return;

    setCreatingUser(true);
    setCreateUserError(null);
    setCreateUserSuccess(false);

    try {
      // Use createUserByAdmin mutation which conditionally sends activation email
      const result = await createUserByAdmin({
        adminClerkId: clerkUser.id,
        email: newUserForm.email,
        name: newUserForm.name,
        role: newUserForm.role as
          | 'individual'
          | 'user'
          | 'student'
          | 'staff'
          | 'university_admin'
          | 'advisor',
        sendActivationEmail: newUserForm.sendActivationEmail,
      });

      // Show success message
      setCreateUserSuccess(true);
      setCreateUserError(null);

      // Reset form after a short delay so user sees the success message
      setTimeout(() => {
        setNewUserForm({
          name: '',
          email: '',
          role: 'staff',
          plan: 'free',
          sendActivationEmail: true,
        });
        setShowAddUser(false);
        setCreateUserSuccess(false);
      }, 1500);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create user. Please try again.';
      console.error('Error creating user:', error);
      setCreateUserError(errorMessage);
      setCreateUserSuccess(false);
    } finally {
      setCreatingUser(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    // Default to 'free' for internal roles (staff/super_admin) that don't have a billing plan
    const effectivePlan = u.subscription_plan || 'free';
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      plan: effectivePlan,
      status: u.subscription_status,
    });
  };

  const submitEdit = async () => {
    if (!editing || !form) return;
    setSaving(true);
    try {
      await updateUser({
        clerkId: editing.clerkId,
        updates: {
          name: form.name,
          email: form.email,
          role: form.role as any,
          subscription_plan: form.plan, // Updates cached field in Convex (actual source is Clerk)
          subscription_status: form.status, // Updates cached field in Convex (actual source is Clerk)
        },
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTestUser = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await markTestUser({
        targetClerkId: editing.clerkId,
        isTestUser: !editing.is_test_user,
      });
      // Close dialog and let Convex query update the UI
      setEditing(null);
    } catch (error) {
      console.error('Error toggling test user:', error);
      alert('Failed to toggle test user status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || !deleteType) return;
    setDeleting(true);
    try {
      if (deleteType === 'soft') {
        await softDeleteUser({
          targetClerkId: editing.clerkId,
          reason: deleteReason || undefined,
        });
        alert('User soft deleted successfully. Account preserved for compliance.');
      } else {
        await hardDeleteUser({
          targetClerkId: editing.clerkId,
        });
        alert('Test user permanently deleted.');
      }
      setShowDeleteConfirm(false);
      setEditing(null);
      setDeleteReason('');
      setDeleteType(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      alert(`Error: ${message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await restoreDeletedUser({
        targetClerkId: editing.clerkId,
      });
      alert('User restored successfully. Account is now active.');
      setEditing(null);
    } catch (error) {
      console.error('Error restoring user:', error);
      const message = error instanceof Error ? error.message : 'Failed to restore user';
      alert(`Error: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (type: 'soft' | 'hard') => {
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  // Pro access handlers
  const openProAccessDialog = (user: UserRow, action: 'grant' | 'revoke') => {
    setProAccessUser(user);
    setProAccessAction(action);
    setProAccessReason('');
    setShowProAccessConfirm(true);
  };

  const handleProAccess = async () => {
    if (!proAccessUser || !clerkUser?.id) return;
    setGrantingProAccess(true);
    try {
      const response = await fetch('/api/admin/users/grant-pro-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: proAccessUser.clerkId,
          grantAccess: proAccessAction === 'grant',
          reason: proAccessReason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update pro access');
      }

      alert(data.message);
      setShowProAccessConfirm(false);
      setProAccessUser(null);
      setProAccessReason('');
    } catch (error) {
      console.error('Error updating pro access:', error);
      const message = error instanceof Error ? error.message : 'Failed to update pro access';
      alert(`Error: ${message}`);
    } finally {
      setGrantingProAccess(false);
    }
  };

  // Check if user can have pro access granted/revoked
  const canModifyProAccess = (user: UserRow): boolean => {
    // Cannot modify pro access for university-affiliated users
    if (['student', 'university_admin', 'advisor'].includes(user.role)) {
      return false;
    }
    // Cannot modify pro access for staff/admins
    if (['super_admin', 'staff'].includes(user.role)) {
      return false;
    }
    return true;
  };

  // Check if user currently has pro access
  const hasProAccess = (user: UserRow): boolean => {
    return user.subscription_plan === 'premium' && user.subscription_status === 'active';
  };

  // Access check: use Clerk's publicMetadata (source of truth)
  if (!canAccess) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm">
          <Card>
            <CardHeader>
              <CardTitle>Unauthorized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Only Super Admin can access User Management.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!usersResult) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <Button onClick={() => setShowAddUser(true)} className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, username"
                  className="pl-8"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="user">User (legacy)</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="university_admin">University Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={universityFilter} onValueChange={(v: any) => setUniversityFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="University" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Universities</SelectItem>
                  {universities?.map((uni) => (
                    <SelectItem key={uni._id} value={uni._id}>
                      {uni.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={(v: any) => setPlanFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                  <SelectItem value="staff">Staff (Internal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-3">
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Subscription Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subscription Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={accountStatusFilter}
                  onValueChange={(v: any) => setAccountStatusFilter(v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Account Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Account Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_activation">Pending Activation</SelectItem>
                    <SelectItem value="pending_deletion">Pending Deletion</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Showing {filtered.length} of {users.length} users
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1fr_1fr_80px] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="min-w-0">Name</div>
                <div className="hidden md:block min-w-0">Email</div>
                <div className="min-w-0">Role</div>
                <div className="hidden md:block min-w-0">Plan</div>
                <div className="min-w-0">University</div>
                <div className="min-w-0">Sub Status</div>
                <div className="min-w-0">Account</div>
                <div className="text-right min-w-0">Actions</div>
              </div>
              <div className="divide-y">
                {filtered.map((u) => {
                  const isDeleted = u.account_status === 'deleted';
                  return (
                    <div
                      key={u._id}
                      className={`grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1fr_1fr_80px] gap-3 px-4 py-3 items-center ${
                        isDeleted ? 'bg-red-50/50 opacity-60' : ''
                      }`}
                      title={
                        isDeleted && u.deleted_reason ? `Deleted: ${u.deleted_reason}` : undefined
                      }
                    >
                      <div className="min-w-0 truncate">
                        <div className="font-medium flex items-center gap-2">
                          <Image
                            src={
                              u.profile_image ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=0C29AB&color=fff`
                            }
                            alt={u.name}
                            width={32}
                            height={32}
                            className={`h-8 w-8 rounded-full object-cover flex-shrink-0 ${isDeleted ? 'grayscale' : ''}`}
                          />
                          <div className="flex flex-col">
                            <span className={isDeleted ? 'line-through text-muted-foreground' : ''}>
                              {u.name}
                            </span>
                            {u.is_test_user && (
                              <Badge
                                variant="outline"
                                className="text-[10px] w-fit border-orange-300 text-orange-600 bg-orange-50"
                              >
                                TEST
                              </Badge>
                            )}
                            {isDeleted && u.deleted_at && (
                              <span className="text-[10px] text-red-600">
                                Deleted {new Date(u.deleted_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`text-xs md:hidden truncate ${isDeleted ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}
                        >
                          {u.email}
                        </div>
                      </div>
                      <div
                        className={`hidden md:block min-w-0 truncate ${isDeleted ? 'line-through text-muted-foreground' : ''}`}
                      >
                        {u.email}
                      </div>
                      <div className="min-w-0">
                        <Badge variant="outline" className="capitalize text-xs">
                          {u.role.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="hidden md:block min-w-0">
                        {(() => {
                          const planInfo = getDisplayPlan(u);
                          return (
                            <Badge
                              variant={planInfo.variant}
                              className={`text-xs ${planInfo.className || ''}`}
                            >
                              {planInfo.label}
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="text-xs text-muted-foreground">
                          {getUniversityName(u.university_id)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Badge
                          variant={u.subscription_status === 'active' ? 'default' : 'destructive'}
                          className="capitalize text-xs"
                        >
                          {u.subscription_status}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <Badge
                          variant={
                            u.account_status === 'deleted'
                              ? 'destructive'
                              : u.account_status === 'suspended'
                                ? 'destructive'
                                : u.account_status === 'pending_activation'
                                  ? 'secondary'
                                  : 'default'
                          }
                          className={`text-xs ${
                            u.account_status === 'pending_deletion'
                              ? 'bg-orange-600 hover:bg-orange-700 text-white border-transparent'
                              : ''
                          }`}
                        >
                          {(u.account_status || 'active')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </div>
                      <div className="text-right min-w-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              {isDeleted ? 'View / Restore' : 'Edit'}
                            </DropdownMenuItem>
                            {canModifyProAccess(u) && !isDeleted && (
                              <>
                                <DropdownMenuSeparator />
                                {hasProAccess(u) ? (
                                  <DropdownMenuItem
                                    onClick={() => openProAccessDialog(u, 'revoke')}
                                    className="text-orange-600 focus:text-orange-600"
                                  >
                                    <Crown className="h-4 w-4 mr-2" />
                                    Revoke Pro Access
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => openProAccessDialog(u, 'grant')}
                                    className="text-primary-600 focus:text-primary-600"
                                  >
                                    <Crown className="h-4 w-4 mr-2" />
                                    Grant Pro Access
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user profile, access, and account status.
              </DialogDescription>
            </DialogHeader>
            {form && editing ? (
              <div className="space-y-6">
                {/* Deleted User Warning */}
                {editing.account_status === 'deleted' && (
                  <div className="rounded-lg bg-red-100 border border-red-300 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-red-900">User Deleted</h4>
                            <p className="text-sm text-red-700 mt-1">
                              This user account has been soft deleted and cannot be edited.
                            </p>
                            {editing.deleted_at && (
                              <p className="text-xs text-red-600 mt-2">
                                Deleted on: {new Date(editing.deleted_at).toLocaleString()}
                              </p>
                            )}
                            {editing.deleted_reason && (
                              <p className="text-xs text-red-600 mt-1">
                                Reason: {editing.deleted_reason}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRestore}
                            disabled={saving}
                            className="ml-4 border-green-600 text-green-700 hover:bg-green-50"
                          >
                            {saving ? 'Restoring...' : 'Restore User'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select
                        value={form.role}
                        onValueChange={(v: any) => setForm({ ...form, role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="university_admin">University Admin</SelectItem>
                          <SelectItem value="advisor">Advisor</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Plan (Display Only)</label>
                      <Select
                        value={form.plan}
                        onValueChange={(v: any) => setForm({ ...form, plan: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="university">University</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status (Display Only)</label>
                      <Select
                        value={form.status}
                        onValueChange={(v: any) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Test User Toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Test User</Label>
                      <div className="text-sm text-muted-foreground">
                        Test users can be permanently deleted. Real users can only be soft deleted.
                      </div>
                    </div>
                    <Switch
                      checked={editing.is_test_user || false}
                      onCheckedChange={handleToggleTestUser}
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Danger Zone - Delete User */}
                <div className="border-t border-red-200 pt-4 bg-red-50 -mx-6 px-6 -mb-6 pb-6 rounded-b-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-red-900">Danger Zone</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Delete this user account. This action has serious consequences.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog('soft')}
                          disabled={editing.is_test_user}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Soft Delete
                        </Button>
                        {editing.is_test_user && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog('hard')}
                            className="bg-red-700 hover:bg-red-800"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hard Delete (Permanent)
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-red-600">
                        {editing.is_test_user
                          ? 'Test user: Can be permanently deleted with all data removed.'
                          : 'Real user: Can only be soft deleted. Data preserved for FERPA compliance.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={submitEdit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>
                Create a new user account and send activation email.
              </DialogDescription>
            </DialogHeader>
            {createUserSuccess ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                  <p className="text-sm font-medium text-green-900">User created successfully!</p>
                  <p className="text-sm text-green-800 mt-1">
                    {newUserForm.sendActivationEmail
                      ? 'Activation email has been sent.'
                      : 'No activation email was sent.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {createUserError && (
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <p className="text-sm font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-800 mt-1">{createUserError}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    placeholder="Enter full name"
                    disabled={creatingUser}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="Enter email address"
                    type="email"
                    disabled={creatingUser}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={newUserForm.role}
                    onValueChange={(v: any) => {
                      // Update role and set default email checkbox based on role
                      const isUniversityRole = ['student', 'university_admin', 'advisor'].includes(
                        v,
                      );
                      setNewUserForm({
                        ...newUserForm,
                        role: v,
                        sendActivationEmail: !isUniversityRole,
                      });
                    }}
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="student">Student (University)</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="university_admin">University Admin</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sendActivationEmail"
                    checked={newUserForm.sendActivationEmail}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, sendActivationEmail: e.target.checked })
                    }
                    className="rounded"
                    disabled={creatingUser}
                  />
                  <label htmlFor="sendActivationEmail" className="text-sm font-medium">
                    Send activation email now
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddUser(false)}
                disabled={creatingUser}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={
                  creatingUser ||
                  !newUserForm.name.trim() ||
                  !newUserForm.email.trim() ||
                  createUserSuccess
                }
              >
                {creatingUser ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                {deleteType === 'hard' ? 'Permanently Delete User?' : 'Soft Delete User?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteType === 'hard' ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-red-600">
                      This will PERMANENTLY delete the user and all their data. This action CANNOT
                      be undone.
                    </p>
                    <p>
                      User: <span className="font-medium">{editing?.name}</span> ({editing?.email})
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                      <li>User account will be removed from Convex</li>
                      <li>Clerk identity will be deleted</li>
                      <li>
                        All user data will be permanently deleted (applications, resumes, etc.)
                      </li>
                      <li>This action is IRREVERSIBLE</li>
                    </ul>
                    <p className="text-sm text-red-600 font-medium mt-3">
                      Only use this for test users. Real user data must be preserved for compliance.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold">
                      This will soft delete the user. Data will be preserved for FERPA compliance.
                    </p>
                    <p>
                      User: <span className="font-medium">{editing?.name}</span> ({editing?.email})
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                      <li>User will be unable to log in</li>
                      <li>Account marked as "deleted" in database</li>
                      <li>All user data is preserved for compliance</li>
                      <li>Clerk account will be disabled (not deleted)</li>
                    </ul>
                    <div className="mt-4">
                      <Label htmlFor="deleteReason" className="text-sm font-medium">
                        Reason for deletion (optional)
                      </Label>
                      <Textarea
                        id="deleteReason"
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Enter reason for deleting this user..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteReason('');
                  setDeleteType(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteType === 'hard' ? 'Permanently Delete' : 'Soft Delete'}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Pro Access Confirmation Dialog */}
        <AlertDialog open={showProAccessConfirm} onOpenChange={setShowProAccessConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Crown
                  className={`h-5 w-5 ${proAccessAction === 'grant' ? 'text-primary-600' : 'text-orange-600'}`}
                />
                {proAccessAction === 'grant' ? 'Grant Pro Access?' : 'Revoke Pro Access?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3">
                  <p>
                    {proAccessAction === 'grant'
                      ? 'This will give the user premium features without requiring payment.'
                      : 'This will remove premium features from the user. They will return to the free plan.'}
                  </p>
                  <p>
                    User: <span className="font-medium">{proAccessUser?.name}</span> (
                    {proAccessUser?.email})
                  </p>
                  {proAccessAction === 'grant' && (
                    <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This is an admin-granted subscription and will not
                        generate any billing. Use this sparingly for special cases like beta
                        testers, partners, or support resolutions.
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <Label htmlFor="proAccessReason" className="text-sm font-medium">
                      Reason (optional but recommended)
                    </Label>
                    <Textarea
                      id="proAccessReason"
                      value={proAccessReason}
                      onChange={(e) => setProAccessReason(e.target.value)}
                      placeholder={
                        proAccessAction === 'grant'
                          ? 'e.g., Beta tester, Partner account, Support resolution...'
                          : 'e.g., User requested downgrade, Abuse detected...'
                      }
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowProAccessConfirm(false);
                  setProAccessUser(null);
                  setProAccessReason('');
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleProAccess}
                disabled={grantingProAccess}
                className={
                  proAccessAction === 'grant'
                    ? 'bg-primary-600 hover:bg-primary-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }
              >
                {grantingProAccess ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {proAccessAction === 'grant' ? 'Granting...' : 'Revoking...'}
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    {proAccessAction === 'grant' ? 'Grant Pro Access' : 'Revoke Pro Access'}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
