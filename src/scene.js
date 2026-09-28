// ============================================================
// SafeSense VR — بناء بيئة المدرسة 3D (خفيف ومناسب للمتصفح)
// فصل + ممر + مخرجان + منطقة تجمع. يقرأ config السيناريو فقط.
// الصلاحيات: scene.js لا يقرر السيناريو — يستقبله كبراميتر.
// ============================================================
import * as THREE from 'three'

export const WORLD = {
  classroom: { x0: -6, x1: 6, z0: 0, z1: 8 },
  corridor: { x0: -15, x1: 15, z0: 8, z1: 12 },
  assembly: { x: 0, z: 22, r: 3 },
  doorClass: { x: 4, z: 8, w: 1.6 },
  exitMain: { x: 15, z: 10, w: 2.4 },
  exitAlt: { x: -15, z: 10, w: 2.4 },
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts })
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts.material || {}))
  m.position.set(x, y, z)
  m.castShadow = false
  m.receiveShadow = false
  if (opts.name) m.name = opts.name
  return m
}

function wallWithGap(len, height, thick, gapCenter, gapWidth, color) {
  // جدار على المحور X مع فجوة باب — يُبنى من قطعتين
  const group = new THREE.Group()
  const side = (len - gapWidth) / 2
  const leftLen = gapCenter - gapWidth / 2 + len / 2
  const rightLen = len / 2 - (gapCenter + gapWidth / 2)
  const mk = (l, cx) => {
    if (l <= 0.01) return null
    const w = box(l, height, thick, color, cx, height / 2, 0)
    return w
  }
  const a = mk(leftLen, -len / 2 + leftLen / 2)
  const b = mk(rightLen, len / 2 - rightLen / 2)
  if (a) group.add(a)
  if (b) group.add(b)
  return group
}

