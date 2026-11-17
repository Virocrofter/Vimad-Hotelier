/* apps/web/src/app/app/layout.tsx */
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBanner } from '../../components/StatusBanner';
import CommandPalette from '../../components/layout/CommandPalette';
import SetupChip from '../../components/SetupChip';
import { useLiveFlag } from '../../components/FlagsProvider';
import Dock from '../../components/layout/Dock';
import OnboardingGate from '../../components/OnboardingGate';

function ShellCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('vimad:open-palette', h);
    return () => window.removeEventListener('vimad:open-palette', h);
  }, []);
  return <CommandPalette open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />;
}

export default function AppLayout() {
  const dockOn = useLiveFlag('nav.dock', false);
  const [collapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {dockOn ? <Dock /> : <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <StatusBanner />
        <SetupChip />
        <main className="flex-1 overflow-y-auto p-6">
          <OfflineBanner />
          <OnboardingGate />
          <Outlet />
        </main>
        <ShellCommandPalette />
      </div>
    </div>
  );
}
