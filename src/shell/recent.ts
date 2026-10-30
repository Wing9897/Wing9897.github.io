import { useEffect, useState } from 'react'
import { getTool, type Tool } from '@/data/tools'

const STORAGE_KEY = 'recent-tools'
const CHANGE_EVENT = 'workbench-recent'

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 5)
  } catch {
    return []
  }
}

function writeIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // 隱私模式可能拒絕寫入。
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function rememberTool(id: string) {
  writeIds([id, ...readIds().filter((item) => item !== id)].slice(0, 5))
}

export function clearRecentTools() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略清除失敗。
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function resolveTools(ids: string[]): Tool[] {
  return ids.flatMap((id) => {
    const tool = getTool(id)
    return tool ? [tool] : []
  })
}

export function useRecentTools() {
  const [ids, setIds] = useState<string[]>(readIds)

  useEffect(() => {
    const sync = () => setIds(readIds())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { tools: resolveTools(ids), clear: clearRecentTools }
}
