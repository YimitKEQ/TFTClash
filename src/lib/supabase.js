import { createClient } from '@supabase/supabase-js';
var url = import.meta.env.VITE_SUPABASE_URL;
var key = import.meta.env.VITE_SUPABASE_ANON_KEY;
var noop = async function() { return {}; };
var mockAuth = {
  getSession: async function() { return { data: { session: null } }; },
  onAuthStateChange: function() { return { data: { subscription: { unsubscribe: function() {} } } }; },
  signOut: noop, signInWithOAuth: noop, signInWithPassword: noop,
  signUp: noop, linkIdentity: noop, updateUser: noop,
};
export var CANONICAL_ORIGIN = 'https://tftclash.com';
export var supabase = (url && key)
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
