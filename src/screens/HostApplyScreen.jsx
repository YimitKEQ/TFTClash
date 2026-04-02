import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon } from '../components/ui'

// Frequency radio tile
function FreqTile({ label, value, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={function() { onSelect(value); }}
      className={
        "p-4 border rounded-lg text-center transition-all font-label text-sm uppercase " +
        (selected
          ? "bg-primary/10 border-primary text-primary"
          : "border-outline-variant/20 text-on-surface/60 hover:bg-white/5")
      }
    >
      {label}
    </button>
  );
}

export default function HostApplyScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var setHostApps = ctx.setHostApps;
  var navigate = useNavigate();

  var [org, setOrg] = useState("");
  var [discord, setDiscord] = useState("");
  var [freq, setFreq] = useState("weekly");
  var [reason, setReason] = useState("");
  var [vision, setVision] = useState("");
  var [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!currentUser) {
      toast("Please log in to submit an application", "error");
      return;
    }
    if (!org.trim() || !reason.trim()) {
      toast("Organization name and reason are required", "error");
      return;
    }
    if (currentUser) {
      var slug = org.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      var res = await supabase.from("host_profiles").upsert({
        user_id: currentUser.id,
        org_name: org.trim(),
        slug: slug,
        bio: reason.trim(),
        status: "pending",
        social_links: { freq: freq, discord: discord.trim() },
        vision: vision.trim()
      }, { onConflict: 'user_id' }).select().single();
      if (res.error) {
        toast("Failed to submit application: " + res.error.message, "error");
        return;
      }
    }
    var app = {
      id: Date.now(),
      name: (currentUser && currentUser.username) || "",
      org: org.trim(),
      reason: reason.trim(),
      freq: freq,
      email: (currentUser && currentUser.email) || "",
      status: "pending",
      submittedAt: new Date().toLocaleDateString()
    };
    if (setHostApps) setHostApps(function(apps) { return [app].concat(apps); });
    setSubmitted(true);
    toast("Application submitted! We will review it within 48h", "success");
  }

  if (submitted) {
    return (
      <PageLayout>
        <div className="max-w-[560px] mx-auto text-center pt-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="check_circle" fill={true} size={32} className="text-primary" />
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">Application Submitted</h2>
          <p className="text-on-surface/60 text-sm leading-relaxed mb-2">
            We review all host applications within 48 hours. You will be notified at{" "}
            <span className="text-secondary">{(currentUser && currentUser.email) || "your email"}</span> once approved.
          </p>
          <p className="text-on-surface/40 text-xs mb-8">
            Approved hosts unlock a dedicated tournament dashboard to create and manage their own clashes.
          </p>
          <Btn v="primary" onClick={function() { setScreen("home"); navigate("/"); }}>Back to Home</Btn>
        </div>
      </PageLayout>
    );
  }

  var FREQ_OPTIONS = [
    { label: "Weekly", value: "weekly" },
    { label: "Bi-Weekly", value: "biweekly" },
    { label: "Monthly", value: "monthly" },
    { label: "One-off", value: "adhoc" }
  ];

  var REQUIREMENTS = [
    { label: "Active Discord", sub: "Minimum 500 active members", met: true },
    { label: "Stream Capability", sub: "Dedicated production team", met: true },
    { label: "Prize Pool Wallet", sub: "Verified tournament funds", met: false }
  ];

  return (
    <PageLayout>
      {/* Hero Header */}
      <div className="relative -mx-6 -mt-6 h-[300px] flex items-end px-12 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary font-label text-xs tracking-widest border border-tertiary/20 rounded-sm uppercase">
              Organizer Portal
            </span>
            <div className="flex items-center gap-2 text-primary">
              <Icon name="stars" fill={true} size={14} />
              <span className="font-label text-xs tracking-widest">Verified Partner Program</span>
            </div>
          </div>
          <h1 className="font-headline text-6xl font-bold tracking-tight text-on-surface mb-2">
            Host Application
          </h1>
          <p className="text-on-surface-variant max-w-2xl text-lg font-light leading-relaxed">
            Scale your community through official TFT Clash infrastructure. We provide the tools, you provide the competition.
          </p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6 -mt-8 relative z-20 pb-24">

        {/* Form Side (8 cols) */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-low p-8 rounded-xl shadow-2xl space-y-8">

            {/* Row 1: Org name + Discord */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="font-label text-xs tracking-widest text-slate-400 uppercase">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={org}
                  onChange={function(e) { setOrg(e.target.value); }}
                  placeholder="e.g. Tacticians United"
                  className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 focus:outline-none text-on-surface px-0 py-3 transition-colors placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="font-label text-xs tracking-widest text-slate-400 uppercase">
                  Discord Handle
                </label>
                <input
                  type="text"
                  value={discord}
                  onChange={function(e) { setDiscord(e.target.value); }}
                  placeholder="username#0000"
                  className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 focus:outline-none text-on-surface px-0 py-3 transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-4">
              <label className="font-label text-xs tracking-widest text-slate-400 uppercase">
                Event Frequency
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {FREQ_OPTIONS.map(function(opt) {
                  return (
                    <FreqTile
                      key={opt.value}
                      label={opt.label}
                      value={opt.value}
                      selected={freq === opt.value}
                      onSelect={setFreq}
                    />
                  );
                })}
              </div>
            </div>

            {/* Reason for Hosting */}
            <div className="space-y-2">
              <label className="font-label text-xs tracking-widest text-slate-400 uppercase">
                Reason for Hosting
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={function(e) { setReason(e.target.value); }}
                placeholder="Tell us why you want to become a TFT Clash partner..."
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 focus:outline-none text-on-surface px-0 py-3 transition-colors placeholder:text-slate-600 resize-none"
              />
            </div>

            {/* Vision */}
            <div className="space-y-2">
              <label className="font-label text-xs tracking-widest text-slate-400 uppercase">
                Vision for the Circuit
              </label>
              <textarea
                rows={4}
                value={vision}
                onChange={function(e) { setVision(e.target.value); }}
                placeholder="Describe your long-term goals and how you plan to engage players..."
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 focus:outline-none text-on-surface px-0 py-3 transition-colors placeholder:text-slate-600 resize-none"
              />
            </div>

            {/* Submit row */}
            <div className="pt-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon name="info" size={16} />
                <span className="text-xs italic">Review takes up to 48 hours</span>
              </div>
              <button
                type="button"
                onClick={submit}
                className="px-12 py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold text-lg tracking-widest rounded-full hover:shadow-[0_0_20px_rgba(253,186,73,0.3)] transition-all uppercase"
              >
                Apply Now
              </button>
            </div>
          </div>
        </div>

        {/* Status + Meta Side (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          {/* Requirements Checklist */}
          <div className="bg-surface-container/60 backdrop-blur-[24px] p-8 rounded-xl border border-outline-variant/10">
            <h4 className="font-label text-xs tracking-widest text-slate-400 uppercase mb-6">Partner Requirements</h4>
            <ul className="space-y-4">
              {REQUIREMENTS.map(function(req, i) {
                return (
                  <li key={i} className={"flex items-start gap-3" + (req.met ? "" : " opacity-50")}>
                    <Icon
                      name={req.met ? "check_circle" : "radio_button_unchecked"}
                      fill={req.met}
                      size={20}
                      className={req.met ? "text-tertiary" : "text-slate-600"}
                    />
                    <div className="text-sm">
                      <p className="font-bold text-on-surface">{req.label}</p>
                      <p className="text-slate-500 text-xs">{req.sub}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Prestige Info Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-primary/10">
            <Icon name="verified_user" fill={true} size={28} className="text-primary mb-4" />
            <h4 className="font-headline text-xl font-bold text-on-surface mb-2">Prestige Access</h4>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Approved hosts receive exclusive arena skins, custom lobby commands, and direct support from the TFT Clash dev team.
            </p>
            <button
              type="button"
              onClick={function() { navigate("/rules"); }}
              className="flex items-center gap-2 text-primary font-label text-xs tracking-widest uppercase group"
            >
              Read Partner Manifesto
              <Icon name="arrow_forward" size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </div>
    </PageLayout>
  );
}
