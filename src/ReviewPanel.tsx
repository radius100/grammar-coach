import { useEffect, useState } from 'react'
import { selectDueMistakes } from './shared/mistakes'
import type {
  ResponseFor,
  ReviewMistakeMessage,
  SavedMistakeRecord,
  Sm2Quality,
  StorageSchema,
} from './shared/types'

const RATINGS: { label: string; quality: Sm2Quality }[] = [
  { label: 'Не вспомнил', quality: 1 },
  { label: 'С трудом', quality: 3 },
  { label: 'Легко', quality: 5 },
]

interface CardProps {
  record: SavedMistakeRecord
  busy: boolean
  onRate: (quality: Sm2Quality) => void
}

function MistakeCard({ record, busy, onRate }: CardProps) {
  // Controlled by the user's own typing only; never prefilled or checked by the extension.
  const [answer, setAnswer] = useState('')

  return (
    <section style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>
        {record.ruleCode} <small>({record.language}, ошибок: {record.errorCount})</small>
      </h2>
      <p style={{ margin: '0 0 8px' }}>{record.explanation}</p>
      <p style={{ margin: '0 0 8px' }}>Ваша ошибка: «{record.lastQuote}»</p>
      <p style={{ margin: '0 0 8px' }}>Подсказка: {record.lastHint}</p>
      <textarea
        placeholder="Напишите правильный вариант сами"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={2}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        {RATINGS.map(({ label, quality }) => (
          <button key={quality} type="button" disabled={busy} onClick={() => onRate(quality)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

function ReviewPanel() {
  const [total, setTotal] = useState(0)
  const [due, setDue] = useState<SavedMistakeRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void chrome.storage.local.get('mistakes').then((data) => {
      const mistakes = (data as Partial<StorageSchema>).mistakes ?? {}
      setTotal(Object.keys(mistakes).length)
      setDue(selectDueMistakes(mistakes, Date.now()))
    })
  }, [])

  async function rate(id: string, quality: Sm2Quality) {
    setBusy(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage<
        ReviewMistakeMessage,
        ResponseFor<ReviewMistakeMessage>
      >({ type: 'REVIEW_MISTAKE', payload: { id, quality } })
      if (response.ok) setDue((list) => list.filter((r) => r.id !== id))
      else setError(response.error)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const current = due[0]

  return (
    <div style={{ marginBottom: 16 }}>
      {current ? (
        <>
          <p style={{ margin: '0 0 8px' }}>К повторению: {due.length}</p>
          <MistakeCard
            key={current.id}
            record={current}
            busy={busy}
            onRate={(quality) => void rate(current.id, quality)}
          />
        </>
      ) : (
        <p style={{ margin: 0 }}>Нет ошибок к повторению (сохранено типов ошибок: {total})</p>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}

export default ReviewPanel
