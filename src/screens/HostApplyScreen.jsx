import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp } from '../components/ui'

// ─── Inline select ────────────────────────────────────────────────────────────
function Sel({ value, onChange, children }) {
  return (
    <select
      className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm w-full"
      value={value}
      onChange={function(e) { onChange(e.target.value); }}
    >
      {children}
    </select>
  );
}

// ─── HostApplyScreen ──────────────────────────────────────────────────────────
export default function HostApplyScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var setHostApps = ctx.setHostApps;
  var navigate = useNavigate();

  var [name, setName] = useState((currentUser && currentUser.username) || "");
  var [org, setOrg] = useState("");
  var [reason, setReason] = useState("");
  var [freq, setFreq] = useState("weekly");
  var [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!name.trim() || !reason.trim()) { toast("Name and reason required", "error"); return; }
    var app = {
      id: Date.now(),
      name: name.trim(),
      org: org.trim(),
      reason: reason.trim(),
      freq: freq,
      email: currentUser && currentUser.email || "",
      status: "pending",
      submittedAt: new Date().toLocaleDateString()
    };
    setHostApps && setHostApps(function(apps) { return [app].concat(apps); });
    if (supabase.from && currentUser) {
      var slug = (org.trim() || name.trim()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      supabase.from("host_profiles").upsert({
        user_id: currentUser.id,
        org_name: org.trim() || name.trim(),
        slug: slug,
        bio: reason.trim(),
        status: "pending",
        social_links: { freq: freq }
      }, { onConflict: 'user_id' }).then(function(res) {
        if (res.error) console.error("[TFT] host_profiles insert failed:", res.error);
      });
    }
    setSubmitted(true);
    toast("Application submitted! We'll review it within 48h", "success");
  }

  if (submitted) {
    return (
      <PageLayout>
        <div className="max-w-[560px] mx-auto text-center pt-16">
          <div className="text-5xl mb-4">
            <i className="ti ti-device-gamepad-2" />
          </div>
          <h2 className="text-on-surface text-xl font-bold mb-3">Application Submitted!</h2>
          <p className="text-on-surface/60 text-sm leading-relaxed mb-2">
            We review all host applications within 48 hours. You'll be notified at{" "}
            <span className="text-secondary">{(currentUser && currentUser.email) || "your email"}</span> once approved.
          </p>
          <p className="text-on-surface/40 text-xs mb-6">
            Approved hosts unlock a dedicated tournament dashboard to create and manage their own clashes.
          </p>
          <Btn v="primary" onClick={function() { setScreen("home"); navigate("/"); }}>Back to Home</Btn>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-[600px] mx-auto">
        <Btn v="dark" s="sm" onClick={function() { setScreen("account"); navigate("/account"); }} className="mb-5">
          arrow_back Back
        </Btn>

        <div className="mb-7">
          <div className="text-4xl mb-3">
            <i className="ti ti-device-gamepad-2" />
          </div>
          <h2 className="text-on-surface text-xl font-bold mb-2">Apply to Host</h2>
          <p className="text-on-surface/60 text-sm leading-relaxed">
            Host status gives you your own tournament dashboard to create and run TFT Clash events.
            All hosts are manually reviewed and approved by our admin team.
          </p>
        </div>

        <Panel>
          <div className="flex flex-col gap-4 p-6">
            <div>
              <div className="text-xs font-semibold text-on-surface/60 mb-1.5">Your Name / Handle</div>
              <Inp value={name} onChange={setName} placeholder="Display name" />
            </div>

            <div>
              <div className="text-xs font-semibold text-on-surface/60 mb-1.5">
                Org / Community Name <span className="text-on-surface/40 font-normal">(optional)</span>
              </div>
              <Inp value={org} onChange={setOrg} placeholder="e.g. TFT Academy, PG Clashes..." />
            </div>

            <div>
              <div className="text-xs font-semibold text-on-surface/60 mb-1.5">Planned Event Frequency</div>
              <Sel value={freq} onChange={setFreq}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="adhoc">Ad-hoc / Special events only</option>
              </Sel>
            </div>

            <div>
              <div className="text-xs font-semibold text-on-surface/60 mb-1.5">
                Why do you want to host? <span className="text-red-400">*</span>
              </div>
              <textarea
                className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm resize-y min-h-[100px] outline-none font-sans"
                value={reason}
                onChange={function(e) { setReason(e.target.value); }}
                placeholder="Tell us about your community, experience, and what kind of clashes you want to run..."
              />
            </div>

            <div className="bg-secondary/5 border border-secondary/20 rounded-sm p-3.5 text-xs text-on-surface/60 leading-relaxed">
              <strong className="text-secondary">What you get when approved:</strong> Your own Host Dashboard,
              ability to create public or private clashes, custom tournament rules, entry fee events (admin approved),
              and a Host badge on your profile.
            </div>

            <Btn v="primary" full onClick={submit}>Submit Application</Btn>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
