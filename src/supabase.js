
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REMEMBER_KEY = "ledger_remember_me";

export const setRememberMe = (value) => {
  localStorage.setItem(REMEMBER_KEY, String(value));
};

const authStorage = {
  getItem(key) {
    const remember = localStorage.getItem(REMEMBER_KEY) !== "false";

    return remember
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
  },

  setItem(key, value) {
    const remember = localStorage.getItem(REMEMBER_KEY) !== "false";

    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },

  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;
