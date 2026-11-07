import './lightToggle.css'

type LightToggleProps = {
  dim: boolean
  onToggle: () => void
}

export function LightToggle({ dim, onToggle }: LightToggleProps) {
  const label = dim ? 'Brighten the lights' : 'Dim the lights'
  return (
    <button
      type="button"
      className="light-toggle"
      data-dim={dim || undefined}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <svg viewBox="-4 -4 32 32" aria-hidden="true">
        <g className="light-rays">
          <path d="M12-2.5v2.6M2.4 1.4l1.9 1.9M21.6 1.4l-1.9 1.9M-1.5 10h2.6M25.5 10h-2.6" />
        </g>
        <path
          className="light-glass"
          d="M12 3.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.2 1 2h6c0-.8.3-1.4 1-2a6.5 6.5 0 0 0-4-11.6Z"
        />
        <path d="M9.4 20.2h5.2M10.6 23h2.8" />
      </svg>
    </button>
  )
}
