import React from 'react'
import { Icon } from '../ui'

function ClashReminderBtn(props) {
  var toast = props.toast;
  var enabled = props.enabled;
  var setEnabled = props.setEnabled;

  function requestNotif() {
    if (!("Notification" in window)) {
      if (toast) toast("Browser doesn't support notifications", "error");
      return;
    }
    if (Notification.permission === "granted") {
      setEnabled(true);
      if (toast) toast("Clash reminders enabled!", "success");
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function(perm) {
        if (perm === "granted") {
          setEnabled(true);
          if (toast) toast("Clash reminders enabled!", "success");
        } else {
          if (toast) toast("Notification permission denied", "error");
        }
      });
    } else {
      if (toast) toast("Notifications blocked. Enable in browser settings.", "error");
    }
  }

  return (
    <button
      onClick={function() {
        if (enabled) {
          setEnabled(false);
          if (toast) toast("Reminders disabled", "info");
        } else {
          requestNotif();
        }
      }}
      className={
        "flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-[13px] font-semibold font-body transition-all border " +
        (enabled
          ? "bg-tertiary/10 border-tertiary/40 text-tertiary"
          : "bg-primary/[.08] border-primary/20 text-primary-light")
      }
    >
      <Icon name={enabled ? "notifications" : "notifications_off"} className="text-base" />
      {enabled ? "Reminders On" : "Enable Clash Reminders"}
    </button>
  );
}

export default ClashReminderBtn;
