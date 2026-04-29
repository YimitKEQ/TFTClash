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

const BRAND_BLOCK = `You are the content brain behind TFT Clash, the dedicated competitive tournament platform for Teamfight Tactics players.

BRAND FACTS:
- TFT Clash runs weekly clashes, custom tournaments, season standings, hero deck, leaderboards
- Free to compete, no paywall on entry, scrappy and player-first
- Indie operator energy, NOT corporate esports
- Tiers: Player (free), Pro ($4.99/mo), Host ($19.99/mo)
- Hosts can run fully branded tournaments through TFT Clash
- Set 17 "Space Gods" launches April 15, 2026

VOICE:
- BY TFT players FOR TFT players
- Competitive, welcoming, sharp
- Never corporate-speak. Never "we're excited to announce"
- Speak like a competitive TFT player who runs the spot
- Light swearing fine on X/Reddit, never on Medium/LinkedIn/Threads
- NEVER use em dashes or en dashes. Hyphens, commas, or rewrite.
- First person plural ("we") for platform updates. First person singular ("I") for hot takes / dev notes.
- Never mention specific employees by name.

HASHTAGS (X/Instagram/Threads/Bluesky):
Primary: #TFTClash #TeamfightTactics #TFT
Secondary: #TFTSet17 #SpaceGods #CompetitiveTFT #AutoBattler
Niche: #TFTCommunity #RiotGames #TournamentTFT

SET 17 CONTEXT (launches April 15, 2026 - CURRENT HYPE CYCLE):
- "Space Gods" set replaces carousel with "Realm of the Gods" mechanic
- 9 Gods: Soraka, Yasuo, Ahri, Thresh, Kayle, Varus, Evelynn, Ekko, Aurelion Sol
- Key traits: Meeple, Anima, Dark Star, Stargazer, Factory New, Mecha, Fateweaver
- 5-costs: Fiora, Shen, Vex, Graves, Blitzcrank
- 40 new augments, 8 hero augments, Zed hero augment = infinite cloning 5-cost`;

