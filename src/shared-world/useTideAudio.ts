import { useCallback, useEffect, useRef, useState } from 'react'

type Cue = 'district' | 'trace' | 'reply' | 'anchor' | 'warning'

export function useTideAudio() {
  const [muted, setMuted] = useState(() => alteruLocalStorage.getItem('city-of-tides-muted') === '1')
  const contextRef = useRef<AudioContext | null>(null)

  const ensure = useCallback(() => {
    if (muted) return null
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!contextRef.current) contextRef.current = new Ctx()
    if (contextRef.current.state === 'suspended') contextRef.current.resume().catch(() => {})
    return contextRef.current
  }, [muted])

  const play = useCallback((cue: Cue) => {
    const ctx = ensure()
    if (!ctx) return
    const presets: Record<Cue, { notes: number[]; duration: number; gain: number }> = {
      district: { notes: [220, 330], duration: .09, gain: .03 },
      trace: { notes: [440, 550, 660], duration: .18, gain: .035 },
      reply: { notes: [330, 495], duration: .24, gain: .035 },
      anchor: { notes: [196, 392, 587], duration: .65, gain: .045 },
      warning: { notes: [140, 220], duration: .22, gain: .03 },
    }
    const preset = presets[cue]
    const start = ctx.currentTime
    preset.notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = cue === 'warning' ? 'sawtooth' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(.0001, start + index * .035)
      gain.gain.exponentialRampToValueAtTime(preset.gain, start + index * .035 + .018)
      gain.gain.exponentialRampToValueAtTime(.0001, start + preset.duration + index * .035)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start + index * .035)
      oscillator.stop(start + preset.duration + index * .035 + .03)
    })
  }, [ensure])

  const toggleMuted = useCallback(() => setMuted((current) => {
    const next = !current
    alteruLocalStorage.setItem('city-of-tides-muted', next ? '1' : '0')
    if (next) contextRef.current?.suspend().catch(() => {})
    return next
  }), [])

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) contextRef.current?.suspend().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return { muted, toggleMuted, play }
}
