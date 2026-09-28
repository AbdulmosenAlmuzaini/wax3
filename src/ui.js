// ============================================================
// SafeSense VR — واجهات المتدربة + مشغّل التدريب 3D
// ============================================================
import * as THREE from 'three'
import { APP_CONFIG, USER_TYPES, LEVEL_LABELS, userTypeLabel } from './config/appConfig.js'
import { SCENARIOS, getScenario } from './scenarios.js'
import { buildSchool, animateWorld } from './scene.js'
import { Player, makeCollider } from './player.js'
import { AudioManager, resolveScenarioId } from './audioManager.js'
import { speak, helpContent, instructionFor, detectZones } from './simulation.js'
import { SessionTracker, formatTime } from './sessionTracker.js'
import { calculateNextLevel, levelAdvice } from './adaptiveEngine.js'
import { saveSession, getStudentSessions } from './services/storage.js'
import { getTrainingConfig, setTrainingConfig } from './services/trainingConfig.js'

// ---------------- الشاشة الرئيسية HOME ----------------
// لا Canvas · لا Scene · لا Pointer Lock · لا سيناريو · لا إنذار
export function renderHome(el) {
  el.innerHTML = `
  <div class="page home">
    <div class="hero card" style="margin-top: 50px;">
      
      <!-- حاوية علوية لترتيب الشعارات بنفس المستوى -->
      <div style="display: flex; justify-content: center; align-items: center; position: relative; margin-bottom: 20px; width: 100%; min-height: 100px;">
        <!-- شعار الوزارة على اليمين -->
        <img src="/logo.png" alt="وزارة التعليم" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); height: 110px; width: auto; object-fit: contain;" />
        
        <!-- أيقونة المنصة في المنتصف -->
        <div class="logo" style="margin: 0; z-index: 2;">🛡️</div>
      </div>
      
      <h1>SafeSense VR</h1>
      <p class="subtitle">منصة تدريب افتراضي تكيفي للسلامة والإخلاء</p>
      <div class="home-actions">
        <a class="btn primary big" href="#/train">بدء التدريب</a>
        <a class="btn ghost big" href="#/admin">دخول المشرف</a>
      </div>
      <div class="features">
        <div class="feat"><span>🏫</span><b>محاكاة مدرسية 3D</b><small>فصل وممر ومخارج ومنطقة تجمع</small></div>
        <div class="feat"><span>🧩</span><b>تدريب تكيفي</b><small>سهل / متوسط / صعب حسب أدائك</small></div>
        <div class="feat"><span>♿</span><b>شامل للجميع</b><small>5 أنواع تدريب مخصصة</small></div>
        <div class="feat"><span>📊</span><b>تقارير ومتابعة</b><small>زمن وإخلاء وأخطاء للمشرف</small></div>
      </div>
      
      <!-- معلومات المشروع المطلوبة -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 35px; padding-top: 25px; border-top: 1px solid #eee; gap: 15px; flex-wrap: wrap; background: #fafafa; padding: 20px; border-radius: 8px;">
        <div style="text-align: right; flex: 1; min-width: 150px;">
          <h4 style="margin: 0 0 5px 0; color: #1976d2; font-size: 0.95rem;">اسم المشروع</h4>
          <p style="margin: 0; font-weight: bold; color: #333; font-size: 1.1rem;">SafeSense VR</p>
        </div>
        <div style="text-align: left; flex: 1; min-width: 150px;">
          <h4 style="margin: 0 0 5px 0; color: #1976d2; font-size: 0.95rem;">مطورة المشروع</h4>
          <p style="margin: 0; font-weight: bold; color: #333; font-size: 1.1rem;">ميان طارق القثامي</p>
        </div>
      </div>

      <p class="hint" style="margin-top: 20px;">يعمل من المتصفح مباشرة — WASD + الفأرة</p>
    </div>
  </div>`
}

