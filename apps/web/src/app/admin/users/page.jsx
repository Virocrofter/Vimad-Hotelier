/* src/app/admin/users/page.jsx
 * Admin Users - control-plane access management.
 * Phase 1 ships the route plus this honest shell. InternalAdminUser, TOTP
 * enrolment and the SUPPORT_AGENT / ONBOARDING_LEAD / FINANCE_ADMIN roles
 * land in Phase 3 (Operations Core). Platform access today is the
 * PLATFORM_ADMIN_EMAILS env allowlist (fail-closed). */
import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, Users } from 'lucide-react';

const ROADMAP = [
  {
    role: 'Founder - Supreme Mode',
    scope: 'Full control: impersonation, contracts, kill-switches, erasure',
    state: 'Active today',
    source: 'PLATFORM_ADMIN_EMAILS env',
  },
  {
    role: 'Support Agent',
    scope: 'Read-only impersonation, password/2FA recovery, tickets',
    state: 'Phase 3',
    source: 'InternalAdminUser + TOTP',
  },
  {
    role: 'Onboarding Lead',
    scope: 'Pilot tenants, CSV migrations, sandbox reset',
    state: 'Phase 3',
    source: 'InternalAdminUser + TOTP',
  },
  {
    role: 'Finance Admin',
    scope: 'Contracts, ZAR tax invoices, dunning, exports',
    state: 'Phase 3',
    source: 'InternalAdminUser + TOTP',
  },
];

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
          <Users className="h-6 w-6" /> Admin Users
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Control-plane accounts for the admin surface. Today platform access is the fail-closed
          PLATFORM_ADMIN_EMAILS env allowlist; per-user TOTP and least-privilege roles ship in Phase
          3.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ShieldCheck className="h-4 w-4" />
          Access model
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>
            Every /admin/* route runs authMiddleware plus requireAdminRole; unset env disables admin
            for everyone (503).
          </li>
          <li>
            All admin actions are audit-logged; impersonation sessions will require a ticket number
            and expire in 60 minutes.
          </li>
          <li>
            Never reuse hotel-staff accounts for platform access; control-plane identities are
            separate by design.
          </li>
        </ul>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated text-left text-text-secondary">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Provisioned via</th>
            </tr>
          </thead>
          <tbody>
            {ROADMAP.map((r) => (
              <tr key={r.role} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-text-primary">{r.role}</td>
                <td className="px-4 py-3 text-text-secondary">{r.scope}</td>
                <td className="px-4 py-3 text-text-secondary">{r.state}</td>
                <td className="px-4 py-3 text-text-secondary">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <KeyRound className="h-4 w-4 text-text-muted" />
        <span className="text-text-secondary">
          Hotel staff accounts are managed per tenant under{' '}
          <Link to="/app/users" className="text-danger hover:underline">
            App Users
          </Link>{' '}
          - not here.
        </span>
      </div>
    </div>
  );
}
