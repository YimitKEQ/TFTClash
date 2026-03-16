// Client-side Stripe helper — redirects to Stripe Checkout
// Usage: import { startCheckout } from './lib/stripe.js';
//        await startCheckout('pro', currentUser);

export async function startCheckout(plan, user) {
  if (!user?.email) throw new Error('Must be logged in to subscribe');

  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      userId: user.id,
      email: user.email,
      successUrl: `${window.location.origin}/#account?checkout=success`,
      cancelUrl:  `${window.location.origin}/#pricing`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Checkout failed');
  }

  const { url } = await res.json();
  if (url) window.location.href = url;
}

// Check subscription status from Supabase
export async function getSubscription(supabase, userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single();
  return data?.status === 'active' ? data : null;
}