export function buildSchool(scene, scenario, userType) {
  const refs = { arrows: [], smoke: [], exits: {}, doors: {}, guides: [], barriers: [] }
  scene.background = new THREE.Color(0xeef3f6)
  scene.fog = new THREE.Fog(0xeef3f6, 30, 90)

  // --- إضاءة أساسية ---
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c4c9, 0.95)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(10, 18, 8)
  scene.add(dir)
  const emergencyLight = new THREE.PointLight(0xff5533, 0, 40)
  emergencyLight.position.set(0, 4, 10)
  scene.add(emergencyLight)
  refs.emergencyLight = emergencyLight

  // --- أرضيات ---
  const floorClass = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), mat(0xdfe9ef))
  floorClass.rotation.x = -Math.PI / 2
  floorClass.position.set(0, 0, 4)
  scene.add(floorClass)

  const floorCorr = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), mat(0xcfd9de))
  floorCorr.rotation.x = -Math.PI / 2
  floorCorr.position.set(0, 0.001, 10)
  scene.add(floorCorr)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0xe6efe3))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.02, 20)
  scene.add(ground)

  // ممر خارجي نحو منطقة التجمع
  const path = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), mat(0xd8d2c4))
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.005, 17)
  scene.add(path)

  const WALL_H = 3
  const wallColor = 0xf5f1e6
  const accent = userType === 'visual' ? 0x222222 : 0x9fb3bd

  // --- جدران الفصل ---
  const cls = WORLD.classroom
  // شمال (السبورة)
  scene.add(Object.assign(box(12, WALL_H, 0.3, wallColor, 0, WALL_H / 2, 0), {}))
  // غرب وشرق
  scene.add(box(0.3, WALL_H, 8, wallColor, -6, WALL_H / 2, 4))
  scene.add(box(0.3, WALL_H, 8, wallColor, 6, WALL_H / 2, 4))
  // جنوب مع باب الفصل (فجوة عند x=4)
  const southWall = wallWithGap(12, WALL_H, 0.3, 4, 1.8, wallColor)
  southWall.position.set(0, 0, 8)
  scene.add(southWall)

  // --- جدران الممر ---
  const corr = WORLD.corridor
  // الجدار الشمالي للممر هو نفسه southWall للفصل + امتداد
  const northCorrL = box(9, WALL_H, 0.3, wallColor, -10.5, WALL_H / 2, 8)
  const northCorrR = box(9, WALL_H, 0.3, wallColor, 10.5, WALL_H / 2, 8)
  scene.add(northCorrL, northCorrR)
  // الجدار الجنوبي للممر (مصمت — الخروج فقط من الشرق/الغرب)
  scene.add(box(30, WALL_H, 0.3, wallColor, 0, WALL_H / 2, 12))
  // جدار الشرق مع فجوة المخرج الرئيسي
  const eastWall = new THREE.Group()
  const ez = WORLD.exitMain.z
  const egap = WORLD.exitMain.w
  const eTop = box(0.3, WALL_H, (4 - egap) / 2, wallColor, 0, WALL_H / 2, 8 + (4 - egap) / 4)
  const eBot = box(0.3, WALL_H, (4 - egap) / 2, wallColor, 0, WALL_H / 2, 12 - (4 - egap) / 4)
  eastWall.add(eTop, eBot)
  eastWall.position.set(15, 0, 0)
  scene.add(eastWall)
  // جدار الغرب مع فجوة المخرج البديل
  const westWall = new THREE.Group()
  const wTop = box(0.3, WALL_H, (4 - egap) / 2, wallColor, 0, WALL_H / 2, 8 + (4 - egap) / 4)
  const wBot = box(0.3, WALL_H, (4 - egap) / 2, wallColor, 0, WALL_H / 2, 12 - (4 - egap) / 4)
  westWall.add(wTop, wBot)
  westWall.position.set(-15, 0, 0)
  scene.add(westWall)

  // أبواب فصول جانبية (ديكور مغلق على الجدار الشمالي للممر)
  const dxArr = [-10, -4, 8, 12]
  const classNames = ['فصل ١', 'فصل ٢', 'فصل ٣', 'فصل ٤']
  for (let i = 0; i < dxArr.length; i++) {
    const dx = dxArr[i]
    const d = box(1.4, 2.2, 0.12, 0x8aa0aa, dx, 1.1, 8.22)
    scene.add(d)
    
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = userType === 'visual' ? '#000000' : 'rgba(255,255,255,0.92)'
    ctx.roundRect ? ctx.roundRect(0, 0, 256, 128, 12) : ctx.rect(0, 0, 256, 128)
    ctx.fill()
    ctx.fillStyle = userType === 'visual' ? '#ffffff' : '#123'
    ctx.font = 'bold 54px Cairo, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.direction = 'rtl'
    ctx.fillText(classNames[i], 128, 64)
    
    const tex = new THREE.CanvasTexture(c)
    const plaqueMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), plaqueMat)
    
    plaque.position.set(dx - 1.0, 1.6, 8.16)
    scene.add(plaque)
  }

  // --- السبورة + مكتب المعلم ---
  const boardBg = box(4.4, 1.4, 0.12, 0x113322, 0, 1.9, 0.25)
  scene.add(boardBg)

  const cBoard = document.createElement('canvas')
  cBoard.width = 2048
  cBoard.height = 512
  const ctxB = cBoard.getContext('2d')
  
  // خلفية السبورة خضراء لجميع المحاكات
  ctxB.fillStyle = '#0a4d2e'
  if (ctxB.roundRect) ctxB.roundRect(16, 16, 2016, 480, 32)
  else ctxB.rect(16, 16, 2016, 480)
  ctxB.fill()
  
  ctxB.fillStyle = '#ffffff' // كتابة بيضاء
  ctxB.textAlign = 'center'
  ctxB.textBaseline = 'middle'
  ctxB.direction = 'rtl'

  const isHearing = userType === 'hearing'
  const boardMsg = isHearing
    ? 'تنبيه للإخلاء: اتبع الشريط الأحمر أسفل الشاشة\nوالمسار الأخضر على الأرض نحو منطقة التجمع'
    : 'عند الإنذار: حافظ على هدوئك، اتبع الإرشادات، واتجه إلى منطقة التجمع\nإذا لم تتقدم خلال ٥ ثوانٍ، يهدأ صوت الإنذار وتظهر إرشادات إضافية'

  ctxB.font = 'bold 58px Cairo, Arial'
  const linesB = boardMsg.split('\n')
  const startYB = 210 - ((linesB.length - 1) * 80) / 2
  linesB.forEach((line, i) => {
    ctxB.fillText(line, 1024, startYB + i * 80)
  })

  // تذييل السبورة بجانب بعض مع مسافة معقولة
  ctxB.font = 'bold 36px Cairo, Arial'
  ctxB.fillStyle = '#a8e6cf'
  const footerStr = "عنوان الدرس : كيف نتصرف بأمان أثناء الطوارئ؟         |         مطورة المشروع : ميان طارق القثامي         |         اسم المشروع : SafeSense VR"
  ctxB.fillText(footerStr, 1024, 440)

  const texB = new THREE.CanvasTexture(cBoard)
  const boardText = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.05),
    new THREE.MeshLambertMaterial({ map: texB, transparent: true, side: THREE.DoubleSide })
  )
  boardText.position.set(0, 1.9, 0.32)
  scene.add(boardText)
  scene.add(box(2.2, 0.75, 0.9, 0x8a6a45, 0, 0.375, 1.6, { name: 'teacherDesk' }))
  scene.add(box(0.8, 0.5, 0.5, 0x5b4632, -3.5, 0.9, 1.2, { name: 'chairT' }))

  // --- طاولات وكراسي التلاميذ (3×3) ---
  const deskC = userType === 'visual' ? 0xffd23f : 0xc9a86a
  const chairC = 0x6b7f8a
  const obstacle = userType === 'motor' ? 2 : 0 // للإعاقة الحركية: ممرات أوسع (صفوف أقل ازدحامًا)
  const rows = [3.2, 4.8, 6.4]
  const cols = obstacle ? [-3, 0.5, 4] : [-3.4, 0, 3.4]
  rows.forEach((rz, ri) => {
    cols.forEach((cx, ci) => {
      if (obstacle && ri === 1 && ci === 1) return // ممر واسع خالٍ من العوائق
      scene.add(box(1.1, 0.06, 0.7, deskC, cx, 0.74, rz))
      for (const [lx, lz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) {
        scene.add(box(0.06, 0.72, 0.06, 0x7a6a55, cx + lx, 0.36, rz + lz))
      }
      scene.add(box(0.5, 0.06, 0.5, chairC, cx, 0.46, rz + 0.85))
      scene.add(box(0.5, 0.5, 0.06, chairC, cx, 0.75, rz + 1.1))
    })
  })

  // --- باب الفصل (مفتوح دائمًا) ---
  const doorFrame = box(0.15, 2.3, 2.0, 0x7d8b93, 4.9, 1.15, 8)
  doorFrame.visible = false
  const doorLeaf = box(0.08, 2.1, 0.9, 0xa9743f, 3.0, 1.05, 8)
  doorLeaf.rotation.y = 0.6
  scene.add(doorLeaf)
  refs.doors.classroom = doorLeaf

  // --- المخرجان ---
  refs.exits.main = buildExitDoor(scene, 15, 10, 'المخرج الرئيسي', scenario.blockedExit === 'main', userType)
  refs.exits.alt = buildExitDoor(scene, -15, 10, 'المخرج البديل', scenario.blockedExit === 'alt', userType)
  if (scenario.blockedExit === 'main' || scenario.blockedExit === 'alt') {
    refs.barriers.push(refs.exits[scenario.blockedExit].barrier)
  }

  // --- لافتات EXIT مضيئة ---
  // (تم إزالة اللوحات العائمة المكررة هنا، تم الإبقاء على لافتات الأبواب فقط)

  // --- مناطق الدخان ---
  for (const z of scenario.smokeZones || []) {
    const smoke = buildSmoke(scene, z.x, z.z, z.r, userType)
    refs.smoke.push(smoke)
  }

  // --- منطقة التجمع ---
  const asm = WORLD.assembly
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(asm.r - 0.35, asm.r, 40),
    new THREE.MeshBasicMaterial({ color: userType === 'visual' ? 0xffff00 : 0x00b36b, side: THREE.DoubleSide })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.set(asm.x, 0.02, asm.z)
  scene.add(ring)
  const pole = box(0.12, 3, 0.12, 0x2e7d32, asm.x, 1.5, asm.z)
  scene.add(pole)
  const flag = makeTextPlane('📍 منطقة التجمع', userType, '#0a7a3d')
  flag.position.set(asm.x, 3.4, asm.z - 0.07)
  flag.rotation.y = Math.PI // Face the school
  flag.scale.set(0.8, 0.8, 1)
  scene.add(flag)
  refs.assemblyRing = ring
  refs.assemblyFlag = flag

  // --- أسهم الإرشاد 3D (تتبع correctExit) ---
  buildArrows(scene, refs, scenario, userType)

  // تباين عالٍ لضعف البصر: حدود صفراء حول العناصر المهمة
  if (userType === 'visual') {
    for (const a of refs.arrows) {
      if (a.material) {
        a.material.color = new THREE.Color(0xffff00)
        a.material.emissive = new THREE.Color(0x555500)
      }
    }
  }
  return refs
}

