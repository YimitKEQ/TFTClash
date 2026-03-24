import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon'

var PRIVACY_SECTIONS = [
  {
    id: 'collect',
    num: '01.',
    title: 'Information We Collect',
    body: 'To facilitate a high-stakes competitive environment, we require certain data points from our athletes. This ensures match fairness and prevents multi-accounting.',
    cards: [
      {
        label: 'Identity Data',
        text: 'Riot ID, Summoner Name, Region, and Rank Tier metadata.'
      },
      {
        label: 'Technical Data',
        text: 'IP address, browser type, and anti-cheat hardware identifiers.'
      }
    ]
  },
  {
    id: 'use',
    num: '02.',
    title: 'How We Use Your Data',
    body: 'Data processing is restricted to the essential operations of the TFT Clash ecosystem. We do not sell player data to third-party advertisers.',
    items: [
      {
        strong: 'Tournament Matching:',
        text: ' Using rank data to ensure fair brackets and competitive seeding.'
      },
      {
        strong: 'Integrity Checks:',
        text: ' Analyzing match history to identify potential scripting or boosting behavior.'
      },
      {
        strong: 'Broadcast Graphics:',
        text: ' Displaying your Summoner Name and stats on official tournament streams.'
      }
    ]
  },
  {
    id: 'sharing',
    num: '03.',
    title: 'Third-Party Disclosures',
    highlight: true,
    body: 'We may share specific data with Riot Games, Inc. as part of our developer agreement to ensure compliance with the League of Legends / Teamfight Tactics Terms of Service.',
    quote: 'TFT Clash is an independent organization and is not directly affiliated with Riot Games. However, all tournament results are reported to the official API for MMR adjustments where applicable.'
  },
  {
    id: 'retention',
    num: '04.',
    title: 'Data Retention',
    body: 'Account data is stored for the duration of your active membership. Tournament records and historic standings are archived indefinitely as part of the public competitive record, unless a Right to be Forgotten request is formally filed.'
  },
  {
    id: 'rights',
    num: '05.',
    title: 'Your Rights',
    body: 'You can update or delete your account at any time via Account Settings. Upon deletion, your personal data is removed. Anonymized competitive records may be retained for historical standings integrity.'
  },
  {
    id: 'security',
    num: '06.',
    title: 'Data Security',
    body: 'We use Supabase with row-level security policies. All data is encrypted in transit and at rest. Authentication is handled through industry-standard protocols.'
  }
]

var SIDEBAR_LINKS = [
  { href: '/privacy', label: 'Privacy Policy', icon: 'gavel', active: true },
  { href: '/terms', label: 'Terms of Service', icon: 'description', active: false },
]

