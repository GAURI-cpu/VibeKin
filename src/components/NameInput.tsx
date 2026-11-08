import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import './nameInput.css'

type NameInputProps = {
  /** Called 450ms after typing stops, or at once on "Write it" / Enter. */
  onWrite: (name: string) => void
  /** Extra buttons shown next to the hint, such as "Save as image". */
  actions?: ReactNode
  /** 'glass' sits on a dark sky; 'paper' sits on the site's cozy paper. */
  tone?: 'glass' | 'paper'
}

export function NameInput({ onWrite, actions, tone = 'glass' }: NameInputProps) {
  const id = useId()
  const [value, setValue] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div className="name-input" data-tone={tone}>
      <form
        className="name-input-pill"
        onSubmit={(event) => {
          event.preventDefault()
          window.clearTimeout(timer.current)
          onWrite(value.trim())
        }}
      >
        <label className="name-input-label" htmlFor={id}>
          Your name
        </label>
        <input
          id={id}
          type="text"
          maxLength={14}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type your name"
          value={value}
          onChange={(event) => {
            const next = event.target.value
            setValue(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => onWrite(next.trim()), 450)
          }}
        />
        <button type="submit">Write it</button>
      </form>
      <div className="name-input-hint">
        <p>Your name becomes a constellation · move your cursor to light the stars</p>
        {actions && <div className="name-input-actions">{actions}</div>}
      </div>
    </div>
  )
}
