// ============================================================
// SafeSense VR — الإعدادات العامة
// ============================================================
// ملاحظة: بيانات دخول المشرف هنا للنسخة التجريبية (Demo) فقط
// وليست حماية إنتاجية. عند الانتقال إلى Supabase/Auth حقيقي
// يجب نقل المصادقة إلى Backend.

export const APP_CONFIG = {
  appName: 'SafeSense VR',
  appSubtitle: 'التدريب الافتراضي التكيفي للسلامة والإخلاء',
  admin: {
    username: 'admin',
    password: '1234',
  },
  emergencyDelaySec: 5,      // بدء الطوارئ بعد N ثوانٍ من دخول المشهد
  helpAfterNoMoveSec: 10,    // إظهار المساعدة بعد N ثوانٍ بدون حركة
  stopThresholdSec: 3,       // تعريف التوقف: عدم حركة أكثر من N ثوانٍ
  moveThreshold: 0.35,       // أقل مسافة تُعتبر حركة (بالمتر)
  version: '1.0.0',
}

export const USER_TYPES = [
  { id: 'general',  label: 'تدريب عام',   icon: '🎓', desc: 'التعليمات والصوت والمؤشرات الطبيعية' },
  { id: 'visual',   label: 'ضعف بصري',    icon: '🔊', desc: 'توجيه صوتي أوضح وتباين عالٍ' },
  { id: 'hearing',  label: 'ضعف سمعي',    icon: '👁️', desc: 'تنبيهات بصرية ووميض ورسائل نصية' },
  { id: 'motor',    label: 'إعاقة حركية', icon: '♿', desc: 'مسار واسع بلا عوائق وسرعة قابلة للضبط' },
  { id: 'learning', label: 'صعوبات تعلم', icon: '📝', desc: 'تعليمات قصيرة خطوة بخطوة' },
]

export const LEVELS = ['easy', 'medium', 'hard']

export const LEVEL_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }

export function userTypeLabel(id) {
  return (USER_TYPES.find((u) => u.id === id) || {}).label || id
}
