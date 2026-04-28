import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Icon } from '../components/ui'
import { SOCIAL_BRANDS, brandFor, brandAccent } from '../lib/socialBrands.js'
import { DISCORD_URL } from '../lib/constants'

// Default seed shown if the admin hasn't configured anything yet.
// The DB row in site_settings.social_links overrides this.
var DEFAULT_LINKS = [
  {
    id: 'tftclash',
    kind: 'website',
    label: 'tftclash.com',
    description: 'The home of EU TFT clashes. Register, climb, repeat.',
    url: 'https://tftclash.com',
    featured: true,
  },
  {
    id: 'discord',
    kind: 'discord',
    label: 'Discord community',
    description: 'Live results, lobby chat, and the people behind the brand.',
    url: DISCORD_URL,
    featured: false,
  },
  {
    id: 'twitter',
    kind: 'twitter',
    label: '@tftclash',
    description: 'Highlights, recaps, weekly clash announcements.',
    url: 'https://twitter.com/tftclash',
    featured: false,
  },
]

function BrandGlyph({ brand, size }) {
  var s = size || 22
  if (brand && brand.svg) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={s}
        height={s}
        aria-hidden="true"
        fill="currentColor"
        focusable="false"
      >
        <path d={brand.svg} />
      </svg>
    )
  }
  return <Icon name={brand ? brand.mat : 'link'} size={s} />
}

function LinkCard({ link, idx }) {
  var brand = brandFor(link.kind)
  var accent = brandAccent(link.kind, 0.74)
  var glow = brandAccent(link.kind, 0.62)
  var bg = 'oklch(0.18 ' + (brand.chroma * 0.18).toFixed(3) + ' ' + brand.hue + ')'
  var delay = (60 + idx * 60) + 'ms'

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="links-card lobby-row-in group relative block overflow-hidden rounded-xl border border-white/[0.06] bg-surface-container px-5 py-4 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
      style={{
        animationDelay: delay,
        '--brand-accent': accent,
        '--brand-bg': bg,
        '--brand-glow': glow,
      }}
    >
      {/* Brand bleed: a soft tint that lights up on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle at 0% 50%, color-mix(in oklch, var(--brand-accent) 16%, transparent) 0%, transparent 60%)',
        }}
      />
      {/* Hover edge glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ borderColor: 'color-mix(in oklch, var(--brand-accent) 60%, transparent)' }}
      />

      <div className="relative flex items-center gap-4">
        {/* Glyph tile */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
          style={{
            background: 'color-mix(in oklch, var(--brand-accent) 15%, oklch(0.16 0 0))',
            color: accent,
            boxShadow:
              '0 0 0 1px color-mix(in oklch, var(--brand-accent) 28%, transparent), inset 0 0 16px color-mix(in oklch, var(--brand-accent) 10%, transparent)',
          }}
        >
          <BrandGlyph brand={brand} size={22} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-base text-on-surface tracking-wide truncate">
              {link.label}
            </span>
            <span
              className="font-label text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                color: accent,
                background: 'color-mix(in oklch, var(--brand-accent) 12%, transparent)',
              }}
            >
              {brand.label}
            </span>
          </div>
          {link.description && (
            <div className="text-[12px] text-on-surface/60 mt-0.5 truncate">
              {link.description}
            </div>
          )}
        </div>

        {/* Trailing arrow */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-0.5"
          style={{
            background: 'color-mix(in oklch, var(--brand-accent) 14%, transparent)',
            color: accent,
          }}
        >
          <Icon name="arrow_outward" size={18} />
        </div>
      </div>
    </a>
  )
}

function FeaturedCard({ link }) {
  var brand = brandFor(link.kind)
  var accent = brandAccent(link.kind, 0.78)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="lobby-reveal group relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-secondary/[0.05] to-transparent p-6 transition-all hover:border-primary/60 hover:shadow-[0_18px_60px_oklch(0.78_0.16_78_/_0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={{ '--brand-accent': accent }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-30 group-hover:opacity-60 transition-opacity"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--brand-accent) 50%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--brand-accent) 22%, oklch(0.18 0 0))',
            color: accent,
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--brand-accent) 35%, transparent)',
          }}
        >
          <BrandGlyph brand={brand} size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-label text-[10px] uppercase tracking-[0.25em] text-primary/80 mb-1">
            Start here
          </div>
          <div className="font-editorial italic text-2xl text-on-surface leading-tight">
            {link.label}
          </div>
          {link.description && (
            <div className="text-sm text-on-surface/70 mt-1.5 leading-relaxed">
              {link.description}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-11 h-11 rounded-full border border-primary/30 group-hover:border-primary/60 transition-all group-hover:translate-x-0.5">
          <Icon name="arrow_forward" size={20} className="text-primary" />
        </div>
      </div>
    </a>
  )
}

