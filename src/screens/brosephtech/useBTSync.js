// useBTSync -- subscribes one or more BrosephTech tables to Supabase realtime
// changes and triggers a refetch via the supplied callback. Also refetches
// when the tab regains focus or comes back online so a friend (or a second
// device) always sees the same state as the owner.
//
// Usage:
//   useBTSync(['bt_content_cards'], loadCards);
//   useBTSync(['bt_hooks', 'bt_ideas'], loadAll);

import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function useBTSync(tables, refetch) {
  var refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(function() {
    if (!Array.isArray(tables) || tables.length === 0) return undefined;

    var debounceHandle = null;
    function scheduleRefetch() {
      if (debounceHandle) return;
      debounceHandle = setTimeout(function() {
        debounceHandle = null;
        if (refetchRef.current) refetchRef.current();
      }, 200);
    }

    var channelName = 'bt-sync-' + tables.slice().sort().join('-');
    var channel = supabase.channel(channelName);
    tables.forEach(function(table) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        function() { scheduleRefetch(); }
      );
    });
    channel.subscribe();

    function handleFocus() { scheduleRefetch(); }
    function handleVisibility() {
      if (document.visibilityState === 'visible') scheduleRefetch();
    }
    function handleOnline() { scheduleRefetch(); }
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return function() {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
        debounceHandle = null;
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      supabase.removeChannel(channel);
    };
  }, [tables.join('|')]);
}
