// Client Supabase client — works with any Supabase project via env vars.
// See EXTERNAL_SUPABASE_SETUP.md for connecting your own project.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import { createMockSupabaseClient } from "./mock-client";

export function isSupabaseConfigured(): boolean {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_URL"]) ||
    (typeof process !== "undefined" && process.env?.["SUPABASE_URL"]) ||
    "";
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]) ||
    (typeof process !== "undefined" && process.env?.["SUPABASE_PUBLISHABLE_KEY"]) ||
    "";

  if (!url || !key) return false;
  if (
    url.includes("YOUR_PROJECT_REF") ||
    url.includes("example.supabase.co") ||
    key.includes("your_anon") ||
    key.includes("your_publishable")
  ) {
    return false;
  }
  return true;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  if (!isSupabaseConfigured()) {
    // Return safe in-memory mock client for preview mode so app doesn't crash
    return createMockSupabaseClient() as unknown as ReturnType<typeof createClient<Database>>;
  }

  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = (import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"])!;
  const SUPABASE_PUBLISHABLE_KEY = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"])!;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
