import React, { useState } from 'react';
import { Bell, Shield, Sliders, Check } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Panel } from '../../../components/dashboard/Panel';
import { useToast } from '../../../components/ui/Toast';
import { Select, type SelectOption } from '../../../components/ui/Select/index';

const AUTO_RELEASE_OPTIONS: SelectOption[] = [
  { value: '3', label: '3 Days (Fast track)', tone: 'success' },
  { value: '7', label: '7 Days (Standard)', tone: 'primary' },
  { value: '14', label: '14 Days (Extended review)', tone: 'muted' },
];

export const SettingsPanel: React.FC = () => {
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [autoReleaseDays, setAutoReleaseDays] = useState('7');
  const [requireCiPass, setRequireCiPass] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [realtimeAlerts, setRealtimeAlerts] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://ci.codebridge.internal/hooks/deliveries');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      addToast({
        title: 'Settings saved',
        description: 'Your project owner preferences have been updated successfully.',
        type: 'success',
      });
    }, 400);
  };

  return (
    <Panel
      id="settings"
      title="Settings & Preferences"
      serviceName="identity service"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-6 py-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Project & Escrow Automation */}
          <div className="p-5 rounded-2xl bg-secondary/40 border border-border space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pb-2.5 border-b border-border">
              <Sliders className="w-4 h-4 text-accent" />
              <span>Escrow & deliverable policies</span>
            </div>

            <div>
              <Label
                id="auto-release-label"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Auto-release review period (days)
              </Label>
              <Select
                value={autoReleaseDays}
                onChange={setAutoReleaseDays}
                options={AUTO_RELEASE_OPTIONS}
                aria-labelledby="auto-release-label"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Time after developer submission before escrow funds are disbursed.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-xs font-medium text-foreground block">
                  Enforce CI pass before review
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Block approval until automated tests pass
                </span>
              </div>
              <input
                type="checkbox"
                checked={requireCiPass}
                onChange={(e) => setRequireCiPass(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Notifications & Integrations */}
          <div className="p-5 rounded-2xl bg-secondary/40 border border-border space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pb-2.5 border-b border-border">
              <Bell className="w-4 h-4 text-accent" />
              <span>Notifications & webhooks</span>
            </div>

            <div>
              <Label
                htmlFor="webhook-endpoint"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Webhook delivery endpoint
              </Label>
              <Input
                id="webhook-endpoint"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="font-mono text-xs bg-card"
              />
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-foreground block">
                    Realtime event notifications
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Display toast popups for milestone releases
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={realtimeAlerts}
                  onChange={(e) => setRealtimeAlerts(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-foreground block">
                    Email digests
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Receive daily project updates
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-success shrink-0" />
            <span>Settings apply across all owned CodeBridge workspaces</span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving}
            className="font-semibold self-start sm:self-auto"
          >
            {isSaving ? (
              'Saving…'
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save preferences
              </>
            )}
          </Button>
        </div>
      </form>
    </Panel>
  );
};
