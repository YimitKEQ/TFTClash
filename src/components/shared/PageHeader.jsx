export default function PageHeader({ title, subtitle, description, goldWord, grid }) {
  return (
    <header className="relative text-center mb-16">
      {grid && (
        <div aria-hidden="true" className="tactical-grid absolute inset-0 -z-10 pointer-events-none"></div>
      )}
      {subtitle && (
        <div className="flex justify-center mb-4">
          <span className="brand-eyebrow">{subtitle}</span>
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
