/**
 * dmQueue.js — small in-process queue for sending DMs without tripping
 * Discord's per-bot DM ceiling (~5/s). Concurrency-bounded; each task is an
 * async function and its result/error is captured per-item.
 *
 * No external deps — keeps the bot's footprint small.
 */

var DEFAULT_CONCURRENCY = 5;
var MIN_INTERVAL_MS = 220; // ~4.5 dispatches/sec, headroom under the 5/s soft cap

var state = {
  active: 0,
  pending: [],
  lastStartAt: 0,
};

function schedule(concurrency) {
  while (state.active < concurrency && state.pending.length) {
    var now = Date.now();
    var wait = Math.max(0, MIN_INTERVAL_MS - (now - state.lastStartAt));
    if (wait > 0) {
      // Spread out start times to avoid bursty 5-in-the-same-tick patterns.
      setTimeout(function() { schedule(concurrency); }, wait);
      return;
    }
    var item = state.pending.shift();
    state.active += 1;
    state.lastStartAt = Date.now();
    Promise.resolve()
      .then(item.task)
      .then(function(value) { item.resolve(value); })
      .catch(function(err) { item.reject(err); })
      .finally(function() {
        state.active -= 1;
        schedule(concurrency);
      });
  }
}

/**
 * enqueue(task, opts?) — adds an async function to the queue. Returns a
 * Promise that resolves with the task's return value or rejects with its error.
 *
 * task: () => Promise<any>
 * opts.concurrency: optional override (default 5)
 */
export function enqueue(task, opts) {
  var concurrency = (opts && opts.concurrency) || DEFAULT_CONCURRENCY;
  return new Promise(function(resolve, reject) {
    state.pending.push({ task: task, resolve: resolve, reject: reject });
    schedule(concurrency);
  });
}

/**
 * runAll(items, fn, opts?) — convenience: run fn(item) for every item with
 * the same concurrency. Resolves to a list of { item, ok, value, error }.
 */
export function runAll(items, fn, opts) {
  var jobs = items.map(function(item) {
    return enqueue(function() {
      return Promise.resolve(fn(item)).then(function(value) {
        return { item: item, ok: true, value: value };
      }).catch(function(err) {
        return { item: item, ok: false, error: err };
      });
    }, opts);
  });
  return Promise.all(jobs);
}

export function pendingCount() { return state.pending.length; }
export function activeCount() { return state.active; }