function buildExitDoor(scene, x, z, label, blocked, userType) {
  const g = new THREE.Group()
  const frameC = blocked ? 0xb71c1c : 0x2e7d32
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 2.6), mat(frameC))
  frame.position.set(x, 1.3, z)
  g.add(frame)
  let barrier = null
  if (blocked) {
    barrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.3, 2.3),
      new THREE.MeshLambertMaterial({ color: 0xc62828, transparent: true, opacity: 0.92 })
    )
    barrier.position.set(x, 1.15, z)
    barrier.name = 'blockedBarrier'
    g.add(barrier)
    const warn = makeTextPlane('⛔ مغلق — خطر', userType, '#b71c1c')
    warn.position.set(x + (x > 0 ? -0.17 : 0.17), 2.2, z)
    warn.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2
    warn.scale.set(0.6, 0.6, 1)
    scene.add(warn)
    // لهب بسيط (مخروط برتقالي نابض)
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.85 })
    )
    flame.position.set(x + (x > 0 ? -1 : 1), 0.8, z)
    flame.name = 'flame'
    g.add(flame)
    g.userData.flame = flame
  } else {
    const open = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.2, 2.0),
      new THREE.MeshLambertMaterial({ color: 0xe8f5e9, transparent: true, opacity: 0.35 })
    )
    open.position.set(x, 1.1, z)
    g.add(open)
  }
  
  // لافتة فوق الباب
  const s = makeTextPlane(label, userType, blocked ? '#b71c1c' : '#0a7a3d')
  s.position.set(x + (x > 0 ? -0.16 : 0.16), 2.8, z)
  s.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2
  s.scale.set(0.6, 0.6, 1)
  scene.add(s)
  
  scene.add(g)
  return { group: g, barrier, blocked, label, sign: s }
}