export default function PrivacyScreen() {
  var [activeSection, setActiveSection] = useState(null)
  var navigate = useNavigate()

  function scrollTo(id) {
    var el = document.getElementById('privacy-' + id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  return (
    <PageLayout showSidebar={false}>
      <div className="flex flex-col md:flex-row gap-10 md:gap-12 pt-4">

        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="md:sticky md:top-28 flex flex-col gap-1">
            <div className="mb-5">
              <span className="font-condensed text-xs uppercase tracking-widest text-primary font-bold">Legal Directory</span>
              <h2 className="font-editorial text-3xl mt-1 text-on-surface">Resources</h2>
            </div>

            <button
              onClick={function() { navigate('/privacy') }}
              className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary border-r-4 border-primary transition-all w-full text-left"
            >
              <Icon name="gavel" size={18} />
              <span className="font-condensed text-sm font-bold uppercase tracking-wide">Privacy Policy</span>
            </button>

            <button
              onClick={function() { navigate('/terms') }}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all w-full text-left"
            >
              <Icon name="description" size={18} />
              <span className="font-condensed text-sm font-bold uppercase tracking-wide">Terms of Service</span>
            </button>

            <div className="mt-8 p-5 bg-surface-container-low rounded-sm border border-outline-variant/15">
              <span className="font-condensed text-[10px] uppercase tracking-widest text-tertiary">Last Updated</span>
              <p className="font-mono text-sm mt-1 text-on-surface">MARCH 2026</p>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              {PRIVACY_SECTIONS.map(function (s) {
                var isActive = activeSection === s.id
                return (
                  <button
                    key={s.id}
                    onClick={function () { scrollTo(s.id) }}
                    className={'text-left px-4 py-2 text-xs transition-all hover:bg-white/5 rounded-sm bg-transparent border-0 cursor-pointer ' + (isActive ? 'text-primary' : 'text-[#9d8e7c]')}
                  >
                    <span className={'font-mono mr-2 text-primary ' + (isActive ? 'opacity-100' : 'opacity-50')}>{s.num}</span>
                    {s.title}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 pb-16 min-w-0">
          <div className="mb-10">
            <span className="font-condensed text-xs uppercase tracking-widest text-secondary">Compliance &amp; Protection</span>
            <h1 className="font-editorial text-5xl md:text-6xl mt-2 leading-tight text-on-surface">Privacy Policy</h1>
            <p className="text-on-surface-variant mt-4 max-w-2xl leading-relaxed">
              At TFT Clash, we take your competitive integrity and data security seriously. This document outlines how we handle player data across our tournament platform.
            </p>
          </div>

          <div className="flex flex-col gap-14">
            {PRIVACY_SECTIONS.map(function (sec) {
              if (sec.highlight) {
                return (
                  <div key={sec.id} id={'privacy-' + sec.id} className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 -skew-y-1 translate-y-2 pointer-events-none"></div>
                    <div className="relative bg-surface-container-high p-8 rounded-sm border-l-4 border-primary">
                      <div className="flex items-center gap-4 mb-5">
                        <span className="font-mono text-primary text-base">{sec.num}</span>
                        <h3 className="font-editorial text-2xl text-on-surface">{sec.title}</h3>
                      </div>
                      <p className="leading-relaxed text-on-surface mb-6">{sec.body}</p>
                      {sec.quote && (
                        <div className="p-5 bg-surface-container-lowest rounded-sm border border-outline-variant/10">
                          <p className="text-sm italic text-on-surface-variant">
                            "{sec.quote}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div key={sec.id} id={'privacy-' + sec.id} className="group">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="font-mono text-primary text-base">{sec.num}</span>
                    <h3 className="font-editorial text-2xl text-on-surface group-hover:text-primary transition-colors">{sec.title}</h3>
                  </div>
                  <div className="bg-surface-container-low p-7 rounded-sm space-y-5">
                    <p className="leading-relaxed text-on-surface">{sec.body}</p>

                    {sec.cards && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sec.cards.map(function (card) {
                          return (
                            <div key={card.label} className="p-4 bg-surface-container-high rounded-sm">
                              <span className="font-condensed text-[10px] uppercase tracking-widest text-tertiary">{card.label}</span>
                              <p className="text-sm mt-2 text-on-surface-variant">{card.text}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {sec.items && (
                      <ul className="space-y-4">
                        {sec.items.map(function (item, i) {
                          return (
                            <li key={i} className="flex gap-3">
                              <Icon name="check_circle" size={18} className="text-primary mt-0.5 shrink-0" />
                              <span className="text-sm text-on-surface-variant">
                                <strong className="text-on-surface">{item.strong}</strong>
                                {item.text}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Contact Footer */}
            <div className="pt-10 mt-2 border-t border-outline-variant/20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h4 className="font-editorial text-xl text-on-surface">Have questions about your data?</h4>
                  <p className="text-on-surface-variant text-sm mt-1">Our compliance team is available for inquiries regarding GDPR and CCPA.</p>
                </div>
                <a
                  href="https://discord.gg/tftclash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-primary text-on-primary font-bold rounded-full font-condensed text-sm uppercase tracking-wide hover:bg-primary/90 active:scale-95 transition-all no-underline whitespace-nowrap"
                >
                  Contact via Discord
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  )
}
