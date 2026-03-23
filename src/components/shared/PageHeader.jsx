export default function PageHeader({ title, subtitle, description, goldWord }) {
  return (
    <header className="text-center mb-16 relative">
      {subtitle && (
        <div className="inline-block mb-4 px-6 py-1 bg-tertiary-container/10 text-tertiary font-sans uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm">
          {subtitle}
        </div>
      )}
      <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tight leading-none mb-4">
        {goldWord ? (
          <>{title} <span className="gold-gradient-text">{goldWord}</span></>
        ) : title}
      </h1>
      {description && (
        <p className="max-w-2xl mx-auto text-on-surface-variant text-lg leading-relaxed italic">
          {description}
        </p>
      )}
    </header>
  )
}