function buildSmoke(scene, x, z, r, userType) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const color = userType === 'visual' ? 0x555555 : 0x9aa5ab
  const geo = new THREE.SphereGeometry(r, 16, 12)
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.75 })
  )
  m.position.set(0, 1.2, 0)
  m.scale.y = 0.8
  g.add(m)
  const geo2 = new THREE.SphereGeometry(r * 0.6, 12, 10)
  const m2 = new THREE.Mesh(
    geo2,
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85 })
  )
  m2.position.set(r * 0.2, 1.0, -r * 0.2)
  m2.scale.y = 0.7
  g.add(m2)
  scene.add(g)
  return { group: g, x, z, r }
}

function buildArrows(scene, refs, scenario, userType) {
  const correctExit = scenario.correctExit;
  // مسار مبسط: الفصل (4,6) → باب الفصل (4,8) → الممر → المخرج الصحيح → خارج → التجمع
  let pts =
    correctExit === 'main'
      ? [[4, 5], [4, 8.6], [7, 10], [11, 10], [14, 10], [17, 10], [14, 15], [6, 19], [0, 21]]
      : [[4, 5], [4, 8.6], [1, 10], [-5, 10], [-10, 10], [-14, 10], [-17, 10], [-12, 15], [-4, 19], [0, 21]];
      
  if (scenario.id === 'smoke-corridor') {
    // Route safely around smoke (smoke is at x=13.0, z=11.2, r=1.2)
    pts = [[4, 5], [4, 9.0], [8, 9.0], [13.0, 9.0], [14.6, 10], [17, 10], [14, 15], [6, 19], [0, 21]];
  }
  const big = userType === 'hearing' || userType === 'visual'
  const color = userType === 'visual' ? 0xffff00 : correctExit === 'main' ? 0x00c853 : 0xff9100

  // خط أصفر عريض على الأرض لضعف البصر
  if (userType === 'visual') {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    // رسم الوصلات الدائرية عند النقاط (لتدوير الزوايا وتغطية الفراغات)
    const circleGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.01, 16);
    for (let i = 0; i < pts.length; i++) {
      const joint = new THREE.Mesh(circleGeo, mat);
      joint.position.set(pts[i][0], 0.02, pts[i][1]);
      scene.add(joint);
    }
    // رسم القطع المستقيمة بين النقاط
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const dist = Math.hypot(dx, dz);
      if (dist === 0) continue;
      
      const geo = new THREE.BoxGeometry(0.3, 0.01, dist);
      const mesh = new THREE.Mesh(geo, mat);
      
      mesh.position.set(p1[0] + dx / 2, 0.02, p1[1] + dz / 2);
      mesh.rotation.y = Math.atan2(dx, dz);
      scene.add(mesh);
    }
  }

  // علامات خضراء مضيئة على الأرض لضعف السمع
  if (userType === 'hearing') {
    refs.pathSigns = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const geom = new THREE.PlaneGeometry(1.2, 1.2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.03, z);
      mesh.userData.idx = i;
      scene.add(mesh);
      refs.pathSigns.push(mesh);
    }
  }

  for (const [x, z] of pts) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(big ? 0.55 : 0.38, big ? 1.0 : 0.7, 4),
      new THREE.MeshBasicMaterial({ color })
    )
    cone.rotation.x = Math.PI / 2
    // اتجاه تقريبي نحو النقطة التالية handled by lookAt below
    cone.position.set(x, 1.5, z)
    const idx = pts.findIndex((p) => p[0] === x && p[1] === z)
    const next = pts[Math.min(idx + 1, pts.length - 1)]
    cone.lookAt(next[0], 1.5, next[1])
    cone.rotateX(Math.PI / 2)
    scene.add(cone)
    refs.arrows.push(cone)
  }
}