// ---------------- شاشة الإعداد TRAINING_SETUP ----------------
// خطوتان إجباريتان، ولا تبدأ أي محاكاة هنا:
// أولًا اختيار نوع المستخدم → ثم السيناريوهات الأربعة → زر "دخول المحاكاة 3D"
// الذي يحفظ trainingConfig في sessionStorage ثم ينتقل إلى #/simulation.
export function renderSetup(el, state) {
  const lastSessions = state.studentName ? getStudentSessions(state.studentName) : []
  const suggestedLevel = lastSessions[0]?.nextLevel || 'easy'
  state.startLevel = state.startLevel || suggestedLevel

  const typeCards = USER_TYPES.map((t) => `
    <button class="type-card ${state.userType === t.id ? 'active' : ''}" data-type="${t.id}">
      <span class="t-icon">${t.icon}</span>
      <b>${t.label}</b>
      <small>${t.desc}</small>
    </button>`).join('')

  const scenCards = SCENARIOS.map((s) => `
    <button class="scen-card ${state.scenarioId === s.id ? 'active' : ''}" data-scen="${s.id}">
      <b>${s.title}</b>
      <small>${s.description}</small>
      <span class="pill ${s.difficulty}">المستوى: ${LEVEL_LABELS[s.difficulty] || s.difficulty}</span>
    </button>`).join('')

  el.innerHTML = `
  <div class="page setup">
    <div class="card">
      <a class="back" href="#/">→ عودة</a>
      <h2>أولًا: اختيار نوع المستخدم</h2>
      <div class="type-grid">${typeCards}</div>
      <div id="setupStep2" class="${state.userType ? '' : 'hidden'}">
        <h2>ثانيًا: اختر السيناريو</h2>
        <div class="form-row">
          <label>اسم المتدربة أو المعرف
            <input id="inpName" type="text" placeholder="مثال: نورة" value="${escapeHtml(state.studentName || '')}" />
          </label>
          <label>مستوى البداية (تكيفي)
            <select id="selLevel">
              ${['easy', 'medium', 'hard'].map((l) => `<option value="${l}" ${state.startLevel === l ? 'selected' : ''}>${LEVEL_LABELS[l]}</option>`).join('')}
            </select>
          </label>
        </div>
        ${lastSessions[0] ? `<p class="info">👋 مرحبًا ${escapeHtml(state.studentName)} — مستواك المقترح: <b>${LEVEL_LABELS[lastSessions[0].nextLevel] || lastSessions[0].nextLevel}</b> (من آخر تدريب)</p>` : ''}
        <div class="scen-grid">${scenCards}</div>
        <div id="adaptBox" class="adapt-box"></div>
        <p id="setupErr" class="err"></p>
        <button id="btnStart" class="btn primary big full">دخول المحاكاة 3D</button>
        <p class="hint">ستبدأ جالسًا داخل الفصل. بعد ${APP_CONFIG.emergencyDelaySec} ثوانٍ يبدأ الإنذار. استخدم WASD + الفأرة.</p>
      </div>
      <p id="setupHint" class="hint ${state.userType ? 'hidden' : ''}">اختر نوع المستخدم أولًا لعرض السيناريوهات.</p>
    </div>
  </div>`

  el.querySelectorAll('[data-type]').forEach((b) => {
    b.onclick = () => {
      state.userType = b.dataset.type
      el.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('active', x === b))
      // بعد الاختيار: إظهار الخطوة الثانية
      el.querySelector('#setupStep2')?.classList.remove('hidden')
      el.querySelector('#setupHint')?.classList.add('hidden')
      const box = el.querySelector('#adaptBox')
      if (box) box.innerHTML = adaptPreview(state.userType)
    }
  })
  el.querySelectorAll('[data-scen]').forEach((b) => {
    b.onclick = () => {
      state.scenarioId = b.dataset.scen
      el.querySelectorAll('[data-scen]').forEach((x) => x.classList.toggle('active', x === b))
    }
  })
  el.querySelector('#inpName').oninput = (e) => { state.studentName = e.target.value.trim() }
  el.querySelector('#selLevel').onchange = (e) => { state.startLevel = e.target.value }
  const adaptBox = el.querySelector('#adaptBox')
  if (adaptBox) adaptBox.innerHTML = adaptPreview(state.userType || 'general')
  el.querySelector('#btnStart').onclick = () => {
    const err = el.querySelector('#setupErr')
    if (!state.studentName || state.studentName.trim() === '') {
      if (err) err.textContent = 'يرجى إدخال اسم المتدرب/المتدربة أولاً.'
      return
    }
    if (!state.userType) {
      if (err) err.textContent = 'اختر نوع المستخدم أولًا.'
      return
    }
    if (!state.scenarioId) {
      if (err) err.textContent = 'اختر السيناريو أولًا.'
      return
    }
    const saved = setTrainingConfig({
      traineeName: state.studentName,
      userType: state.userType,
      scenarioId: state.scenarioId,
      startingLevel: state.startLevel || 'easy',
    })
    if (!saved) {
      if (err) err.textContent = 'البيانات غير مكتملة — تحقق من النوع والسيناريو.'
      return
    }
    // الدخول للمحاكاة 3D فقط بضغطة صريحة من المستخدم (لا auto-start أبدًا)
    location.hash = '#/simulation'
  }
}

