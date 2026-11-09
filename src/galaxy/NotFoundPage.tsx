import { followLink } from '../router'
import './galaxy.css'

export function NotFoundPage() {
  return (
    <main className="galaxy-gallery galaxy-not-found">
      <header className="galaxy-gallery-header">
        <h1>Not found</h1>
        <p>There's no background at this address.</p>
      </header>
      <a className="galaxy-back-link" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>
    </main>
  )
}
