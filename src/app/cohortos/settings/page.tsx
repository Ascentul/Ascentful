'use client';

import { Bell, Check, Mail, MessageSquare, Save, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { mockCoaches } from '@/lib/cohortos/mock-data';
import { cn } from '@/lib/utils';

export default function CohortosSettingsPage() {
  // Notification settings
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    weeklyDigest: true,
    blockerAlerts: true,
    surveyReminders: true,
  });

  // Survey settings
  const [surveySettings, setSurveySettings] = useState({
    reminderDays: '3',
    autoReminders: true,
    maxReminders: '2',
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success('Settings saved successfully');
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary-500' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your CohortOS preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Email Alerts</p>
                <p className="text-xs text-slate-500">
                  Receive email notifications for important updates
                </p>
              </div>
              <ToggleSwitch
                checked={notifications.emailAlerts}
                onChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })}
                label="Email Alerts"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">SMS Alerts</p>
                <p className="text-xs text-slate-500">Get text messages for urgent notifications</p>
              </div>
              <ToggleSwitch
                checked={notifications.smsAlerts}
                onChange={(checked) => setNotifications({ ...notifications, smsAlerts: checked })}
                label="SMS Alerts"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Weekly Digest</p>
                <p className="text-xs text-slate-500">Summary of pipeline activity every Monday</p>
              </div>
              <ToggleSwitch
                checked={notifications.weeklyDigest}
                onChange={(checked) =>
                  setNotifications({ ...notifications, weeklyDigest: checked })
                }
                label="Weekly Digest"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Blocker Alerts</p>
                <p className="text-xs text-slate-500">Notify when students report blockers</p>
              </div>
              <ToggleSwitch
                checked={notifications.blockerAlerts}
                onChange={(checked) =>
                  setNotifications({ ...notifications, blockerAlerts: checked })
                }
                label="Blocker Alerts"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Survey Reminders</p>
                <p className="text-xs text-slate-500">Alert when survey response rate is low</p>
              </div>
              <ToggleSwitch
                checked={notifications.surveyReminders}
                onChange={(checked) =>
                  setNotifications({ ...notifications, surveyReminders: checked })
                }
                label="Survey Reminders"
              />
            </div>
          </div>
        </div>

        {/* Survey Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Survey Automation</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Auto-Send Reminders</p>
                <p className="text-xs text-slate-500">Automatically remind non-responders</p>
              </div>
              <ToggleSwitch
                checked={surveySettings.autoReminders}
                onChange={(checked) =>
                  setSurveySettings({ ...surveySettings, autoReminders: checked })
                }
                label="Auto-Send Reminders"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Days Before Reminder
              </label>
              <select
                value={surveySettings.reminderDays}
                onChange={(e) =>
                  setSurveySettings({ ...surveySettings, reminderDays: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="7">7 days</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Send first reminder after this many days of no response
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Maximum Reminders
              </label>
              <select
                value={surveySettings.maxReminders}
                onChange={(e) =>
                  setSurveySettings({ ...surveySettings, maxReminders: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="1">1 reminder</option>
                <option value="2">2 reminders</option>
                <option value="3">3 reminders</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Stop sending reminders after this limit</p>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-medium text-slate-900">Team Members</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Invite feature coming soon')}
            >
              Invite Member
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Students
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockCoaches.map((coach) => (
                  <tr key={coach.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {coach.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{coach.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{coach.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {coach.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {coach.studentCount} assigned
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