export default function LinksScreen() {
  var navigate = useNavigate()
  var _links = useState(null)
  var links = _links[0]
  var setLinks = _links[1]
  var _err = useState(false)
  var err = _err[0]
  var setErr = _err[1]

  useEffect(function () {
    var alive = true
    function load() {
      if (!supabase || !supabase.from) {
        if (alive) setLinks(DEFAULT_LINKS)
        return
      }
      supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'social_links')
        .single()
        .then(function (res) {
          if (!alive) return
          if (res.error || !res.data) {
            setLinks(DEFAULT_LINKS)
            return
          }
          try {
            var raw = res.data.value
            var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (Array.isArray(parsed) && parsed.length > 0) {
              setLinks(parsed)
            } else {
              setLinks(DEFAULT_LINKS)
            }
          } catch (e) {
            setLinks(DEFAULT_LINKS)
            setErr(true)
          }
        })
        .catch(function () {
          if (!alive) return
          setLinks(DEFAULT_LINKS)
        })
    }
    load()
    // realtime: admin edits propagate immediately
    var ch = supabase.channel
      ? supabase
          .channel('social-links-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.social_links' },
            function () {
              load()
            }
          )
          .subscribe()
      : null
    return function () {
      alive = false
      if (ch && supabase.removeChannel) supabase.removeChannel(ch)
    }
  }, [])

  useEffect(function () {
    document.title = 'TFT Clash · Links'
  }, [])

  var loading = links === null
  var safeLinks = Array.isArray(links) ? links : DEFAULT_LINKS
  var featured = safeLinks.find(function (l) { return l.featured })
  var rest = safeLinks.filter(function (l) { return !l.featured })

  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-on-background">
      {/* Backdrop motif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 tactical-grid opacity-50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, oklch(0.36 0.08 78) 0%, transparent 65%)',
          opacity: 0.22,
        }}
      />

      <main className="relative max-w-[520px] mx-auto px-5 pt-14 pb-16 sm:pt-20">
        {/* Brand block */}
        <header className="text-center mb-10">
          <button
            type="button"
            onClick={function(){ navigate('/') }}
            className="inline-flex items-center gap-2 mb-6 group bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md px-2 py-1"
            aria-label="Go to TFT Clash home"
          >
            <span className="relative inline-flex w-2.5 h-2.5">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/55 [animation:live-ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_18px_oklch(0.78_0.16_78_/_0.6)]" />
            </span>
            <span className="font-label text-[11px] uppercase tracking-[0.4em] text-on-surface/70 group-hover:text-on-surface">
              TFT Clash
            </span>
          </button>
          <h1 className="leading-none">
            <span className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-on-surface block">
              Where the scene
            </span>
            <span className="font-editorial italic text-3xl sm:text-4xl text-primary block mt-2">
              clashes
            </span>
          </h1>
          <p className="font-body text-sm text-on-surface/60 mt-5 max-w-[380px] mx-auto leading-relaxed">
            Weekly competitive TFT for EU. Free to compete, ranked seasons, real lobbies, no spreadsheets.
          </p>
        </header>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(function (k) {
              return (
                <div
                  key={k}
                  className="h-20 rounded-xl border border-white/[0.04] bg-surface-container/60 animate-pulse"
                />
              )
            })}
          </div>
        )}

        {!loading && featured && (
          <div className="mb-5">
            <FeaturedCard link={featured} />
          </div>
        )}

        {!loading && rest.length > 0 && (
          <div className="space-y-3">
            {rest.map(function (l, i) {
              return <LinkCard key={l.id || i} link={l} idx={i} />
            })}
          </div>
        )}

        {!loading && safeLinks.length === 0 && (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-6 text-center">
            <Icon name="link_off" size={28} className="text-on-surface/40 block mx-auto mb-2" />
            <div className="font-display text-sm text-on-surface mb-1">No links yet</div>
            <div className="text-xs text-on-surface/50">An admin will add them shortly.</div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-14 text-center">
          <button
            type="button"
            onClick={function(){ navigate('/') }}
            className="font-label text-[10px] uppercase tracking-[0.3em] text-on-surface/45 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded px-2 py-1"
          >
            Built by TFT Clash · {new Date().getFullYear()}
          </button>
          {err && (
            <div className="mt-2 text-[10px] text-on-surface/30">
              Showing default links. (config error)
            </div>
          )}
        </footer>
      </main>
    </div>
  )
}
