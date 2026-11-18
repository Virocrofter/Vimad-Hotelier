/* Guest Card drawer (blueprint S6 reference consumer): the guest profile
 * as a right slide-over, openable from any surface (directory row, palette,
 * reservation). Full data lives at /app/guests/:id; the drawer's expand
 * control covers full width. */
import { Drawer } from '../ui/drawer';
import { useGuest } from '../../hooks/useGuests';
import { GuestCard } from './GuestCard';

export function GuestCardDrawer({ guestId, open, onClose }) {
  const { data: guest, isLoading, error } = useGuest(guestId);
  const title = guest ? `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim() : 'Guest';
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      loading={isLoading}
      error={error?.message ?? null}
      width={720}
    >
      {guest && <GuestCard guest={guest} showBack={false} />}
    </Drawer>
  );
}
