/**
 * BreathAnimation — renders the main 主字 on canvas.
 *
 * Three-stage "awakening" narrative over the session:
 *   Stage 1 (0–25%): scale 0.4→0.75, opacity 0.1→0.5  — 初入
 *   Stage 2 (25–75%): scale 0.75→0.95, opacity 0.5→0.85 — 渐定
 *   Stage 3 (75–100%): scale 0.95→1.0, opacity 0.85→1.0 — 安住
 * A 12-second sin breath oscillation (±0.02 scale) is superimposed on the growth curve.
 */

import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'

const CYCLE_MS = 12_000
const BREATH_AMP = 0.02

type CharMetrics = {
  advanceWidth: number
  ascent: number
  descent: number
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function getGrowth(p: number): { scale: number; opacity: number } {
  if (p <= 0.25) {
    const t = easeInOutCubic(p / 0.25)
    return { scale: 0.4 + 0.35 * t, opacity: 0.1 + 0.4 * t }
  } else if (p <= 0.75) {
    const t = easeInOutCubic((p - 0.25) / 0.5)
    return { scale: 0.75 + 0.2 * t, opacity: 0.5 + 0.35 * t }
  } else {
    const t = easeInOutCubic((p - 0.75) / 0.25)
    return { scale: 0.95 + 0.05 * t, opacity: 0.85 + 0.15 * t }
  }
}

export class BreathAnimation {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private char = ''
  private fontSize = 200
  private readonly fontFamily = '"LXGW WenKai", "Noto Serif CJK SC", serif'
  private readonly color = '#2C2826'

  private cssW = 0
  private cssH = 0

  private metrics: CharMetrics | null = null
  private breathPhase = 0
  private lastTs: number | null = null
  private rafId: number | null = null

  // Session progress tracking
  private totalMs = 0
  private sessionStart = 0

  // Glow state
  private glowProgress = 0
  private glowRafId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
  }

  // ── Public API ──────────────────────────────────────────────

  setChar(char: string) {
    this.char = char
    this.metrics = this.measureChar(char)
    this.drawStatic()
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    this.cssW = window.innerWidth
    this.cssH = window.innerHeight
    this.canvas.width = this.cssW * dpr
    this.canvas.height = this.cssH * dpr
    this.canvas.style.width = this.cssW + 'px'
    this.canvas.style.height = this.cssH + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    this.fontSize = Math.round(Math.min(this.cssW * 0.32, this.cssH * 0.30, 320))

    if (this.char) {
      this.metrics = this.measureChar(this.char)
    }
  }

  /** Start the breathing animation loop with session duration for growth curve. */
  start(totalMs: number) {
    if (this.rafId !== null) return
    this.totalMs = totalMs
    this.sessionStart = 0 // set on first tick
    this.breathPhase = 0
    this.lastTs = null
    this.rafId = requestAnimationFrame(ts => this.tick(ts))
  }

  /** Stop the animation loop and clear canvas. */
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /** Draw the character once at full presence (home screen). */
  drawStatic() {
    this.stop()
    this.render(0, 1.0, 1.0)
  }

  /** Flash a glow on the character when the bell rings. */
  triggerGlow() {
    if (this.glowRafId !== null) cancelAnimationFrame(this.glowRafId)
    const startTs = performance.now()
    const duration = 1_800

    const step = (ts: number) => {
      const t = Math.min((ts - startTs) / duration, 1)
      this.glowProgress = Math.sin(t * Math.PI) * (t < 0.5 ? 1.4 : 1) * 0.7
      if (t < 1) {
        this.glowRafId = requestAnimationFrame(step)
      } else {
        this.glowProgress = 0
        this.glowRafId = null
      }
    }
    this.glowRafId = requestAnimationFrame(step)
  }

  // ── Internal ────────────────────────────────────────────────

  private fontString(): string {
    return `${this.fontSize}px ${this.fontFamily}`
  }

  private measureChar(char: string): CharMetrics {
    const font = this.fontString()
    const prepared = prepareWithSegments(char, font)
    const advanceWidth = measureNaturalWidth(prepared)

    this.ctx.save()
    this.ctx.font = font
    const m = this.ctx.measureText(char)
    this.ctx.restore()

    return {
      advanceWidth,
      ascent: m.actualBoundingBoxAscent,
      descent: m.actualBoundingBoxDescent,
    }
  }

  private tick(ts: number) {
    if (this.sessionStart === 0) this.sessionStart = ts

    if (this.lastTs !== null) {
      const delta = ts - this.lastTs
      this.breathPhase = (this.breathPhase + delta / CYCLE_MS) % 1
    }
    this.lastTs = ts

    const elapsed = ts - this.sessionStart
    const p = Math.min(elapsed / this.totalMs, 1)

    const { scale: growthScale, opacity: growthOpacity } = getGrowth(p)

    // Superimpose breath oscillation: full ±BREATH_AMP sine, clamped at 1.0
    const breathOffset = Math.sin(this.breathPhase * 2 * Math.PI) * BREATH_AMP
    const scale = Math.min(growthScale + breathOffset, 1.0)

    this.render(this.glowProgress, growthOpacity, scale)
    this.rafId = requestAnimationFrame(t => this.tick(t))
  }

  private render(glowProgress: number, opacity: number, scale = 1.0) {
    const { ctx, cssW, cssH, char, metrics } = this
    if (!char || !metrics) return

    ctx.clearRect(0, 0, cssW, cssH)

    const cx = cssW / 2
    const cy = cssH / 2

    const optX = metrics.advanceWidth / 2
    const optCenterFromBaseline = (metrics.ascent - metrics.descent) / 2

    const drawX = cx - optX
    const drawY = cy + optCenterFromBaseline

    ctx.save()

    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)

    ctx.globalAlpha = Math.min(opacity + glowProgress * 0.18, 1)
    ctx.font = this.fontString()
    ctx.fillStyle = this.color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    if (glowProgress > 0) {
      ctx.shadowBlur = 28 * glowProgress
      ctx.shadowColor = this.color
    }

    ctx.fillText(char, drawX, drawY)

    ctx.restore()
  }
}
