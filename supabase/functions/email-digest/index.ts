import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get users who opted in to email notifications
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, username, email_notifications, riot_id")
    .eq("email_notifications", true);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No opted-in users" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get current standings
  const { data: players } = await supabase
    .from("players")
    .select("id, name, pts, auth_user_id, last_clash_rank")
    .order("pts", { ascending: false });

  let sent = 0;
  for (const profile of profiles) {
    const player = players?.find(p => p.auth_user_id === profile.user_id);
    if (!player) continue;

    const rank = (players?.indexOf(player) ?? 0) + 1;
    const rankChange = player.last_clash_rank ? player.last_clash_rank - rank : 0;

    const subject = "TFT Clash - Your Weekly Update";
    const body = [
      "Hey " + (profile.username || player.name) + ",",
      "",
      "Your current rank: #" + rank + (rankChange > 0 ? " (up " + rankChange + ")" : rankChange < 0 ? " (down " + Math.abs(rankChange) + ")" : ""),
      "Points: " + player.pts,
      "",
      "See you Saturday!",
      "- TFT Clash"
    ].join("\n");

    // TODO: Integrate with email provider (Resend, Postmark, etc.)
    console.log("[digest] Would send to:", profile.user_id, subject);
    sent++;
  }

  return new Response(JSON.stringify({ sent, message: sent + " digests processed" }), {
    headers: { "Content-Type": "application/json" },
  });
});
