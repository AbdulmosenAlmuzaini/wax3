// ============================================================
// SafeSense VR — trainingConfig: البيانات المطلوبة قبل TRAINING_3D
// {
//   traineeName: string,
//   userType: 'general' | 'visual' | 'hearing' | 'motor' | 'learning',
//   scenarioId: 'fire-basic' | 'fire-main-blocked' | 'smoke-corridor' | 'alt-exit-choice' (+aliases),
//   startingLevel: 'easy' | 'medium' | 'hard'
// }
// الحفظ في sessionStorage: يبقى أثناء التنقل والـ refresh داخل نفس التبويب،
// ويُمسح بإغلاق التبويب — لذلك refresh على #/simulation بدون config مستحيل
// إلا إذا كان config محفوظًا فعلًا في نفس الجلسة.
// ============================================================
import { USER_TYPES, LEVELS } from '../config/appConfig.js'
import { SCENARIOS } from '../scenarios.js'
import { resolveScenarioId } from '../audioManager.js'

const KEY = 'safesense_training_config_v1'

const VALID_USER_TYPES = new Set(USER_TYPES.map((u) => u.id))
const VALID_LEVELS = new Set(LEVELS)
function validScenarioIds() {
  const ids = new Set(SCENARIOS.map((s) => s.id))
  // aliases المدعومة في audioManager
  ids.add('fire-blocked')
  ids.add('smoke')
  ids.add('alternate-exit')
  return ids
}

/** إرجاع trainingConfig المحفوظ أو null */
export function getTrainingConfig() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw)
    return cfg && typeof cfg === 'object' ? cfg : null
  } catch {
    return null
  }
}

/** هل الـ config صالح للدخول إلى TRAINING_3D؟ (userType + scenarioId إلزاميان) */
export function isTrainingConfigValid(cfg = getTrainingConfig()) {
  if (!cfg || typeof cfg !== 'object') return false
  if (!cfg.userType || !VALID_USER_TYPES.has(cfg.userType)) return false
  if (!cfg.scenarioId || !validScenarioIds().has(cfg.scenarioId)) return false
  return true
}

/** حفظ trainingConfig بعد التحقق — يُستخدم فقط من زر "دخول المحاكاة 3D" */
export function setTrainingConfig(cfg) {
  const normalized = {
    traineeName: String(cfg?.traineeName || '').trim(),
    userType: cfg?.userType || '',
    scenarioId: cfg?.scenarioId || '',
    startingLevel: VALID_LEVELS.has(cfg?.startingLevel) ? cfg.startingLevel : 'easy',
  }
  if (!normalized.traineeName) {
    normalized.traineeName = 'متدربة_' + Math.floor(Math.random() * 900 + 100)
  }
  // canonicalize aliases إلى الـ IDs الفعلية
  try { normalized.scenarioId = resolveScenarioId(normalized.scenarioId) || normalized.scenarioId } catch {}
  if (!isTrainingConfigValid(normalized)) return null
  try {
    sessionStorage.setItem(KEY, JSON.stringify(normalized))
  } catch {}
  return normalized
}

export function clearTrainingConfig() {
  try { sessionStorage.removeItem(KEY) } catch {}
}
