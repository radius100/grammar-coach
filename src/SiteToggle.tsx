import { useEffect, useState } from 'react'
import { isSiteDisabled, normalizeHost, setSiteDisabled } from './shared/site-filter'
import type { StorageSchema } from './shared/types'

function SiteToggle() {
  // undefined — загрузка, null — страница не поддерживается
  const [host, setHost] = useState<string | null | undefined>(undefined)
  const [disabledSites, setDisabledSites] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.storage.local.get('disabledSites'),
    ]).then(([tabs, data]) => {
      setHost(normalizeHost(tabs[0]?.url ?? ''))
      setDisabledSites((data as Partial<StorageSchema>).disabledSites ?? [])
    })
  }, [])

  if (host === undefined) return null

  if (host === null) {
    return <p style={{ margin: '0 0 12px' }}>Проверка недоступна на этой странице</p>
  }

  const disabled = isSiteDisabled('https://' + host, disabledSites)
  const viaParent = disabled && !disabledSites.includes(host)

  async function onChange(checked: boolean) {
    if (host === null || host === undefined) return
    const next = setSiteDisabled(disabledSites, host, !checked)
    await chrome.storage.local.set({ disabledSites: next } satisfies Partial<StorageSchema>)
    setDisabledSites(next)
  }

  return (
    <div style={{ margin: '0 0 12px' }}>
      <label>
        <input
          type="checkbox"
          checked={!disabled}
          disabled={viaParent}
          onChange={(e) => void onChange(e.target.checked)}
        />{' '}
        Проверять на {host}
      </label>
      {viaParent && <p style={{ margin: '4px 0 0' }}>Отключено для родительского домена</p>}
    </div>
  )
}

export default SiteToggle
