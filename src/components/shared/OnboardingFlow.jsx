import React, { useState } from 'react'
import { Btn, Inp, Icon } from '../ui'
import { supabase } from '../../lib/supabase'
import { REGIONS } from '../../lib/constants'

function OnboardingFlow(props) {
  var currentUser = props.currentUser;
  var onComplete = props.onComplete;
  var onRegister = props.onRegister;
  var nextClash = props.nextClash;
  var playerCount = props.playerCount || 0;

  var _step = useState(1);
  var step = _step[0];
  var setStep = _step[1];
  var _riotId = useState("");
  var riotId = _riotId[0];
  var setRiotId = _riotId[1];
  var _region = useState("EUW");
  var region = _region[0];
  var setRegion = _region[1];
  var _linking = useState(false);
  var linking = _linking[0];
  var setLinking = _linking[1];

  // Screen 1: Welcome cinematic
  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-[#08080F] flex flex-col items-center justify-center z-[10000] text-center p-8">
        <div className="text-sm text-amber-400 font-bold animate-fade-in">
          {"Welcome, " + (currentUser ? currentUser.username : "Player") + "."}
        </div>
        <div className="text-[13px] text-on-surface-variant mt-4 animate-fade-in-slow">
          Your story starts now.
        </div>
        <div className="mt-8 animate-fade-in-slower">
          <Btn v="primary" onClick={function() { setStep(2); }}>Enter the Arena</Btn>
        </div>
      </div>
    );
  }

  // Screen 2: Link Riot ID
  if (step === 2) {
    return (
      <div className="fixed inset-0 bg-[#08080F] flex flex-col items-center justify-center z-[10000] p-8">
        <div className="max-w-[360px] w-full text-center">
          <h2 className="display text-on-surface mb-2">Link Your Riot ID</h2>
          <p className="text-[13px] text-on-surface-variant mb-6">
            So we can track your placements and build your legacy.
          </p>
          <Inp
            placeholder="Name#TAG"
            value={riotId}
            onChange={function(e) { setRiotId(e.target.value); }}
            className="mb-3 text-center"
          />
          <select
            value={region}
            onChange={function(e) { setRegion(e.target.value); }}
            className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface-container border border-white/10 text-on-surface text-[13px] mb-4"
          >
            {REGIONS.map(function(r) {
              return <option key={r} value={r}>{r}</option>;
            })}
          </select>
          <Btn
            v="primary"
            full={true}
            disabled={linking}
            onClick={function() {
              if (!riotId.includes("#")) return;
              setLinking(true);
              supabase
                .from("user_profiles")
                .update({ riot_id: riotId, region: region, onboarding_step: 3 })
                .eq("user_id", currentUser.id)
                .then(function() {
                  setLinking(false);
                  setStep(3);
                });
            }}
          >
            {linking ? "Linking..." : "Link Account"}
          </Btn>
          <div
            className="mt-3 text-xs text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors"
            onClick={function() { setStep(3); }}
          >
            Skip for now
          </div>
        </div>
      </div>
    );
  }

  // Screen 3: Your Player Card
  if (step === 3) {
    var displayName = riotId || (currentUser ? currentUser.username : "Player");
    var displayRegion = region || "EUW";

    return (
      <div className="fixed inset-0 bg-[#08080F] flex flex-col items-center justify-center z-[10000] p-8">
        <div className="bg-surface-container border border-primary/30 rounded-2xl px-6 py-7 max-w-[340px] w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-tertiary/15 flex items-center justify-center mx-auto mb-3 border-2 border-primary/40">
            <Icon name="person" className="text-[22px] text-primary-light" />
          </div>
          <div className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
            Unranked
          </div>
          <div className="text-xl font-bold text-on-surface mb-1">
            {currentUser ? currentUser.username : "Player"}
          </div>
          <div className="text-xs text-on-surface-variant mb-3">
            {displayName + " - " + displayRegion}
          </div>
          <div className="text-xs text-on-surface-variant mb-4">
            0 pts - 0 clashes
          </div>
          <div className="border-t border-white/[.08] pt-3">
            <div className="text-[11px] text-on-surface-variant mb-1">
              {"Next Clash: " + (nextClash || "Saturday")}
            </div>
            <div className="text-[10px] text-on-surface-variant">
              Status: Not yet registered
            </div>
          </div>
          <div className="text-xs italic text-primary mt-3">
            Every champion started here.
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Btn
            v="dark"
            onClick={function() {
              supabase.from("user_profiles").update({ onboarding_complete: true, onboarding_step: 4 }).eq("user_id", currentUser.id);
              if (onComplete) onComplete();
            }}
          >
            See the Leaderboard
          </Btn>
          <Btn
            v="primary"
            onClick={function() {
              supabase.from("user_profiles").update({ onboarding_complete: true, onboarding_step: 4 }).eq("user_id", currentUser.id);
              if (onRegister) onRegister();
              if (onComplete) onComplete();
            }}
          >
            Register for Clash
          </Btn>
        </div>
      </div>
    );
  }

  return null;
}

export default OnboardingFlow;
