'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Mail, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

type Provider = 'gmail' | 'outlook';
type Mode = 'metadata_only' | 'enhanced';

function providerLabel(provider: Provider) {
  return provider === 'gmail' ? 'Gmail' : 'Outlook';
}

function oauthStartUrl(provider: Provider, mode: Mode) {
  const base =
    provider === 'gmail'
      ? '/api/integrations/gmail/oauth/start'
      : '/api/integrations/outlook/oauth/start';
  return `${base}?mode=${mode === 'enhanced' ? 'enhanced' : 'metadata_only'}`;
}

export function AutoUpdatesSettings() {
  const { user } = useUser();
  const { toast } = useToast();

  const integrations = useQuery(api.email_auto_updates.getMyEmailIntegrations);
  const reviewCount = useQuery(api.email_auto_updates.getReviewQueueCount);
  const reviewItems = useQuery(api.email_auto_updates.listReviewQueue, { limit: 10 });

  const applications = useQuery(
    api.applications.getUserApplications,
    user?.id ? { clerkId: user.id } : 'skip',
  );

  const setEnabled = useMutation(api.email_auto_updates.setEmailAutoUpdatesEnabled);
  const setMode = useMutation(api.email_auto_updates.setEmailAutoUpdatesMode);
  const triggerScan = useMutation(api.email_auto_updates.triggerManualScan);
  const disconnect = useMutation(api.email_auto_updates.disconnectEmailIntegration);
  const deleteData = useMutation(api.email_auto_updates.deleteEmailAutoUpdateData);
  const approve = useMutation(api.email_auto_updates.approveSuggestedUpdate);
  const dismiss = useMutation(api.email_auto_updates.dismissSuggestedUpdate);

  const integrationByProvider = useMemo(() => {
    const map = new Map<Provider, any>();
    for (const i of integrations || []) {
      map.set(i.provider as Provider, i);
    }
    return map;
  }, [integrations]);

  const appsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of applications || []) {
      map.set(String(a._id), a);
    }
    return map;
  }, [applications]);

  const [selectedApplicationBySignal, setSelectedApplicationBySignal] = useState<
    Record<string, string | undefined>
  >({});

  const [includeStageEvents, setIncludeStageEvents] = useState(false);
  const [scanningProvider, setScanningProvider] = useState<Provider | null>(null);

  const handleToggleEnabled = async (provider: Provider, enabled: boolean) => {
    try {
      await setEnabled({ provider, enabled });
      toast({
        title: 'Saved',
        description: enabled ? 'Auto Updates enabled.' : 'Auto Updates disabled.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to update setting.',
        variant: 'destructive',
      });
    }
  };

  const handleScanNow = async (provider: Provider) => {
    try {
      setScanningProvider(provider);
      await triggerScan({ provider });
      toast({
        title: 'Scan Started',
        description: 'Scanning your inbox for application updates. Results will appear shortly.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to trigger scan.',
        variant: 'destructive',
      });
    } finally {
      // Keep scanning indicator for a few seconds to indicate processing
      setTimeout(() => setScanningProvider(null), 3000);
    }
  };

  const handleDowngradeMode = async (provider: Provider) => {
    try {
      await setMode({ provider, mode: 'metadata_only' });
      toast({
        title: 'Saved',
        description: 'Switched to metadata-only mode.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Reconnect required',
        description: e?.message || 'Please reconnect to change mode.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    try {
      await disconnect({ provider });
      toast({
        title: 'Disconnected',
        description: 'Integration disconnected.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to disconnect.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteData = async (provider?: Provider) => {
    try {
      await deleteData({ provider, includeStageEvents });
      toast({
        title: 'Scheduled',
        description: 'Email-derived data deletion has been scheduled.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to schedule deletion.',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (
    signalId: Id<'email_application_signals'>,
    matchedAppId?: string,
  ) => {
    const selected = selectedApplicationBySignal[String(signalId)];
    // If user explicitly selected __CREATE_NEW__, or if there's no selection AND no matched app, create new
    const isCreateNew = selected === '__CREATE_NEW__' || (!selected && !matchedAppId);
    const applicationId = selected && selected !== '__CREATE_NEW__' ? selected : matchedAppId;
    try {
      await approve({
        signalId,
        applicationId: isCreateNew
          ? undefined
          : applicationId
            ? (applicationId as Id<'applications'>)
            : undefined,
        createNew: isCreateNew,
      });
      toast({
        title: isCreateNew ? 'Application Created' : 'Update Applied',
        description: isCreateNew
          ? 'New application created from email.'
          : 'Update applied to application.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to apply update.',
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = async (signalId: Id<'email_application_signals'>) => {
    try {
      await dismiss({ signalId });
      toast({ title: 'Dismissed', description: 'Suggestion dismissed.', variant: 'success' });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to dismiss.',
        variant: 'destructive',
      });
    }
  };

  const providers: Provider[] = ['gmail', 'outlook'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Auto Updates
        </CardTitle>
        <CardDescription>
          Connect Gmail or Outlook to suggest (or apply) stage changes from incoming application
          emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {providers.map((provider) => {
            const integration = integrationByProvider.get(provider);
            const connected = integration?.status === 'connected';
            const enabled = Boolean(integration?.enabled);
            const mode = (integration?.mode as Mode | undefined) || 'metadata_only';
            const accountEmail = integration?.provider_account_email as string | undefined;

            return (
              <div key={provider} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{providerLabel(provider)}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {connected
                        ? `Connected${accountEmail ? `: ${accountEmail}` : ''}`
                        : 'Not connected'}
                    </div>
                  </div>

                  {!connected ? (
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = oauthStartUrl(provider, 'enhanced'))}
                    >
                      Connect {providerLabel(provider)}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => handleDisconnect(provider)}>
                      Disconnect
                    </Button>
                  )}
                </div>

                {connected && (
                  <div className="grid gap-4 md:grid-cols-3 items-start">
                    <div className="flex items-center justify-between gap-3 md:col-span-1">
                      <div>
                        <Label className="text-sm">Enable Auto Updates</Label>
                        <div className="text-xs text-muted-foreground">
                          Scans only while enabled.
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => handleToggleEnabled(provider, v)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-1">
                      <Label className="text-sm">Mode</Label>
                      <Select
                        value={mode}
                        onValueChange={(value) => {
                          const nextMode = value as Mode;
                          if (nextMode === 'enhanced') {
                            window.location.href = oauthStartUrl(provider, 'enhanced');
                          } else {
                            handleDowngradeMode(provider);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="metadata_only">Metadata-only (default)</SelectItem>
                          <SelectItem value="enhanced">Enhanced parsing (reconnect)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground">
                        Enhanced parsing reads a limited snippet/preview (and may use AI) to improve
                        accuracy.
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-1">
                      <Label className="text-sm">Scan now</Label>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          enabled ? handleScanNow(provider) : handleToggleEnabled(provider, true)
                        }
                        disabled={scanningProvider === provider}
                      >
                        <RefreshCw
                          className={`h-4 w-4 mr-2 ${scanningProvider === provider ? 'animate-spin' : ''}`}
                        />
                        {scanningProvider === provider
                          ? 'Scanning...'
                          : enabled
                            ? 'Scan Now'
                            : 'Enable & Scan'}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {enabled
                          ? 'Trigger a manual scan immediately.'
                          : 'Polling runs every ~5 minutes when enabled.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Review queue</div>
              <div className="text-sm text-muted-foreground">
                {reviewCount != null ? `${reviewCount} pending suggestion(s)` : 'Loading…'}
              </div>
            </div>
          </div>

          {reviewItems && reviewItems.length > 0 && (
            <div className="space-y-3">
              {reviewItems.map((item) => {
                const matchedApp = item.matched_application_id
                  ? appsById.get(String(item.matched_application_id))
                  : undefined;
                const selectedAppId = selectedApplicationBySignal[String(item._id)];
                return (
                  <div key={item._id} className="p-3 border rounded-md space-y-2">
                    <div className="text-sm font-medium">{item.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      From: {item.from} • {new Date(item.received_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Suggested stage: {item.suggested_stage || item.event_type || 'unknown'}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="text-sm">
                        {matchedApp ? (
                          <div>
                            Matched: <span className="font-medium">{matchedApp.company}</span> —{' '}
                            {matchedApp.job_title}
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No confident match found.</div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Apply to application</Label>
                        <Select
                          value={
                            selectedAppId ||
                            (matchedApp?._id ? String(matchedApp._id) : '__CREATE_NEW__')
                          }
                          onValueChange={(value) =>
                            setSelectedApplicationBySignal((prev) => ({
                              ...prev,
                              [String(item._id)]: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select or create application" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__CREATE_NEW__" className="font-medium text-primary">
                              + Create new application
                            </SelectItem>
                            {(applications || []).length > 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                Or select existing:
                              </div>
                            )}
                            {(applications || []).map((a) => (
                              <SelectItem key={String(a._id)} value={String(a._id)}>
                                {a.company} — {a.job_title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" onClick={() => handleDismiss(item._id as any)}>
                        Dismiss
                      </Button>
                      <Button
                        onClick={() =>
                          handleApprove(
                            item._id as any,
                            matchedApp?._id ? String(matchedApp._id) : undefined,
                          )
                        }
                      >
                        {selectedAppId === '__CREATE_NEW__' || (!selectedAppId && !matchedApp)
                          ? 'Create Application'
                          : 'Apply Update'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border rounded-lg space-y-3">
          <div>
            <div className="font-medium">Data controls</div>
            <div className="text-sm text-muted-foreground">
              Revoke access anytime and delete stored email-derived artifacts.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Include stage events</Label>
              <div className="text-xs text-muted-foreground">
                Removes email-linked stage events (does not revert application stages).
              </div>
            </div>
            <Switch checked={includeStageEvents} onCheckedChange={setIncludeStageEvents} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDeleteData('gmail')}>
              Delete Gmail signals
            </Button>
            <Button variant="outline" onClick={() => handleDeleteData('outlook')}>
              Delete Outlook signals
            </Button>
            <Button variant="destructive" onClick={() => handleDeleteData(undefined)}>
              Delete all email signals
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
