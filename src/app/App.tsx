import { useState } from 'react'
import { SnakeOilExample } from '../examples/snake-oil/SnakeOilExample'
import { PollywaffleExample } from '../examples/pollywaffle/PollywaffleExample'
import { isEmbedMode } from './embedMode'
import styles from './App.module.css'

type ViewKey = 'pollywaffle' | 'snake-oil-reference'

/**
 * Pollywaffle is the product this app ships: the default (and only
 * directly-navigable-to) view. Snake Oil remains reachable behind the
 * "reference" toggle below purely as an engine fixture — regression
 * testing, visual comparison, and proof the underlying BalloonRace engine
 * (src/balloon-race/) stays dataset-agnostic — not as a second product.
 * The toggle is part of the standalone app's own chrome, not the chart, so
 * it's hidden in embed mode (see embedMode.ts) along with
 * PollywaffleExample's own intro/methodology copy.
 */
export function App() {
  const [view, setView] = useState<ViewKey>('pollywaffle')
  const embedded = isEmbedMode()

  return (
    <div className={styles.app}>
      {!embedded && (
        <nav className={styles.referenceNav}>
          {view === 'snake-oil-reference' ? (
            <button type="button" className={styles.referenceNavButton} onClick={() => setView('pollywaffle')}>
              ← Back to Pollywaffle
            </button>
          ) : (
            <button
              type="button"
              className={styles.referenceNavButton}
              onClick={() => setView('snake-oil-reference')}
            >
              Engine reference: Snake Oil
            </button>
          )}
        </nav>
      )}
      {view === 'pollywaffle' ? <PollywaffleExample /> : <SnakeOilExample />}
    </div>
  )
}
