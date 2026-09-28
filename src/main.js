// ============================================================
// SafeSense VR — نقطة الدخول + Hash Routing معماري واضح
//
// الحالات الأربع فقط:
//   HOME          → #/ أو #/home
//   TRAINING_SETUP→ #/train (و #/setup كاسم بديل قديم)
//   TRAINING_3D   → #/simulation (و #/sim كاسم بديل قديم)
//                   * فقط إذا وُجد trainingConfig صالح، وإلا redirect → #/train
//   ADMIN         → #/admin
//
// القاعدة الصارمة: لا يوجد أي auto-start.
// لا initScene / startSimulation / startTraining على مستوى الوحدة.
// المحاكاة 3D تُبنى فقط داخل enterSimulation() بعد:
//   1) trainingConfig صالح في sessionStorage
//   2) المستخدم في #/simulation
//   3) ضغط زر "ابدأ التجربة" داخل Intro الـ TRAINING_3D
// ============================================================
import './styles.css'
import { renderHome, renderSetup, startTraining } from './ui.js'
import { renderAdminLogin, renderDashboard, XR_READY_NOTES } from './admin/admin.js'
import { isAdminLoggedIn } from './services/storage.js'
import { isTrainingConfigValid } from './services/trainingConfig.js'

const views = {
  home: document.getElementById('home-view'),
  train: document.getElementById('training-view'),
  simulation: document.getElementById('simulation-view'),
  admin: document.getElementById('admin-view')
}

// حالة خفيفة للجلسة (اختيارات شاشة الإعداد + تبويبات المشرف)
// ملاحظة: trainingConfig الرسمي يُحفظ في sessionStorage عبر
// src/services/trainingConfig.js — وليس هنا.
const state = {
  studentName: '',
  userType: null, // null = لم يختر بعد (مقصود: لا default صالح)
  scenarioId: null, // null = لم يختر بعد (مقصود: لا default صالح)
  startLevel: 'easy',
  filters: {},
  adminTab: 'overview',
  openSession: null,
}

let cleanupTrain = null
function disposeTrain() {
  if (cleanupTrain) { try { cleanupTrain() } catch {} cleanupTrain = null }
  document.body.classList.remove('emergency')
}

function normalizeHash(raw) {
  const h = (raw || '').split('?')[0]
  if (h === '' || h === '#/' || h === '#/home') return 'home'
  if (h.startsWith('#/train') || h.startsWith('#/setup')) return 'train'
  if (h.startsWith('#/simulation') || h.startsWith('#/sim')) return 'simulation'
  if (h.startsWith('#/admin')) return 'admin'
  return 'home'
}

/**
 * النقطة الوحيدة المسموح فيها ببناء المحاكاة 3D.
 * تُستدعى فقط من route() عندما يكون المسار #/simulation
 * ومعه trainingConfig صالح. لا تُستدعى أبدًا عند load مباشرة.
 */
function enterSimulation() {
  return startTraining(views.simulation, state)
}

function route() {
  const page = normalizeHash(location.hash)
  disposeTrain()
  window.scrollTo(0, 0)
  
  // إخفاء كل الـ Views وتفريغها
  Object.values(views).forEach(v => {
    if (v) {
      v.style.display = 'none'
      v.innerHTML = ''
    }
  })

  if (page === 'train') {
    if (views.train) views.train.style.display = 'block'
    renderSetup(views.train, state)
    return
  }

  if (page === 'simulation') {
    // Guard معماري: بدون userType + scenarioId صالحين → عودة إجبارية للإعداد
    if (!isTrainingConfigValid()) {
      location.hash = '#/train'
      return
    }
    if (views.simulation) views.simulation.style.display = 'block'
    cleanupTrain = enterSimulation()
    return
  }

  if (page === 'admin') {
    if (!isAdminLoggedIn() && location.hash !== '#/admin') { location.hash = '#/admin'; return }
    if (views.admin) views.admin.style.display = 'block'
    
    if (!isAdminLoggedIn()) renderAdminLogin(views.admin)
    else renderDashboard(views.admin, state)
    return
  }

  // HOME هو الافتراضي دائمًا: / أو #/ أو #/home أو أي hash غير معروف
  if (views.home) views.home.style.display = 'block'
  renderHome(views.home)
}

window.addEventListener('hashchange', route)
// أول تحميل: HOME دائمًا إلا إذا كان الـ hash يشير صراحة لصفحة أخرى
// (وحتى #/simulation يخضع للـ guard أعلاه → redirect لـ #/train بدون config)
route()

// إتاحة ملاحظات WebXR في الكونسول للمطورين
console.info('%cSafeSense VR v1.0.0 — ' + XR_READY_NOTES, 'color:#0e7c5b')
