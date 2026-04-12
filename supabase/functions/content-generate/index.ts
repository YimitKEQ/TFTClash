// Secure Gemini API proxy + TFT trend fetcher for the Content Engine.
// Secrets required:
//   GEMINI_API_KEY (free from aistudio.google.com)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash";

const BRAND_BLOCK = `You are the content brain behind TFT Clash, the first dedicated competitive tournament platform for Teamfight Tactics friend groups.

BRAND FACTS:
- Built by Lodie (solo founder/dev), creator brand "Sebastian Lives"
- Core community: "the homies", a competitive EUW friend group
- Tech: React, Supabase, dark navy + gold cinematic UI
- Features: automated matchmaking, live lobbies, scoring, leaderboards
- Free to use, indie, passion project
- NOT a corporate esports platform, we're scrappy and authentic
- IGN: Levitate (EUW)

VOICE:
- Competitive but welcoming
- BY TFT players FOR TFT players
- Self-aware about being indie/solo dev (a strength, not a weakness)
- Never corporate-speak. Never "we're excited to announce"
- Speak like a competitive TFT player who happens to build cool shit
- Swearing is fine on Twitter/Reddit (light), not on Medium/Instagram
- NEVER use em dashes or en dashes. Use hyphens, commas, or rewrite.

HASHTAGS (Twitter/Instagram):
Primary: #TFTClash #TeamfightTactics #TFT
Secondary: #TFTSet17 #SpaceGods #IndieGaming #SoloDev #BuildInPublic
Niche: #CompetitiveTFT #TFTCommunity #RiotGames #AutoBattler

SET 17 CONTEXT (launches April 15, 2026 - CURRENT HYPE CYCLE):
- "Space Gods" set replaces carousel with "Realm of the Gods" mechanic
- 9 Gods: Soraka, Yasuo, Ahri, Thresh, Kayle, Varus, Evelynn, Ekko, Aurelion Sol
- Key traits: Meeple, Anima, Dark Star, Stargazer, Factory New, Mecha, Fateweaver
- 5-costs: Fiora, Shen, Vex, Graves, Blitzcrank
- 40 new augments, 8 hero augments, Zed hero augment = infinite cloning 5-cost`;

const PLATFORM_RULES: Record<string, string> = {
  twitter: `TWITTER RULES:
- Single tweets: HARD max 280 characters. Count them.
- Threads: Number each tweet (1/, 2/, etc). First tweet is the hook. Last tweet always CTA.
- Line breaks between sentences for readability.
- 2-3 hashtags MAX at the end. Never inline hashtags.
- Emoji: strategic, not spammy. 1-3 per tweet.
- Hook HARD in the first line. 0.3 seconds to grab attention.`,

  reddit: `REDDIT RULES:
- Title is 80% of success. Most effort goes here.
- Body must feel AUTHENTIC. No corporate tone. Write like a person.
- If promoting TFT Clash: be transparent. "I'm the dev, I built this" ALWAYS works better.
- Markdown: ## headers, **bold**, bullet points.
- End with a discussion question.
- NO hashtags. NO emoji spam.
- Output format: first line = "Title: <title>", then a blank line, then body.`,

  medium: `MEDIUM RULES:
- Headline formats: "How I...", "Why Every TFT Player Needs...", "I Built X in Y Days. Here's What..."
- Subtitle: one hooking sentence.
- Opening: personal anecdote OR bold claim. Never "In this article..."
- Subheadings every 3-4 paragraphs. Mix short punchy paragraphs with longer ones.
- Include a TL;DR near the top. Bold key phrases for scanners.
- Target 800-1500 words.
- End with clear CTA + "follow for more".
- Output format: first line = "Title: <title>", second = "Subtitle: <subtitle>", blank line, then body.`,

  instagram: `INSTAGRAM RULES:
- Caption hook: first ~125 characters appear before "more" fold. Make them count.
- Line breaks and dots as spacers.
- CTA: "Save this for later", "Tag a friend", "Link in bio".
- Hashtags: 20-30 in a separate block after caption. Mix large/medium/small/niche.
- For Reel/Carousel: provide full script with slide/frame breakdown.`,
};

const TONE_BLOCKS: Record<string, string> = {
  hype: "TONE: Maximum energy. FOMO. Exclamation points. Make them feel they'll miss out.",
  casual: "TONE: Chill and conversational. Lowercase is fine. Write like talking to a friend.",
  professional: "TONE: Clean, confident, polished. No slang. Authority without being stiff.",
  funny: "TONE: Self-deprecating TFT humor. Relatable moments. Make them laugh.",
  provocative: "TONE: Hot take. Bold claim. Engagement bait. Make them want to reply.",
  educational: "TONE: Helpful, informative, authority-building. Teach something concrete.",
  unhinged: "TONE: Gen-Z shitpost energy. Chaotic. Viral-brain. Go absolutely feral.",
};

