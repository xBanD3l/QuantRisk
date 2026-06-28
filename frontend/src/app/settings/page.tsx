"use client";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { SectionReveal } from "@/components/section-reveal";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <SectionReveal>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation">
          <Badge className="border-teal/40 text-teal">Account</Badge>
          <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
          <p className="mt-2 text-sm text-muted">Your profile is managed through Google and synced with Supabase.</p>
        </div>
      </SectionReveal>

      <SectionReveal delay={0.05}>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation">
          {loading ? (
            <p className="text-sm text-muted">Loading profile…</p>
          ) : user ? (
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-medium">{profile?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="font-medium">{profile?.email ?? user.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Member since</dt>
                <dd className="font-medium">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last login</dt>
                <dd className="font-medium">
                  {profile?.last_login ? new Date(profile.last_login).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Sign in to view your account settings.</p>
          )}
        </div>
      </SectionReveal>
    </div>
  );
}
