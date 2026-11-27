// Leads API client — public marketing lead capture (unauthenticated).
// Mirrors demo-access.ts: built on the shared client so base URL + error
// shape behave exactly like every other page. [FORM-WIRING Phase 0+]
import { apiPost } from './client';

const unwrap = (p: Promise<any>) => p.then((r: any) => r?.data ?? r);

export const submitLead = (body: object) => unwrap(apiPost('/v1/public/leads', body));
