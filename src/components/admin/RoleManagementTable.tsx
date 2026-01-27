'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  Filter,
  GraduationCap,
  Loader2,
  RefreshCw,
  School,
  Search,
  Shield,
  User,
  UserCog,
} from 'lucide-react';
import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/lib/constants/roles';

interface MinimalUser {
  _id: Id<'users'>;
  _creationTime: number;
  clerkId: string;
  name: string;
  email: string;
  username: string | undefined;
  role: UserRole;
  subscription_plan: 'free' | 'premium' | 'university' | undefined;
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'past_due' | undefined;
  account_status:
    | 'active'
    | 'suspended'
    | 'pending_activation'
    | 'pending_deletion'
    | 'deleted'
    | undefined;
  is_test_user: boolean | undefined;
  deleted_at: number | undefined;
  deleted_by: string | undefined;
  deleted_reason: string | undefined;
  university_id: Id<'universities'> | undefined;
  profile_image: string | undefined;
  created_at: number;
  updated_at: number;
}

interface RoleChangeDialogState {
  open: boolean;
  user: MinimalUser | null;
  newRole: string;
  selectedUniversityId: string | undefined;
  loading: boolean;
  validation: {
    valid: boolean;
    error?: string;
    warnings?: string[];
    requiredActions?: string[];
  } | null;
}

