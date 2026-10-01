/**
 * Browser Supabase client entry for hub modules.
 * Prefer existing `@/integrations/supabase/client` — this file adds NEXT_PUBLIC_* aliases
 * so Netlify vars named like Next.js still work with Vite.
 *
 * Server secrets stay in `@/integrations/supabase/client.server` (service role only).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function readPublicEnv(name: string): string {
  const viteKey = `VITE_${name.replace(/^NEXT_PUBLIC_/, "")}`;
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.[name] as string | undefined) ||
        (import.meta.env?.[viteKey] as string | undefined) ||
        (import.meta.env?.[`VITE_${name}`] as string | undefined)
      : undefined;
  const fromProcess =
    typeof process !== "undefined"
      ? process.env?.[name] ||
        process.env?.[viteKey] ||
        process.env?.[`VITE_${name}`] ||
        process.env?.[name.replace(/^NEXT_PUBLIC_/, "")]
      : undefined;
  return String(fromVite || fromProcess || "").trim();
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url =
    readPublicEnv("VITE_SUPABASE_URL") ||
    readPublicEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    readPublicEnv("SUPABASE_URL");
  const anonKey =
    readPublicEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    readPublicEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readPublicEnv("SUPABASE_ANON_KEY");
  return { url, anonKey };
}

export function isPublicSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicConfig();
  if (!url || !anonKey) return false;
  if (url.includes("YOUR_PROJECT") || anonKey.includes("your_anon")) return false;
  return true;
}

let _client: SupabaseClient<Database> | undefined;

/** Standard browser/SSR-anon client. Never put service-role keys here. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (_client) return _client;
  const { url, anonKey } = getSupabasePublicConfig();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase public env missing. Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  _client = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

/** Lazy proxy — same pattern as integrations/supabase/client */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_t, prop, receiver) {
    const client = getSupabaseBrowserClient();
    return Reflect.get(client, prop, receiver);
  },
});
