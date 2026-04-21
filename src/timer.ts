export class MeditationTimer {
  private duration: number
  private startTime: number = 0
  private tickId: number | null = null
  private onComplete: () => void

  constructor(minutes: number, onComplete: () => void) {
    this.duration = minutes * 60 * 1000
    this.onComplete = onComplete
  }

  start() {
    this.startTime = Date.now()
    this.schedule()
  }

  private schedule() {
    const elapsed = Date.now() - this.startTime
    const remaining = this.duration - elapsed
    if (remaining <= 0) {
      this.onComplete()
      return
    }
    this.tickId = window.setTimeout(() => {
      this.onComplete()
    }, remaining)
  }

  stop() {
    if (this.tickId !== null) {
      clearTimeout(this.tickId)
      this.tickId = null
    }
  }
}
