// ============================================================
// SafeSense VR — طبقة التخزين (النسخة الأولى: LocalStorage)
// ------------------------------------------------------------
// القاعدة الذهبية: بقية المشروع لا يتعامل مع localStorage مباشرة.
// كل التعامل يتم عبر الدوال المصدّرة هنا.
// لاحقًا يمكن استبدال هذا الملف بمزود Supabase/API بنفس الواجهة
// دون تغيير باقي النظام.
// ============================================================

const KEYS = {
  sessions: 'safesense_sessions_v1',
  students: 'safesense_students_v1',
  adminSession: 'safesense_admin_v1',
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[storage] تعذر الكتابة في LocalStorage', e)
  }
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ---------- Sessions ----------
export function saveSession(session) {
  const all = readJSON(KEYS.sessions, [])
  const record = { ...session }
  if (!record.sessionId) record.sessionId = uid('ses')
  if (!record.createdAt) record.createdAt = new Date().toISOString()
  const idx = all.findIndex((s) => s.sessionId === record.sessionId)
  if (idx >= 0) all[idx] = record
  else all.push(record)
  writeJSON(KEYS.sessions, all)

  // تحديث ملف المتدربة تلقائيًا
  if (record.studentName) {
    upsertStudentFromSession(record)
  }
  return record
}

export function getSessions() {
  const all = readJSON(KEYS.sessions, [])
  return [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getSessionById(sessionId) {
  return getSessions().find((s) => s.sessionId === sessionId) || null
}

export function getStudentSessions(studentName) {
  if (!studentName) return []
  return getSessions().filter((s) => s.studentName === studentName)
}

export function clearSessions() {
  writeJSON(KEYS.sessions, [])
}

// ---------- Students ----------
export function saveStudentProfile(profile) {
  const all = readJSON(KEYS.students, [])
  const rec = { ...profile }
  if (!rec.name) return null
  const idx = all.findIndex((s) => s.name === rec.name)
  if (idx >= 0) all[idx] = { ...all[idx], ...rec, updatedAt: new Date().toISOString() }
  else all.push({ ...rec, createdAt: new Date().toISOString() })
  writeJSON(KEYS.students, all)
  return rec
}

export function getStudents() {
  return readJSON(KEYS.students, [])
}

export function getStudentProfile(name) {
  return getStudents().find((s) => s.name === name) || null
}

function upsertStudentFromSession(session) {
  const all = readJSON(KEYS.students, [])
  const existing = all.find((s) => s.name === session.studentName)
  const sessions = getSessions().filter((s) => s.studentName === session.studentName)
  const payload = {
    name: session.studentName,
    userType: session.userType || existing?.userType || 'general',
    sessionsCount: sessions.length,
    lastLevel: session.nextLevel || session.startLevel || 'easy',
    lastResult: session.result || null,
    updatedAt: new Date().toISOString(),
  }
  if (existing) Object.assign(existing, payload)
  else all.push({ ...payload, createdAt: new Date().toISOString() })
  writeJSON(KEYS.students, all)
}

// ---------- Admin demo session ----------
export function setAdminLoggedIn(flag) {
  if (flag) writeJSON(KEYS.adminSession, { loggedIn: true, at: new Date().toISOString() })
  else localStorage.removeItem(KEYS.adminSession)
}

export function isAdminLoggedIn() {
  return !!readJSON(KEYS.adminSession, null)?.loggedIn
}

// ---------- إحصاءات عامة للوحة المشرف ----------
export function getSummaryStats() {
  const sessions = getSessions()
  const students = getStudents()
  const total = sessions.length
  const reached = sessions.filter((s) => s.reachedAssembly).length
  const avgTime = total
    ? sessions.reduce((a, s) => a + (Number(s.evacTimeSec) || 0), 0) / total
    : 0
  const avgErrors = total
    ? sessions.reduce((a, s) => a + (Number(s.errors) || 0), 0) / total
    : 0
  return {
    totalSessions: total,
    totalStudents: students.length,
    avgEvacTime: Math.round(avgTime * 10) / 10,
    avgErrors: Math.round(avgErrors * 100) / 100,
    reachRate: total ? Math.round((reached / total) * 100) : 0,
  }
}
