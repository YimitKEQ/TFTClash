import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'

var TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    icon: 'ti ti-file-check',
    body: 'By creating an account or using TFT Clash, you agree to these terms. If you do not agree, please do not use the platform.'
  },
  {
    id: 'accounts',
    title: 'Accounts',
    icon: 'ti ti-user',
    body: 'You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. One account per person.'
  },
  {
    id: 'conduct',
    title: 'Acceptable Use',
    icon: 'ti ti-shield-check',
    body: 'You agree not to: manipulate game results, use automated tools to interact with the platform, harass other users, impersonate others, or exploit bugs instead of reporting them.'
  },
  {
    id: 'content',
    title: 'User Content',
    icon: 'ti ti-edit',
    body: 'You retain ownership of content you create (profile info, messages). By posting, you grant TFT Clash a license to display it within the platform. We may remove content that violates these terms.'
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions and Payments',
    icon: 'ti ti-credit-card',
    body: 'Paid tiers (Pro, Host) are billed monthly. You may cancel at any time. Refunds are handled case-by-case. Features are subject to change with notice.'
  },
  {
    id: 'termination',
    title: 'Termination',
    icon: 'ti ti-ban',
    body: 'We may suspend or terminate accounts that violate these terms. You may delete your account at any time via Account Settings.'
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    icon: 'ti ti-alert-triangle',
    body: 'TFT Clash is provided as-is. We are not liable for competitive outcomes, data loss from service interruptions, or third-party actions. Use the platform at your own risk.'
  },
  {
    id: 'changes',
    title: 'Changes to Terms',
    icon: 'ti ti-refresh',
    body: 'We may update these terms periodically. Continued use after changes constitutes acceptance. We will notify users of significant changes via the platform.'
  }
]

export default function TermsScreen() {
  var [expanded, setExpanded] = useState(null)

  function toggleSection(id) {
    setExpanded(function (prev) {
      return prev === id ? null : id
    })
  }

  return (
    <PageLayout showSidebar={false}>
      <PageHeader
        title="Terms of"
        goldWord="Service"
        description="Please read these terms carefully before using TFT Clash"
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
          {TERMS_SECTIONS.map(function (s) {
            return (
              <a
                key={s.id}
                href={'#terms-' + s.id}
                onClick={function (e) {
                  e.preventDefault()
                  setExpanded(s.id)
                  var el = document.getElementById('terms-' + s.id)
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
        {TERMS_SECTIONS.map(function (sec) {
          var isOpen = expanded === sec.id
          return (
            <div
              key={sec.id}
              id={'terms-' + sec.id}
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
          These terms govern your use of TFT Clash. By continuing to use the platform, you accept any updates to these terms.
        </div>
      </div>
    </PageLayout>
  )
}
