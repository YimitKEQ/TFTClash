import * as Sentry from '@sentry/react';

// withRetry - run a Supabase write with automatic retry on transient failure.
// opFn must RETURN a fresh query promise each call (supabase queries are
// one-shot thenables, so the caller passes a factory, not a promise).
// Retries up to `retries` times (default 2) with linear backoff + jitter so
// simultaneous clients don't re-stampede the API. Resolves with the final
// result object ({ data, error }) and never rejects; the last failure is
// reported to Sentry so silent player-facing write failures become visible.
export function withRetry(opFn, label, retries) {
  var max = typeof retries === 'number' ? retries : 2;

  function backoff(n) {
    var ms = (n + 1) * 1200 + Math.floor(Math.random() * 800);
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function report(err) {
    try {
      var msg = err && err.message ? err.message : 'unknown';
      Sentry.captureMessage('[db-write] ' + (label || 'op') + ' failed after retries: ' + msg, 'error');
    } catch (e) {}
  }

  function attempt(n) {
    var p;
    try {
      p = Promise.resolve(opFn());
    } catch (e) {
      p = Promise.resolve({ error: e });
    }
    return p.then(function(res) {
      if (!res || !res.error) return res || {};
      if (n >= max) { report(res.error); return res; }
      return backoff(n).then(function() { return attempt(n + 1); });
    }).catch(function(e) {
      if (n >= max) { report(e); return { error: e }; }
      return backoff(n).then(function() { return attempt(n + 1); });
    });
  }

  return attempt(0);
}
