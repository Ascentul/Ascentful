'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

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
import { Button } from '@/components/ui/button';
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

export function AutoUpdatesSection() {
  const { user } = useUser();
  const { toast } = useToast();

  const integrations = useQuery(api.email_auto_updates.getMyEmailIntegrations);

  const setEnabled = useMutation(api.email_auto_updates.setEmailAutoUpdatesEnabled);
  const setMode = useMutation(api.email_auto_updates.setEmailAutoUpdatesMode);
  const triggerScan = useMutation(api.email_auto_updates.triggerManualScan);
  const disconnect = useMutation(api.email_auto_updates.disconnectEmailIntegration);
  const deleteData = useMutation(api.email_auto_updates.deleteEmailAutoUpdateData);

  const integrationByProvider = useMemo(() => {
    const map = new Map<Provider, NonNullable<typeof integrations>[number]>();
    for (const i of integrations || []) {
      map.set(i.provider as Provider, i);
    }
    return map;
  }, [integrations]);

  const [includeStageEvents, setIncludeStageEvents] = useState(false);
  const [scanningProvider, setScanningProvider] = useState<Provider | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    provider?: Provider;
  }>({ open: false });

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

  const providers: Provider[] = ['gmail', 'outlook'];

  return (
    <>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect Gmail or Outlook to suggest (or apply) stage changes from incoming application
          emails.
        </p>

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
                        onClick={async () => {
                          if (enabled) {
                            handleScanNow(provider);
                          } else {
                            try {
                              await setEnabled({ provider, enabled: true });
                              toast({
                                title: 'Saved',
                                description: 'Auto Updates enabled.',
                                variant: 'success',
                              });
                              handleScanNow(provider);
                            } catch (e: unknown) {
                              const message =
                                e instanceof Error
                                  ? e.message
                                  : 'Failed to enable. Scan cancelled.';
                              toast({
                                title: 'Error',
                                description: message,
                                variant: 'destructive',
                              });
                            }
                          }
                        }}
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
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation({ open: true, provider: 'gmail' })}
            >
              Delete Gmail signals
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation({ open: true, provider: 'outlook' })}
            >
              Delete Outlook signals
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmation({ open: true, provider: undefined })}
            >
              Delete all email signals
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={deleteConfirmation.open}
        onOpenChange={(open) =>
          setDeleteConfirmation({ open, provider: deleteConfirmation.provider })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete email signals?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation.provider
                ? `This will permanently delete all ${providerLabel(deleteConfirmation.provider)} email signals.`
                : 'This will permanently delete all email signals from Gmail and Outlook.'}
              {includeStageEvents && ' This includes email-linked stage events.'} This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteData(deleteConfirmation.provider);
                setDeleteConfirmation({ open: false });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
