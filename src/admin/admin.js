// ============================================================
// SafeSense VR — لوحة المشرف (تسجيل دخول + Dashboard)
// ============================================================
import { APP_CONFIG, LEVEL_LABELS, userTypeLabel } from '../config/appConfig.js'
import { SCENARIOS } from '../scenarios.js'
import {
  getSessions, getSessionById, getStudents, getStudentSessions,
  getSummaryStats, isAdminLoggedIn, setAdminLoggedIn,
} from '../services/storage.js'
import { formatTime } from '../sessionTracker.js'

function scenTitle(id) {
  return (SCENARIOS.find((s) => s.id === id) || {}).title || id || '—'
}

export function renderAdminLogin(el) {
  el.innerHTML = `
  <div class="page">
    <div class="card login-box">
      <div class="logo">🔐</div>
      <h2>دخول المشرف</h2>
      <label>اسم المستخدم<input id="admUser" type="text" autocomplete="username" /></label>
      <br/><label>كلمة المرور<input id="admPass" type="password" autocomplete="current-password" /></label>
      <p id="admErr" class="err"></p>
      <button id="admGo" class="btn primary big full">دخول اللوحة</button>
      <a class="back" href="#/">→ عودة للرئيسية</a>
    </div>
  </div>`
  el.querySelector('#admGo').onclick = () => {
    const norm = (s) => String(s || '')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .trim()
    const u = norm(el.querySelector('#admUser').value).toLowerCase()
    const p = norm(el.querySelector('#admPass').value)
    if (u === APP_CONFIG.admin.username && p === APP_CONFIG.admin.password) {
      setAdminLoggedIn(true)
      if (location.hash === '#/admin') {
        window.dispatchEvent(new Event('hashchange'))
      } else {
        location.hash = '#/admin'
      }
    } else {
      el.querySelector('#admErr').textContent = 'بيانات الدخول غير صحيحة'
    }
  }
}

export function renderDashboard(el, state) {
  if (!isAdminLoggedIn()) { renderAdminLogin(el); return }
  const tab = state.adminTab || 'overview'
  el.innerHTML = `
  <div class="page">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h2 style="margin:0">📊 لوحة المشرف — محاكاة إخلاء الطوارئ</h2>
        <div><button id="btnLogout" class="btn ghost small">تسجيل الخروج</button> <a class="btn ghost small" href="#/">الرئيسية</a></div>
      </div>
      <div class="admin-tabs">
        <button data-tab="overview" class="${tab === 'overview' ? 'active' : ''}">ملخص عام</button>
        <button data-tab="sessions" class="${tab === 'sessions' ? 'active' : ''}">آخر التدريبات</button>
        <button data-tab="students" class="${tab === 'students' ? 'active' : ''}">المتدربات</button>
      </div>
      <div id="tabBody"></div>
    </div>
  </div>`
  el.querySelector('#btnLogout').onclick = () => { setAdminLoggedIn(false); location.hash = '#/' }
  el.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { state.adminTab = b.dataset.tab; renderDashboard(el, state) }
  })
  const body = el.querySelector('#tabBody')
  if (tab === 'overview') renderOverview(body)
  else if (tab === 'sessions') renderSessions(body, state)
  else renderStudents(body, state)
}

function renderOverview(body) {
  const s = getSummaryStats()
  body.innerHTML = `
    <h3>ملخص عام</h3>
    <div class="stat-grid">
      <div class="stat"><b>${s.totalSessions}</b><small>عدد التدريبات</small></div>
      <div class="stat"><b>${s.totalStudents}</b><small>عدد المتدربات</small></div>
      <div class="stat"><b>${formatTime(s.avgEvacTime)}</b><small>متوسط زمن الإخلاء</small></div>
      <div class="stat"><b>${s.avgErrors}</b><small>متوسط الأخطاء</small></div>
      <div class="stat"><b>${s.reachRate}%</b><small>نسبة الوصول للتجمع</small></div>
    </div>
    <p class="hint">تُحسب الإحصاءات من LocalStorage محليًا في هذه النسخة.</p>`
}

function renderSessions(body, state) {
  const all = getSessions()
  const f = state.filters || {}
  const filtered = all.filter((s) =>
    (!f.userType || s.userType === f.userType) &&
    (!f.scenarioId || s.scenarioId === f.scenarioId) &&
    (!f.nextLevel || s.nextLevel === f.nextLevel) &&
    (!f.result || (f.result === 'ok' ? s.reachedAssembly : !s.reachedAssembly))
  )
  body.innerHTML = `
    <h3>جدول آخر التدريبات (${filtered.length})</h3>
    <div class="filters">
      <select id="fUser"><option value="">كل الأنواع</option>
        <option value="general">تدريب عام</option><option value="visual">ضعف بصري</option>
        <option value="hearing">ضعف سمعي</option><option value="motor">إعاقة حركية</option>
        <option value="learning">صعوبات تعلم</option></select>
      <select id="fScen"><option value="">كل السيناريوهات</option>
        ${SCENARIOS.map((s) => `<option value="${s.id}">${s.title}</option>`).join('')}</select>
      <select id="fLvl"><option value="">كل المستويات</option>
        <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select>
      <select id="fRes"><option value="">كل النتائج</option>
        <option value="ok">وصل للتجمع</option><option value="fail">لم يصل</option></select>
    </div>
    <div style="overflow-x:auto"><table class="data">
      <thead><tr><th>المتدربة</th><th>النوع</th><th>السيناريو</th><th>الزمن</th><th>الأخطاء</th><th>المخرج</th><th>النتيجة</th><th>القادم</th><th>التاريخ</th></tr></thead>
      <tbody>
        ${filtered.map((s) => `<tr data-id="${s.sessionId}">
          <td>${esc(s.studentName)}</td><td>${userTypeLabel(s.userType)}</td><td>${esc(scenTitle(s.scenarioId))}</td>
          <td>${formatTime(s.evacTimeSec)}</td><td>${s.errors}</td>
          <td>${s.exitUsed === 'main' ? 'الرئيسي' : s.exitUsed === 'alt' ? 'البديل' : '—'}</td>
          <td>${esc(s.result || '')} ${s.reachedAssembly ? '✅' : '❌'}</td>
          <td>${LEVEL_LABELS[s.nextLevel] || ''}</td>
          <td>${new Date(s.createdAt).toLocaleString('ar')}</td></tr>`).join('') || '<tr><td colspan="9">لا توجد سجلات بعد — نفّذ تدريبًا من الشاشة الرئيسية.</td></tr>'}
      </tbody>
    </table></div>
    <div id="detail"></div>`
  const set = (id, key) => {
    const n = body.querySelector(id)
    n.value = f[key] || ''
    n.onchange = () => { state.filters = { ...f, [key]: n.value || undefined }; renderSessions(body, state) }
  }
  set('#fUser', 'userType'); set('#fScen', 'scenarioId'); set('#fLvl', 'nextLevel'); set('#fRes', 'result')
  body.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.onclick = () => renderSessionDetail(body.querySelector('#detail'), tr.dataset.id)
  })
  if (state.openSession) renderSessionDetail(body.querySelector('#detail'), state.openSession)
}

