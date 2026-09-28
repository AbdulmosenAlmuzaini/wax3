// ============================================================
// SafeSense VR — تعريف سيناريوهات الطوارئ (ملف منفصل ومنظم)
// لا تربط السيناريوهات داخل scene.js — scene.js يقرأ هذا الـ config فقط.
// ============================================================

export const SCENARIOS = [
  {
    id: 'fire-basic',
    title: 'حريق - المسار الأساسي مفتوح',
    description: 'حريق في الممر، المخرج الرئيسي مفتوح والطريق واضح.',
    blockedExit: null,            // 'main' | 'alt' | null
    smokeZones: [],
    difficulty: 'easy',
    startLevel: 'easy',
    correctExit: 'main',
    briefing: 'اتبع الأسهم الخضراء نحو المخرج الرئيسي ثم إلى منطقة التجمع.',
    // النداء الصوتي (يُشغَّل عبر src/audioManager.js — مسار Vite مدمج في الـ build)
    announcement: 'voice-fire-basic.wav',
  },
  {
    id: 'fire-main-blocked',
    title: 'حريق - المخرج الرئيسي مغلق',
    description: 'المخرج الرئيسي مغلق بسبب النيران، استخدم المخرج البديل.',
    blockedExit: 'main',
    smokeZones: [{ x: 8, z: 10, r: 2.2 }],
    difficulty: 'medium',
    startLevel: 'medium',
    correctExit: 'alt',
    briefing: 'المخرج الرئيسي مغلق! اتبع الأسهم البرتقالية نحو المخرج البديل.',
    announcement: 'voice-fire-blocked.wav',
  },
  {
    id: 'smoke-corridor',
    title: 'دخان يحجب جزءًا من الطريق',
    description: 'دخان كثيف في منتصف الممر يتطلب الحذر وتغيير الاتجاه.',
    blockedExit: null,
    smokeZones: [
      { x: 13.0, z: 11.2, r: 1.2 }
    ],
    difficulty: 'medium',
    startLevel: 'medium',
    correctExit: 'main',
    briefing: 'تجنّب سحب الدخان الرمادية واتبع الأسهم نحو المخرج الرئيسي.',
    announcement: 'voice-smoke.wav',
  },
  {
    id: 'alt-exit-choice',
    title: 'اختيار مخرج بديل',
    description: 'حريق قرب المخرج الرئيسي — القرار الصحيح هو المخرج البديل.',
    blockedExit: 'main',
    smokeZones: [{ x: 11, z: 10, r: 2.8 }],
    difficulty: 'hard',
    startLevel: 'hard',
    correctExit: 'alt',
    briefing: 'قيّم الموقف: الدخان قرب المخرج الرئيسي. اختر المخرج البديل.',
    announcement: 'voice-alternate-exit.wav',
  },
]

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0]
}

export function scenariosForLevel(level) {
  const order = { easy: 0, medium: 1, hard: 2 }
  return [...SCENARIOS].sort(
    (a, b) => Math.abs(order[a.difficulty] - order[level]) - Math.abs(order[b.difficulty] - order[level])
  )
}
