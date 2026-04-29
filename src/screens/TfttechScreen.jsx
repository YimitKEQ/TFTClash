import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout';
import { Icon } from '../components/ui';

// TFTTech is the launcher that links to both private workspaces.
// The portal itself is unguarded; each child owns its own PIN gate.
//   - BrosephTech: PIN 1738, session key bt_unlocked
//   - TFT Clash Studio: PIN 133199, session key tcs_unlocked

function PortalCard(props) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group text-left bg-surface-container-low border border-outline-variant/15 rounded p-6 hover:border-primary/40 transition-colors flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-surface-container border border-outline-variant/15 flex items-center justify-center">
            <Icon name={props.icon} size={20} className="text-primary" />
          </div>
          <div>
            <div className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">
              {props.kicker}
            </div>
            <h2 className="font-display text-xl font-bold text-on-surface tracking-tight leading-tight mt-0.5">
              {props.title}
            </h2>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
      </div>

      <p className="text-sm text-on-surface/60 leading-relaxed">
        {props.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {props.features.map(function(f) {
          return (
            <span
              key={f}
              className="font-label text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-surface-container border border-outline-variant/10 text-on-surface/60"
            >
              {f}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <span className="font-mono text-[11px] text-on-surface/40 uppercase tracking-wider">
          {props.routeLabel}
        </span>
        <span className="flex items-center gap-1.5 font-label text-[11px] font-bold uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
          Enter
          <Icon name="arrow_forward" size={14} />
        </span>
      </div>
    </button>
  );
}

function StatusChip(props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline-variant/10">
      <Icon name={props.icon} size={14} className={props.color || 'text-primary'} />
      <div className="leading-tight">
        <div className="font-label text-[9px] uppercase tracking-widest font-bold text-on-surface/40">
          {props.label}
        </div>
        <div className="font-mono text-[11px] font-bold text-on-surface">
          {props.value}
        </div>
      </div>
    </div>
  );
}

function TfttechScreen() {
  var navigate = useNavigate();

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* OPS-STYLE HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon name="hub" size={32} className="text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse border-2 border-[#13131A]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-on-surface tracking-tight">TFTTech</h1>
              <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>Operator portal / Two brands, one control room</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip icon="memory" label="Brain" value="Gemini + Haiku" />
            <StatusChip icon="lock" label="Auth" value="PIN gates" />
            <StatusChip icon="bolt" label="Status" value="Live" color="text-success" />
          </div>
        </div>

        {/* PORTAL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PortalCard
            onClick={function() { navigate('/brosephtech'); }}
            kicker="Creator Brand"
            icon="auto_awesome"
            title="BrosephTech"
            description="Private command center for the Sebastian Lives content stack: planning, scripting, marketing lab, tier lists, and production SOPs."
            features={['Content Board', 'Schedule', 'Studio', 'Marketing Lab', 'Tier Lists', 'Metrics', 'SOPs']}
            routeLabel="/brosephtech"
          />

          <PortalCard
            onClick={function() { navigate('/content-engine'); }}
            kicker="Platform Engine"
            icon="bolt"
            title="TFT Clash Studio"
            description="Daily drop machine for the TFT Clash platform: nine surfaces (X, Reddit, TikTok, YT Shorts, IG, Threads, Bluesky, LinkedIn, Medium), one-click adapt, scheduler, and idea inbox."
            features={['Daily Drop', 'Idea Inbox', 'Generate', 'Library', 'Trends', 'Socials']}
            routeLabel="/content-engine"
          />
        </div>

        {/* SYSTEM ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4 flex items-center gap-3">
            <Icon name="memory" size={18} className="text-primary" />
            <div>
              <p className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">Primary brain</p>
              <p className="font-mono text-sm text-on-surface font-bold leading-none mt-1">Gemini 2.5 Flash</p>
            </div>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4 flex items-center gap-3">
            <Icon name="bolt" size={18} className="text-primary" />
            <div>
              <p className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">Fallback brain</p>
              <p className="font-mono text-sm text-on-surface font-bold leading-none mt-1">Claude Haiku 4.5</p>
            </div>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4 flex items-center gap-3">
            <Icon name="lock" size={18} className="text-primary" />
            <div>
              <p className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">Auth</p>
              <p className="font-mono text-sm text-on-surface font-bold leading-none mt-1">Per-property PINs</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default TfttechScreen;
