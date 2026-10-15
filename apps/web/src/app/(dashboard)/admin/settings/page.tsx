'use client';

import React, { useState } from 'react';
import { Settings, Palette, Globe, Shield, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

export default function AdminSettingsPage() {
  const [panelName, setPanelName] = useState('Obsidian Panel');
  const [accentColor, setAccentColor] = useState('#06B6D4');
  const [publicUrl, setPublicUrl] = useState('http://127.0.0.1:3000');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [requireMfa, setRequireMfa] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Settings updated successfully.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          System & Branding Settings
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Configure branding identity, network addresses, and security baselines
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Branding Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Branding & Theme</CardTitle>
                <CardDescription>
                  Customize the panel title and accent theme colors.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">
                Panel Name
              </label>
              <input
                type="text"
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">
                Theme Accent Color (HEX)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-control bg-transparent border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-32 px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Network & Reverse Proxy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Public URL & Reverse Proxy</CardTitle>
                <CardDescription>
                  The public FQDN that Wings nodes and users connect back to.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">
                Application Public URL (APP_URL)
              </label>
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Must match the remote endpoint defined in Wings nodes&apos; config.yml.
              </p>
            </div>
          </div>
        </Card>

        {/* Security & Access Policies */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Access & Authentication Policy</CardTitle>
                <CardDescription>
                  Global rules for registrations, user sessions, and MFA.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-3 pt-2 text-xs">
            <label className="flex items-center gap-2.5 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="accent-primary"
              />
              <span>Allow public user self-registration (Default: Disabled)</span>
            </label>

            <label className="flex items-center gap-2.5 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={requireMfa}
                onChange={(e) => setRequireMfa(e.target.checked)}
                className="accent-primary"
              />
              <span>Enforce mandatory Two-Factor Authentication (TOTP) for administrators</span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button variant="primary" size="md" type="submit">
            <Save className="w-4 h-4" /> Save System Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
