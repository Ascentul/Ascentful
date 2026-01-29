'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Cpu,
  Database,
  Eye,
  FileText,
  Globe,
  Key,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import { RoleDiagnostics } from '@/components/admin/RoleDiagnostics';
import { RoleHistoryView } from '@/components/admin/RoleHistoryView';
import { RoleManagementTable } from '@/components/admin/RoleManagementTable';
import { RolePermissionsGuide } from '@/components/admin/RolePermissionsGuide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { hasPlatformAdminAccess } from '@/lib/constants/roles';

export default function AdminSettingsPage() {
  const { user: clerkUser } = useUser();
  const { user } = useAuth();
  const { toast } = useToast();

  const updatePlatformSettings = useMutation(api.platform_settings.updatePlatformSettings);
  const platformSettings = useQuery(api.platform_settings.getPlatformSettings);

  // State for various settings
  const [aiSettings, setAiSettings] = useState({
    openaiEnabled: true,
    openaiApiKey: '••••••••••••••••••••••••••••••••••••••••',
    model: 'gpt-4o-mini',
    maxTokens: 4000,
    temperature: 0.7,
    rateLimitEnabled: true,
    rateLimitRequests: 100,
    rateLimitWindow: 3600,
  });

  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    emailVerificationRequired: true,
    sessionTimeout: 24,
    maxFileUploadSize: 10,
    debugMode: false,
  });

  const [generalSettings, setGeneralSettings] = useState({
    platformName: 'Ascentful',
    supportEmail: 'support@ascentful.com',
    baseUrl: 'https://app.ascentful.com',
    defaultTimezone: 'UTC',
    universityPlanLimit: 1000,
    premiumPlanLimit: 100,
  });

  // Update state when platformSettings loads
  React.useEffect(() => {
    if (platformSettings) {
      setAiSettings({
        openaiEnabled: platformSettings.openai_enabled ?? true,
        openaiApiKey: '••••••••••••••••••••••••••••••••••••••••',
        model: platformSettings.openai_model || 'gpt-5',
        maxTokens: platformSettings.openai_max_tokens || 4000,
        temperature: platformSettings.openai_temperature || 0.7,
        rateLimitEnabled: platformSettings.rate_limit_enabled ?? true,
        rateLimitRequests: platformSettings.rate_limit_requests || 100,
        rateLimitWindow: platformSettings.rate_limit_window || 3600,
      });
      setSystemSettings({
        maintenanceMode: platformSettings.maintenance_mode ?? false,
        registrationEnabled: platformSettings.allow_signups ?? true,
        emailVerificationRequired: platformSettings.email_verification_required ?? true,
        sessionTimeout: platformSettings.session_timeout || 24,
        maxFileUploadSize: platformSettings.max_file_upload_size || 10,
        debugMode: platformSettings.debug_mode ?? false,
      });
      setGeneralSettings({
        platformName: platformSettings.platform_name || 'Ascentful',
        supportEmail: platformSettings.support_email || 'support@ascentful.com',
        baseUrl: platformSettings.base_url || 'https://app.ascentful.com',
        defaultTimezone: platformSettings.default_timezone || 'UTC',
        universityPlanLimit: platformSettings.university_plan_limit || 1000,
        premiumPlanLimit: platformSettings.premium_plan_limit || 100,
      });
      setSecuritySettings({
        twoFactorRequired: platformSettings.two_factor_required ?? false,
        passwordComplexity: platformSettings.password_complexity || 'medium',
        loginAttemptLimit: platformSettings.login_attempt_limit || 5,
        ipWhitelistEnabled: platformSettings.ip_whitelist_enabled ?? false,
        auditLogging: platformSettings.audit_logging ?? true,
        sessionEncryption: platformSettings.session_encryption ?? true,
      });
      setNotificationSettings({
        emailNotifications: platformSettings.email_notifications ?? true,
        slackIntegration: platformSettings.slack_integration ?? false,
        webhookUrl: platformSettings.slack_webhook_url || '',
        criticalAlertsOnly: platformSettings.critical_alerts_only ?? false,
        dailyReports: platformSettings.daily_reports ?? true,
        weeklyAnalytics: platformSettings.weekly_analytics ?? true,
      });
    }
  }, [platformSettings]);

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    slackIntegration: false,
    webhookUrl: '',
    criticalAlertsOnly: false,
    dailyReports: true,
    weeklyAnalytics: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorRequired: false,
    passwordComplexity: 'medium',
    loginAttemptLimit: 5,
    ipWhitelistEnabled: false,
    auditLogging: true,
    sessionEncryption: true,
  });

  const [loading, setLoading] = useState(false);

  const role = user?.role;
  const isSuperAdmin = hasPlatformAdminAccess(role);

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm">
          <Card>
            <CardHeader>
              <CardTitle>Unauthorized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Only Super Admin can access System Settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSaveSettings = async (settingsType: string) => {
    setLoading(true);
    try {
      if (!clerkUser) throw new Error('No user found');

      let settingsToSave = {};

      // Map settings based on type
      if (settingsType === 'General') {
        // General tab - includes platform config + maintenance/registration toggles shown in this tab
        settingsToSave = {
          platform_name: generalSettings.platformName,
          support_email: generalSettings.supportEmail,
          base_url: generalSettings.baseUrl,
          default_timezone: generalSettings.defaultTimezone,
          university_plan_limit: generalSettings.universityPlanLimit,
          premium_plan_limit: generalSettings.premiumPlanLimit,
          // These toggles appear in both Quick Actions and General tab for convenience
          maintenance_mode: systemSettings.maintenanceMode,
          allow_signups: systemSettings.registrationEnabled,
        };
      } else if (settingsType === 'AI') {
        settingsToSave = {
          openai_enabled: aiSettings.openaiEnabled,
          openai_model: aiSettings.model,
          openai_temperature: aiSettings.temperature,
          openai_max_tokens: aiSettings.maxTokens,
          rate_limit_enabled: aiSettings.rateLimitEnabled,
          rate_limit_requests: aiSettings.rateLimitRequests,
          rate_limit_window: aiSettings.rateLimitWindow,
        };
      } else if (settingsType === 'System') {
        settingsToSave = {
          maintenance_mode: systemSettings.maintenanceMode,
          allow_signups: systemSettings.registrationEnabled,
          email_verification_required: systemSettings.emailVerificationRequired,
          session_timeout: systemSettings.sessionTimeout,
          max_file_upload_size: systemSettings.maxFileUploadSize,
          debug_mode: systemSettings.debugMode,
        };
      } else if (settingsType === 'Security') {
        settingsToSave = {
          two_factor_required: securitySettings.twoFactorRequired,
          password_complexity: securitySettings.passwordComplexity,
          login_attempt_limit: securitySettings.loginAttemptLimit,
          ip_whitelist_enabled: securitySettings.ipWhitelistEnabled,
          audit_logging: securitySettings.auditLogging,
          session_encryption: securitySettings.sessionEncryption,
        };
      } else if (settingsType === 'Notification') {
        settingsToSave = {
          email_notifications: notificationSettings.emailNotifications,
          slack_integration: notificationSettings.slackIntegration,
          slack_webhook_url: notificationSettings.webhookUrl,
          critical_alerts_only: notificationSettings.criticalAlertsOnly,
          daily_reports: notificationSettings.dailyReports,
          weekly_analytics: notificationSettings.weeklyAnalytics,
        };
      }

      await updatePlatformSettings({
        clerkId: clerkUser.id,
        settings: settingsToSave,
      });

      toast({
        title: 'Settings saved',
        description: `${settingsType} settings have been updated successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to save ${settingsType} settings.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test connection to external provider
   * FEATURE INCOMPLETE: Currently returns mock success
   * Implementation plan:
   * 1. Create API routes for each provider health check:
   *    - /api/admin/health/sendgrid - Verify API key with sendgrid.api.domains.get()
   *    - /api/admin/health/openai - Call models.list() endpoint
   *    - /api/admin/health/clerk - Verify via Clerk API client
   * 2. Each route should return { success: boolean, latency: number, error?: string }
   * 3. Add timeout handling (5s max)
   * 4. Cache results for 5 minutes to avoid rate limiting
   */
  const handleTestConnection = async (type: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/health/${type.toLowerCase()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Connection successful',
          description: `${type} connection test passed (${data.latency}ms)${data.cached ? ' [cached]' : ''}.`,
        });
      } else {
        toast({
          title: 'Connection issue',
          description: data.error || `${type} connection test failed.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: `${type} connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="ai">AI & OpenAI</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="roles">User Roles</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Platform Configuration
                </CardTitle>
                <CardDescription>
                  General platform settings and configuration options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Platform Name</Label>
                      <Input
                        value={generalSettings.platformName}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({ ...prev, platformName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Support Email</Label>
                      <Input
                        value={generalSettings.supportEmail}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({ ...prev, supportEmail: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default University Plan Limit</Label>
                      <Input
                        type="number"
                        value={generalSettings.universityPlanLimit}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({
                            ...prev,
                            universityPlanLimit: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={generalSettings.baseUrl}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({ ...prev, baseUrl: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Time Zone</Label>
                      <Select
                        value={generalSettings.defaultTimezone}
                        onValueChange={(value) =>
                          setGeneralSettings((prev) => ({ ...prev, defaultTimezone: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="EST">Eastern Time</SelectItem>
                          <SelectItem value="PST">Pacific Time</SelectItem>
                          <SelectItem value="CST">Central Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Premium Plan Limit</Label>
                      <Input
                        type="number"
                        value={generalSettings.premiumPlanLimit}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({
                            ...prev,
                            premiumPlanLimit: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label id="general-maintenance-mode-label" htmlFor="general-maintenance-mode">
                        Maintenance Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enable maintenance mode for all users
                      </p>
                    </div>
                    <Switch
                      id="general-maintenance-mode"
                      aria-label="Maintenance Mode"
                      aria-labelledby="general-maintenance-mode-label"
                      checked={systemSettings.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSystemSettings((prev) => ({ ...prev, maintenanceMode: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label id="general-registration-label" htmlFor="general-registration">
                        Registration Enabled
                      </Label>
                      <p className="text-sm text-muted-foreground">Allow new user registrations</p>
                    </div>
                    <Switch
                      id="general-registration"
                      aria-label="Registration Enabled"
                      aria-labelledby="general-registration-label"
                      checked={systemSettings.registrationEnabled}
                      onCheckedChange={(checked) =>
                        setSystemSettings((prev) => ({ ...prev, registrationEnabled: checked }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => handleSaveSettings('General')} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save General Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  OpenAI Configuration
                </CardTitle>
                <CardDescription>
                  Configure OpenAI integration and AI-powered features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable OpenAI Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable AI-powered features throughout the platform
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.openaiEnabled}
                    onCheckedChange={(checked) =>
                      setAiSettings((prev) => ({ ...prev, openaiEnabled: checked }))
                    }
                  />
                </div>

                {aiSettings.openaiEnabled && (
                  <>
                    <Separator />
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>OpenAI API Key</Label>
                          <div className="flex gap-2">
                            <Input
                              type="password"
                              value={aiSettings.openaiApiKey}
                              onChange={(e) =>
                                setAiSettings((prev) => ({ ...prev, openaiApiKey: e.target.value }))
                              }
                              placeholder="sk-..."
                            />
                            <Button
                              variant="outline"
                              onClick={() => handleTestConnection('OpenAI')}
                            >
                              Test
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai-model">Model</Label>
                          <Input
                            id="ai-model"
                            value={aiSettings.model}
                            onChange={(e) =>
                              setAiSettings((prev) => ({ ...prev, model: e.target.value }))
                            }
                            placeholder="gpt-4o"
                          />
                          <p className="text-sm text-muted-foreground">
                            OpenAI model to use (e.g., gpt-4o, gpt-4-turbo)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Max Tokens</Label>
                          <Input
                            type="number"
                            value={aiSettings.maxTokens}
                            onChange={(e) =>
                              setAiSettings((prev) => ({
                                ...prev,
                                maxTokens: parseInt(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="temperature">
                            Temperature ({aiSettings.temperature})
                          </Label>
                          <input
                            id="temperature"
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={aiSettings.temperature}
                            onChange={(e) =>
                              setAiSettings((prev) => ({
                                ...prev,
                                temperature: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Rate Limiting</Label>
                            <p className="text-sm text-muted-foreground">
                              Limit API requests per hour
                            </p>
                          </div>
                          <Switch
                            checked={aiSettings.rateLimitEnabled}
                            onCheckedChange={(checked) =>
                              setAiSettings((prev) => ({ ...prev, rateLimitEnabled: checked }))
                            }
                          />
                        </div>
                        {aiSettings.rateLimitEnabled && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Requests</Label>
                              <Input
                                type="number"
                                value={aiSettings.rateLimitRequests}
                                onChange={(e) =>
                                  setAiSettings((prev) => ({
                                    ...prev,
                                    rateLimitRequests: parseInt(e.target.value),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Window (seconds)</Label>
                              <Input
                                type="number"
                                value={aiSettings.rateLimitWindow}
                                onChange={(e) =>
                                  setAiSettings((prev) => ({
                                    ...prev,
                                    rateLimitWindow: parseInt(e.target.value),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveSettings('AI')} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save AI Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Configuration
                </CardTitle>
                <CardDescription>
                  Configure security policies and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Two-Factor Authentication Required</Label>
                        <p className="text-sm text-muted-foreground">
                          Require 2FA for all admin accounts
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.twoFactorRequired}
                        onCheckedChange={(checked) =>
                          setSecuritySettings((prev) => ({ ...prev, twoFactorRequired: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password Complexity</Label>
                      <Select
                        value={securitySettings.passwordComplexity}
                        onValueChange={(value) =>
                          setSecuritySettings((prev) => ({ ...prev, passwordComplexity: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Login Attempt Limit</Label>
                      <Input
                        type="number"
                        value={securitySettings.loginAttemptLimit}
                        onChange={(e) =>
                          setSecuritySettings((prev) => ({
                            ...prev,
                            loginAttemptLimit: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>IP Whitelist Enabled</Label>
                        <p className="text-sm text-muted-foreground">
                          Restrict admin access to specific IPs
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.ipWhitelistEnabled}
                        onCheckedChange={(checked) =>
                          setSecuritySettings((prev) => ({ ...prev, ipWhitelistEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">Log all admin actions</p>
                      </div>
                      <Switch
                        checked={securitySettings.auditLogging}
                        onCheckedChange={(checked) =>
                          setSecuritySettings((prev) => ({ ...prev, auditLogging: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Audit Trail</Label>
                      <p className="text-sm text-muted-foreground">
                        View complete history of all admin actions and user deletions/restorations
                      </p>
                      <Link href="/admin/audit-logs">
                        <Button variant="outline" className="w-full">
                          <FileText className="h-4 w-4 mr-2" />
                          View Audit Logs
                        </Button>
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Session Encryption</Label>
                        <p className="text-sm text-muted-foreground">Encrypt user sessions</p>
                      </div>
                      <Switch
                        checked={securitySettings.sessionEncryption}
                        onCheckedChange={(checked) =>
                          setSecuritySettings((prev) => ({ ...prev, sessionEncryption: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveSettings('Security')} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>Configure system notifications and alerting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Send system alerts via email
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onCheckedChange={(checked) =>
                          setNotificationSettings((prev) => ({
                            ...prev,
                            emailNotifications: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Slack Integration</Label>
                        <p className="text-sm text-muted-foreground">
                          Send alerts to Slack channel
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.slackIntegration}
                        onCheckedChange={(checked) =>
                          setNotificationSettings((prev) => ({
                            ...prev,
                            slackIntegration: checked,
                          }))
                        }
                      />
                    </div>
                    {notificationSettings.slackIntegration && (
                      <div className="space-y-2">
                        <Label>Webhook URL</Label>
                        <Input
                          value={notificationSettings.webhookUrl}
                          onChange={(e) =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              webhookUrl: e.target.value,
                            }))
                          }
                          placeholder="https://hooks.slack.com/..."
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Critical Alerts Only</Label>
                        <p className="text-sm text-muted-foreground">
                          Only send critical system alerts
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.criticalAlertsOnly}
                        onCheckedChange={(checked) =>
                          setNotificationSettings((prev) => ({
                            ...prev,
                            criticalAlertsOnly: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Daily Reports</Label>
                        <p className="text-sm text-muted-foreground">Send daily system reports</p>
                      </div>
                      <Switch
                        checked={notificationSettings.dailyReports}
                        onCheckedChange={(checked) =>
                          setNotificationSettings((prev) => ({ ...prev, dailyReports: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Weekly Analytics</Label>
                        <p className="text-sm text-muted-foreground">
                          Send weekly analytics summary
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.weeklyAnalytics}
                        onCheckedChange={(checked) =>
                          setNotificationSettings((prev) => ({ ...prev, weeklyAnalytics: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveSettings('Notification')} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Notification Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Template Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Templates
                </CardTitle>
                <CardDescription>
                  Preview and test email templates sent by the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Template Preview</Label>
                  <p className="text-sm text-muted-foreground">
                    View all email templates including activation emails, invitations, and
                    notifications
                  </p>
                  <Link href="/admin/email-preview">
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email Templates
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>System-level settings and maintenance options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label id="maintenance-mode-label" htmlFor="maintenance-mode">
                          Maintenance Mode
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable maintenance mode for all users
                        </p>
                      </div>
                      <Switch
                        id="maintenance-mode"
                        aria-label="Maintenance Mode"
                        aria-labelledby="maintenance-mode-label"
                        checked={systemSettings.maintenanceMode}
                        onCheckedChange={(checked) =>
                          setSystemSettings((prev) => ({ ...prev, maintenanceMode: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label id="system-registration-label" htmlFor="system-registration">
                          Registration Enabled
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Allow new user registrations
                        </p>
                      </div>
                      <Switch
                        id="system-registration"
                        aria-label="Registration Enabled"
                        aria-labelledby="system-registration-label"
                        checked={systemSettings.registrationEnabled}
                        onCheckedChange={(checked) =>
                          setSystemSettings((prev) => ({ ...prev, registrationEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label id="email-verification-label" htmlFor="email-verification">
                          Email Verification Required
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Require email verification for new accounts
                        </p>
                      </div>
                      <Switch
                        id="email-verification"
                        aria-label="Email Verification Required"
                        aria-labelledby="email-verification-label"
                        checked={systemSettings.emailVerificationRequired}
                        onCheckedChange={(checked) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            emailVerificationRequired: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Session Timeout (hours)</Label>
                      <Input
                        type="number"
                        value={systemSettings.sessionTimeout}
                        onChange={(e) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            sessionTimeout: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max File Upload Size (MB)</Label>
                      <Input
                        type="number"
                        value={systemSettings.maxFileUploadSize}
                        onChange={(e) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            maxFileUploadSize: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Debug Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable debug logging and features
                        </p>
                      </div>
                      <Switch
                        checked={systemSettings.debugMode}
                        onCheckedChange={(checked) =>
                          setSystemSettings((prev) => ({ ...prev, debugMode: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveSettings('System')} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm">Database</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm">OpenAI API</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm">Email Service</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                    <span className="text-sm">File Storage</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            {/* Role Permissions Guide */}
            <RolePermissionsGuide />

            {/* Role Management Table */}
            {clerkUser ? (
              <>
                <RoleManagementTable clerkId={clerkUser.id} />
                <RoleHistoryView clerkId={clerkUser.id} />
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Loading user data...
                </CardContent>
              </Card>
            )}

            {/* Role Diagnostics */}
            <RoleDiagnostics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
