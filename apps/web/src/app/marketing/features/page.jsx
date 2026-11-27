/* features/page.jsx — the old template catalog (LSTM revenue manager, Booking.com
 * "real-time sync", fake comparison table) was judged unfixable and removed.
 * The honest platform overview lives at /platform. */
import { Navigate } from 'react-router-dom';

export default function FeaturesRedirect() {
  return <Navigate to="/platform" replace />;
}
