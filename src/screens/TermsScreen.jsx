import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon'

var TERMS_SECTIONS = [
  {
    id: 'acceptance',
    num: '01.',
    title: 'Acceptance of Terms',
    body: 'By creating an account or using TFT Clash, you agree to these terms. If you do not agree, please do not use the platform.',
    items: null
  },
  {
    id: 'accounts',
    num: '02.',
    title: 'Accounts',
    body: 'You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. One account per person.',
    items: null
  },
  {
    id: 'conduct',
    num: '03.',
    title: 'Acceptable Use',
    body: 'You agree not to engage in any of the following prohibited behaviors on the TFT Clash platform:',
    items: [
      { strong: 'Result Manipulation:', text: ' Do not manipulate game results or submit false scores.' },
      { strong: 'Automation:', text: ' Do not use automated tools or bots to interact with the platform.' },
      { strong: 'Harassment:', text: ' Do not harass, threaten, or demean other users or organizers.' },
      { strong: 'Impersonation:', text: ' Do not impersonate other players or staff members.' },
      { strong: 'Exploit Abuse:', text: ' Report bugs instead of exploiting them for competitive advantage.' }
    ]
  },
  {
    id: 'content',
    num: '04.',
    title: 'User Content',
    body: 'You retain ownership of content you create such as profile info and messages. By posting, you grant TFT Clash a license to display it within the platform. We may remove content that violates these terms.',
    items: null
  },
  {
    id: 'subscriptions',
    num: '05.',
    title: 'Subscriptions and Payments',
    highlight: true,
    body: 'Paid tiers (Pro at $4.99/mo and Host at $19.99/mo) are billed monthly. You may cancel at any time. Refunds are handled case-by-case. Features are subject to change with reasonable notice.',
    cards: [
      { label: 'Pro Tier', text: '$4.99/month. Cancel anytime. No lock-in contracts.' },
      { label: 'Host Tier', text: '$19.99/month. Full tournament hosting suite included.' }
    ]
  },
  {
    id: 'termination',
    num: '06.',
    title: 'Termination',
    body: 'We may suspend or terminate accounts that violate these terms. You may delete your account at any time via Account Settings. Terminations for rule violations may be permanent.',
    items: null
  },
  {
    id: 'liability',
    num: '07.',
    title: 'Limitation of Liability',
    body: 'TFT Clash is provided as-is. We are not liable for competitive outcomes, data loss from service interruptions, or third-party actions. Use the platform at your own risk.',
    items: null
  },
  {
    id: 'changes',
    num: '08.',
    title: 'Changes to Terms',
    body: 'We may update these terms periodically. Continued use after changes constitutes acceptance. We will notify users of significant changes via the platform.',
    items: null
  }
]

export default function TermsScreen() {
  var [activeSection, setActiveSection] = useState(null)
  var navigate = useNavigate()

  function scrollTo(id) {
    var el = document.getElementById('terms-' + id)
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
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all w-full text-left"
            >
              <Icon name="gavel" size={18} />
              <span className="font-condensed text-sm font-bold uppercase tracking-wide">Privacy Policy</span>
            </button>

            <button
              onClick={function() { navigate('/terms') }}
              className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary border-r-4 border-primary transition-all w-full text-left"
            >
              <Icon name="description" size={18} />
              <span className="font-condensed text-sm font-bold uppercase tracking-wide">Terms of Service</span>
            </button>

            <div className="mt-8 p-5 bg-surface-container-low rounded-sm border border-outline-variant/15">
              <span className="font-condensed text-[10px] uppercase tracking-widest text-tertiary">Last Updated</span>
              <p className="font-mono text-sm mt-1 text-on-surface">MARCH 2026</p>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              {TERMS_SECTIONS.map(function (s) {
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
            <span className="font-condensed text-xs uppercase tracking-widest text-secondary">Platform Agreement</span>
            <h1 className="font-editorial text-5xl md:text-6xl mt-2 leading-tight text-on-surface">Terms of Service</h1>
            <p className="text-on-surface-variant mt-4 max-w-2xl leading-relaxed">
              Please read these terms carefully before using TFT Clash. By accessing or using the platform you agree to be bound by these terms.
            </p>
          </div>

          <div className="flex flex-col gap-14">
            {TERMS_SECTIONS.map(function (sec) {
              if (sec.highlight) {
                return (
                  <div key={sec.id} id={'terms-' + sec.id} className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 -skew-y-1 translate-y-2 pointer-events-none"></div>
                    <div className="relative bg-surface-container-high p-8 rounded-sm border-l-4 border-primary">
                      <div className="flex items-center gap-4 mb-5">
                        <span className="font-mono text-primary text-base">{sec.num}</span>
                        <h3 className="font-editorial text-2xl text-on-surface">{sec.title}</h3>
                      </div>
                      <p className="leading-relaxed text-on-surface mb-6">{sec.body}</p>
                      {sec.cards && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sec.cards.map(function (card) {
                            return (
                              <div key={card.label} className="p-4 bg-surface-container-lowest rounded-sm border border-outline-variant/10">
                                <span className="font-condensed text-[10px] uppercase tracking-widest text-tertiary">{card.label}</span>
                                <p className="text-sm mt-2 text-on-surface-variant">{card.text}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div key={sec.id} id={'terms-' + sec.id} className="group">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="font-mono text-primary text-base">{sec.num}</span>
                    <h3 className="font-editorial text-2xl text-on-surface group-hover:text-primary transition-colors">{sec.title}</h3>
                  </div>
                  <div className="bg-surface-container-low p-7 rounded-sm space-y-5">
                    <p className="leading-relaxed text-on-surface">{sec.body}</p>

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
                  <h4 className="font-editorial text-xl text-on-surface">Questions about these terms?</h4>
                  <p className="text-on-surface-variant text-sm mt-1">Reach out to the TFT Clash team via Discord for any legal or compliance questions.</p>
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