function adaptPreview(userType) {
  const map = {
    general: '🎓 تدريب عام: تعليمات وصوت ومؤشرات طبيعية.',
    visual: '🔊 ضعف بصري: توجيه صوتي واضح + تباين عالٍ + تنبيه عند الاتجاه الصحيح.',
    hearing: '👁️ ضعف سمعي: تنبيه بصري + وميض معتدل + رسائل نصية وأسهم كبيرة.',
    motor: '♿ إعاقة حركية: مسار واسع بلا عوائق + سرعة قابلة للضبط.',
    learning: '📝 صعوبات تعلم: تعليمات قصيرة — خطوة واحدة في كل مرة.',
  }
  return `<div>✨ <b>كيف سيتغير التدريب؟</b> ${map[userType] || map.general}</div>`
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ---------------- TRAINING_3D: مشغّل التدريب ----------------
// الواجهة القديمة "محاكاة الإخلاء في حالات الحريق" محفوظة هنا كـ Intro
// داخل TRAINING_3D فقط — لا Canvas ولا Scene ولا صوت قبل "ابدأ التجربة".
export function startTraining(el, state) {
  // المصدر الرسمي: trainingConfig من sessionStorage (يُزامَن مع state للتوافق)
  const cfg = getTrainingConfig() || {}
  const scenarioId = resolveScenarioId(cfg.scenarioId || state.scenarioId || '')
  const scenario = getScenario(scenarioId || 'fire-basic')
  const userType = cfg.userType || state.userType || 'general'
  const startLevel = cfg.startingLevel || state.startLevel || scenario.startLevel || 'easy'
  const traineeName = cfg.traineeName || state.studentName || 'متدربة'
  // زامن state مع الـ config الرسمي حتى تستخدمه بقية الدوال
  state.userType = userType
  state.scenarioId = scenario.id
  state.startLevel = startLevel
  state.studentName = traineeName

  el.innerHTML = `
  <div class="page">
    <div class="card" style="text-align:center;max-width:640px;margin:40px auto">
      <div class="logo">🔥</div>
      <h2>محاكاة الإخلاء في حالات الحريق</h2>
      <p class="hint">${escapeHtml(scenario.title)} · ${escapeHtml(userTypeLabel(userType))} · ${escapeHtml(traineeName)} · ${escapeHtml(LEVEL_LABELS[startLevel] || startLevel)}</p>
      <p>${escapeHtml(scenario.briefing || '')}</p>
      <p class="hint">ستدخل الفصل ثلاثي الأبعاد. لا يبدأ الإنذار ولا Pointer Lock إلا بعد ضغط الزر.</p>
      <button id="btnEnter3D" class="btn primary big full">ابدأ التجربة</button>
      <p><a class="back" href="#/train">→ عودة للإعداد</a></p>
    </div>
  </div>`

  let cleanup3D = null
  let entered = false
  el.querySelector('#btnEnter3D').onclick = () => {
    if (entered) return
    entered = true
    cleanup3D = initSimulation3D(el, state, scenario, userType, startLevel)
  }
  return () => { try { cleanup3D?.() } catch {} }
}

// تهيئة الـ 3D الفعلية: Scene + Player + Simulation + Audio + Tracking.
// لا تُستدعى إلا من زر "ابدأ التجربة" داخل startTraining (أي داخل enterSimulation).
function initSimulation3D(el, state, scenario, userType, startLevel) {

  el.innerHTML = `
  <div class="train-wrap ${userType === 'visual' ? 'high-contrast' : ''}">
    <canvas id="c3d"></canvas>
    <div id="flash" class="flash hidden"></div>
    <div class="hud-top">
      <div class="hud-chip">⏱️ <span id="hudTimer">0:00</span></div>
      <div class="hud-chip">🔥 ${escapeHtml(scenario.title)}</div>
      <div class="hud-chip">👤 ${escapeHtml(state.studentName)} · ${LEVEL_LABELS[startLevel]}</div>
      <button id="btnCursor" class="hud-chip btn-cursor" title="تحرير المؤشر">🖱️ إظهار المؤشر</button>
      <button id="btnQuit" class="hud-chip btn-quit">✕ إنهاء</button>
    </div>
    <div class="hud-hint">⌨️ WASD للحركة • 🖱️ الماوس للنظر • ESC لتحرير المؤشر</div>
    <div id="banner" class="banner info">أنت داخل الفصل. انتظر بدء حالة الطوارئ…</div>
    <div id="alertBar" class="alertbar hidden">🚨 إنذار حريق! أخلِ المكان فورًا</div>
    <div id="hearingBar" class="hearing-bar hidden">أنت داخل الفصل. انتظر بدء حالة الطوارئ…</div>
    <div id="helpPanel" class="help hidden"></div>
    <div id="toast" class="toast hidden"></div>
    <div id="lockOverlay" class="lock-overlay">
      <div class="lock-card">
        <h3 class="lock-title">جاهز للتدريب؟</h3>
        <p class="lock-desc">${escapeHtml(instructionFor(userType, scenario, 'pre'))}</p>
        <p class="keys">🖱️ انقر للتحكم · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> للحركة · الفأرة للنظر</p>
        <div class="lock-actions">
          <button id="btnLock" class="btn primary">انقر للبدء</button>
          <button id="btnExitTraining" class="btn outline hidden">الخروج من التدريب</button>
        </div>
      </div>
    </div>
    ${userType === 'motor' ? `<div class="speed-ctl">🚶 السرعة: <b id="speedVal">متوسط (2)</b><div style="font-size:0.8em; margin-top:4px;">⌨️ أرقام 1-5 لتغيير السرعة</div></div>` : ''}
    ${userType === 'learning' ? `<div id="stepBox" class="steps hidden"><b id="stepText"></b><button id="stepNext" class="btn small">التالي ←</button></div>` : ''}
  </div>`

  const canvas = el.querySelector('#c3d')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const resize = () => {
    const w = el.clientWidth || window.innerWidth
    const h = el.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 200)
  const refs = buildSchool(scene, scenario, userType)
  const collider = makeCollider(scenario)

  const $ = (id) => el.querySelector('#' + id)
  const lockOverlayEl = () => $('lockOverlay')
  const lockTitleEl = () => el.querySelector('#lockOverlay .lock-title')
  const lockDescEl = () => el.querySelector('#lockOverlay .lock-desc')
  const lockKeysEl = () => el.querySelector('#lockOverlay .keys')
  const btnLockEl = () => $('btnLock')
  const btnExitEl = () => $('btnExitTraining')

  // hasLockedOnce: يميّز شاشة البداية الأولى عن نافذة "المؤشر محرر" بعد ESC.
  let hasLockedOnce = false
  // pausedByCursor: نافذة خيارات المؤشر مفتوحة → إيقاف WASD مؤقتًا دون تغيير السيناريو.
  // modalOpen: يوجد Modal حقيقي (مساعدة / تقرير) يحتاج تفاعل المستخدم.
  let pausedByCursor = false
  let modalOpen = false
  let finished = false
  let pauseStartStamp = 0
  let minDistToExit = Infinity
  let lastProgressTime = 0
  let alarmDuckedForNoProgress = false

  // نافذة "المؤشر محرر": عنوان + نص + زرّان منفصلان بصريًا.
  function renderPauseMenu() {
    const t = lockTitleEl()
    if (t) t.textContent = 'المؤشر محرر'
    const d = lockDescEl()
    if (d) d.textContent = 'اختر ما تريد القيام به.'
    lockKeysEl()?.classList.add('hidden')
    const b1 = btnLockEl()
    if (b1) b1.textContent = 'متابعة التدريب'
    const b2 = btnExitEl()
    if (b2) {
      b2.textContent = 'الخروج من التدريب'
      b2.classList.remove('hidden')
    }
  }

  function renderInitialMenu() {
    const t = lockTitleEl()
    if (t) t.textContent = 'جاهز للتدريب؟'
    const d = lockDescEl()
    if (d) d.textContent = instructionFor(userType, scenario, 'pre')
    lockKeysEl()?.classList.remove('hidden')
    const b1 = btnLockEl()
    if (b1) b1.textContent = 'انقر للبدء'
    btnExitEl()?.classList.add('hidden')
  }

  function pauseForCursor() {
    if (finished || modalOpen || pausedByCursor) return
    if (!hasLockedOnce) {
      renderInitialMenu()
      lockOverlayEl()?.classList.remove('hidden')
      return
    }
    pausedByCursor = true
    pauseStartStamp = Date.now()
    player.enabled = false
    player.keys = {}
    renderPauseMenu()
    lockOverlayEl()?.classList.remove('hidden')
  }

  function resumeTraining() {
    if (finished) return
    // تعويض مدة الإيقاف حتى لا يقفز المؤقت ولا تُحتسب توقفات وهمية.
    const pausedMs = pauseStartStamp ? Date.now() - pauseStartStamp : 0
    if (pausedMs > 0) {
      startStamp += pausedMs
      if (tracker.emergencyStart) tracker.emergencyStart += pausedMs
      tracker._lastMoveAt = Date.now()
      if (tracker._stopOpenSince) tracker._stopOpenSince += pausedMs
    }
    pauseStartStamp = 0
    pausedByCursor = false
    modalOpen = false
    player.enabled = true
    player.keys = {}
    lockOverlayEl()?.classList.add('hidden')
    // نفس الـ click يستعيد Pointer Lock مباشرة (gesture مباشر).
    player.requestLock()
  }

  const player = new Player(camera, canvas, {
    speed: userType === 'motor' ? 3 : 4.5,
    onLock: () => {
      hasLockedOnce = true
      // لا تُبقِ أي حالة paused تمنع WASD بعد المتابعة الناجحة.
      // لا نمس modalOpen هنا: نافذة المساعدة/التقرير تبقى متحكمة بإتاحة الحركة.
      pausedByCursor = false
      pauseStartStamp = 0
      if (!modalOpen) {
        player.enabled = true
        player.keys = {}
      }
      lockOverlayEl()?.classList.add('hidden')
    },
    // ESC أثناء Pointer Lock يحرر المؤشر → نعرض نافذة الخيارين ليقرر المستخدم.
    onUnlock: () => { if (!finished && !modalOpen) pauseForCursor() },
  })
  player.yaw = 0 // مواجهة السبورة (شمال)
  // نقطة البداية: جالسة خلف الطاولة الوسطى — ممر حر (ليست داخل أي collider)
  // تحقق: الطاولة عند (0,6.4) نصف قطرها 0.55 → البداية (0,7.3) حرة من كل الجهات
  player.pos.x = 0; player.pos.y = 1.6; player.pos.z = 7.3
  if (!collider(player.pos.x, player.pos.z)) {
    // احتياط: إن كانت النقطة محجوبة لأي سبب، جرّب أقرب نقطة حرة
    outer: for (const [ox, oz] of [[0, 7.3], [1.5, 7.3], [-1.5, 7.3], [0, 5.6], [2, 5.6]]) {
      if (collider(ox, oz)) { player.pos.x = ox; player.pos.z = oz; break outer }
    }
  }
  player.applyPose()

  const audio = new AudioManager()
  const tracker = new SessionTracker({
    studentName: state.studentName, userType, scenarioId: scenario.id, startLevel,
  })

  let emergencyActive = false
  let helpShown = false
  let startStamp = Date.now()
  let emergencyAt = 0
  let exitCandidate = null
  let lastSmokeErr = 0
  let raf = 0
  let clock = performance.now()
  const flags = new Set()

  // تعليمات أولية حسب النوع
  $('banner').textContent = instructionFor(userType, scenario, 'pre')
  if (userType === 'visual') speak('أنت داخل الفصل. استعد. بعد قليل يبدأ تدريب الإخلاء.', userType)

  // خطوات صعوبات التعلم
  const steps = ['اخرج من الفصل', 'اتبع الأسهم', 'اذهب إلى منطقة التجمع']
  let stepIdx = 0
  if (userType === 'learning') {
    const box = $('stepBox')
    const txt = $('stepText')
    const render = () => { txt.textContent = `خطوة ${stepIdx + 1}: ${steps[stepIdx]}` }
    render()
    $('stepNext').onclick = () => { stepIdx = Math.min(stepIdx + 1, steps.length - 1); render(); audio.beep(700) }
  }

  // الزر الأساسي: نفس الـ click يستدعي requestPointerLock مباشرة (gesture مباشر للمتصفح).
  $('btnLock').onclick = () => {
    if (finished) return
    if (hasLockedOnce) resumeTraining()
    else player.requestLock()
  }
  btnExitEl()?.addEventListener('click', () => exitTraining())
  // النقر على المشهد يعيد القفل فقط عندما لا تكون نافذة الخيارين مفتوحة
  // (أثناء ظهور النافذة يجب استخدام زر "متابعة التدريب" حصرًا).
  canvas.onclick = () => {
    if (finished || modalOpen || pausedByCursor) return
    player.requestLock()
  }
  // "الخروج من التدريب": إنهاء آمن دون تسجيل نجاح وهمي.
  // نظام الجلسات الحالي لا يدعم حالة cancelled/aborted، لذا لا نستدعي saveSession هنا إطلاقًا.
  function exitTraining() {
    if (finished && !pausedByCursor) return
    try { if (document.pointerLockElement) document.exitPointerLock?.() } catch {}
    cleanup()
    location.hash = '#/train'
  }
  $('btnQuit').onclick = () => exitTraining()
  // زر إظهار المؤشر — بديل ESC (يحرر Pointer Lock مؤقتًا → تظهر نافذة الخيارين عبر onUnlock)
  $('btnCursor').onclick = (e) => {
    e.stopPropagation()
    if (finished || modalOpen) return
    try { document.exitPointerLock?.() } catch {}
    // احتياط: إن لم يُطلق المتصفح pointerlockchange (مثل عدم وجود قفل أصلًا) اعرض النافذة يدويًا.
    if (!document.pointerLockElement) setTimeout(() => { if (!finished && !modalOpen) pauseForCursor() }, 50)
  }
  const onSpeedKey = (e) => {
    if (userType !== 'motor' || finished || modalOpen) return
    const map = {
      Digit1: { v: 2, l: 'بطيء (1)' }, Numpad1: { v: 2, l: 'بطيء (1)' },
      Digit2: { v: 3, l: 'متوسط (2)' }, Numpad2: { v: 3, l: 'متوسط (2)' },
      Digit3: { v: 4.5, l: 'سريع (3)' }, Numpad3: { v: 4.5, l: 'سريع (3)' },
      Digit4: { v: 6, l: 'أسرع (4)' }, Numpad4: { v: 6, l: 'أسرع (4)' },
      Digit5: { v: 7.5, l: 'سريع جدا (5)' }, Numpad5: { v: 7.5, l: 'سريع جدا (5)' }
    }
    const cfg = map[e.code]
    if (cfg) {
      player.setSpeed(cfg.v)
      const sv = $('speedVal')
      if (sv) sv.textContent = cfg.l
    }
  }
  if (userType === 'motor') {
    window.addEventListener('keydown', onSpeedKey)
  }

  function toast(msg) {
    const t = $('toast')
    if (!t) return
    t.textContent = msg
    t.classList.remove('hidden')
    clearTimeout(t._h)
    t._h = setTimeout(() => t.classList.add('hidden'), 2600)
  }

  // نافذة المساعدة = Modal حقيقي:
  // - إيقاف الحركة مؤقتًا + تحرير المؤشر حتى يستطيع المستخدم النقر على "فهمت"
  // - عند "فهمت": إغلاق + عودة Running + طبقة النقر لاستعادة Pointer Lock + WASD تعمل فورًا
  function showHelp() {
    if (helpShown) return
    helpShown = true
    modalOpen = true
    pausedByCursor = false
    pauseStartStamp = 0
    player.enabled = false
    player.keys = {}
    try { document.exitPointerLock?.() } catch {}
    $('lockOverlay').classList.add('hidden') // لا تغطِّ نافذة المساعدة
    tracker.markHelp()
    audio.setAlarmBaseVolume(0.5) // خفض الإنذار إلى 50% (مستوى أساسي — يُستعاد بعد النداء إن كان نشطًا)
    const h = helpContent(userType, scenario)
    const p = $('helpPanel')
    p.innerHTML = `<b>${escapeHtml(h.title)}</b><div>${escapeHtml(h.text)}</div>
      ${h.steps ? `<div class="mini-steps">${h.steps.map((s) => `<span>${escapeHtml(s)}</span>`).join(' → ')}</div>` : ''}
      <button class="btn small" id="helpOk">فهمت ✓</button>`
    p.classList.remove('hidden')
    const ok = p.querySelector('#helpOk')
    if (ok) ok.onclick = () => {
      p.classList.add('hidden')
      modalOpen = false
      if (finished) return
      // بعد المساعدة اعرض نافذة الخيارين ليقرر المستخدم بنفسه (متابعة / خروج).
      // لا نعيد الحركة تلقائيًا هنا: زر "متابعة التدريب" هو من يستأنف + يستعيد Pointer Lock.
      pauseStartStamp = 0
      if (hasLockedOnce) pauseForCursor()
      else {
        player.enabled = true
        player.keys = {}
        renderInitialMenu()
        lockOverlayEl()?.classList.remove('hidden')
      }
    }
    // التوجيه الصوتي أثناء المساعدة: لا يتداخل مع النداء الجاري.
    // ضعف سمعي: المعلومة الأساسية تبقى مرئية دائمًا (النص + الوميض أعلاه).
    // ضعف بصري: النداء يعمل كاملًا، ورسائل TTS اللاحقة تُستكمل بعد انتهائه.
    if (!audio.isAnnouncementPlaying()) {
      if (h.speak) speak(h.speak, userType)
      else if (userType === 'visual') speak(h.text, userType)
    }
    if (h.flash) {
      const f = $('flash')
      f.classList.remove('hidden')
      setTimeout(() => f.classList.add('hidden'), 4000)
    }
    if (userType === 'learning') $('stepBox')?.classList.remove('hidden')
    toast('💡 ظهرت المساعدة المناسبة لك')
  }

  function triggerEmergency() {
    emergencyActive = true
    tracker.markEmergencyStart()
    emergencyAt = Date.now()
    lastProgressTime = Date.now()
    // 1) الإنذار أولًا (Loop طوال الإخلاء) 2) النداء الخاص بالسيناريو بعده بـ ~1 ثانية
    // ضعف السمع: لا يوجد إنذار صوتي أو نداء
    if (userType !== 'hearing') {
      audio.startAlarm()
      audio.playAnnouncement(scenario.id, { delayMs: 1000, userType })
    }
    
    $('alertBar').classList.remove('hidden')
    
    if (userType === 'hearing') {
      $('alertBar').textContent = '🚨 إنذار طوارئ — ابدأ الإخلاء'
      $('alertBar').style.animation = 'none' // Remove blinking/pulse for hearing impaired
      $('hearingBar').classList.remove('hidden')
    }
    
    document.body.classList.add('emergency')
    const msg = userType === 'learning' ? 'اخرج من الفصل.' : `🚨 ${scenario.briefing} (${scenario.correctExit === 'main' ? 'المخرج الرئيسي' : 'المخرج البديل'})`
    $('banner').textContent = msg
    $('banner').className = 'banner danger'
    // ملاحظة: لا TTS هنا — ملف النداء الصوتي الحقيقي (WAV) يغطي التوجيه الصوتي
    // لجميع الأنواع بما فيها ضعف البصر، حتى لا يتداخل صوتان معًا.
    // ضعف السمع: التنبيه البصري (وميض + لافتة + أسهم) أعلاه يبقى المصدر الأساسي.
    if (userType === 'learning') $('stepBox')?.classList.remove('hidden')
  }

  function onError(type) {
    const labels = {
      'closed-exit': '⚠️ هذا المخرج مغلق! استخدم المخرج الآخر',
      'smoke': '⚠️ دخان! غيّر الاتجاه فورًا',
      'wrong-area': '⚠️ منطقة غير صحيحة — عُد نحو الأسهم',
      'backtrack': '⚠️ لا تعد للخلف — واصل نحو المخرج',
    }
    toast(labels[type] || '⚠️ خطأ')
    if (userType !== 'hearing') {
      audio.beep(220, 0.25)
      if (userType === 'visual' && !audio.isAnnouncementPlaying()) speak(labels[type] || 'انتبه', userType)
    }
  }

  function finishTraining(reached, failReason = null) {
    if (finished) return
    finished = true
    modalOpen = true // التقرير Modal حقيقي — إيقاف الحركة نهائيًا
    player.enabled = false
    // نجاح الإخلاء: إيقاف الإنذار + أي نداء جارٍ، ثم صوت النجاح فقط
    audio.stopAnnouncement({ restore: false })
    audio.stopAlarm()
    if (userType !== 'hearing') {
      audio.playSuccess()
    }
    try { window.speechSynthesis?.cancel() } catch {}
    document.body.classList.remove('emergency')
    if (document.pointerLockElement) document.exitPointerLock?.()
    const usedCorrect = exitCandidate ? exitCandidate === scenario.correctExit : reached
    tracker.finish({ exitUsed: exitCandidate, usedCorrectExit: usedCorrect, reachedAssembly: reached && !failReason })
    if (failReason) tracker.markError()
    const partial = tracker.toResult()
    const nextLevel = calculateNextLevel(partial)
    const result = tracker.toResult(nextLevel)
    showReport(result, scenario, failReason)
    
    // حفظ في قاعدة البيانات (Vercel) بشكل غير متزامن
    saveSession(result).then((savedOk) => {
      const msg = document.getElementById('repSaveMsg')
      if (msg) {
        msg.innerHTML = savedOk ? '<span style="color:#2e7d32">✅ تم حفظ النتيجة في قاعدة البيانات بنجاح</span>' 
                                : '<span style="color:#c62828">⚠️ تعذر الاتصال بالخادم، حُفظت النتيجة محلياً وسيعاد إرسالها لاحقاً</span>'
      }
    })
  }

  function showReport(r, scen, failReason = null) {
    const exitLabel = r.exitUsed === 'main' ? 'المخرج الرئيسي' : r.exitUsed === 'alt' ? 'المخرج البديل' : '—'
    const overlay = document.createElement('div')
    overlay.className = 'report-overlay'
    const failMessage = failReason ? `<div style="color: #c62828; font-size: 1.2rem; font-weight: bold; margin-bottom: 15px;">❌ ${failReason}</div>` : ''
    overlay.innerHTML = `
      <div class="report card">
        <h2>📋 نتيجة التدريب</h2>
        ${failMessage}
        <div id="repSaveMsg" style="margin-bottom: 15px; font-weight: bold; text-align: center;">⏳ جاري حفظ النتيجة في الخادم...</div>
        <div class="rep-grid">
          <div><small>زمن الإخلاء</small><b>${formatTime(r.evacTimeSec)}</b></div>
          <div><small>الأخطاء</small><b>${r.errors}</b></div>
          <div><small>المخرج المستخدم</small><b>${exitLabel}</b></div>
          <div><small>الوصول لمنطقة التجمع</small><b>${r.reachedAssembly ? '✅' : '❌'}</b></div>
          <div><small>المساعدة المستخدمة</small><b>${r.helpUsed ? 'نعم' : 'لا'}</b></div>
          <div><small>التوقف</small><b>${r.stopsCount} مرات</b></div>
        </div>
        <div class="next-level">مستوى التدريب القادم: <b>${LEVEL_LABELS[r.nextLevel]}</b><small>${levelAdvice(r.nextLevel)}</small></div>
        <div class="rep-actions">
          <button class="btn primary" id="repDone">إنهاء</button>
          <button class="btn ghost" id="repNew">بدء تدريب جديد</button>
        </div>
      </div>`
    el.appendChild(overlay)
    overlay.querySelector('#repDone').onclick = () => { cleanup(); location.hash = '#/' }
    overlay.querySelector('#repNew').onclick = () => {
      state.startLevel = r.nextLevel
      // اقتراح سيناريو بنفس الصعوبة
      const cand = SCENARIOS.find((s) => s.difficulty === r.nextLevel)
      if (cand) state.scenarioId = cand.id
      cleanup(); location.hash = '#/train'
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop)
    const now = performance.now()
    const dt = Math.min((now - clock) / 1000, 0.05)
    clock = now
    const t = now / 1000

    if (!finished && !pausedByCursor) {
      // بدء الطوارئ بعد N ثوانٍ (مجمّد أثناء ظهور نافذة المؤشر — لا يتقدم الوقت ولا تتغير الحالة)
      if (!emergencyActive && (Date.now() - startStamp) / 1000 >= APP_CONFIG.emergencyDelaySec) {
        triggerEmergency()
      }
      player.move(dt, collider)
      const pos = player.position
      tracker.update(pos, emergencyActive, {
        moveThreshold: APP_CONFIG.moveThreshold,
        stopThresholdSec: APP_CONFIG.stopThresholdSec,
        onError,
      })

      if (emergencyActive) {
        // المؤقت
        const el2 = $('hudTimer')
        if (el2) el2.textContent = formatTime(tracker.evacTimeSec)
        
        // --- متابعة التقدم (5 ثوانٍ بدون تقدم) ---
        const targetX = scenario.correctExit === 'main' ? 15 : -15;
        const targetZ = 10;
        let dist = 0;
        if (pos.z < 8.2 && Math.abs(pos.x) < 6) { // داخل الفصل
          dist = Math.hypot(pos.x - 4, pos.z - 8) + Math.hypot(4 - targetX, 8 - targetZ);
        } else { // في الممر
          dist = Math.hypot(pos.x - targetX, pos.z - targetZ);
        }
        
        if (dist < minDistToExit - 0.2) {
          minDistToExit = dist;
          lastProgressTime = Date.now();
          if (alarmDuckedForNoProgress) {
            alarmDuckedForNoProgress = false;
            audio.setAlarmBaseVolume(1.0);
          }
        }
        
        const stallSec = (Date.now() - lastProgressTime) / 1000;
        if (stallSec >= 5 && !alarmDuckedForNoProgress) {
          alarmDuckedForNoProgress = true;
          
          const h = helpContent(userType, scenario);
          toast('💡 ' + h.text);
          
          if (userType !== 'hearing') {
            audio.setAlarmBaseVolume(0.5);
            if (!audio.isAnnouncementPlaying()) {
              if (h.speak) speak(h.speak, userType);
              else if (userType === 'visual') speak(h.text, userType);
            }
            if (h.flash) {
              const f = $('flash');
              f.classList.remove('hidden');
              setTimeout(() => f.classList.add('hidden'), 4000);
            }
          } else {
            // ضعف السمع: إبراز شريط التعليمات بدلاً من خفض الإنذار الصوتي
            const hBar = $('hearingBar');
            if (hBar) {
              hBar.style.transform = 'scale(1.02)';
              hBar.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.8)';
              setTimeout(() => { hBar.style.transform = 'none'; hBar.style.boxShadow = 'none'; }, 1500);
            }
          }
          tracker.markHelp();
        }

        // تنبيه صوتي عند الاقتراب من الاتجاه الصحيح (ضعف بصري)
        if (userType === 'visual' && !flags.has('near-ok')) {
          const targetX = scenario.correctExit === 'main' ? 12 : -12
          if (Math.hypot(pos.x - targetX, pos.z - 10) < 5) {
            flags.add('near-ok')
            audio.beep(990, 0.4)
            if (!audio.isAnnouncementPlaying()) speak('أحسنت. أنت قريب من الاتجاه الصحيح. واصل.', userType)
            toast('🔊 أحسنت — الاتجاه صحيح')
          }
        }

        const z = detectZones(pos, scenario)
        // مخرج مغلق
        if (z.atMainExit && scenario.blockedExit === 'main' && !flags.has('closed-main')) {
          flags.add('closed-main')
          tracker.addError('closed-exit', 'الاتجاه نحو مخرج مغلق (الرئيسي)')
          onError('closed-exit')
        }
        if (z.atAltExit && scenario.blockedExit === 'alt' && !flags.has('closed-alt')) {
          flags.add('closed-alt')
          tracker.addError('closed-exit', 'الاتجاه نحو مخرج مغلق (البديل)')
          onError('closed-exit')
        }
        // تسجيل المخرج المستخدم عند العبور الفعلي
        if (pos.x > 15.4 && !flags.has('used-main')) { flags.add('used-main'); exitCandidate = 'main'; if (userType !== 'hearing') audio.beep(760, 0.2); toast('🚪 خرجت من المخرج الرئيسي — توجه لمنطقة التجمع') }
        if (pos.x < -15.4 && !flags.has('used-alt')) { flags.add('used-alt'); exitCandidate = 'alt'; if (userType !== 'hearing') audio.beep(760, 0.2); toast('🚪 خرجت من المخرج البديل — توجه لمنطقة التجمع') }
        // دخان
        if (z.inSmoke && !flags.has('failed-smoke')) {
          flags.add('failed-smoke')
          tracker.addError('smoke', 'السير داخل منطقة دخان')
          finishTraining(false, 'دخلت منطقة الدخان؛ اتبع المسار الآمن')
        }
        
        // تحذير استباقي للدخان عند دخول الممر
        if (scenario.id === 'smoke-corridor' && pos.x > 6 && !flags.has('smoke-warn')) {
          flags.add('smoke-warn')
          toast('انتبه أمامك حريق')
        }
        // منطقة خاطئة
        if (z.atWrongArea && !flags.has('wrong')) {
          flags.add('wrong')
          tracker.addError('wrong-area', 'منطقة غير صحيحة')
          onError('wrong-area')
        }
        // الوصول للتجمع
        if (z.atAssembly) { finishTraining(true) }
        
        // تحديث شريط التوجيه لضعاف السمع
        if (userType === 'hearing') {
          const hBar = $('hearingBar');
          if (hBar) {
            let msg = 'اتجه إلى باب الفصل';
            if (pos.z < 8.2 && Math.abs(pos.x) < 6) {
              msg = 'اتجه إلى باب الفصل';
            } else if (z.atMainExit && scenario.blockedExit === 'main') {
              msg = 'المخرج الرئيسي مغلق! استخدم المخرج البديل';
            } else if (z.atAltExit && scenario.blockedExit === 'alt') {
              msg = 'المخرج البديل مغلق! استخدم المخرج الآخر';
            } else if (pos.x > 15 || pos.x < -15) {
              msg = 'تابع إلى منطقة التجمع';
            } else {
              if (scenario.blockedExit === 'main' && (flags.has('closed-main') || flags.has('smoke'))) {
                msg = 'استخدم المخرج البديل الموضح بالمسار الأخضر';
              } else if (scenario.correctExit === 'main') {
                msg = 'اتبع المسار الأخضر في الممر للوصول للمخرج';
              } else {
                msg = 'اتبع المسار الأخضر في الممر للوصول للمخرج';
              }
            }
            hBar.textContent = msg;
          }
        }
        
        // مهلة قصوى 5 دقائق → إنهاء كغير مكتمل
        if (tracker.secondsSinceEmergency() > 300) finishTraining(false)
      }
    }
    animateWorld(refs, t, emergencyActive, tracker.secondsSinceEmergency())
    renderer.render(scene, camera)
  }

  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  resize()
  loop()

  function cleanup() {
    finished = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    try { player.dispose() } catch {}
    if (userType === 'motor') window.removeEventListener('keydown', onSpeedKey)
    // إنهاء يدوي/تنقل: إيقاف الإنذار + النداء + تنظيف كل timers/listeners
    try { audio.dispose() } catch {}
    try { window.speechSynthesis?.cancel() } catch {}
    document.body.classList.remove('emergency')
    renderer.dispose()
  }
  return cleanup
}
