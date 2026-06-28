import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
              avatar_url: user.user_metadata?.avatar_url ?? null,
              last_login: new Date().toISOString()
            },
            { onConflict: "id" }
          );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth=error`);
}
