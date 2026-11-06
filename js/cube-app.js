/**
 * 魔方启动页逻辑（按需加载）
 *
 * 这个文件只有在「首次访问 + 桌面端 + 未开启减少动态效果」时才会被动态 import，
 * 因此 three.module.js（~1.2MB）不会阻塞首屏，二次访问完全不加载。
 * 业务逻辑与原内嵌版本一致，仅补充了退出记忆与安全兜底。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

// ============ 国际化配置 ============
const i18n = {
  'zh-cn': {
    title: '解开魔方，进入博客',
    autoSolve: '自动还原',
    solving: '还原中...',
    manualMode: '手动模式',
    manualModeActive: '手动模式中',
    skip: '跳过',
    manualHint: '点击按钮旋转对应层 | 可拖动魔方调整视角',
    top: '上',
    bottom: '下',
    left: '左',
    right: '右',
    front: '前',
    back: '后',
    cw: '顺',
    ccw: '逆',
    directionHint: '顺=顺时针 | 逆=逆时针',
    congrats: '恭喜！魔方已还原',
    entering: '正在进入博客...',
    scrambleSteps: '魔方打乱步骤',
    solveSteps: '还原步骤',
    detailedSteps: '详细还原操作说明',
    step: '步骤',
    face: '面',
    cwRotate: '顺时针旋转',
    ccwRotate: '逆时针旋转'
  },
  'en': {
    title: 'Solve the Cube to Enter',
    autoSolve: 'Auto Solve',
    solving: 'Solving...',
    manualMode: 'Manual Mode',
    manualModeActive: 'Manual Mode',
    skip: 'Skip',
    manualHint: 'Click buttons to rotate layers | Drag cube to adjust view',
    top: 'U',
    bottom: 'D',
    left: 'L',
    right: 'R',
    front: 'F',
    back: 'B',
    cw: '↻',
    ccw: '↺',
    directionHint: '↻=Clockwise | ↺=Counter-Clockwise',
    congrats: 'Congratulations! Cube Solved!',
    entering: 'Entering blog...',
    scrambleSteps: 'Scramble Steps',
    solveSteps: 'Solve Steps',
    detailedSteps: 'Detailed Solve Instructions',
    step: 'Step',
    face: 'Face',
    cwRotate: 'Clockwise',
    ccwRotate: 'Counter-Clockwise'
  }
};

function getCurrentLang() {
  const htmlLang = document.documentElement.lang || 'en';
  if (htmlLang.startsWith('zh')) return 'zh-cn';
  return 'en';
}

function t(key) {
  const lang = getCurrentLang();
  return i18n[lang][key] || i18n['en'][key] || key;
}

function updateI18nText() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}

// ============ 配置 ============
const CUBE_SIZE = 0.95;
const GAP = 0.08;
const ANIMATION_DURATION = 180;
const PARTICLE_COUNT = 1200;

const FACE_COLORS = {
  R: 0xC41E3A,  // 红
  L: 0xFF5800,  // 橙
  U: 0xFFFFFF,  // 白
  D: 0xFFD500,  // 黄
  F: 0x009E60,  // 绿
  B: 0x0051BA,  // 蓝
  INNER: 0x1a1a1a
};

// ============ 全局变量 ============
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let cubies = [];
let isAnimating = false;
let isManualMode = false;
let animationId = null;
let cubeState = [];
let scrambleSequence = [];
let manualMoves = [];
let activeActionBtn = null;

// ============ 立即绑定「跳过」 ============
// 不能等 3D 场景初始化完（要等 window load + 加载 three.js + 建 27 个小方块），
// 否则图片多/网络慢时用户点了没反应，会以为按钮坏了。
// type=module 默认 defer，执行到这里 DOM 已就绪，可以直接绑。
(function bindSkipImmediately() {
  const skipBtn = document.getElementById('btn-skip');
  if (!skipBtn) return;
  skipBtn.addEventListener('click', () => {
    // 标记跳过，避免后续场景初始化把页面再盖回去
    window.__cubeSkipped = true;
    setActiveButton(skipBtn);
    transitionToMain();
  });
})();

// ============ 初始化场景 ============
function initScene() {
  const container = document.getElementById('cube-container');
  if (!container) return false;

  let width = container.clientWidth;
  let height = container.clientHeight;

  if (width === 0 || height === 0) {
    container.style.height = '320px';
    height = 320;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(5, 4, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 12;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
  light1.position.set(5, 10, 7);
  scene.add(light1);
  const light2 = new THREE.DirectionalLight(0xffffff, 0.3);
  light2.position.set(-5, -5, -5);
  scene.add(light2);

  window.addEventListener('resize', onWindowResize);
  return true;
}

function onWindowResize() {
  const container = document.getElementById('cube-container');
  if (!container || !camera || !renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ============ 创建魔方 ============
function createCube() {
  if (!scene) return;

  cubies = [];
  cubeState = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = createCubie(x, y, z);
        cubies.push(cubie);
        scene.add(cubie);

        cubeState.push({
          mesh: cubie,
          pos: { x, y, z },
          colors: {
            px: x === 1 ? 'R' : null,
            nx: x === -1 ? 'L' : null,
            py: y === 1 ? 'U' : null,
            ny: y === -1 ? 'D' : null,
            pz: z === 1 ? 'F' : null,
            nz: z === -1 ? 'B' : null
          }
        });
      }
    }
  }
}

function createCubie(x, y, z) {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  const materials = [
    new THREE.MeshPhongMaterial({ color: x === 1 ? FACE_COLORS.R : FACE_COLORS.INNER }),
    new THREE.MeshPhongMaterial({ color: x === -1 ? FACE_COLORS.L : FACE_COLORS.INNER }),
    new THREE.MeshPhongMaterial({ color: y === 1 ? FACE_COLORS.U : FACE_COLORS.INNER }),
    new THREE.MeshPhongMaterial({ color: y === -1 ? FACE_COLORS.D : FACE_COLORS.INNER }),
    new THREE.MeshPhongMaterial({ color: z === 1 ? FACE_COLORS.F : FACE_COLORS.INNER }),
    new THREE.MeshPhongMaterial({ color: z === -1 ? FACE_COLORS.B : FACE_COLORS.INNER }),
  ];

  const cubie = new THREE.Mesh(geometry, materials);
  cubie.position.set(
    x * (CUBE_SIZE + GAP),
    y * (CUBE_SIZE + GAP),
    z * (CUBE_SIZE + GAP)
  );
  cubie.userData = { x, y, z };

  const edges = new THREE.EdgesGeometry(geometry);
  cubie.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 })));

  return cubie;
}

// ============ 旋转逻辑 ============
function getAxisAndLayer(move) {
  const m = move.charAt(0);
  const prime = move.includes("'");
  let axis, layer, dir;

  switch (m) {
    case 'R': axis = 'x'; layer = 1; dir = 1; break;
    case 'L': axis = 'x'; layer = -1; dir = -1; break;
    case 'U': axis = 'y'; layer = 1; dir = 1; break;
    case 'D': axis = 'y'; layer = -1; dir = -1; break;
    case 'F': axis = 'z'; layer = 1; dir = 1; break;
    case 'B': axis = 'z'; layer = -1; dir = -1; break;
    default: return null;
  }

  if (prime) dir *= -1;
  return { axis, layer, dir };
}

function getCubiesInLayer(axis, layer) {
  return cubeState.filter(c => Math.round(c.pos[axis]) === layer);
}

function rotateLayer(move, instant = false) {
  return new Promise((resolve) => {
    if (!scene) {
      resolve();
      return;
    }

    if (isAnimating && !instant) {
      resolve();
      return;
    }

    const info = getAxisAndLayer(move);
    if (!info) { resolve(); return; }

    const { axis, layer, dir } = info;
    const angle = (Math.PI / 2) * dir;
    const layerCubies = getCubiesInLayer(axis, layer);

    if (layerCubies.length === 0) { resolve(); return; }

    if (instant) {
      const axisVec = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
      );

      layerCubies.forEach(c => {
        const q = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
        c.mesh.position.applyQuaternion(q);
        c.mesh.quaternion.premultiply(q);
        c.pos = rotatePosition(c.pos, axis, dir);
      });

      updateColorState(axis, layer, dir);
      resolve();
    } else {
      isAnimating = true;
      const startTime = performance.now();
      const pivot = new THREE.Group();
      scene.add(pivot);
      layerCubies.forEach(c => pivot.add(c.mesh));

      const axisVec = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
      );

      function animateLayer(time) {
        const progress = Math.min((time - startTime) / ANIMATION_DURATION, 1);
        const ease = easeInOutCubic(progress);

        pivot.rotation.set(0, 0, 0);
        pivot.rotateOnAxis(axisVec, angle * ease);

        if (progress < 1) {
          requestAnimationFrame(animateLayer);
        } else {
          layerCubies.forEach(c => {
            scene.attach(c.mesh);
            c.pos = rotatePosition(c.pos, axis, dir);
          });
          scene.remove(pivot);

          updateColorState(axis, layer, dir);
          isAnimating = false;
          resolve();
        }
      }
      requestAnimationFrame(animateLayer);
    }
  });
}

function rotatePosition(pos, axis, dir) {
  const { x, y, z } = pos;
  switch (axis) {
    case 'x': return { x, y: dir > 0 ? -z : z, z: dir > 0 ? y : -y };
    case 'y': return { x: dir > 0 ? z : -z, y, z: dir > 0 ? -x : x };
    case 'z': return { x: dir > 0 ? -y : y, y: dir > 0 ? x : -x, z };
    default: return pos;
  }
}

function updateColorState(axis, layer, dir) {
  const layerCubies = getCubiesInLayer(axis, layer);

  layerCubies.forEach(c => {
    const colors = c.colors;
    let newColors;

    switch (axis) {
      case 'x':
        if (dir > 0) {
          newColors = { px: colors.px, nx: colors.nx, py: colors.nz, ny: colors.pz, pz: colors.py, nz: colors.ny };
        } else {
          newColors = { px: colors.px, nx: colors.nx, py: colors.pz, ny: colors.nz, pz: colors.ny, nz: colors.py };
        }
        break;
      case 'y':
        if (dir > 0) {
          newColors = { px: colors.nz, nx: colors.pz, py: colors.py, ny: colors.ny, pz: colors.px, nz: colors.nx };
        } else {
          newColors = { px: colors.pz, nx: colors.nz, py: colors.py, ny: colors.ny, pz: colors.nx, nz: colors.px };
        }
        break;
      case 'z':
        if (dir > 0) {
          newColors = { px: colors.ny, nx: colors.py, py: colors.px, ny: colors.nx, pz: colors.pz, nz: colors.nz };
        } else {
          newColors = { px: colors.py, nx: colors.ny, py: colors.nx, ny: colors.px, pz: colors.pz, nz: colors.nz };
        }
        break;
    }
    c.colors = newColors;
  });
}

// ============ 获取逆操作 ============
function getInverseMove(move) {
  if (move.includes("'")) {
    return move.charAt(0);
  } else {
    return move + "'";
  }
}

// ============ 打乱魔方 ============
const MOVES = ['R', 'L', 'U', 'D', 'F', 'B', "R'", "L'", "U'", "D'", "F'", "B'"];

function generateScramble(length = 20) {
  const scramble = [];
  let lastFace = '';

  for (let i = 0; i < length; i++) {
    let move;
    do {
      move = MOVES[Math.floor(Math.random() * MOVES.length)];
    } while (move.charAt(0) === lastFace);
    scramble.push(move);
    lastFace = move.charAt(0);
  }
  return scramble;
}

async function scrambleCube() {
  const scramble = generateScramble(20);
  scrambleSequence = [...scramble];

  const solveSteps = [...scrambleSequence].reverse().map(m => getInverseMove(m));
  const lang = getCurrentLang();

  const faceNames = lang === 'zh-cn'
    ? { U: '上', D: '下', L: '左', R: '右', F: '前', B: '后' }
    : { U: 'U', D: 'D', L: 'L', R: 'R', F: 'F', B: 'B' };

  console.log('========================================');
  console.log(`🎲 ${t('scrambleSteps')}:`, scramble.join(' '));
  console.log(`🔄 ${t('solveSteps')}:`, solveSteps.join(' '));
  console.log('========================================');
  console.log(`📝 ${t('detailedSteps')}:`);
  solveSteps.forEach((step, i) => {
    const face = step.charAt(0);
    const isPrime = step.includes("'");
    const faceName = faceNames[face];
    const direction = isPrime ? t('ccwRotate') : t('cwRotate');
    console.log(`  ${i + 1}. ${step} → ${faceName} ${direction}`);
  });
  console.log('========================================');

  for (const move of scramble) {
    await rotateLayer(move, true);
  }
}

// ============ 设置按钮激活状态 ============
function setActiveButton(btn) {
  if (activeActionBtn) {
    activeActionBtn.classList.remove('bg-primary-500', 'dark:bg-primary-600', 'text-white', 'border-primary-500', 'dark:border-primary-600');
    activeActionBtn.classList.add('bg-neutral-200', 'dark:bg-neutral-800', 'text-neutral-700', 'dark:text-neutral-200', 'border-neutral-300', 'dark:border-neutral-700');
  }

  if (btn) {
    btn.classList.remove('bg-neutral-200', 'dark:bg-neutral-800', 'text-neutral-700', 'dark:text-neutral-200', 'border-neutral-300', 'dark:border-neutral-700');
    btn.classList.add('bg-primary-500', 'dark:bg-primary-600', 'text-white', 'border-primary-500', 'dark:border-primary-600');
    activeActionBtn = btn;
  } else {
    activeActionBtn = null;
  }
}

// ============ 还原魔方 ============
async function solveCube() {
  setActiveButton(document.getElementById('btn-auto-solve'));

  const btn = document.getElementById('btn-auto-solve');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    const span = btn.querySelector('span');
    if (span) span.textContent = t('solving');
  }

  let solveSequence = [];

  if (manualMoves.length > 0) {
    const undoManual = [...manualMoves].reverse().map(m => getInverseMove(m));
    const originalSolve = [...scrambleSequence].reverse().map(m => getInverseMove(m));
    solveSequence = [...undoManual, ...originalSolve];

    console.log('========================================');
    console.log('用户手动操作:', manualMoves.join(' '));
    console.log('撤销手动操作:', undoManual.join(' '));
    console.log('原始还原序列:', originalSolve.join(' '));
    console.log('完整还原序列:', solveSequence.join(' '));
    console.log('========================================');
  } else {
    solveSequence = [...scrambleSequence].reverse().map(m => getInverseMove(m));
  }

  for (const move of solveSequence) {
    await rotateLayer(move, false);
  }

  if (isSolved()) {
    onCubeSolved();
  } else {
    console.error('魔方还原失败，重建魔方...');
    rebuildSolvedCube();
    onCubeSolved();
  }
}

// ============ 重建已还原的魔方 ============
function rebuildSolvedCube() {
  cubies.forEach(c => scene.remove(c));
  cubies = [];
  cubeState = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = createCubie(x, y, z);
        cubies.push(cubie);
        scene.add(cubie);

        cubeState.push({
          mesh: cubie,
          pos: { x, y, z },
          colors: {
            px: x === 1 ? 'R' : null,
            nx: x === -1 ? 'L' : null,
            py: y === 1 ? 'U' : null,
            ny: y === -1 ? 'D' : null,
            pz: z === 1 ? 'F' : null,
            nz: z === -1 ? 'B' : null
          }
        });
      }
    }
  }
}

// ============ 检查是否还原 ============
function isSolved() {
  const faces = { R: 0, L: 0, U: 0, D: 0, F: 0, B: 0 };

  cubeState.forEach(c => {
    if (c.colors.px === 'R') faces.R++;
    if (c.colors.nx === 'L') faces.L++;
    if (c.colors.py === 'U') faces.U++;
    if (c.colors.ny === 'D') faces.D++;
    if (c.colors.pz === 'F') faces.F++;
    if (c.colors.nz === 'B') faces.B++;
  });

  return Object.values(faces).every(count => count === 9);
}

// ============ 还原成功 ============
function onCubeSolved() {
  createParticleExplosion();

  setTimeout(() => {
    const msg = document.getElementById('success-message');
    if (msg) msg.classList.remove('hidden');
  }, 800);

  setTimeout(transitionToMain, 2600);
}

// ============ 粒子爆炸 ============
function createParticleExplosion() {
  if (!scene) return;

  const container = document.getElementById('particles-container');
  if (container) container.classList.remove('hidden');

  const particles = [];
  const geo = new THREE.SphereGeometry(0.04, 6, 6);
  const colors = [FACE_COLORS.R, FACE_COLORS.L, FACE_COLORS.U, FACE_COLORS.D, FACE_COLORS.F, FACE_COLORS.B];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(
      (Math.random() - 0.5) * 2.5,
      (Math.random() - 0.5) * 2.5,
      (Math.random() - 0.5) * 2.5
    );
    p.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      (Math.random() - 0.5) * 0.35,
      (Math.random() - 0.5) * 0.35
    );
    particles.push(p);
    scene.add(p);
  }

  cubies.forEach(c => c.visible = false);

  let frame = 0;
  function animateParticles() {
    frame++;
    particles.forEach(p => {
      p.position.add(p.userData.vel);
      p.userData.vel.y -= 0.003;
      p.scale.multiplyScalar(0.97);
    });
    if (frame < 90) requestAnimationFrame(animateParticles);
    else particles.forEach(p => scene.remove(p));
  }
  animateParticles();
}

// ============ 过渡到主页 ============
function transitionToMain() {
  // 不再写 localStorage：魔方是首页招牌，每次打开都应该出现
  document.documentElement.classList.remove('cube-pending');
  unlockPageNavigation();

  const intro = document.getElementById('cube-intro');
  const main = document.getElementById('cube-home-content');

  if (intro) {
    intro.style.transition = 'opacity 0.4s ease-out';
    intro.style.opacity = '0';
  }

  setTimeout(() => {
    if (intro) intro.style.display = 'none';
    if (main) {
      main.classList.remove('hidden');
      requestAnimationFrame(() => {
        main.style.transition = 'opacity 0.4s ease-in';
        main.style.opacity = '1';
      });
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }, 400);
}

// ============ 手动模式 ============
function enableManualMode() {
  isManualMode = true;
  setActiveButton(document.getElementById('btn-manual-mode'));

  const controlsDiv = document.getElementById('manual-controls');
  const span = document.getElementById('manual-mode-text');

  if (controlsDiv) controlsDiv.classList.remove('hidden');
  if (span) span.textContent = t('manualModeActive');

  document.querySelectorAll('.manual-btn').forEach(b => {
    b.addEventListener('click', async () => {
      if (!isAnimating) {
        const move = b.dataset.move;
        await rotateLayer(move);
        manualMoves.push(move);
        console.log(`手动操作记录: ${move}, 当前手动操作序列: [${manualMoves.join(', ')}]`);
        if (isSolved()) onCubeSolved();
      }
    });
  });
}

function disableManualMode() {
  isManualMode = false;
  setActiveButton(null);

  const controlsDiv = document.getElementById('manual-controls');
  const span = document.getElementById('manual-mode-text');

  if (controlsDiv) controlsDiv.classList.add('hidden');
  if (span) span.textContent = t('manualMode');

  // 不清空 manualMoves，自动还原需要据此撤销手动操作
}

// ============ 工具函数 ============
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============ 渲染循环 ============
function animate() {
  // 已跳过就停止渲染，别在后台空烧 GPU
  if (window.__cubeSkipped) return;
  animationId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

// ============ 事件绑定 ============
function bindEvents() {
  document.getElementById('btn-auto-solve')?.addEventListener('click', () => {
    if (!isAnimating) {
      if (isManualMode) {
        disableManualMode();
      }
      solveCube();
    }
  });

  document.getElementById('btn-manual-mode')?.addEventListener('click', () => {
    if (!isManualMode) enableManualMode();
  });

  // 「跳过」已在模块加载时立即绑定（见 bindSkipImmediately），此处不再重复绑定
}

// ============ 锁定/解锁页面导航 ============
function lockPageNavigation() {
  document.body.classList.add('cube-locked');
}

function unlockPageNavigation() {
  document.body.classList.remove('cube-locked');
}

// ============ 初始化 ============
async function init() {
  await new Promise(r => {
    if (document.readyState === 'complete') r();
    else window.addEventListener('load', r);
  });
  await new Promise(r => setTimeout(r, 20));

  // 用户已经点了「跳过」，就不要再搭场景、锁导航了
  if (window.__cubeSkipped) return;

  lockPageNavigation();
  updateI18nText();

  if (!initScene()) {
    transitionToMain();
    return;
  }

  createCube();
  await scrambleCube();
  bindEvents();
  animate();
}

init().catch(err => {
  // 任何异常都不要把用户挡在门外
  console.error('魔方初始化失败，直接进入正文:', err);
  try {
    document.documentElement.classList.remove('cube-pending');
    const intro = document.getElementById('cube-intro');
    if (intro) intro.style.display = 'none';
    const main = document.getElementById('cube-home-content');
    if (main) { main.classList.remove('hidden'); main.style.opacity = '1'; }
  } catch (e) { /* noop */ }
});
