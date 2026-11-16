import { useEffect, useState } from 'react'
import type { StorageSchema } from './shared/types'
import ReviewPanel from './ReviewPanel'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void chrome.storage.local.get('apiKey').then((data) => {
      setHasKey(Boolean((data as Partial<StorageSchema>).apiKey))
    })
  }, [])

  async function save() {
    const key = apiKey.trim()
    if (!key) return
    await chrome.storage.local.set({ apiKey: key } satisfies Partial<StorageSchema>)
    setApiKey('')
    setHasKey(true)
    setStatus('Ключ сохранён')
  }

  return (
    <main style={{ padding: 16, minWidth: 300 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Grammar Coach</h1>
      <ReviewPanel />
      <p style={{ margin: '0 0 8px' }}>
        Anthropic API-ключ: {hasKey ? 'задан' : 'не задан'}
      </p>
      <input
        type="password"
        placeholder="sk-ant-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <button type="button" onClick={() => void save()} disabled={!apiKey.trim()}>
        Сохранить
      </button>
      {status && <p>{status}</p>}
    </main>
  )
}

export default App
