import React, { useState, useRef } from "react";
import { C, F } from "../d17.js";

function Tooltip(props) {
  var ref = useRef(null);
  var timerRef = useRef(null);
  var state = useState(false);
  var show = state[0];
  var setShow = state[1];
  var posState = useState({ top: 0, left: 0 });
  var pos = posState[0];
  var setPos = posState[1];

  function onEnter(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    timerRef.current = setTimeout(function() { setShow(true); }, 200);
  }

  function onLeave() {
    clearTimeout(timerRef.current);
    setShow(false);
  }

  if (!props.text) return props.children;

  return React.createElement("span", {
    ref: ref,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    style: Object.assign({ position: "relative", display: "inline-flex" }, props.style || {}),
  },
    props.children,
    show && React.createElement("div", {
      style: {
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        background: C.surfaceHighest,
        border: "1px solid " + C.borderHover,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: F.body,
        color: C.text,
        whiteSpace: "nowrap",
        zIndex: 9999,
        pointerEvents: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        maxWidth: 280,
      }
    }, props.text)
  );
}

export default Tooltip;
