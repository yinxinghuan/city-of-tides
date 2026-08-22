import { useCallback, useEffect, useRef, useState } from 'react'

type Cue = 'district' | 'trace' | 'reply' | 'anchor' | 'warning'
const themeUrl = new URL('../story/audio/assets/theme.mp3', import.meta.url).href
const ambienceUrl = new URL('../story/audio/assets/ambience.mp3', import.meta.url).href
const featureUrl = new URL('../story/audio/assets/feature.mp3', import.meta.url).href
const MUSIC_REPEAT_MS = 30_000
const AMBIENCE_REPEAT_MS = 7_000
const FEATURE_COOLDOWN_MS = 180_000
const CUE_COOLDOWN_MS = 360

export function useTideAudio() {
  const [muted, setMuted] = useState(() => alteruLocalStorage.getItem('city-of-tides-muted') === '1')
  const mutedRef = useRef(muted)
  const contextRef = useRef<AudioContext | null>(null)
  const themeRef = useRef<HTMLAudioElement | null>(null)
  const ambienceRef = useRef<HTMLAudioElement | null>(null)
  const featureRef = useRef<HTMLAudioElement | null>(null)
  const featureLastPlayedRef = useRef(-Infinity)
  const themeTimerRef = useRef<number>()
  const ambienceTimerRef = useRef<number>()
  const playPendingRef = useRef(new Set<HTMLAudioElement>())
  const lastCueAtRef = useRef(-Infinity)

  const clearReplay = useCallback(() => {
    window.clearTimeout(themeTimerRef.current)
    window.clearTimeout(ambienceTimerRef.current)
    themeTimerRef.current = undefined
    ambienceTimerRef.current = undefined
  }, [])

  const playRecorded = useCallback((allowMuted = false) => {
    if ((!allowMuted && mutedRef.current) || document.hidden || typeof Audio === 'undefined') return
    if (!themeRef.current) {
      const audio = new Audio(themeUrl)
      audio.preload = 'auto'
      audio.volume = .14
      audio.onended = () => {
        if (mutedRef.current || document.hidden) return
        themeTimerRef.current = window.setTimeout(() => {
          audio.currentTime = 0
          playRecorded()
        }, MUSIC_REPEAT_MS)
      }
      themeRef.current = audio
    }
    if (!ambienceRef.current) {
      const audio = new Audio(ambienceUrl)
      audio.preload = 'auto'
      audio.volume = .18
      audio.onended = () => {
        if (mutedRef.current || document.hidden) return
        ambienceTimerRef.current = window.setTimeout(() => {
          audio.currentTime = 0
          playRecorded()
        }, AMBIENCE_REPEAT_MS)
      }
      ambienceRef.current = audio
    }
    const beds = featureRef.current ? [ambienceRef.current] : [themeRef.current, ambienceRef.current]
    beds.forEach((audio) => {
      if (!audio || !audio.paused || playPendingRef.current.has(audio)) return
      playPendingRef.current.add(audio)
      void audio.play().catch(() => undefined).finally(() => playPendingRef.current.delete(audio))
    })
  }, [])

  const stopFeature = useCallback((resumeTheme: boolean) => {
    const feature = featureRef.current
    if (!feature) return
    feature.onended = null
    feature.pause()
    featureRef.current = null
    if (resumeTheme && !mutedRef.current && !document.hidden) playRecorded()
  }, [playRecorded])

  const playFeature = useCallback(() => {
    if (mutedRef.current || document.hidden || featureRef.current || Date.now() - featureLastPlayedRef.current < FEATURE_COOLDOWN_MS) return false
    const feature = new Audio(featureUrl)
    feature.preload = 'auto'
    feature.volume = .16
    window.clearTimeout(themeTimerRef.current)
    themeTimerRef.current = undefined
    themeRef.current?.pause()
    featureRef.current = feature
    const finish = () => {
      if (featureRef.current !== feature) return
      featureRef.current = null
      if (!mutedRef.current && !document.hidden) playRecorded()
    }
    feature.onended = finish
    void feature.play()
      .then(() => { featureLastPlayedRef.current = Date.now() })
      .catch(finish)
    return true
  }, [playRecorded])

  const pauseRecorded = useCallback(() => {
    stopFeature(false)
    clearReplay()
    themeRef.current?.pause()
    ambienceRef.current?.pause()
  }, [clearReplay, stopFeature])

  const ensure = useCallback(() => {
    if (muted) return null
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!contextRef.current) contextRef.current = new Ctx()
    if (contextRef.current.state === 'suspended') contextRef.current.resume().catch(() => {})
    return contextRef.current
  }, [muted])

  const play = useCallback((cue: Cue) => {
    const now = performance.now()
    if (now - lastCueAtRef.current < CUE_COOLDOWN_MS) return
    lastCueAtRef.current = now
    const ctx = ensure()
    if (!ctx) return
    playRecorded()
    if (cue === 'anchor' && playFeature()) return
    const presets: Record<Cue, { notes: number[]; duration: number; gain: number }> = {
      district: { notes: [220], duration: .09, gain: .017 },
      trace: { notes: [440, 660], duration: .16, gain: .019 },
      reply: { notes: [330, 495], duration: .22, gain: .019 },
      anchor: { notes: [196, 392], duration: .55, gain: .024 },
      warning: { notes: [140], duration: .2, gain: .017 },
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
  }, [ensure, playFeature, playRecorded])

  const toggleMuted = useCallback(() => setMuted((current) => {
    const next = !current
    mutedRef.current = next
    alteruLocalStorage.setItem('city-of-tides-muted', next ? '1' : '0')
    if (next) {
      contextRef.current?.suspend().catch(() => {})
      pauseRecorded()
    } else {
      contextRef.current?.resume().catch(() => {})
      playRecorded(true)
    }
    return next
  }), [pauseRecorded, playRecorded])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        contextRef.current?.suspend().catch(() => {})
        pauseRecorded()
      } else if (!muted) {
        contextRef.current?.resume().catch(() => {})
        playRecorded()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [muted, pauseRecorded, playRecorded])

  useEffect(() => () => {
    pauseRecorded()
    themeRef.current = null
    ambienceRef.current = null
    contextRef.current?.close().catch(() => {})
    contextRef.current = null
  }, [pauseRecorded])

  return { muted, toggleMuted, play }
}
