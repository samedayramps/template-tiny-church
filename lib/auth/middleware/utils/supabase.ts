import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { Database } from '../../../data/supabase/database.types'

export function createSupabaseClient(request: NextRequest, response: NextResponse) {
  const cookieStore = new Map<string, string>();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name) ?? request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value);
          response.cookies.set({
            name,
            value,
            ...options,
            sameSite: options.sameSite ?? 'lax'
          });
        },
        remove(name: string, options: any) {
          cookieStore.delete(name);
          response.cookies.delete(name);
        },
      }
    }
  );
} 