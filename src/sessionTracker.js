// ============================================================
// SafeSense VR — تتبع الجلسة (Session Tracking)
// تعريف التوقف: عدم حركة أكثر من stopThresholdSec أثناء الطوارئ.
// الأخطاء: اتجاه لمخرج مغلق / منطقة خاطئة / عودة للخلف / دخان / عدم الوصول.
// ============================================================

export class SessionTracker {
  constructor({ studentName, userType, scenarioId, startLevel }) {
    this.sessionId = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
    this.studentName = studentName || 'متدربة'
    this.userType = userType || 'general'
    this.scenarioId = scenarioId
    this.startLevel = startLevel || 'easy'
    this.startTime = Date.now()
    this.emergencyStart = null
    this.endTime = null
    this.errors = 0
    this.errorLog = []
    this.stops = []            // { at, durationSec, x, z }
    this.exitUsed = null       // 'main' | 'alt' | null
    this.usedCorrectExit = null
    this.helpUsed = false
    this.helpAt = null
    this.reachedAssembly = false
    this.positions = []
    this._lastMoveAt = Date.now()
    this._lastPos = null
    this._stopOpenSince = null
    this._maxZ = -Infinity     // لكشف العودة للخلف (z يتناقص بعد التقدم)
    this._flagged = new Set()
  }

  markEmergencyStart() {
    this.emergencyStart = Date.now()
    this._lastMoveAt = Date.now()
  }

  addError(type, detail = '') {
    this.errors += 1
    this.errorLog.push({ at: new Date().toISOString(), type, detail })
  }

  markHelp() {
    if (!this.helpUsed) {
      this.helpUsed = true
      this.helpAt = new Date().toISOString()
    }
  }

  // تُستدعى كل إطار مع موقع اللاعب
  update(pos, emergencyActive, opts = {}) {
    const now = Date.now()
    const threshold = opts.moveThreshold ?? 0.35
    const stopSec = opts.stopThresholdSec ?? 3
    if (!this._lastPos) {
      this._lastPos = { ...pos }
      this._lastMoveAt = now
      return
    }
    const dx = pos.x - this._lastPos.x
    const dz = pos.z - this._lastPos.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.005) {
      // حركة حقيقية
      if (dist >= threshold * 0.02) this._lastMoveAt = now
      this._lastPos = { ...pos }
      if (emergencyActive) {
        this._stopOpenSince = null
        // كشف العودة للخلف: كان متقدمًا نحو المخرج/التجمع ثم رجع
        if (pos.z > this._maxZ) this._maxZ = pos.z
        else if (this._maxZ - pos.z > 4 && !this._flagged.has('backtrack')) {
          this._flagged.add('backtrack')
          this.addError('backtrack', 'العودة للخلف بعد بدء الإخلاء')
          opts.onError?.('backtrack')
        }
      }
      if (this.positions.length < 600) this.positions.push({ x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), t: now })
    } else if (emergencyActive) {
      // لا حركة أثناء الطوارئ
      const idleSec = (now - this._lastMoveAt) / 1000
      if (idleSec >= stopSec && this._stopOpenSince === null) {
        this._stopOpenSince = now
      }
      if (this._stopOpenSince !== null && now - this._stopOpenSince >= 500) {
        const dur = (now - this._stopOpenSince) / 1000
        // سجّل التوقف مرة واحدة لكل نوبة توقف
        if (!this._stopRecorded) {
          this._stopRecorded = true
          this.stops.push({
            at: new Date(this._stopOpenSince).toISOString(),
            durationSec: Math.round(dur * 10) / 10,
            x: +pos.x.toFixed(2),
            z: +pos.z.toFixed(2),
          })
        } else {
          const last = this.stops[this.stops.length - 1]
          if (last) last.durationSec = Math.round(((now - this._stopOpenSince) / 1000) * 10) / 10
        }
      }
    }
    if (dist > 0.01) this._stopRecorded = false
  }

  secondsSinceEmergency() {
    if (!this.emergencyStart) return 0
    return (Date.now() - this.emergencyStart) / 1000
  }

  idleSeconds() {
    return (Date.now() - this._lastMoveAt) / 1000
  }

  finish({ exitUsed, usedCorrectExit, reachedAssembly }) {
    this.endTime = Date.now()
    this.exitUsed = exitUsed
    this.usedCorrectExit = usedCorrectExit
    this.reachedAssembly = reachedAssembly
    if (!reachedAssembly) this.addError('no-assembly', 'عدم الوصول لمنطقة التجمع')
  }

  get evacTimeSec() {
    const base = this.emergencyStart || this.startTime
    const end = this.endTime || Date.now()
    return Math.round(((end - base) / 1000) * 10) / 10
  }

  get stopsCount() {
    return this.stops.length
  }

  toResult(nextLevel) {
    return {
      sessionId: this.sessionId,
      studentName: this.studentName,
      userType: this.userType,
      scenarioId: this.scenarioId,
      startLevel: this.startLevel,
      startTime: new Date(this.startTime).toISOString(),
      createdAt: new Date().toISOString(),
      evacTimeSec: this.evacTimeSec,
      errors: this.errors,
      errorLog: this.errorLog,
      stopsCount: this.stopsCount,
      stops: this.stops,
      exitUsed: this.exitUsed,
      usedCorrectExit: this.usedCorrectExit,
      helpUsed: this.helpUsed,
      helpAt: this.helpAt,
      reachedAssembly: this.reachedAssembly,
      nextLevel: nextLevel || this.startLevel,
      result: this.reachedAssembly ? (this.errors === 0 ? 'ممتاز' : this.errors <= 2 ? 'ناجح' : 'يحتاج تحسين') : 'لم يكتمل',
    }
  }
}

export function formatTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
