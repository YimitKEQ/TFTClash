function Sparkline(props) {
  var data = props.data;
  var color = props.color || "#E8A838";
  var w = typeof props.width === "number" ? props.width : (typeof props.w === "number" ? props.w : 80);
  var h = props.height || props.h || 28;

  if (!data || data.length < 2) return null;

  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;

  var pts = data.map(function(v, i) {
    return (i / (data.length - 1)) * w + "," + (h - ((v - min) / range) * (h - 4) + 2);
  }).join(" ");

  var fill = pts + " " + w + "," + h + " 0," + h;
  var gid = "sg" + (color || "gold").replace(/[^a-z0-9]/gi, "");

  return (
    <svg width={w} height={h} style={{overflow: "visible", flexShrink: 0, display: "block"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={"url(#" + gid + ")"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default Sparkline;
