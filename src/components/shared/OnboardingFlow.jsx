import React, { useState } from 'react'
import { Btn, Inp, Icon } from '../ui'
import { supabase } from '../../lib/supabase'

function OnboardingFlow(props) {
  var currentUser = props.currentUser;
  var onComplete = props.onComplete;
  var onRegister = props.onRegister;
  var onRiotLinked = props.onRiotLinked;
  var nextClash = props.nextClash;
  var playerCount = props.playerCount || 0;

  var _step = useState(1);
  var step = _step[0];
  var setStep = _step[1];
  var _riotIdEu = useState("");
  var riotIdEu = _riotIdEu[0];
  var setRiotIdEu = _riotIdEu[1];
  var _riotIdNa = useState("");
  var riotIdNa = _riotIdNa[0];
  var setRiotIdNa = _riotIdNa[1];
  var _linking = useState(false);
  var linking = _linking[0];
  var setLinking = _linking[1];
  var _linkError = useState('');
  var linkError = _linkError[0];
  var setLinkError = _linkError[1];

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

  // Screen 2: Link Riot ID (EU + NA)
  if (step === 2) {
    var hasAnyId = (riotIdEu && riotIdEu.includes("#")) || (riotIdNa && riotIdNa.includes("#"));
    return (
      <div className="fixed inset-0 bg-[#08080F] flex flex-col items-center justify-center z-[10000] p-8">
        <div className="max-w-[360px] w-full text-center">
          <h2 className="display text-on-surface mb-2">Link Your Riot ID</h2>
          <p className="text-[13px] text-on-surface-variant mb-6">
            So we can track your placements and build your legacy. Add at least one.
          </p>
          <div className="text-left mb-1">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">EU (EUW / EUNE)</span>
          </div>
          <Inp
            placeholder="Name#TAG"
            value={riotIdEu}
            onChange={function(e) { setRiotIdEu(e.target.value); }}
            className="mb-4 text-center"
          />
          <div className="text-left mb-1">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">NA</span>
          </div>
          <Inp
            placeholder="Name#TAG"
            value={riotIdNa}
            onChange={function(e) { setRiotIdNa(e.target.value); }}
            className="mb-4 text-center"
          />
          <Btn
            v="primary"
            full={true}
            disabled={linking || !hasAnyId}
            onClick={function() {
              setLinking(true);
              setLinkError('');
              var update = {
                riot_id_eu: riotIdEu.trim() || null,
                riot_id_na: riotIdNa.trim() || null,
                riot_id: riotIdEu.trim() || riotIdNa.trim() || null
              };
              supabase
                .from("players")
                .update(update)
                .eq("auth_user_id", currentUser.auth_user_id || currentUser.id)
                .then(function(res) {
                  setLinking(false);
                  if (res.error) { setLinkError('Failed to save: ' + res.error.message); return; }
                  if (onRiotLinked) onRiotLinked(riotIdEu.trim(), riotIdNa.trim());
                  setStep(3);
                });
            }}
          >
            {linking ? "Linking..." : "Link Account"}
          </Btn>
          {linkError && (
            <div className="mt-2 text-xs text-red-400">{linkError}</div>
          )}
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
    var displayName = riotIdEu || riotIdNa || (currentUser ? currentUser.username : "Player");
    var displayRegion = riotIdEu ? "EU" : riotIdNa ? "NA" : "--";

    return (
      <div className="fixed inset-0 bg-[#08080F] flex flex-col items-center justify-center z-[10000] p-8">
        <div className="bg-surface-container border border-primary/30 rounded-xl px-6 py-7 max-w-[340px] w-full text-center">
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
              {"Next Clash: " + (nextClash || "This week")}
            </div>
            <div className="text-[10px] text-on-surface-variant">
              Status: Not yet registered
            </div>
          </div>
          <div className="text-xs text-primary mt-3">
            Every champion started here.
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Btn
            v="dark"
            onClick={function() {
              try { localStorage.setItem('tft-onboarding-done', '1'); } catch(e) {}
              if (onComplete) onComplete();
            }}
          >
            See the Leaderboard
          </Btn>
          <Btn
            v="primary"
            onClick={function() {
              try { localStorage.setItem('tft-onboarding-done', '1'); } catch(e) {}
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
