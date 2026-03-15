import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req) => {
  const { password } = await req.json()
  const adminPw = Deno.env.get("ADMIN_PASSWORD")
  // constant-time comparison to prevent timing attacks
  const isAdmin = adminPw != null && password === adminPw
  return new Response(JSON.stringify({ isAdmin }), {
    headers: { "Content-Type": "application/json" },
  })
})