interface GenerateBody {
  action: "generate";
  platform: string;
  contentType: string;
  tone: string;
  context?: string;
  includeTrends?: boolean;
  previousPosts?: string[];
  variations?: number;
}

interface TrendsBody {
  action: "trends";
  refresh?: boolean;
}

async function fetchRedditHot(supabase: any): Promise<any> {
  const { data: cached } = await supabase
    .from("trend_cache")
    .select("data, fetched_at")
    .eq("source", "reddit")
    .eq("data_type", "hot_posts")
    .gt("expires_at", new Date().toISOString())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) return cached.data;

  const redditUrl = "https://www.reddit.com/r/CompetitiveTFT/hot.json?limit=15&raw_json=1";
  const endpoints = [
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(redditUrl),
    "https://corsproxy.io/?" + encodeURIComponent(redditUrl),
    redditUrl,
    "https://old.reddit.com/r/CompetitiveTFT/hot.json?limit=15&raw_json=1",
  ];
  const ua = "web:app.tftclash:v1.0.0 (by /u/Levitate_TFT)";
  let lastErr = "";
  let json: any = null;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          "User-Agent": ua,
          "Accept": "application/json",
        },
      });
      if (!res.ok) {
        lastErr = `${ep} -> ${res.status}`;
        continue;
      }
      json = await res.json();
      break;
    } catch (e) {
      lastErr = `${ep} -> ${String(e)}`;
    }
  }
  try {
    if (!json) return { posts: [], error: lastErr || "all reddit endpoints failed" };
    const posts = (json?.data?.children || []).map((c: any) => ({
      title: c.data.title,
      score: c.data.score,
      num_comments: c.data.num_comments,
      url: "https://reddit.com" + c.data.permalink,
      flair: c.data.link_flair_text,
    }));
    if (!posts.length) return { posts: [], error: "reddit returned 0 posts (likely blocked)" };
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await supabase.from("trend_cache").insert({
      source: "reddit",
      data_type: "hot_posts",
      data: { posts },
      expires_at: expires,
    });
    return { posts };
  } catch (e) {
    return { posts: [], error: String(e) };
  }
}

function buildSystemPrompt(body: GenerateBody, trends: any): string {
  const parts = [BRAND_BLOCK];
  parts.push(PLATFORM_RULES[body.platform] || "");
  parts.push(TONE_BLOCKS[body.tone] || "");
  parts.push(`CONTENT TYPE: ${body.contentType}`);
  if (body.context) parts.push(`ADDITIONAL CONTEXT FROM LODIE:\n${body.context}`);
  if (body.includeTrends && trends?.posts?.length) {
    const top = trends.posts.slice(0, 5).map((p: any) => `- ${p.title} (${p.score} upvotes)`).join("\n");
    parts.push(`CURRENT REDDIT TRENDS (r/CompetitiveTFT hot, use if relevant):\n${top}`);
  }
  if (body.previousPosts?.length) {
    parts.push(`YOUR LAST POSTS ON THIS PLATFORM (do not repeat ideas or phrasing):\n${body.previousPosts.slice(0, 5).join("\n---\n")}`);
  }
  parts.push("OUTPUT: ready-to-post content only. No preamble, no meta-commentary, no explanations. Just the post.");
  return parts.join("\n\n");
}

async function callGemini(systemPrompt: string, userMsg: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text: " + JSON.stringify(json));
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    if (body.action === "trends") {
      const trends = await fetchRedditHot(supabase);
      return new Response(JSON.stringify({ trends }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (body.action === "generate") {
      const trends = body.includeTrends ? await fetchRedditHot(supabase) : null;
      const sys = buildSystemPrompt(body, trends);
      const userMsg = `Generate a ${body.contentType} for ${body.platform} in a ${body.tone} tone. ${body.context || ""}`;

      const variations = Math.max(1, Math.min(3, body.variations || 1));
      const results: string[] = [];
      for (let i = 0; i < variations; i++) {
        const text = await callGemini(sys, userMsg + (i > 0 ? `\n\n(Variation ${i + 1}: take a completely different angle)` : ""));
        results.push(text);
      }

      return new Response(JSON.stringify({ results, trends }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
