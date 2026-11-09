import styles from './VibekinMarquee.module.css'

const PHRASES = [
  'a family of vibes',
  'backgrounds that feel alive',
  'tune any mood',
  'copy, paste, vibe',
  'made in India',
] as const

/** One copy of the phrases, each followed by the kin blob so the loop seam has the same gap as everywhere else. */
function PhraseList({ hidden }: { hidden?: boolean }) {
  return (
    <ul className={styles.list} aria-hidden={hidden ? 'true' : undefined}>
      {PHRASES.map((phrase) => (
        <li key={phrase} className={styles.item}>
          <span>{phrase}</span>
          <img className={styles.icon} src="/vibekin-icon.svg" alt="" width={20} height={20} />
        </li>
      ))}
    </ul>
  )
}

/** A calm band of phrases sliding left between the hero and the library. */
export function VibekinMarquee() {
  return (
    <section className={styles.section} aria-label="About Vibekin">
      <div className={styles.band}>
        <div className={styles.track}>
          <PhraseList />
          <PhraseList hidden />
        </div>
      </div>
    </section>
  )
}
