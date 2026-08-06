import { useCallback, useRef, useState } from 'react'

type Cue = 'switch' | 'submit' | 'ready' | 'resolve' | 'conflict' | 'next'

class LabSynth {
  context?: AudioContext
  master?: GainNode

  async unlock() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return false
      this.context = new AudioCtor()
      this.master = this.context.createGain()
      this.master.gain.value = 0.7
      this.master.connect(this.context.destination)
    }
    if (this.context.state !== 'running') await this.context.resume()
    return this.context.state === 'running'
  }

  tone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (!this.context || !this.master) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(this.master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  play(cue: Cue) {
    if (!this.context || this.context.state !== 'running') return
    const now = this.context.currentTime
    if (cue === 'switch') this.tone(260, now, .045, .1, 'triangle')
    if (cue === 'submit') { this.tone(110, now, .1, .16); this.tone(440, now + .025, .075, .07, 'square') }
    if (cue === 'ready') { this.tone(330, now, .1, .12); this.tone(494, now + .09, .1, .14) }
    if (cue === 'resolve') { this.tone(196, now, .16, .14); this.tone(294, now + .1, .18, .14); this.tone(392, now + .2, .18, .18) }
    if (cue === 'conflict') { this.tone(110, now, .14, .16, 'sawtooth'); this.tone(138, now + .025, .11, .08, 'square') }
    if (cue === 'next') this.tone(147, now, .09, .12, 'triangle')
  }
}

export function useLabAudio() {
  const synth = useRef(new LabSynth())
  const [muted, setMuted] = useState(() => localStorage.getItem('shared_caravan_muted') === '1')
  const [ready, setReady] = useState(false)

  const play = useCallback(async (cue: Cue) => {
    if (muted) return
    try { const unlocked = await synth.current.unlock(); setReady(unlocked); if (unlocked) synth.current.play(cue) } catch { setReady(false) }
  }, [muted])

  const toggleMuted = useCallback(async () => {
    const next = !muted
    setMuted(next)
    localStorage.setItem('shared_caravan_muted', next ? '1' : '0')
    if (!next) {
      try { const unlocked = await synth.current.unlock(); setReady(unlocked); if (unlocked) synth.current.play('switch') } catch { setReady(false) }
    }
  }, [muted])

  return { muted, ready, play, toggleMuted }
}
