import { BreathAnimation } from './breath'
import { MeditationTimer } from './timer'
import ziData from './data/zi.json'

// ── Types ───────────────────────────────────────────────────────

type ZiEntry = { zi: string; ji: string }
type AppState = 'home' | 'sitting' | 'ending'
type SoundChoice = 'wind' | 'birds' | 'water' | 'silent' | null

// ── Helpers ─────────────────────────────────────────────────────

function pickRandomEntry(entries: ZiEntry[]): ZiEntry {
  return entries[Math.floor(Math.random() * entries.length)]
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Audio helpers ───────────────────────────────────────────────

const AMBIENT_VOLUME = 0.032

function loadAudio(src: string, loop: boolean, volume: number): HTMLAudioElement {
  const el = new Audio(src)
  el.loop = loop
  el.volume = volume
  return el
}

// ── App ─────────────────────────────────────────────────────────

class App {
  private state: AppState = 'home'
  private entry: ZiEntry
  private selectedSound: SoundChoice = null
  private breath: BreathAnimation
  private timer: MeditationTimer | null = null
  private ambient: HTMLAudioElement | null = null
  private bell: HTMLAudioElement

  private homeControls: HTMLElement
  private verseEl: HTMLElement
  private exitVerseEl: HTMLElement
  private exitBtn: HTMLElement
  private canvas: HTMLCanvasElement

  private ziPicker: HTMLElement
  private soundPicker: HTMLElement

  constructor() {
    this.entry = pickRandomEntry(ziData as ZiEntry[])
    this.canvas = document.getElementById('main-canvas') as HTMLCanvasElement
    this.breath = new BreathAnimation(this.canvas)
    this.homeControls = document.getElementById('home-controls')!
    this.verseEl = document.getElementById('verse')!
    this.exitVerseEl = document.getElementById('exit-verse')!
    this.exitBtn = document.getElementById('exit-btn')!
    this.ziPicker = document.getElementById('zi-picker')!
    this.soundPicker = document.getElementById('sound-picker')!
    this.bell = loadAudio('/audio/bell.mp3', false, 0.72)
    this.boot()
  }

  private async boot() {
    try {
      await document.fonts.load(`${Math.round(Math.min(window.innerWidth * 0.32, window.innerHeight * 0.30, 320))}px "LXGW WenKai"`)
    } catch {
      // font fallback is fine
    }

    this.breath.setChar(this.entry.zi)
    this.markZiActive(this.entry.zi)
    this.attachEvents()
    this.showHome()

    window.addEventListener('resize', () => {
      this.breath.resize()
      if (this.state === 'home') this.breath.drawStatic()
    })
  }

  // ── State: Home ──────────────────────────────────────────────

  private showHome() {
    this.state = 'home'
    this.verseEl.textContent = ''
    this.verseEl.classList.remove('visible')
    this.homeControls.classList.remove('hidden')
    this.exitBtn.classList.remove('sitting', 'fade-out')
    this.breath.drawStatic()
  }

  // ── State: Sitting ───────────────────────────────────────────

  private startSitting(minutes: number) {
    if (this.state !== 'home') return
    this.state = 'sitting'

    this.homeControls.classList.add('hidden')
    this.exitBtn.classList.add('sitting')
    this.breath.start(minutes * 60 * 1000)
    this.playAmbient()

    this.timer = new MeditationTimer(minutes, () => this.onTimerDone())
    this.timer.start()
  }

  private resolveSound(): 'wind' | 'birds' | 'water' | 'silent' {
    if (this.selectedSound === null) {
      const tracks: ('wind' | 'birds' | 'water')[] = ['wind', 'birds', 'water']
      return tracks[Math.floor(Math.random() * tracks.length)]
    }
    return this.selectedSound
  }

  private playAmbient() {
    const sound = this.resolveSound()
    if (sound === 'silent') return
    this.ambient = loadAudio(`/audio/${sound}.mp3`, true, AMBIENT_VOLUME)
    this.ambient.play().catch(() => {})
  }

  private stopAmbient() {
    if (!this.ambient) return
    const el = this.ambient
    const fadeStep = () => {
      if (el.volume > 0.004) {
        el.volume = Math.max(0, el.volume - 0.004)
        setTimeout(fadeStep, 80)
      } else {
        el.pause()
      }
    }
    fadeStep()
    this.ambient = null
  }

  // ── State: Ending ────────────────────────────────────────────

  /** Early exit: fade char out → show 起身即修行 3 s → return home. */
  private async exitEarly() {
    if (this.state !== 'sitting') return
    this.state = 'ending'

    this.timer?.stop()
    this.stopAmbient()
    this.exitBtn.classList.add('fade-out')

    // 1. Fade out canvas (400 ms)
    this.canvas.style.transition = 'opacity 0.4s ease'
    this.canvas.style.opacity = '0'
    await delay(450)
    this.breath.stop()

    // 2. Fade in exit verse (CSS transition 0.6 s)
    this.exitVerseEl.textContent = '起身即修行'
    void this.exitVerseEl.offsetHeight
    this.exitVerseEl.classList.add('visible')

    // 3. Hold 3 s
    await delay(3_000)

    // 4. Fade out verse (0.6 s)
    this.exitVerseEl.classList.remove('visible')
    await delay(650)

    // 5. Prepare next char while canvas is still invisible
    this.exitVerseEl.textContent = ''
    this.entry = pickRandomEntry(ziData as ZiEntry[])
    this.breath.setChar(this.entry.zi)
    this.markZiActive(this.entry.zi)

    // 6. Fade canvas back in and restore home
    this.canvas.style.transition = 'opacity 0.6s ease'
    this.canvas.style.opacity = '1'
    this.showHome()
  }

  private onTimerDone() {
    if (this.state !== 'sitting') return
    this.state = 'ending'

    this.stopAmbient()

    this.bell.currentTime = 0
    this.bell.play().catch(() => {})

    this.breath.triggerGlow()

    setTimeout(() => this.showVerse(), 900)
    setTimeout(() => this.returnHome(), 6_500)
  }

  private showVerse() {
    this.verseEl.textContent = this.entry.ji
    void this.verseEl.offsetHeight
    this.verseEl.classList.add('visible')
  }

  private returnHome() {
    this.breath.stop()
    this.entry = pickRandomEntry(ziData as ZiEntry[])
    this.breath.setChar(this.entry.zi)
    this.markZiActive(this.entry.zi)
    this.showHome()
  }

  // ── Picker helpers ───────────────────────────────────────────

  private markZiActive(zi: string) {
    this.ziPicker.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('active'))
    const btn = this.ziPicker.querySelector<HTMLButtonElement>(`[data-zi="${zi}"]`)
    btn?.classList.add('active')
  }

  private switchZi(entry: ZiEntry) {
    this.entry = entry
    this.canvas.style.transition = 'opacity 0.25s ease'
    this.canvas.style.opacity = '0'
    setTimeout(() => {
      this.breath.setChar(entry.zi)
      this.canvas.style.opacity = '1'
    }, 260)
  }

  // ── Events ───────────────────────────────────────────────────

  private attachEvents() {
    this.homeControls.querySelectorAll<HTMLButtonElement>('.dur-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes ?? '10', 10)
        this.startSitting(minutes)
      })
    })

    this.ziPicker.querySelectorAll<HTMLButtonElement>('[data-zi]').forEach(btn => {
      btn.addEventListener('click', () => {
        const zi = btn.dataset.zi!
        const entry = (ziData as ZiEntry[]).find(e => e.zi === zi)!
        this.ziPicker.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        if (this.state === 'home') this.switchZi(entry)
        else this.entry = entry
      })
    })

    document.getElementById('zi-random')!.addEventListener('click', () => {
      const entry = pickRandomEntry(ziData as ZiEntry[])
      this.markZiActive(entry.zi)
      if (this.state === 'home') this.switchZi(entry)
      else this.entry = entry
    })

    this.soundPicker.querySelectorAll<HTMLButtonElement>('[data-sound]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sound = btn.dataset.sound as 'wind' | 'birds' | 'water' | 'silent'
        this.selectedSound = sound
        this.soundPicker.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
    })

    document.getElementById('sound-random')!.addEventListener('click', () => {
      this.selectedSound = null
      this.soundPicker.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('active'))
      document.getElementById('sound-random')!.classList.add('active')
    })

    this.exitBtn.addEventListener('click', () => this.exitEarly())
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.exitEarly()
    })
  }
}

new App()
