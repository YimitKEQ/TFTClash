function Sel(props) {
  var value = props.value;
  var onChange = props.onChange;
  var children = props.children;
  var className = props.className || '';
  return (
    <select
      value={value}
      onChange={function(e) { onChange(e.target.value); }}
      className={'w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40 ' + className}
    >
      {children}
    </select>
  );
}

export default Sel;
