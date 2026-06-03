import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A mock server-side Supabase client to support local development seamlessly
const mockServerSupabase: any = {
  from: (table: string) => {
    // Generate a random ID for dummy inserts
    const mockId = "mock-id-" + Math.floor(Math.random() * 1000000);
    
    // Default response data depending on the table and context
    let defaultData: any = [];
    if (table === "orders") {
      defaultData = { id: mockId, status: "pending_payment" };
    }

    const chain: any = {
      select: (columns?: string) => {
        if (columns === "id" && table === "orders") {
          chain._resolvedData = { id: mockId };
        }
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      eq: () => chain,
      in: () => chain,
      range: () => chain,
      gt: () => chain,
      lt: () => chain,
      gte: () => chain,
      lte: () => chain,
      like: () => chain,
      ilike: () => chain,
      or: () => chain,
      match: () => chain,
      not: () => chain,
      is: () => chain,
      contains: () => chain,
      containedBy: () => chain,
      upsert: (values: any) => {
        chain._resolvedData = values;
        return chain;
      },
      update: (values: any) => {
        chain._resolvedData = values;
        return chain;
      },
      insert: (values: any) => {
        if (table === "orders") {
          chain._resolvedData = { id: mockId, status: "pending_payment", ...values };
        } else {
          chain._resolvedData = values;
        }
        return chain;
      },
      delete: () => chain,
      single: () => {
        chain._isSingle = true;
        return chain;
      },
      maybeSingle: () => {
        chain._isSingle = true;
        return chain;
      },
      rpc: () => chain,
      _resolvedData: defaultData,
      _isSingle: false,
      then: (resolve: any) => {
        let result = chain._resolvedData;
        if (chain._isSingle && Array.isArray(result)) {
          result = result[0] || null;
        }
        resolve({ data: result, error: null });
        return Promise.resolve({ data: result, error: null });
      },
      catch: (reject: any) => {
        return Promise.resolve({ data: null, error: null });
      }
    };
    return chain;
  },
  rpc: (fn: string, args?: any) => {
    const chain: any = {
      maybeSingle: () => Promise.resolve({ data: { success: true }, error: null }),
      then: (resolve: any) => {
        resolve({ data: { success: true }, error: null });
        return Promise.resolve({ data: { success: true }, error: null });
      }
    };
    return chain;
  },
  channel: () => ({
    on: () => ({
      subscribe: () => ({})
    })
  }),
  removeChannel: () => Promise.resolve()
};

/** Server-only: prefers service role so API routes can write orders regardless of RLS. */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isDummy = url?.includes("dummy-supabase-project");
  
  if (isDummy) {
    return mockServerSupabase as any as SupabaseClient;
  }

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (service) return createClient(url, service, { auth: { persistSession: false } });
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon, { auth: { persistSession: false } });
}