const roleIcons: Record<string, React.ReactNode> = {
  super_admin: <Shield className="h-4 w-4" />,
  university_admin: <School className="h-4 w-4" />,
  advisor: <UserCog className="h-4 w-4" />,
  student: <GraduationCap className="h-4 w-4" />,
  individual: <User className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  staff: <Briefcase className="h-4 w-4" />,
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800 border-red-200',
  university_admin: 'bg-blue-100 text-blue-800 border-blue-200',
  advisor: 'bg-purple-100 text-purple-800 border-purple-200',
  student: 'bg-green-100 text-green-800 border-green-200',
  individual: 'bg-gray-100 text-gray-800 border-gray-200',
  user: 'bg-gray-100 text-gray-800 border-gray-200',
  staff: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function RoleManagementTable({ clerkId }: { clerkId: string }) {
  const { toast } = useToast();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogState, setDialogState] = useState<RoleChangeDialogState>({
    open: false,
    user: null,
    newRole: '',
    selectedUniversityId: undefined,
    loading: false,
    validation: null,
  });

  // Check permissions using CLERK directly (source of truth for roles)
  const clerkRole = useMemo(
    () => (clerkUser?.publicMetadata as any)?.role as string | undefined,
    [clerkUser?.publicMetadata],
  );
  const canAccess = useMemo(() => clerkRole === 'super_admin', [clerkRole]);
  const shouldQuery = useMemo(
    () => !!(clerkLoaded && canAccess && clerkId),
    [clerkLoaded, canAccess, clerkId],
  );

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<MinimalUser[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch users with pagination (50 per page)
  const usersData = useQuery(
    api.users.getAllUsersMinimal,
    shouldQuery ? { clerkId, limit: 50, cursor } : 'skip',
  );

  // Accumulate users when data loads
  useEffect(() => {
    if (usersData?.page) {
      if (!cursor) {
        // First page - replace all users
        setAllUsers(usersData.page as MinimalUser[]);
      } else {
        // Subsequent pages - merge with existing users (updating any changed data)
        setAllUsers((prev) => {
          const existingMap = new Map(prev.map((u) => [u._id, u]));
          const pageUsers = usersData.page as MinimalUser[];
          // Update existing users and collect new ones
          pageUsers.forEach((u) => existingMap.set(u._id, u));
          return Array.from(existingMap.values());
        });
      }
      setIsLoadingMore(false);
    }
  }, [usersData?.page, cursor]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (usersData?.continueCursor) {
      setIsLoadingMore(true);
      setCursor(usersData.continueCursor);
    }
  }, [usersData?.continueCursor]);

  // Fetch universities for role change dialog
  const universitiesData = useQuery(
    api.universities.getAllUniversities,
    shouldQuery ? { clerkId } : 'skip',
  );

  // Filter and search users
  const filteredUsers = useMemo(() => {
    if (!allUsers.length) return [];

    return allUsers.filter((user) => {
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = user.name?.toLowerCase().includes(query);
        const matchesEmail = user.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) return false;
      }

      return true;
    });
  }, [allUsers, roleFilter, searchQuery]);

  // Role statistics
  const roleStats = useMemo(() => {
    if (!allUsers.length) return {};

    return allUsers.reduce((acc: Record<string, number>, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
  }, [allUsers]);

  const handleRoleChangeClick = (user: MinimalUser) => {
    setDialogState({
      open: true,
      user,
      newRole: user.role,
      selectedUniversityId: user.university_id,
      loading: false,
      validation: null,
    });
  };

  const handleRoleChange = async () => {
    if (!dialogState.user || !dialogState.newRole) return;
    // Prevent double-clicks and race conditions
    if (dialogState.loading) return;

    setDialogState((prev) => ({ ...prev, loading: true }));

    try {
      // Call API to update role
      const response = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dialogState.user.clerkId,
          newRole: dialogState.newRole,
          universityId: dialogState.selectedUniversityId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update role');
      }

      toast({
        title: 'Role Updated',
        description: `Successfully updated ${dialogState.user.name}'s role to ${dialogState.newRole}`,
      });

      // Close dialog
      // Note: Data will automatically update via Convex reactivity when the webhook completes
      // The flow: API updates Clerk → Clerk webhook → Convex mutation → useQuery re-renders
      // Expected delay: ~500ms-1s for webhook processing
      setDialogState({
        open: false,
        user: null,
        newRole: '',
        selectedUniversityId: undefined,
        loading: false,
        validation: null,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
      setDialogState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleValidateRoleChange = useCallback(async () => {
    if (!dialogState.user || !dialogState.newRole) return;

    try {
      const response = await fetch('/api/admin/users/validate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dialogState.user.clerkId,
          currentRole: dialogState.user.role,
          newRole: dialogState.newRole,
          universityId: dialogState.selectedUniversityId,
        }),
      });

      const validation = await response.json();
      setDialogState((prev) => ({ ...prev, validation }));
    } catch (error) {
      console.error('Validation error:', error);
    }
  }, [dialogState.user, dialogState.newRole, dialogState.selectedUniversityId]);

  // Validate when new role or university selected
  React.useEffect(() => {
    if (dialogState.newRole && dialogState.user && dialogState.newRole !== dialogState.user.role) {
      handleValidateRoleChange();
    }
    // Re-validate when role, university selection, user identity, or validation function changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dialogState.user is intentionally excluded to prevent re-running on every user object change
  }, [
    dialogState.newRole,
    dialogState.selectedUniversityId,
    dialogState.user?.clerkId,
    handleValidateRoleChange,
  ]);

  if (!usersData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading users...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Role Management</CardTitle>
              <CardDescription>
                Manage user roles and permissions ({allUsers.length} users loaded
                {!usersData?.isDone && ', more available'})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {Object.entries(roleStats).map(([role, count]) => (
              <div
                key={role}
                className={`p-3 rounded-lg border ${roleColors[role]} cursor-pointer transition-all hover:shadow-md`}
                onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {roleIcons[role]}
                  <span className="text-xs font-medium capitalize">{role.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-2xl font-bold">{count}</div>
              </div>
            ))}
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="university_admin">University Admin</SelectItem>
                <SelectItem value="advisor">Advisor</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>University</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No users found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.profile_image ? (
                            <Image
                              src={user.profile_image}
                              alt={user.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary">
                                {user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          )}
                          <span>{user.name || 'Unnamed User'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[user.role]}>
                          <span className="flex items-center gap-1">
                            {roleIcons[user.role]}
                            {user.role.replace(/_/g, ' ')}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.university_id ? (
                          <Badge variant="outline">University</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.account_status === 'active' ? 'default' : 'secondary'}>
                          {user.account_status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleChangeClick(user)}
                        >
                          Change Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {!usersData?.isDone && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore || !usersData?.continueCursor}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  'Load More Users'
                )}
              </Button>
            </div>
          )}
          {usersData?.isDone && allUsers.length > 50 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              All {allUsers.length} users loaded
            </p>
          )}
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog
        open={dialogState.open}
        onOpenChange={(open) =>
          !dialogState.loading && setDialogState((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Update the role for {dialogState.user?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Role */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Role</label>
              <div>
                <Badge
                  variant="outline"
                  className={roleColors[dialogState.user?.role || 'individual']}
                >
                  <span className="flex items-center gap-1">
                    {roleIcons[dialogState.user?.role || 'individual']}
                    {dialogState.user?.role?.replace(/_/g, ' ')}
                  </span>
                </Badge>
              </div>
            </div>

            {/* New Role Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Role</label>
              <Select
                value={dialogState.newRole}
                onValueChange={(value) => setDialogState((prev) => ({ ...prev, newRole: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Super Admin
                    </span>
                  </SelectItem>
                  <SelectItem value="university_admin">
                    <span className="flex items-center gap-2">
                      <School className="h-4 w-4" />
                      University Admin
                    </span>
                  </SelectItem>
                  <SelectItem value="advisor">
                    <span className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      Advisor
                    </span>
                  </SelectItem>
                  <SelectItem value="student">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Student
                    </span>
                  </SelectItem>
                  <SelectItem value="individual">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Individual
                    </span>
                  </SelectItem>
                  <SelectItem value="staff">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Staff
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* University Selection (conditional) */}
            {['student', 'university_admin', 'advisor'].includes(dialogState.newRole) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  University <span className="text-red-500">*</span>
                </label>
                <Select
                  value={dialogState.selectedUniversityId || ''}
                  onValueChange={(value) =>
                    setDialogState((prev) => ({ ...prev, selectedUniversityId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select university" />
                  </SelectTrigger>
                  <SelectContent>
                    {!universitiesData ? (
                      <SelectItem value="" disabled>
                        Loading universities...
                      </SelectItem>
                    ) : universitiesData.length === 0 ? (
                      <SelectItem value="" disabled>
                        No universities available
                      </SelectItem>
                    ) : (
                      universitiesData.map((university) => (
                        <SelectItem key={university._id} value={university._id}>
                          {university.name}
                          {university.status !== 'active' && university.status !== 'trial' && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({university.status})
                            </span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Required for university-affiliated roles
                </p>
              </div>
            )}

            {/* Validation Results */}
            {dialogState.validation && (
              <div className="space-y-3">
                {!dialogState.validation.valid && dialogState.validation.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Cannot Change Role</AlertTitle>
                    <AlertDescription>{dialogState.validation.error}</AlertDescription>
                  </Alert>
                )}

                {dialogState.validation.warnings && dialogState.validation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {dialogState.validation.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {dialogState.validation.requiredActions &&
                  dialogState.validation.requiredActions.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Required Actions</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          {dialogState.validation.requiredActions.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDialogState({
                  open: false,
                  user: null,
                  newRole: '',
                  selectedUniversityId: undefined,
                  loading: false,
                  validation: null,
                })
              }
              disabled={dialogState.loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={
                dialogState.loading ||
                !dialogState.validation?.valid ||
                dialogState.newRole === dialogState.user?.role ||
                (['student', 'university_admin', 'advisor'].includes(dialogState.newRole) &&
                  !dialogState.selectedUniversityId)
              }
            >
              {dialogState.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