const NICHE_PLAYBOOK = `TFT NICHE PLAYBOOK (what works in this content space):

CREATOR TONE REFERENCES (study these voices, do not impersonate):
- Mortdog: dev transparency, patch reasoning, balance philosophy. Direct, technical, no hype.
- Frodan: caster authority, comp breakdowns, tournament vocab. Crisp, narrative, expert.
- Bunnymuffins: chaotic-good streamer energy, meme + actual gameplay tips.
- Robinsongz / Dishsoap: tournament grinder POV, lobby reads, mental game.
- Mismatched Socks / Setsuko: educational guide voice, fundamentals first.

WHAT WINS PER SURFACE:
- X: hot takes, patch reactions, tier list flexes, "nobody talks about [comp]" hooks, polls, tournament clip drops, 1-tweet "fix the meta" lists.
- Reddit (r/CompetitiveTFT, r/TeamfightTactics): deep guides, transparent dev posts ("I'm the dev, here's why we shipped X"), patch breakdowns with data, comp guides with augment trees, meta complaints with receipts.
- TikTok / YT Shorts: 1-shot hook in first 1.5 seconds. "POV you hit 3-star [carry]", "Worst comp I've ever seen", insta-fail reactions, lobby clutch endings, augment tier lists with movement.
- Medium / LinkedIn: tournament case studies, "how we built X", set retrospectives, season recaps with charts.
- Instagram: comp carousels (slide 1 hook, slides 2-7 build, slide 8 CTA), tier list posts, season recap reels.
- Threads / Bluesky: more chill / longer tweets, dev-log style updates, screenshots of tournament moments.

DAY-OF-WEEK THEMES (use as default angle if no specific brief):
- Mon: Meta Watch (what shifted, what's S-tier).
- Tue: Tutorial Tuesday (one fundamental: positioning, econ, scout reads).
- Wed: Dev Log (build-in-public, what shipped on TFT Clash).
- Thu: Hot Take Thursday (one bold opinion, engagement bait).
- Fri: Featured Comp (deep dive: items, augments, openers, transitions, late game).
- Sat: Tournament Recap (final tables, big plays, story of the bracket).
- Sun: Q&A / Community (open prompt, "ask me anything", spotlight a player from leaderboard).

ENGAGEMENT TRIGGERS (proven hooks):
- "Unpopular opinion: ..."
- "If you're losing with [comp], it's because ..."
- "Patch [X.Y] just changed everything for ..."
- "I just watched [N] tournament games. Here's what nobody is doing."
- "[Carry] is bait right now. Here's the actual S-tier."
- "Augment ranking. No yapping."
- "We just shipped [feature] on TFT Clash. Here's why ..."

THINGS TO AVOID:
- "We're excited to announce" / "We're thrilled to share"
- Generic "what's your fav comp?" with no setup
- 5+ hashtags inline mid-sentence
- Em / en dashes (use hyphens, commas, or rewrite)
- Anything that reads like a corporate Riot press release
- Calling out individual streamers/casters by name unless quoting them positively`;

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

  tiktok: `TIKTOK RULES:
- HOOK in the first 1.5 seconds, no excuses. Open with a claim, a question, or a visible result.
- Output format: SCRIPT first (timed in seconds, e.g. "0-2s: ..."), then a CAPTION block (under 150 chars), then 4-7 hashtags.
- Voice is spoken: short sentences, no semicolons, no fancy words.
- On-screen text overlays: write them in CAPS as separate lines tagged "ON-SCREEN: ..."
- End with a clear CTA: "follow for more", "comment your S-tier", "save for the next patch".
- Trending sound suggestions optional but encouraged.`,

  ytshorts: `YT SHORTS RULES:
- Same hook discipline as TikTok: first 1.5 seconds win or lose it.
- Output format: TITLE (under 70 chars, optimized for search) on first line, then SCRIPT timed in seconds, then 3-5 hashtags.
- Title MUST include a TFT keyword (TFT, Set 17, Teamfight Tactics, comp name).
- Hook with a number or a verdict ("3 mistakes you make every game").
- Speak directly to camera. No corporate intros. Cold open into the take.
- End screen: "subscribe for more TFT".`,

  linkedin: `LINKEDIN RULES:
- Tone: professional but human. NO swearing. NO meme energy.
- First 3 lines are the hook (before the "see more" cut).
- Use single-line paragraphs, double line breaks between thoughts.
- Lead with a story, a result, or a contrarian take. Never with a link.
- 3-5 hashtags MAX, end of post.
- Acceptable angles: tournament case studies, building TFT Clash, esports business takes, community building.`,

  threads: `THREADS RULES:
- Tone: chiller and longer than X. Conversational, builder-vibe.
- Single posts can run 500 chars (cap is higher but stay scannable).
- Threads: number them (1/, 2/...) like X. First post is the hook.
- 1-2 hashtags max, never inline. Light emoji ok.
- Audience leans gaming + builder + creator. Mix dev-log with hot take.
- No "thread below" preface. Just start.`,

  bluesky: `BLUESKY RULES:
- 300 char limit per post. Treat each post like a tight X tweet.
- Audience values craft, transparency, anti-corporate energy. Do not over-hashtag.
- 0-2 hashtags only, end of post. Never inline.
- Threads: number them (1/, 2/...). First post is the hook.
- Bluesky users hate spam, AI slop, and engagement-bait. Be specific or be quiet.`,
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
    .eq("source", "gemini")
    .eq("data_type", "tft_trends")
    .gt("expires_at", new Date().toISOString())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) return cached.data;

  try {
    const prompt = `List 12 hot TFT (Teamfight Tactics) talking points right now, based on Set 17 "Space Gods" hype cycle (launches April 15 2026), current meta comps, patch buzz, augment debates, and r/CompetitiveTFT discussion themes. Mix meta analysis, hot takes, balance complaints, set prediction, and community drama.

Output STRICT JSON only, no markdown fences, no preamble:
{"posts":[{"title":"<short punchy title like a reddit post>","score":<int 100-3000>,"num_comments":<int 20-500>,"flair":"<Discussion|Patch Notes|Guide|Meta|Set 17>","url":"https://reddit.com/r/CompetitiveTFT"}]}`;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return { posts: [], error: "GEMINI_API_KEY not set" };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return { posts: [], error: `Gemini ${res.status}: ${await res.text().catch(() => "")}` };
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    const posts = parsed?.posts || [];
    if (!posts.length) return { posts: [], error: "gemini returned no trends" };

    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await supabase.from("trend_cache").insert({
      source: "gemini",
      data_type: "tft_trends",
      data: { posts },
      expires_at: expires,
    });
    return { posts };
  } catch (e) {
    return { posts: [], error: String(e) };
  }
}

function buildSystemPrompt(body: GenerateBody, trends: any): string {
  const parts = [BRAND_BLOCK, NICHE_PLAYBOOK];
  parts.push(PLATFORM_RULES[body.platform] || "");
  parts.push(TONE_BLOCKS[body.tone] || "");
  parts.push(`CONTENT TYPE: ${body.contentType}`);
  if (body.context) parts.push(`ADDITIONAL CONTEXT (operator brief):\n${body.context}`);
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
