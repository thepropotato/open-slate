// Synthesised rather than bundled: an audio file would need a web-accessible resource.
export function playChime(): void {
  try {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    const context = new AudioCtor()

    const note = (frequency: number, startAt: number, duration: number) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, context.currentTime + startAt)
      gain.gain.linearRampToValueAtTime(0.22, context.currentTime + startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + startAt + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + startAt)
      oscillator.stop(context.currentTime + startAt + duration)
    }

    note(880, 0, 0.5)
    note(1174.66, 0.16, 0.6)
    setTimeout(() => void context.close(), 1200)
  } catch {
    // Audio can be blocked outright; a silent timer still works.
  }
}
