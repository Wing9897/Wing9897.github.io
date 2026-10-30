import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type SortMode = 'registry' | 'name'

export interface WorkbenchPrefs {
  sort: SortMode
  showDescription: boolean
  note: string
}

const STORAGE_KEY = 'workbench-prefs'

const DEFAULT_PREFS: WorkbenchPrefs = {
  sort: 'registry',
  showDescription: true,
  note: '',
}

function readPrefs(): WorkbenchPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS
    const record = parsed as Partial<WorkbenchPrefs>
    return {
      sort: record.sort === 'name' ? 'name' : 'registry',
      showDescription: record.showDescription !== false,
      note: typeof record.note === 'string' ? record.note : '',
    }
  } catch {
    return DEFAULT_PREFS
  }
}

type PrefsContextValue = {
  prefs: WorkbenchPrefs
  updatePrefs: (patch: Partial<WorkbenchPrefs>) => void
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<WorkbenchPrefs>(readPrefs)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // 隱私模式可能拒絕寫入。
    }
  }, [prefs])

  const value: PrefsContextValue = {
    prefs,
    updatePrefs: (patch) => setPrefs((current) => ({ ...current, ...patch })),
  }

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const value = useContext(PrefsContext)
  if (!value) throw new Error('usePrefs 必須在 PrefsProvider 內使用')
  return value
}
