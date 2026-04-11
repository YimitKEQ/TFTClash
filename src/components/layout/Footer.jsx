import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { DISCORD_URL } from '../../lib/constants.js';

function Footer() {
  var ctx = useApp();
  var orgSponsors = ctx.orgSponsors || [];
  var sponsorEntries = (Array.isArray(orgSponsors) ? orgSponsors : []).filter(function(s) {
    return s.status === 'active' && (!s.placements || s.placements.indexOf('footer') > -1)
  });
  var navigate = useNavigate();

  var platformLinks = [
    ["/", "Home"],
    ["/standings", "Standings"],
    ["/leaderboard", "Leaderboard"],
    ["/hall-of-fame", "Hall of Fame"],
    ["/archive", "Archive"]
  ];
  var communityLinks = [
    ["/events/featured", "Featured Events"],
    ["/rules", "Rules"],
    ["/faq", "FAQ"],
    ["/gear", "Gear"],
    ["/sponsors", "Sponsors"]
  ];
  var hostingLinks = [
    ["/pricing", "Pricing"],
    ["/host/apply", "Apply to Host"],
    ["/host/dashboard", "Host Dashboard"]
  ];

  function handleNav(path) {
    return function() { navigate(path); };
  }

  return (
    <footer className="border-t border-primary/10 pt-10 pb-6 px-6 mt-10" style={{background:"#06060C"}}>
      <div className="max-w-6xl mx-auto">

        {sponsorEntries.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <span className="text-[10px] font-bold text-on-surface/40 tracking-widest uppercase font-condensed">Partners</span>
            {sponsorEntries.map(function(s, i) {
              return (
                <div key={s.name} className="flex items-center gap-1.5 px-3 py-1 rounded-md border"
                  style={{background: s.color + "12", borderColor: s.color + "25"}}>
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="h-4 object-contain" />
                  ) : (
                    <span className="text-xs font-extrabold" style={{color: s.color}}>
                      {(s.name || '').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-on-surface/60">{s.name}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-8 mb-8" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
          <div>
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest font-condensed mb-3">Platform</div>
            {platformLinks.map(function(arr) {
              return (
                <button key={arr[0]} onClick={handleNav(arr[0])}
                  className="block bg-transparent border-0 text-on-surface/60 text-[13px] py-1 px-0 cursor-pointer font-inherit hover:text-on-surface transition-colors">
                  {arr[1]}
                </button>
              );
            })}
          </div>
          <div>
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest font-condensed mb-3">Community</div>
            {communityLinks.map(function(arr) {
              return (
                <button key={arr[0]} onClick={handleNav(arr[0])}
                  className="block bg-transparent border-0 text-on-surface/60 text-[13px] py-1 px-0 cursor-pointer font-inherit hover:text-on-surface transition-colors">
                  {arr[1]}
                </button>
              );
            })}
            <button onClick={function() { window.open(DISCORD_URL, "_blank"); }}
              className="block bg-transparent border-0 text-on-surface/60 text-[13px] py-1 px-0 cursor-pointer font-inherit hover:text-on-surface transition-colors">
              Discord
            </button>
          </div>
          <div>
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest font-condensed mb-3">Hosting</div>
            {hostingLinks.map(function(arr) {
              return (
                <button key={arr[0]} onClick={handleNav(arr[0])}
                  className="block bg-transparent border-0 text-on-surface/60 text-[13px] py-1 px-0 cursor-pointer font-inherit hover:text-on-surface transition-colors">
                  {arr[1]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-primary/[0.08] pt-4 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-on-surface/60">
              {"\u00a9"} 2026 TFT Clash {"\u00b7"} Season 1 {"\u00b7"} Free to compete, always.
            </span>
            <button onClick={handleNav("/privacy")}
              className="bg-transparent border-0 text-on-surface/60 text-[11px] cursor-pointer font-inherit underline p-0 hover:text-on-surface transition-colors">
              Privacy
            </button>
            <button onClick={handleNav("/terms")}
              className="bg-transparent border-0 text-on-surface/60 text-[11px] cursor-pointer font-inherit underline p-0 hover:text-on-surface transition-colors">
              Terms
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <img src="/icon-border.png" alt="TFT Clash" className="w-4 h-4 opacity-40" />
            <span className="text-[10px] text-on-surface/60">Built for the community</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
