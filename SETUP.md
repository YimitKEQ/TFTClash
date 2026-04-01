# TFT Clash - New Machine Setup

## Prerequisites (install these first)

1. **Node.js** (v20+) - https://nodejs.org → download LTS
2. **Git** (optional but handy) - https://git-scm.com

## Steps

```bash
# 1. Open terminal in the tft-clash folder
cd path/to/tft-clash

# 2. Install dependencies (takes ~1 min)
npm install

# 3. Start dev server
npm run dev
```

Then open http://localhost:5173 in your browser.

## Environment Variables

The `.env` file is included on the USB stick with real values already filled in.
If it's missing, copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from Supabase dashboard)
- Stripe keys (from Stripe dashboard)

## Claude Code (optional, for AI-assisted dev)

If you want Claude Code on the new machine:
```bash
npm install -g @anthropic-ai/claude-code
```
Then run `claude` in the project folder.

The Claude memory/config lives at `C:\Users\<you>\.claude\` — copy that folder too
if you want your settings, memories, and skills to carry over.

## Build for production

```bash
npm run build
```

Output goes to `dist/` — deploy to Vercel by dragging that folder or via CLI.