function renderSessionDetail(box, id) {
  const s = getSessionById(id)
  if (!s) { box.innerHTML = '<p class="err">السجل غير موجود</p>'; return }
  box.innerHTML = `
    <div class="detail-box">
      <h4>📝 تفاصيل التدريب — ${esc(s.studentName)} <small>(${s.sessionId})</small></h4>
      <p>السيناريو: <b>${esc(scenTitle(s.scenarioId))}</b> · النوع: <b>${userTypeLabel(s.userType)}</b> ·
      البداية: <b>${LEVEL_LABELS[s.startLevel] || ''}</b> → القادم: <b>${LEVEL_LABELS[s.nextLevel] || ''}</b></p>
      <p>زمن الإخلاء: <b>${formatTime(s.evacTimeSec)}</b> · الأخطاء: <b>${s.errors}</b> ·
      المخرج: <b>${s.exitUsed === 'main' ? 'الرئيسي' : s.exitUsed === 'alt' ? 'البديل' : '—'}</b>
      (${s.usedCorrectExit ? 'صحيح ✅' : 'خاطئ ⚠️'}) · المساعدة: <b>${s.helpUsed ? 'نعم' : 'لا'}</b></p>
      <p>التوقف: <b>${s.stopsCount} مرات</b> ${(s.stops || []).map((t) => `[${t.durationSec}ث عند (${t.x},${t.z})]`).join(' ')}</p>
      <p>سجل الأخطاء: ${(s.errorLog || []).map((e) => `<span class="pill">${esc(e.type)}</span>`).join(' ') || '—'}</p>
      <p class="hint">البداية: ${new Date(s.startTime).toLocaleString('ar')}</p>
    </div>`
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function renderStudents(body, state) {
  const students = getStudents()
  const sel = state.studentSel || students[0]?.name
  body.innerHTML = `
    <h3>المتدربات (${students.length})</h3>
    ${students.length === 0 ? '<p class="hint">لا توجد متدربات بعد.</p>' : `
    <div class="filters"><select id="selStu">${students.map((s) => `<option value="${esc(s.name)}" ${s.name === sel ? 'selected' : ''}>${esc(s.name)} (${s.sessionsCount})</option>`).join('')}</select></div>
    <div id="stuDetail"></div>`}`
  const selEl = body.querySelector('#selStu')
  if (selEl) {
    selEl.onchange = () => { state.studentSel = selEl.value; renderStudents(body, state) }
    renderStudentDetail(body.querySelector('#stuDetail'), selEl.value)
  }
}

function renderStudentDetail(box, name) {
  const sessions = getStudentSessions(name)
  if (!sessions.length) { box.innerHTML = '<p class="hint">لا تدريبات لهذه المتدربة.</p>'; return }
  box.innerHTML = `
    <div class="detail-box">
      <h4>👩‍🎓 ${esc(name)} — ${sessions.length} تدريبات</h4>
      <table class="data"><thead><tr><th>التاريخ</th><th>السيناريو</th><th>الزمن</th><th>الأخطاء</th><th>النتيجة</th><th>القادم</th></tr></thead>
      <tbody>${sessions.map((s) => `<tr><td>${new Date(s.createdAt).toLocaleString('ar')}</td><td>${esc(scenTitle(s.scenarioId))}</td><td>${formatTime(s.evacTimeSec)}</td><td>${s.errors}</td><td>${esc(s.result || '')}</td><td>${LEVEL_LABELS[s.nextLevel] || ''}</td></tr>`).join('')}</tbody></table>
      <p class="hint">التطور: أول زمن ${formatTime(sessions[sessions.length - 1].evacTimeSec)} → آخر زمن ${formatTime(sessions[0].evacTimeSec)} · آخر مستوى: <b>${LEVEL_LABELS[sessions[0].nextLevel] || ''}</b></p>
    </div>`
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ============================================================
// WebXR readiness (مخطط لاحقًا — لا يؤثر على نسخة Desktop):
// - يمكن إضافة VRButton من three/addons وطلب جلسة 'immersive-vr'
// - Controllers + Teleportation تُبنى فوق World anchors نفسها
// (مُجهّز architects: WORLD + refs.exits + assembly كمثبتات تنقّل)
// ============================================================
export const XR_READY_NOTES = 'WebXR planned: VRButton, controllers, teleport anchors at exits/assembly.'
