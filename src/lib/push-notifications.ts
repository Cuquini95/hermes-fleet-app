/**
 * Web Push (VAPID) — browser notifications for critical fleet events.
 *
 * Requires:
 *   VITE_VAPID_PUBLIC_KEY — set in Vercel environment variables
 *
 * VPS endpoints (push.py):
 *   POST /api/push/subscribe  { subscription, role }
 *   POST /api/push/send       { event, data }
 *
 * Subscription is best-effort: failures are silently ignored so they
 * never block the app or any form submission.
 */

import { HERMES_API_BASE } from './hermes-api-base';
import { useAuthStore } from '../stores/auth-store';

const HERMES_API = HERMES_API_BASE;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function sessionHeaders(): Headers | null {
  const { authMode, sessionToken } = useAuthStore.getState();
  if (authMode !== 'server' || !sessionToken) return null;
  return new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  });
}

/** Request notification permission. Returns true if granted. */
async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Subscribe this device to push notifications.
 * Called once on login (in auth-store or top-level component).
 * No-ops gracefully when VAPID key is not configured.
 */
export async function subscribeToPush(role: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const headers = sessionHeaders();
  if (!headers) return;
  try {
    const granted = await requestPermission();
    if (!granted) return;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Pass the raw base64url string; browsers accept it directly
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    const session = useAuthStore.getState();
    await fetch(`${HERMES_API}/api/push/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscription: sub.toJSON(), role: session.role ?? role }),
    });
  } catch {
    // Non-critical — push subscription never blocks app usage
  }
}

/**
 * Trigger a server-side push notification event.
 * Fire-and-forget — does not throw, does not block callers.
 */
export function sendPushEvent(
  event: 'nueva_falla' | 'dvir_deficiente' | 'nueva_ot',
  data: Record<string, string>,
): void {
  if (!VAPID_PUBLIC_KEY) return;
  const headers = sessionHeaders();
  if (!headers) return;
  fetch(`${HERMES_API}/api/push/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ event, data }),
  }).catch(() => {
    // Non-critical
  });
}
