export default function Skeleton({ className = '', ...props }) {
  return (
    <div className={`bg-surface-container-high animate-pulse rounded ${className}`} {...props} />
  )
}
