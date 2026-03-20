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
export const CANONICAL_ORIGIN = 'https://tftclash.com';
export const supabase = (url && key)
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'tft-clash-auth',
        storage: globalThis.localStorage,
      }
    })
  : { auth: mockAuth };
