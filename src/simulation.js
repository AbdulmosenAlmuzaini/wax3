// ============================================================
// SafeSense VR — منطق المحاكاة: الإنذار، الطوارئ، المساعدة، الصوت
// ============================================================
import { WORLD } from './scene.js'

// ---------- مدير الصوت: التنفيذ المركزي في src/audioManager.js ----------
// يُعاد التصدير من هنا للتوافق الخلفي مع أي استيراد قديم.
export { AudioManager } from './audioManager.js'

// ---------- توجيه صوتي (Web Speech API) مع fallback نصي ----------
export function speak(text, userType) {
  // يُستخدم أساسًا لضعف البصر، ومتاح للجميع
  try {
    if (!('speechSynthesis' in window)) return false
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ar-SA'
    u.rate = userType === 'learning' ? 0.85 : 1
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

// ---------- رسائل المساعدة حسب نوع المستخدم ----------
export function helpContent(userType, scenario) {
  const exitName = scenario.correctExit === 'main' ? 'المخرج الرئيسي (شرق)' : 'المخرج البديل (غرب)'
  switch (userType) {
    case 'visual':
      return {
        title: 'توجيه صوتي 🗣️',
        text: `استمر بالتقدم. ${exitName}. اتبع صوت الإنذار والأسهم الصفراء اللامعة.`,
        speak: `انتبه. اتجه نحو ${exitName} ثم إلى منطقة التجمع.`,
      }
    case 'hearing':
      return {
        title: 'تنبيه بصري ⚠️',
        text: `⬆️ اتبع الأسهم الخضراء الكبيرة نحو ${exitName} ثم إلى منطقة التجمع!`,
        flash: true,
      }
    case 'motor':
      return {
        title: 'مسار ميسّر ♿',
        text: `الممر أمامك واسع وخالٍ من العوائق. تقدم بهدوء نحو ${exitName}. يمكنك إبطاء السرعة من الأسفل.`,
      }
    case 'learning':
      return {
        title: 'خطوة واحدة 🙂',
        text: `اخرج من الفصل.`,
        steps: ['اخرج من الفصل', 'اتبع الأسهم', 'اذهب إلى منطقة التجمع'],
      }
    default:
      return {
        title: 'مساعدة 💡',
        text: `اتبع الأسهم نحو ${exitName} ثم واصل إلى منطقة التجمع خارج المدرسة.`,
      }
  }
}

export function instructionFor(userType, scenario, phase) {
  const exitName = scenario.correctExit === 'main' ? 'المخرج الرئيسي' : 'المخرج البديل'
  if (userType === 'learning') {
    if (phase === 'pre') return 'اجلس. انتظر.'
    if (phase === 'go-class') return 'اخرج من الفصل.'
    return 'اتبع الأسهم.'
  }
  if (phase === 'pre') return 'أنت داخل الفصل. انتظر بدء حالة الطوارئ واستعد للإخلاء.'
  return `${scenario.briefing || ''} (${exitName})`
}

// ---------- فحص المواقع: مخارج / دخان / تجمع ----------
export function detectZones(pos, scenario) {
  const res = { atMainExit: false, atAltExit: false, inSmoke: false, atAssembly: false, atWrongArea: false }
  if (pos.x > 13.6 && pos.z > 8.4 && pos.z < 11.6) res.atMainExit = true
  if (pos.x < -13.6 && pos.z > 8.4 && pos.z < 11.6) res.atAltExit = true
  for (const s of scenario.smokeZones || []) {
    if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.r) res.inSmoke = true
  }
  const a = WORLD.assembly
  if (Math.hypot(pos.x - a.x, pos.z - a.z) < a.r) res.atAssembly = true
  // منطقة خاطئة: العودة داخل الفصل بعمق بعد مغادرته، أو الذهاب لأقصى الشمال
  if (pos.z < 2 && pos.x < -4) res.atWrongArea = true
  return res
}
