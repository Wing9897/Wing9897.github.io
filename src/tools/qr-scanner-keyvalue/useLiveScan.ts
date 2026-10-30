import { useCallback, useEffect, useRef, useState } from 'react'
import { attachCamera, startQrLoop } from '@/lib'

export type CameraPhase = 'idle' | 'starting' | 'live' | 'error'

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
}

function cameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return '無法啟動攝像頭，請允許相機權限'
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') return '找不到攝像頭'
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') return '攝像頭被其他程式佔用'
    if (err.name === 'SecurityError') return '無法啟動攝像頭，需要 HTTPS'
  }
  if (err instanceof Error && err.message) return err.message
  return '無法啟動攝像頭'
}

export function useLiveScan(onHit: (data: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stopCamera = useRef<(() => void) | null>(null)
  const stopLoop = useRef<(() => void) | null>(null)
  const onHitRef = useRef(onHit)
  const generation = useRef(0)
  onHitRef.current = onHit

  const [phase, setPhase] = useState<CameraPhase>('idle')
  const [error, setError] = useState('')

  const halt = useCallback(() => {
    stopLoop.current?.()
    stopLoop.current = null
    const release = stopCamera.current
    stopCamera.current = null
    release?.()
  }, [])

  const start = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const gen = ++generation.current
    halt()
    setPhase('starting')
    setError('')
    try {
      const release = await attachCamera(video, CAMERA_CONSTRAINTS)
      if (gen !== generation.current) {
        release()
        return
      }
      stopCamera.current = release
      stopLoop.current = startQrLoop(video, canvas, (hit) => {
        onHitRef.current(hit.data)
      })
      setPhase('live')
    } catch (err) {
      if (gen !== generation.current) return
      setPhase('error')
      setError(cameraError(err))
    }
  }, [halt])

  const stop = useCallback(() => {
    generation.current += 1
    halt()
    setPhase('idle')
    setError('')
  }, [halt])

  useEffect(() => {
    void start()
    return () => {
      generation.current += 1
      halt()
    }
  }, [halt, start])

  return { videoRef, canvasRef, phase, error, start, stop }
}
