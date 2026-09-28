// ============================================================
// SafeSense VR — تحكم اللاعب (First Person: WASD + Mouse + PointerLock)
// خفيف بدون إضافات خارجية. يدعم ضبط السرعة (إعاقة حركية).
// ============================================================

export class Player {
  constructor(camera, dom, opts = {}) {
    this.camera = camera
    this.dom = dom
    this.speed = opts.speed || 4.2
    this.yaw = Math.PI      // مواجهة السبورة بدايةً؟ نضبط أدناه
    this.pitch = 0
    this.pos = new THREE_Vector(0, 1.6, 6)
    this.keys = {}
    this.locked = false
    this.enabled = true
    this._onLock = opts.onLock || (() => {})
    this._onUnlock = opts.onUnlock || (() => {})
    this._bind()
    this.applyPose()
  }

  _bind() {
    const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const isTypingTarget = (e) => {
      const t = e.target
      return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')
    }
    this._kd = (e) => {
      // لا تسجّل مفاتيح الحركة أثناء الكتابة في حقول UI
      if (isTypingTarget(e)) return
      if (MOVE_CODES.has(e.code)) {
        this.keys[e.code] = true
        // منع تمرير الصفحة بالأسهم
        if (e.code.startsWith('Arrow')) e.preventDefault()
      }
    }
    this._ku = (e) => {
      if (MOVE_CODES.has(e.code)) this.keys[e.code] = false
    }
    window.addEventListener('keydown', this._kd)
    window.addEventListener('keyup', this._ku)
    // فقدان التركيز → صفّر المفاتيح (منع مفاتيح عالقة)
    this._blur = () => { this.keys = {} }
    window.addEventListener('blur', this._blur)
    this._mm = (e) => {
      if (!this.locked || !this.enabled) return
      this.yaw -= e.movementX * 0.0023
      this.pitch -= e.movementY * 0.0023
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch))
      this.applyPose()
    }
    document.addEventListener('mousemove', this._mm)
    this._lc = () => {
      this.locked = document.pointerLockElement === this.dom
      if (this.locked) this._onLock()
      else this._onUnlock()
    }
    document.addEventListener('pointerlockchange', this._lc)
  }

  requestLock() {
    if (document.pointerLockElement !== this.dom) {
      try { this.dom.requestPointerLock() } catch { /* تجاهل */ }
    }
  }

  setSpeed(v) { this.speed = v }

  applyPose() {
    this.camera.position.set(this.pos.x, this.pos.y, this.pos.z)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }

  // حركة First Person: أمام = -Z عندما yaw=0
  // f: أمام/خلف (W/S) · s: يمين/يسار (D/A)
  move(dt, collide) {
    if (!this.enabled) return { moved: 0 }
    const f = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0)
    const s = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0)
    if (!f && !s) { this.applyPose(); return { moved: 0 } }
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw)
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw)
    let dx = fx * f + rx * s
    let dz = fz * f + rz * s
    const len = Math.hypot(dx, dz) || 1
    dx = (dx / len) * this.speed * dt
    dz = (dz / len) * this.speed * dt
    const nx = this.pos.x + dx
    const nz = this.pos.z + dz
    let moved = 0
    if (collide && !collide(nx, nz)) {
      // حاول محورًا واحدًا (انزلاق على الجدران)
      if (collide(nx, this.pos.z)) { this.pos.x = nx; moved = Math.abs(dx) }
      else if (collide(this.pos.x, nz)) { this.pos.z = nz; moved = Math.abs(dz) }
    } else if (!collide) {
      this.pos.x = nx; this.pos.z = nz; moved = Math.hypot(dx, dz)
    } else {
      this.pos.x = nx; this.pos.z = nz; moved = Math.hypot(dx, dz)
    }
    this.applyPose()
    return { moved }
  }

  get position() { return { x: this.pos.x, z: this.pos.z, y: this.pos.y } }

  dispose() {
    window.removeEventListener('keydown', this._kd)
    window.removeEventListener('keyup', this._ku)
    window.removeEventListener('blur', this._blur)
    document.removeEventListener('mousemove', this._mm)
    document.removeEventListener('pointerlockchange', this._lc)
  }
}

// متجه بسيط بدون استيراد three هنا (لتفادي دورة استيراد)
class THREE_Vector {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z }
}

// ------------------------------------------------------------
// دالة التصادم: جدران المدرسة + حدود عامة
// تُرجع true إذا كانت الحركة مسموحة.
// ------------------------------------------------------------
export function makeCollider(scenario) {
  const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
  const classroom = { x0: -6, x1: 6, z0: 0, z1: 8 }
  const corridor = { x0: -15, x1: 15, z0: 8, z1: 12 }
  const near = (x, z, px, pz, d) => Math.hypot(x - px, z - pz) < d

  return (x, z) => {
    // حدود العالم
    if (x < -30 || x > 30 || z < -2 || z > 30) return false

    const inClass = inRect(x, z, { ...classroom, x0: classroom.x0 - 0.3, x1: classroom.x1 + 0.3, z0: -0.5, z1: classroom.z1 + 0.3 })
    const inCorr = inRect(x, z, { ...corridor, x0: corridor.x0 - 0.6, x1: corridor.x1 + 0.6, z0: corridor.z0 - 0.3, z1: corridor.z1 + 0.3 })
    const outside = z > 12 || x > 15.2 || x < -15.2

    // داخل الفصل أو الممر أو الخارج — مع منع عبور الجدران إلا عبر الأبواب
    // الجدار بين الفصل والممر (z=8): مسموح فقط عبر باب الفصل x∈[3.1,4.9]
    if (Math.abs(z - 8) < 0.45 && x > -6 && x < 6) {
      if (!(x > 3.0 && x < 5.0)) return false
    }
    // جدران الفصل الجانبية
    if (Math.abs(x - 6) < 0.35 && z > 0 && z < 8) return false
    if (Math.abs(x + 6) < 0.35 && z > 0 && z < 8) return false
    if (z < 0.35 && x > -6 && x < 6) return false
    // الجدار الجنوبي للممر (z=12): لا عبور (الخروج فقط شرق/غرب)
    if (Math.abs(z - 12) < 0.35 && x > -15 && x < 15) return false
    // جدار الشرق (x=15): عبور فقط عبر المخرج z∈[8.9,11.1] وغير مغلق
    if (Math.abs(x - 15) < 0.15 && z >= 8 && z <= 12) {
      if (!(z > 8.7 && z < 11.3)) return false
      if (scenario.blockedExit === 'main') return false
    }
    // جدار الغرب (x=-15): نفس المنطق
    if (Math.abs(x + 15) < 0.15 && z >= 8 && z <= 12) {
      if (!(z > 8.7 && z < 11.3)) return false
      if (scenario.blockedExit === 'alt') return false
    }
    // طاولات الفصل: دوائر منع بسيطة (تُتجاوز للإعاقة الحركية؟ لا — المسار أوسع أصلًا)
    const desks = [
      [-3.4, 3.2], [0, 3.2], [3.4, 3.2],
      [-3.4, 4.8], [0, 4.8], [3.4, 4.8],
      [-3.4, 6.4], [0, 6.4], [3.4, 6.4],
    ]
    for (const [dx2, dz2] of desks) {
      if (near(x, z, dx2, dz2, 0.55)) return false
    }
    // مكتب المعلم
    if (near(x, z, 0, 1.6, 1.0)) return false

    if (!(inClass || inCorr || outside)) return false
    return true
  }
}
