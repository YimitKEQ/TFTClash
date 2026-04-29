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
    label: 'Discord',
    description: 'Live results, lobby chat, the people behind the brand.',
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

function BrandGlyph(props) {
  var brand = props.brand
  var size = props.size || 22
  if (brand && brand.svg) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        fill="currentColor"
        focusable="false"
      >
        <path d={brand.svg} />
      </svg>
    )
  }
  return <Icon name={brand ? brand.mat : 'link'} size={size} />
}

function GlyphTile(props) {
  var kind = props.kind
  var large = props.large
  var brand = brandFor(kind)
  var accent = brandAccent(kind, 0.74)
  var dim = large ? 'w-12 h-12' : 'w-11 h-11'
  return (
    <div
      className={dim + ' flex-shrink-0 rounded-md flex items-center justify-center'}
      style={{
        background: 'color-mix(in oklch, ' + accent + ' 12%, oklch(0.16 0 0))',
        color: accent,
        boxShadow: 'inset 0 0 0 1px color-mix(in oklch, ' + accent + ' 28%, transparent)',
      }}
      aria-hidden="true"
    >
      <BrandGlyph brand={brand} size={large ? 24 : 20} />
    </div>
  )
}

function FeaturedRow(props) {
  var link = props.link
  var brand = brandFor(link.kind)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-primary/40 bg-surface-container px-5 py-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="flex items-center gap-4">
        <GlyphTile kind={link.kind} large />
        <div className="flex-1 min-w-0">
          <div className="font-label text-[10px] uppercase tracking-[0.3em] text-primary mb-1">
            Start Here
          </div>
          <div className="font-display text-lg uppercase tracking-tight text-on-surface leading-tight truncate">
            {link.label}
          </div>
          {link.description && (
            <div className="font-body text-[12.5px] text-on-surface/65 mt-1 line-clamp-2">
              {link.description}
            </div>
          )}
        </div>
        <span
          aria-hidden="true"
          className="hidden sm:flex flex-shrink-0 w-9 h-9 rounded-full items-center justify-center border border-primary/40 text-primary group-hover:bg-primary/10 transition-colors"
        >
          <Icon name="arrow_forward" size={18} />
        </span>
      </div>
    </a>
  )
}

function LinkRow(props) {
  var link = props.link
  var idx = props.idx
  var brand = brandFor(link.kind)
  var accent = brandAccent(link.kind, 0.74)
  var delay = (60 + idx * 60) + 'ms'

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="lobby-row-in group block rounded-lg border border-outline-variant/15 bg-surface-container px-4 py-3.5 transition-colors hover:border-outline-variant/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={{ animationDelay: delay, borderLeftColor: 'color-mix(in oklch, ' + accent + ' 50%, transparent)' }}
    >
      <div className="flex items-center gap-3.5">
        <GlyphTile kind={link.kind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] uppercase tracking-tight text-on-surface truncate">
              {link.label}
            </span>
            <span
              className="font-label text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-on-surface/8 text-on-surface/60 flex-shrink-0"
            >
              {brand.label}
            </span>
          </div>
          {link.description && (
            <div className="font-body text-[12px] text-on-surface/55 mt-0.5 truncate">
              {link.description}
            </div>
          )}
        </div>
        <span
          aria-hidden="true"
          className="flex-shrink-0 text-on-surface/40 group-hover:text-on-surface/80 transition-colors"
        >
          <Icon name="arrow_outward" size={18} />
        </span>
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
        .maybeSingle()
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
    // realtime: admin edits propagate instantly
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
    var prev = document.title
    document.title = 'TFT Clash - Links'
    return function () { document.title = prev }
  }, [])

  var loading = links === null
  var safeLinks = Array.isArray(links) ? links : DEFAULT_LINKS
  var featured = safeLinks.find(function (l) { return l.featured })
  var rest = safeLinks.filter(function (l) { return !l.featured })

  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-on-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 tactical-grid opacity-40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, oklch(0.32 0.08 78) 0%, transparent 65%)',
          opacity: 0.22,
        }}
      />

      <main className="relative max-w-[540px] mx-auto px-5 pt-12 pb-16 sm:pt-16">
        {/* Brand block */}
        <header className="mb-9">
          <button
            type="button"
            onClick={function(){ navigate('/') }}
            className="inline-flex items-center gap-2 mb-5 group bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md px-1.5 py-1 -ml-1.5"
            aria-label="Go to TFT Clash home"
          >
            <span className="relative inline-flex w-2.5 h-2.5">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/55 [animation:live-ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-primary" />
            </span>
            <span className="font-label text-[10px] uppercase tracking-[0.4em] text-on-surface/65 group-hover:text-on-surface">
              TFT Clash
            </span>
          </button>

          <h1 className="font-display text-[34px] sm:text-[42px] font-bold uppercase tracking-tight text-on-surface leading-[0.95]">
            The Scene
            <br />
            <span className="text-primary">Clashes Here</span>
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-label text-[10px] uppercase tracking-widest bg-on-surface/6 text-on-surface/70 border border-outline-variant/15">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" aria-hidden="true" />
              NA & EU
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-label text-[10px] uppercase tracking-widest bg-on-surface/6 text-on-surface/70 border border-outline-variant/15">
              <Icon name="schedule" size={11} />
              Weekly Clashes
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-label text-[10px] uppercase tracking-widest bg-on-surface/6 text-on-surface/70 border border-outline-variant/15">
              <Icon name="bolt" size={11} />
              Free To Play
            </span>
          </div>

          <p className="font-body text-[13px] text-on-surface/60 mt-5 leading-relaxed">
            Pick a destination. Lobby chat, weekly results, brand updates - it all lives behind these links.
          </p>
        </header>

        {/* List */}
        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2].map(function (k) {
              return (
                <div
                  key={k}
                  className="h-[68px] rounded-lg border border-outline-variant/10 bg-surface-container/50 animate-pulse"
                />
              )
            })}
          </div>
        )}

        {!loading && featured && (
          <div className="mb-3">
            <FeaturedRow link={featured} />
          </div>
        )}

        {!loading && rest.length > 0 && (
          <div className="space-y-2.5">
            {rest.map(function (l, i) {
              return <LinkRow key={l.id || i} link={l} idx={i} />
            })}
          </div>
        )}

        {!loading && safeLinks.length === 0 && (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container p-6 text-center">
            <Icon name="link_off" size={26} className="text-on-surface/40 block mx-auto mb-2" />
            <div className="font-display text-sm uppercase tracking-tight text-on-surface mb-1">No links yet</div>
            <div className="font-body text-xs text-on-surface/50">An admin will add them shortly.</div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
          <button
            type="button"
            onClick={function(){ navigate('/') }}
            className="font-label text-[10px] uppercase tracking-[0.3em] text-on-surface/45 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded px-1 py-0.5"
          >
            Open Site
          </button>
          <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface/35">
            S{new Date().getFullYear() - 2025} · Built by TFT Clash
          </div>
        </footer>
        {err && (
          <div className="mt-2 text-[10px] text-on-surface/30 text-center">
            Showing default links. (config error)
          </div>
        )}
      </main>
    </div>
  )
}
