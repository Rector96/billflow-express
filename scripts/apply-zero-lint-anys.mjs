/**
 * Zero out no-explicit-any and no-empty in bills + airtime settlement files.
 * node scripts/apply-zero-lint-anys.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELPER = `
/** Narrow admin client shape for RPCs not in generated Database types (no \`any\`). */
type AdminChain = {
  select: (columns: string) => AdminChain;
  update: (values: Record<string, unknown>) => AdminChain;
  eq: (column: string, value: string | number) => AdminChain;
  filter: (column: string, op: string, value: string) => AdminChain;
  limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null }>["then"];
};

type AdminClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => AdminChain;
};

type AuthSupabase = AdminClient;

function asAdmin(client: unknown): AdminClient {
  return client as AdminClient;
}

`;

function patchFile(rel) {
  const file = path.join(root, rel);
  let c = fs.readFileSync(file, "utf8");

  c = c.replaceAll(
    `      } catch {}`,
    `      } catch {
        // Keep the provider fallback phone when normalization fails.
      }`,
  );

  if (!c.includes("function asAdmin(")) {
    const m = c.match(/^import[\s\S]*?;\n(?=\n|export|\/\*|type |function )/m);
    if (!m) throw new Error("import block not found in " + rel);
    const idx = m[0].length;
    c = c.slice(0, idx) + "\n" + HELPER + c.slice(idx);
  }

  c = c.replaceAll("(supabaseAdmin as any)", "asAdmin(supabaseAdmin)");
  c = c.replaceAll("supabaseAdmin as any", "asAdmin(supabaseAdmin)");
  c = c.replaceAll(
    "context: { supabase: any; userId: string }",
    "context: { supabase: AuthSupabase; userId: string }",
  );
  c = c.replaceAll("supabase: any;", "supabase: AuthSupabase;");

  if (c.includes(" as any") || /:\s*any\b/.test(c)) {
    const lines = c
      .split("\n")
      .map((l, i) => (l.includes("any") ? `${i + 1}:${l}` : null))
      .filter(Boolean);
    console.warn(rel, "still has any:", lines.slice(0, 10));
  }

  c = c.replace(
    /const fin = Array\.isArray\(finalized\) \? finalized\[0\] : finalized;\n(\s*)const status = \(fin\?\.status/g,
    `const fin = (Array.isArray(finalized) ? finalized[0] : finalized) as Record<string, unknown> | null | undefined;\n$1const status = (fin?.status`,
  );

  fs.writeFileSync(file, c);
  console.log("patched", rel);
}

patchFile("src/lib/bills.functions.ts");
patchFile("src/lib/airtime.functions.ts");

const bf = path.join(root, "src/components/app/rockpay-bill-flow.tsx");
if (fs.existsSync(bf)) {
  let t = fs.readFileSync(bf, "utf8");
  const t2 = t.replace(/\n{3,}/g, "\n\n");
  if (t2 !== t) {
    fs.writeFileSync(bf, t2);
    console.log("patched rockpay-bill-flow.tsx newlines");
  }
}

console.log("OK — commit the changed files and re-run npm run lint");
