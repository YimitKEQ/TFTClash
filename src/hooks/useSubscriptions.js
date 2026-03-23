import { useApp } from '../context/AppContext'
import { hasFeature } from '../lib/tiers'

export function useSubscriptions() {
  var ctx = useApp()
  return {
    subscriptions: ctx.subscriptions,
    setSubscriptions: ctx.setSubscriptions,
    userTier: ctx.userTier,
    hasFeature: function(feat) { return hasFeature(ctx.userTier, feat); },
  }
}
