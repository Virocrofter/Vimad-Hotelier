/* apps/web/src/components/ui/drawer.tsx — reference Drawer (blueprint S6).
 * Right slide-over 480-720px, backdrop blur + darken, sticky header,
 * footer action bar, full-width expand. Ships loading / error /
 * permission-denied states. Esc closes; role=dialog + aria-modal. */
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { drawerVariants, fade } from '../motion';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  error?: string | null;
  permissionDenied?: boolean;
  width?: 480 | 560 | 640 | 720;
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  loading,
  error,
  permissionDenied,
  width = 560,
}: DrawerProps) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setFull(false);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 'var(--hq-z-drawer)' }}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
        >
          <motion.div
            className="absolute inset-0 bg-black/45"
            style={{ backdropFilter: 'blur(3px)' }}
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 flex h-full flex-col border-l bg-[var(--hq-surface-1)]"
            style={{
              width: full ? '100%' : `min(${width}px, 100vw)`,
              borderColor: 'var(--hq-hairline)',
            }}
            variants={drawerVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <header
              className="sticky top-0 flex h-14 items-center justify-between gap-3 border-b bg-[var(--hq-surface-1)] px-4"
              style={{ borderColor: 'var(--hq-hairline)' }}
            >
              <h2 className="hq-text-section">{title}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="hq-keycap"
                  onClick={() => setFull((f) => !f)}
                  aria-label={full ? 'Collapse drawer' : 'Expand drawer'}
                >
                  {full ? '<->' : '>'}
                </button>
                <button
                  type="button"
                  className="hq-keycap"
                  onClick={onClose}
                  aria-label="Close drawer"
                >
                  x
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="space-y-3 animate-pulse" aria-busy="true">
                  <div className="h-4 rounded bg-[var(--hq-surface-2)]" style={{ width: '60%' }} />
                  <div className="h-4 rounded bg-[var(--hq-surface-2)]" style={{ width: '85%' }} />
                  <div className="h-4 rounded bg-[var(--hq-surface-2)]" style={{ width: '45%' }} />
                </div>
              ) : permissionDenied ? (
                <div className="py-16 text-center">
                  <div className="hq-text-title">Restricted</div>
                  <p className="hq-text-body" style={{ color: 'var(--text-muted)' }}>
                    You do not have access to this. Ask your manager to adjust your role.
                  </p>
                </div>
              ) : error ? (
                <div className="rounded border p-3" style={{ borderColor: 'var(--danger)' }}>
                  <p className="hq-text-body" style={{ color: 'var(--danger)' }}>
                    {error}
                  </p>
                </div>
              ) : (
                children
              )}
            </div>
            {footer && (
              <footer
                className="flex h-14 items-center justify-end gap-2 border-t px-4"
                style={{ borderColor: 'var(--hq-hairline)' }}
              >
                {footer}
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
