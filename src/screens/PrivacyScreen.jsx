import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'

var PRIVACY_SECTIONS = [
  {
    id: 'collect',
    title: 'Information We Collect',
    icon: 'ti ti-database',
    body: 'We collect information you provide directly: account credentials, Riot ID, region, and optional profile details (bio, social links). We also collect usage data including participation records, placement results, and platform interactions.'
  },
  {
    id: 'use',
    title: 'How We Use Your Information',
    icon: 'ti ti-chart-bar',
    body: 'Your information powers your competitive profile, leaderboard standings, achievement tracking, and season statistics. We use aggregate data to improve the platform. We never sell personal data.'
  },
  {
    id: 'share',
    title: 'Information Sharing',
    icon: 'ti ti-share',
    body: 'Your competitive results and profile are visible to other users. We do not share personal data with third parties except as required by law or to protect against fraud.'
  },
  {
    id: 'security',
    title: 'Data Security',
    icon: 'ti ti-lock',
    body: 'We use Supabase with row-level security policies. All data is encrypted in transit and at rest. Authentication is handled through industry-standard protocols.'
  },
  {
    id: 'rights',
    title: 'Your Rights',
    icon: 'ti ti-user-check',
    body: 'You can update or delete your account at any time via Account Settings. Upon deletion, your personal data is removed. Anonymized competitive records may be retained for historical standings integrity.'
  },
  {
    id: 'contact',
    title: 'Contact',
    icon: 'ti ti-message-circle',
    body: 'Questions about privacy? Reach us via Discord.'
  }
]

export default function PrivacyScreen() {
  var [expanded, setExpanded] = useState(null)

  function toggleSection(id) {
    setExpanded(function (prev) {
      return prev === id ? null : id
    })
  }

  return (
    <PageLayout showSidebar={false}>
      <PageHeader
        title="Privacy"
        goldWord="Policy"
        description="How we collect, use, and protect your data"
      />

      {/* Last updated + table of contents */}
      <div
        className="rounded-xl mb-6"
        style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(242,237,228,.08)',
          padding: '16px 20px',
        }}
      >
        <div
          className="text-xs uppercase tracking-widest mb-3"
          style={{
            color: '#9AAABF',
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: '.1em',
          }}
        >
          Last updated: March 2026
        </div>
        <div className="flex flex-col gap-1">
          {PRIVACY_SECTIONS.map(function (s) {
            return (
              <a
                key={s.id}
                href={'#privacy-' + s.id}
                onClick={function (e) {
                  e.preventDefault()
                  setExpanded(s.id)
                  var el = document.getElementById('privacy-' + s.id)
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="text-sm"
                style={{
                  color: '#9B72CF',
                  textDecoration: 'none',
                  padding: '2px 0',
                }}
              >
                {s.title}
              </a>
            )
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-2">
        {PRIVACY_SECTIONS.map(function (sec) {
          var isOpen = expanded === sec.id
          return (
            <div
              key={sec.id}
              id={'privacy-' + sec.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: isOpen ? 'rgba(155,114,207,.06)' : 'rgba(255,255,255,.02)',
                border:
                  '1px solid ' +
                  (isOpen ? 'rgba(155,114,207,.25)' : 'rgba(242,237,228,.08)'),
                transition: 'all .2s',
              }}
            >
              <button
                onClick={function () {
                  toggleSection(sec.id)
                }}
                className="w-full flex items-center justify-between gap-3 text-left"
                style={{
                  padding: '16px 18px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg" style={{ color: isOpen ? '#9B72CF' : '#8896A8' }}>
                    <i className={sec.icon} />
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isOpen ? '#C4B5FD' : '#F2EDE4' }}
                  >
                    {sec.title}
                  </span>
                </div>
                <span
                  className="text-lg flex-shrink-0"
                  style={{
                    color: isOpen ? '#9B72CF' : '#8896A8',
                    transition: 'transform .2s',
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px 18px' }}>
                  <div className="text-sm leading-relaxed" style={{ color: '#BECBD9' }}>
                    {sec.body}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div
        className="mt-8 rounded-2xl text-center"
        style={{
          background: 'rgba(155,114,207,.06)',
          border: '1px solid rgba(155,114,207,.2)',
          padding: '20px 24px',
        }}
      >
        <div className="text-sm leading-relaxed" style={{ color: '#BECBD9' }}>
          By using TFT Clash, you agree to this Privacy Policy. We are committed to protecting your data and being transparent about how we use it.
        </div>
      </div>
    </PageLayout>
  )
}