export function makeTextPlane(text, userType, color = '#123', fontSize = 52, bgColor = null) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = bgColor || (userType === 'visual' ? '#000000' : 'rgba(255,255,255,0.92)')
  const r = 24
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(8, 8, 1008, 240, r) : ctx.rect(8, 8, 1008, 240)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = `bold ${fontSize}px Cairo, Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = 'rtl'
  
  const lines = text.split('\n')
  const lineHeight = fontSize + 15
  const startY = 128 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, 512, startY + i * lineHeight)
  })
  
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), mat)
  return mesh
}

// نبض الأسهم + الدخان + اللهب — يُستدعى كل إطار
export function animateWorld(refs, t, emergencyActive, timeSinceEmergency = 0) {
  const s = 1 + Math.sin(t * (emergencyActive ? 5 : 2)) * 0.12
  for (const a of refs.arrows) {
    a.scale.setScalar(s)
    a.position.y = 1.5 + Math.sin(t * 3 + a.position.x) * 0.12
  }
  if (refs.pathSigns && emergencyActive) {
    for (const sign of refs.pathSigns) {
      const delay = sign.userData.idx * 0.5;
      if (timeSinceEmergency > delay) {
        sign.material.opacity = Math.max(0, 0.4 + Math.sin(timeSinceEmergency * 4) * 0.3);
      } else {
        sign.material.opacity = 0;
      }
    }
  }
  for (const sm of refs.smoke || []) {
    sm.group.rotation.y = t * 0.25
    sm.group.position.y = Math.sin(t * 1.5) * 0.1
  }
  for (const key of ['main', 'alt']) {
    const f = refs.exits?.[key]?.group?.userData?.flame
    if (f) f.scale.set(1 + Math.sin(t * 9) * 0.18, 1 + Math.sin(t * 11) * 0.25, 1)
  }
  if (refs.emergencyLight) {
    refs.emergencyLight.intensity = emergencyActive ? 0.6 + Math.sin(t * 3) * 0.2 : 0
  }
  if (refs.assemblyRing) {
    refs.assemblyRing.scale.setScalar(1 + Math.sin(t * 2.5) * 0.05)
  }
}
