// ============================================================
// SafeSense VR — مدير الصوت المركزي (Audio Manager)
// - إنذار حريق Loop طوال الإخلاء
// - نداء صوتي واحد لكل سيناريو (مرة واحدة، بدون Loop)
// - Audio Ducking: خفض الإنذار أثناء النداء ثم استعادته تدريجيًا
// - يحترم منطق الخمول: يستعيد المستوى الأساسي (base) وليس 1.0 دائمًا
// - مسارات Vite الصحيحة (?url) تعمل في dev و build و Vercel
// ============================================================
import voiceFireBasic from '../assets/audio/voice-fire-basic.wav?url'
import voiceFireBlocked from '../assets/audio/voice-fire-blocked.wav?url'
import voiceSmoke from '../assets/audio/voice-smoke.wav?url'
import voiceAlternateExit from '../assets/audio/voice-alternate-exit.wav?url'

// الربط بالـ IDs الفعلية الموجودة في scenarios.js
export const SCENARIO_ANNOUNCEMENTS = {
  'fire-basic': voiceFireBasic,          // حريق المسار الأساسي مفتوح
  'fire-main-blocked': voiceFireBlocked, // المخرج الرئيسي مغلق
  'smoke-corridor': voiceSmoke,          // الدخان
  'alt-exit-choice': voiceAlternateExit, // المخرج البديل
}

// أسماء بديلة (التي ذكرها المستخدم) — تُحوَّل للـ IDs الفعلية بدون تغيير السيناريوهات
const SCENARIO_ALIASES = {
  'fire-blocked': 'fire-main-blocked',
  'smoke': 'smoke-corridor',
  'alternate-exit': 'alt-exit-choice',
}

export function resolveScenarioId(id) {
  if (!id) return id
  return SCENARIO_ALIASES[id] || id
}

export function announcementSrcFor(scenarioId) {
  const realId = resolveScenarioId(scenarioId)
  return SCENARIO_ANNOUNCEMENTS[realId] || null
}

export const AUDIO_LEVELS = {
  announcementVolume: 1.0,  // النداء = 100%
  duckLevel: 0.25,          // الإنذار أثناء النداء ≈ 25%
  idleLevel: 0.5,           // مستوى الخمول (10 ثوانٍ بلا حركة) = 50%
  duckFadeMs: 400,          // مدة الخفض التدريجي (300–500ms)
  restoreFadeMs: 600,       // مدة العودة التدريجية
  announceDelayMs: 1000,    // بدء النداء بعد ~1 ثانية من الإنذار
}

function clamp01(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.min(1, Math.max(0, n))
}

export class AudioManager {
  constructor() {
    this.ctx = null
    this.alarmNodes = null
    this.alarmGain = null
    this._mp3Alarm = null
    this._mp3FadeTimer = null

    // إدارة المستويات: الأساسي (خمول/مساعدة) مقابل الهدف الحالي (مع Ducking)
    this.baseAlarmVolume = 1.0
    this.currentAlarmTarget = 1.0
    this.volume = 1.0 // توافق مع الكود القديم (setAlarmVolume)
    this.ducked = false

    // النداء الصوتي: عنصر واحد فقط في كل مرة + مؤقت التأخير
    this._announcement = null
    this._announcementTimer = null
    this._announcementUrl = null
    this._onAnnEnded = null
    this._onAnnError = null
    this.disposed = false
  }

