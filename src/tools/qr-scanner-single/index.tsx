import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner, Button, Field } from '@/components/ui'
import './tool.css'
import { useLiveScan, type CameraPhase } from './useLiveScan'

const MISS_MS = 450

let tone: AudioContext | null = null

function playMatchTone() {
  const Ctx = window.AudioContext
  if (!Ctx) return
  try {
    tone ??= new Ctx()
    if (tone.state === 'suspended') void tone.resume()
    const osc = tone.createOscillator()
    const gain = tone.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.connect(gain)
    gain.connect(tone.destination)
    const now = tone.currentTime
    osc.start(now)
    osc.stop(now + 0.12)
  } catch {
    tone = null
  }
}

function emphasize(text: string, query: string): ReactNode {
  if (!query) return text
  const parts: ReactNode[] = []
  let cursor = 0
  let index = text.indexOf(query, cursor)
  let key = 0
  if (index < 0) return text
  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(<mark key={key}>{query}</mark>)
    key += 1
    cursor = index + query.length
    index = text.indexOf(query, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function cameraLabel(phase: CameraPhase): string {
  if (phase === 'starting') return '正在啟動相機…'
  if (phase === 'live') return '相機已就緒'
  if (phase === 'error') return '相機啟動失敗'
  return '相機已停止'
}

export default function Tool() {
  const [search, setSearch] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const codeRef = useRef<string | null>(null)
  const missTimer = useRef(0)
  const wasMatch = useRef(false)

  const onHit = useCallback((data: string) => {
    window.clearTimeout(missTimer.current)
    if (codeRef.current !== data) {
      codeRef.current = data
      setCode(data)
    }
    missTimer.current = window.setTimeout(() => {
      codeRef.current = null
      setCode(null)
    }, MISS_MS)
  }, [])

  const camera = useLiveScan(onHit)

  useEffect(() => () => window.clearTimeout(missTimer.current), [])

  const query = search.trim()
  const matched = Boolean(query && code?.includes(query))

  useEffect(() => {
    if (matched && !wasMatch.current) playMatchTone()
    wasMatch.current = matched
  }, [matched])

  const status = camera.phase === 'error'
    ? '無法啟動攝像頭'
    : camera.phase === 'starting'
      ? '正在啟動相機…'
      : camera.phase === 'idle'
        ? '相機已停止'
        : matched
          ? '找到匹配！'
          : '掃描中…'

  return (
    <div className="qrs-root">
      <div className="qrs-search">
        <Field
          label="搜索文字"
          placeholder="輸入文字快速搜索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="ghost"
          onClick={() => setSearch('')}
        >
          清除
        </Button>
      </div>
      <p className="qrs-hint">比對目前畫面中的 QR 內容是否包含這段文字。有比對到會高亮這筆記錄。</p>

      <div className="qrs-actions">
        <Button
          className="qrs-stop"
          variant={camera.phase === 'live' ? 'danger' : 'primary'}
          onClick={() => {
            if (camera.phase === 'live' || camera.phase === 'starting') camera.stop()
            else void camera.start()
          }}
        >
          {camera.phase === 'live' || camera.phase === 'starting' ? '停止掃描' : '開始掃描'}
        </Button>
        <div className="qrs-chips">
          <span className={`qrs-chip is-${camera.phase}`}>{cameraLabel(camera.phase)}</span>
          <span className={`qrs-chip${matched ? ' is-match' : ''}`} role="status">
            {status}
          </span>
        </div>
      </div>

      {camera.error ? <Banner tone="danger">{camera.error}</Banner> : null}

      <div className="qrs-stage">
        <video ref={camera.videoRef} className="qrs-video" muted playsInline autoPlay />
        <canvas ref={camera.canvasRef} className="qrs-canvas" aria-hidden />
      </div>

      <ul className="qrs-results" aria-live="polite">
        {code ? (
          <li className={matched ? 'is-match' : 'is-idle'}>
            QR Code: {emphasize(code, query)}
            {matched ? ' (已匹配)' : null}
          </li>
        ) : (
          <li className="is-idle">未檢測到 QR Code</li>
        )}
      </ul>
    </div>
  )
}
