import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const noop = async () => ({});
const mockAuth = {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signOut: noop, signInWithOAuth: noop, signInWithPassword: noop,
  signUp: noop, linkIdentity: noop, updateUser: noop,
};
export const supabase = (url && key)
  ? createClient(url, key, { auth: { flowType: 'implicit' } })
  : { auth: mockAuth };
