// ============================================================
// SafeSense VR — محرك التدريب التكيفي (Rules واضحة، بدون AI API)
// ============================================================
// calculateNextLevel(sessionResult) -> 'easy' | 'medium' | 'hard'
// القواعد قابلة للتعديل من هنا فقط.

export function calculateNextLevel(r) {
  const errors = Number(r.errors || 0)
  const stops = Number(r.stopsCount || 0)
  const time = Number(r.evacTimeSec || 999)
  const reached = !!r.reachedAssembly
  const usedHelp = !!r.helpUsed
  const wrongExit = r.usedCorrectExit === false

  // فشل واضح → سهّل
  if (!reached) return 'easy'
  if (wrongExit && errors >= 2) return 'easy'
  if (errors >= 4 || stops >= 5) return 'easy'

  // أداء ممتاز → صعّب
  const goodTime = time <= 75
  if (reached && errors === 0 && !usedHelp && goodTime && !wrongExit) {
    if (r.startLevel === 'easy') return 'medium'
    return 'hard'
  }

  // أداء جيد → حافظ أو ارفع درجة واحدة
  if (reached && errors <= 1 && stops <= 2 && !wrongExit) {
    if (r.startLevel === 'easy') return 'medium'
    if (r.startLevel === 'medium') return time <= 90 ? 'hard' : 'medium'
    return 'hard'
  }

  // أداء متوسط → ابقَ أو انزل درجة
  if (errors <= 2 && stops <= 3) return r.startLevel === 'hard' ? 'medium' : r.startLevel || 'medium'

  // غير ذلك → المستوى الأسهل احتياطًا
  return 'easy'
}

export function levelAdvice(level) {
  if (level === 'hard') return 'أداء ممتاز! التدريب القادم سيكون أكثر تحديًا.'
  if (level === 'medium') return 'أداء جيد. التدريب القادم بمستوى متوسط.'
  return 'لا بأس — سنعيد التدريب بمستوى أسهل لتثبيت الأساسيات.'
}

export function recommendScenario(level, scenarios) {
  const match = scenarios.find((s) => s.difficulty === level)
  return match || scenarios[0]
}