  // ---------- AudioContext ----------
  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  // ---------- إنذار الحريق (Loop) ----------
  // WebAudio مولّد (يعمل دائمًا دون ملفات خارجية).
  // ملاحظة: لا نطلب أي mp3 ثابت هنا — ملفا fire-alarm.mp3/success.mp3
  // غير موجودين في المشروع، وطلب مسار /assets/audio/*.mp3 غير مدمج
  // عبر Vite كان سيسبب 404 في dev/build/Vercel. الإنذار المولّد هو الأساس.
  playAlarm() {
    if (this.alarmNodes) {
      // الإنذار يعمل مسبقًا — تأكد أن الهدف هو المستوى الصحيح
      this._applyAlarmVolume(this.ducked ? Math.min(this.baseAlarmVolume, AUDIO_LEVELS.duckLevel) : this.baseAlarmVolume, 150)
      return
    }
    const ctx = this._ensureCtx()
    if (!ctx) return // لا WebAudio — لا يتعطل المشروع، يستمر التدريب صامتًا
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 660
      const target = 0.06 * (this.ducked ? Math.min(this.baseAlarmVolume, AUDIO_LEVELS.duckLevel) : this.baseAlarmVolume)
      gain.gain.value = target
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 1.6
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 220
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(); lfo.start()
      this.alarmNodes = { osc, lfo }
      this.alarmGain = gain
      this.currentAlarmTarget = this.ducked ? Math.min(this.baseAlarmVolume, AUDIO_LEVELS.duckLevel) : this.baseAlarmVolume
    } catch { /* لا يتعطل المشروع */ }
  }

  // اسم بديل للتوافق مع ui.js (startAlarm === playAlarm)
  startAlarm() {
    this.playAlarm()
  }

  _tryMp3(src, loop, volume = 0.5) {
    try {
      const a = new Audio(src)
      a.loop = !!loop
      a.volume = clamp01(volume)
      a.preload = 'auto'
      a.play().catch(() => { /* الملف غير موجود — نكتفي بالـ fallback */ })
      if (src.includes('fire-alarm')) {
        this._mp3Alarm = a
        this._mp3Alarm.volume = clamp01(0.5 * this.currentAlarmTarget)
      }
      return a
    } catch { return null }
  }

  // تطبيق مستوى الإنذار الفعلي (WebAudio + mp3) مع fade تدريجي
  _applyAlarmVolume(target01, fadeMs = 300) {
    const target = clamp01(target01)
    this.currentAlarmTarget = target
    this.volume = target // توافق خلفي
    const ms = Math.max(0, Number(fadeMs) || 0)

    // WebAudio siren
    try {
      if (this.alarmGain && this.ctx) {
        const g = this.alarmGain.gain
        const t = this.ctx.currentTime
        const scaled = 0.06 * target
        if (ms <= 1) {
          g.cancelScheduledValues(t)
          g.setValueAtTime(scaled, t)
        } else {
          g.cancelScheduledValues(t)
          g.setValueAtTime(g.value, t)
          g.linearRampToValueAtTime(scaled, t + ms / 1000)
        }
      }
    } catch {}

    // طبقة mp3 (fade يدوي لأن HTMLAudio لا يدعم ramp)
    try {
      if (this._mp3Alarm) this._fadeMp3Volume(this._mp3Alarm, 0.5 * target, ms)
    } catch {}
  }

  _fadeMp3Volume(el, toVolume, ms) {
    if (this._mp3FadeTimer) { clearInterval(this._mp3FadeTimer); this._mp3FadeTimer = null }
    const to = clamp01(toVolume)
    if (!ms || ms <= 1) { try { el.volume = to } catch {} return }
    const steps = Math.max(4, Math.round(ms / 40))
    let i = 0
    let from = to
    try { from = Number(el.volume) } catch {}
    if (!Number.isFinite(from)) from = to
    const delta = (to - from) / steps
    this._mp3FadeTimer = setInterval(() => {
      i += 1
      try { el.volume = clamp01(from + delta * i) } catch {}
      if (i >= steps) { clearInterval(this._mp3FadeTimer); this._mp3FadeTimer = null }
    }, ms / steps)
  }

  // المستوى الأساسي: يستخدمه منطق الخمول (0.5) والمساعدة.
  // إن كان Ducking نشطًا نحفظه فقط وسيُستعاد بعد انتهاء النداء.
  setAlarmBaseVolume(v) {
    const nv = clamp01(v)
    this.baseAlarmVolume = nv
    if (!this.ducked) this._applyAlarmVolume(nv, 200)
    else this.volume = nv
  }

  // توافق مع الكود القديم
  setAlarmVolume(v) {
    this.setAlarmBaseVolume(v)
  }

  // ---------- Audio Ducking ----------
  duckAlarm(fadeMs = AUDIO_LEVELS.duckFadeMs) {
    this.ducked = true
    const target = Math.min(this.baseAlarmVolume, AUDIO_LEVELS.duckLevel)
    this._applyAlarmVolume(target, fadeMs)
  }

  restoreAlarm(fadeMs = AUDIO_LEVELS.restoreFadeMs) {
    this.ducked = false
    this._applyAlarmVolume(this.baseAlarmVolume, fadeMs)
  }

  // ---------- النداء الصوتي (مرة واحدة، بدون Loop) ----------
  isAnnouncementPlaying() {
    try {
      return !!this._announcement && !this._announcement.paused && !this._announcement.ended
    } catch { return !!this._announcement }
  }

  playAnnouncement(scenarioId, opts = {}) {
    if (this.disposed) return false
    const delayMs = Number(opts.delayMs ?? AUDIO_LEVELS.announceDelayMs)
    const volume = clamp01(opts.volume ?? AUDIO_LEVELS.announcementVolume)
    // Adaptive: النداء يعمل كاملًا لجميع الأنواع (مهم لضعف البصر).
    // ضعف السمع: النداء يعمل أيضًا، لكن المعلومة الأساسية تبقى مرئية
    // (وميض + لافتة + أسهم — تُدار في ui.js ولا تُستبدل بالصوت).
    const userType = opts.userType || 'general'
    if (userType === 'hearing') {
      return false; // Disable voice instructions for hearing impairment
    }
    const realId = resolveScenarioId(scenarioId)
    const src = SCENARIO_ANNOUNCEMENTS[realId] || null

    // إيقاف أي نداء سابق أولًا (لا يتداخل ملفان أبدًا)
    this.stopAnnouncement({ restore: false })

    if (!src) {
      console.warn(`[SafeSense Audio] لا يوجد ملف نداء للسيناريو "${scenarioId}" (بعد التحويل: "${realId}"). سيستمر التدريب والإنذار بشكل طبيعي.`)
      return false
    }

    // ألغِ أي TTS جارٍ حتى لا يتداخل الكلام مع النداء
    try { window.speechSynthesis?.cancel() } catch {}

    this._announcementTimer = setTimeout(() => {
      this._announcementTimer = null
      if (this.disposed) return
      this._startAnnouncementPlayback(src, realId, volume)
    }, Math.max(0, delayMs))
    return true
  }

  _startAnnouncementPlayback(src, realId, volume) {
    // تأكيد: لا يوجد عنصر قديم يعمل
    this.stopAnnouncement({ restore: false })
    let el
    try {
      el = new Audio(src)
    } catch {
      console.warn(`[SafeSense Audio] تعذر إنشاء عنصر الصوت للسيناريو "${realId}".`)
      return
    }
    el.loop = false // النداء مرة واحدة فقط
    el.preload = 'auto'
    try { el.volume = clamp01(volume) } catch {}
    this._announcement = el
    this._announcementUrl = src

    // خفض الإنذار تدريجيًا أثناء الكلام (Ducking)
    this.duckAlarm(AUDIO_LEVELS.duckFadeMs)

    const cleanupAndRestore = () => {
      this._detachAnnouncementListeners()
      if (this._announcement === el) { this._announcement = null; this._announcementUrl = null }
      // أعد الإنذار تدريجيًا إلى مستواه الأساسي (يحترم الخمول)
      if (!this.disposed && (this.alarmNodes || this._mp3Alarm)) {
        this.restoreAlarm(AUDIO_LEVELS.restoreFadeMs)
      } else {
        this.ducked = false
      }
    }

    this._onAnnEnded = () => { cleanupAndRestore() }
    this._onAnnError = () => {
      console.warn(`[SafeSense Audio] تعذر تشغيل ملف النداء للسيناريو "${realId}" (${src}). تحقق من وجود الملف. سيستمر التدريب والإنذار بشكل طبيعي.`)
      cleanupAndRestore()
    }
    el.addEventListener('ended', this._onAnnEnded)
    el.addEventListener('error', this._onAnnError)

    try {
      const p = el.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          console.warn(`[SafeSense Audio] منع المتصفح التشغيل التلقائي أو تعذر تشغيل النداء للسيناريو "${realId}". سيستمر الإنذار بشكل طبيعي.`)
          cleanupAndRestore()
        })
      }
    } catch {
      console.warn(`[SafeSense Audio] تعذر تشغيل النداء للسيناريو "${realId}".`)
      cleanupAndRestore()
    }
  }

  _detachAnnouncementListeners() {
    try {
      if (this._announcement) {
        if (this._onAnnEnded) this._announcement.removeEventListener('ended', this._onAnnEnded)
        if (this._onAnnError) this._announcement.removeEventListener('error', this._onAnnError)
      }
    } catch {}
    this._onAnnEnded = null
    this._onAnnError = null
  }

  // restore=true يعيد الإنذار لمستواه الأساسي (للاستخدام عند إيقاف النداء وحده).
  // عند إنهاء التدريب/النجاح نستدعي stopAlarm أيضًا فمرر restore=false لتفادي fade زائد.
  stopAnnouncement({ restore = true } = {}) {
    if (this._announcementTimer) { clearTimeout(this._announcementTimer); this._announcementTimer = null }
    const had = !!this._announcement
    this._detachAnnouncementListeners()
    if (this._announcement) {
      try { this._announcement.pause() } catch {}
      try { this._announcement.removeAttribute('src'); this._announcement.load?.() } catch {}
      this._announcement = null
      this._announcementUrl = null
    }
    if (had && restore && this.ducked && !this.disposed && (this.alarmNodes || this._mp3Alarm)) {
      this.restoreAlarm(AUDIO_LEVELS.restoreFadeMs)
    } else if (!restore) {
      // يبقى ducked كما هو — النداء الجديد سيطبق Ducking من جديد، أو stopAlarm سيصفّره
    }
  }

  // ---------- إيقاف الإنذار ----------
  stopAlarm() {
    this.ducked = false
    if (this._mp3FadeTimer) { clearInterval(this._mp3FadeTimer); this._mp3FadeTimer = null }
    try { this.alarmNodes?.osc?.stop(); this.alarmNodes?.lfo?.stop() } catch {}
    this.alarmNodes = null
    this.alarmGain = null
    try { this._mp3Alarm?.pause() } catch {}
    this._mp3Alarm = null
  }

  // ---------- صوت النجاح (الحالي: تتابع نغمات WebAudio) ----------
  // لا نطلب success.mp3 — غير موجود في المشروع وطلبه كمسار ثابت
  // كان سيسبب 404. الصوت المولّد أدناه هو "الحالي" ويعمل في dev/build/Vercel.
  playSuccess() {
    const ctx = this._ensureCtx()
    if (!ctx) return
    try {
      const notes = [523, 659, 784, 1047]
      notes.forEach((f, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = f
        const t = ctx.currentTime + i * 0.14
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
        o.connect(g); g.connect(ctx.destination)
        o.start(t); o.stop(t + 0.4)
      })
    } catch {}
  }

  beep(freq = 880, dur = 0.15) {
    const ctx = this._ensureCtx()
    if (!ctx) return
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.value = 0.12
      o.connect(g); g.connect(ctx.destination)
      o.start(); o.stop(ctx.currentTime + dur)
    } catch {}
  }

  // ---------- تنظيف شامل (إنهاء يدوي / تنقل بين الصفحات) ----------
  stopAll() {
    if (this._announcementTimer) { clearTimeout(this._announcementTimer); this._announcementTimer = null }
    this.stopAnnouncement({ restore: false })
    this.stopAlarm()
    try { window.speechSynthesis?.cancel() } catch {}
  }

  dispose() {
    this.disposed = true
    this.stopAll()
    if (this._mp3FadeTimer) { clearInterval(this._mp3FadeTimer); this._mp3FadeTimer = null }
  }
}
