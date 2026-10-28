(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const INK = '#25262b';

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.min(1, Math.max(0, k));
  const smooth = k => (k = clamp01(k), k * k * (3 - 2 * k));
  const once = (el, ev, ms) => new Promise(ok => {
    const f = () => { el.removeEventListener(ev, f); ok(); };
    el.addEventListener(ev, f);
    setTimeout(f, ms);
  });

  /*
   * Всё листается колесом по шагам:
   * 0 — интро «Начни своё невозможное»
   * 1 — слоган поднимается наверх во всю ширину, TOYOTA под ним и коротко об имени
   * 2 — слова меняются местами: TOYOTA наверху, слоган внизу и коротко о нём
   * 3 — слоган и TOYOTA встают вместе по центру белого листа
   * 4 — страница машины: Supra разрезает этот лист и едет по треку (потом сюда же приходят и другие машины)
   * 5 — выбор машины: три полосы (Supra, Celica, Soarer); клик — машина разрезает свою полосу
   */
  const NAME_A = 1, NAME_B = 2, CENTER = 3, CAR_STEP = 4, GARAGE = 5, LAST = CAR_STEP;
  let step = 0, busy = false, lastNav = 0;

  /* ================= 1. INTRO ================= */
  const intro = $('#intro'), cols = $$('.intro-cols i');
  const introWord = $('.intro-word'), slogan = $('.intro-slogan');
  const loop = new SliceLoop($('#sliceLoop'), {
    images: ['img/slices-1.webp', 'img/slices-2.webp', 'img/slices-3.webp'],
    interval: 2200, duration: 1300,   // полоски меняются реже и медленнее
    accent: 'rgba(235,10,30,.95)', bg: '#000'
  });
  gsap.from([slogan, introWord], { y: 30, opacity: 0, duration: 1.2, stagger: .2, delay: .3, ease: 'power3.out' });

  // Сдвиг и масштаб, при которых центр элемента окажется в точке (cx, cy)
  const toPoint = (el, cx, cy, scale) => {
    gsap.set(el, { clearProps: 'transform' });
    const r = el.getBoundingClientRect();
    return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2), scale };
  };

  /* ================= 2. СЛОГАН И ИМЯ ================= */
  const names = $('#names'), nmSlogan = $('.nm-slogan'), nmToyota = $('.nm-toyota');
  const nmSlot = $('.nm-slot'), nmRule = $('.nm-rule');
  const jpSlogan = $('.nm-jp-slogan'), jpToyota = $('.nm-jp-toyota');
  let nmState = 'a';

  // Объём слова — CSS-переменная --d от 0 (плоское) до 1 (с «прорезной» тенью); её плавно и анимируем
  const DEPTH = { a: [1, 0], b: [0, 1], c: [1, 1] };          // [слоган, TOYOTA] на каждом виде
  const depthTo = (el, d, extra = {}) => gsap.to(el, { '--d': d, duration: d ? 1.6 : .6, ease: d ? 'power2.inOut' : 'power2.out', ...extra });
  gsap.set([nmSlogan, nmToyota], { '--d': 0 });

  // Размеры: слово наверху — во всю ширину, по центру — поменьше
  function nmLayout() {
    const W = innerWidth, H = innerHeight, pad = Math.max(12, H * .025);
    const fit = (el, k) => {
      el.style.fontSize = '100px';
      const f = Math.min(W * .94 / el.offsetWidth * 100, H * .26 / k);  // не выше четверти экрана
      el.style.fontSize = f + 'px';
      return f;
    };
    const fs = fit(nmSlogan, 1.65), ft = fit(nmToyota, 1);
    const topH = Math.max(1.65 * fs, ft) + pad * 2;
    names.style.setProperty('--top-h', topH + 'px');
    const r = nmSlot.getBoundingClientRect(), row = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    const small = {
      slogan: Math.min(Math.max(W * .46, 220), 640) / nmSlogan.offsetWidth,
      toyota: Math.min(Math.max(W * .34, 180), 480) / nmToyota.offsetWidth
    };

    // Позади слова посередине — крупная серая надпись по-японски, больше самого слова
    const fitJp = (el, h) => {
      el.style.fontSize = '100px';
      el.style.fontSize = Math.min(W * .94 / el.offsetWidth * 100, h) + 'px';
      el.style.top = row.cy + 'px';
    };
    fitJp(jpSlogan, 1.65 * fs * small.slogan * 2.4);
    fitJp(jpToyota, ft * small.toyota * 2.6);

    // Финал посередине: слоган над линией будущего разреза, TOYOTA под ней — машина режет между ними
    const ss = Math.max(W * .5, 200) / nmSlogan.offsetWidth, st = Math.max(W * .32, 150) / nmToyota.offsetWidth;
    const hs = 1.65 * fs * ss, ht = ft * st, cut = cutY(), gap = H * .07;
    return {
      fs, ft, W, H, row, small,
      top: { cx: W / 2, cy: topH / 2 },
      center: {
        slogan: [{ cx: W / 2, cy: cut - gap / 2 - hs / 2 }, ss],
        toyota: [{ cx: W / 2, cy: cut + gap / 2 + ht / 2 }, st]
      }
    };
  }
  // Сдвиг и масштаб, при которых центр слова (transform-origin: 0 0) окажется в точке at
  const place = (el, at, scale) => ({ x: at.cx - el.offsetWidth * scale / 2, y: at.cy - el.offsetHeight * scale / 2, scale });
  // 'a' — слоган наверху, TOYOTA по центру; 'b' — наоборот; 'c' — оба вместе посередине листа
  function nmPose(k, L = nmLayout()) {
    if (k === 'a') return { slogan: place(nmSlogan, L.top, 1), toyota: place(nmToyota, L.row, L.small.toyota) };
    if (k === 'b') return { slogan: place(nmSlogan, L.row, L.small.slogan), toyota: place(nmToyota, L.top, 1) };
    return { slogan: place(nmSlogan, ...L.center.slogan), toyota: place(nmToyota, ...L.center.toyota) };
  }

  // Текст слайда k
  const nmInfo = (k, show) => show
    ? gsap.fromTo($('.nm-note.nm-' + k), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out' })
    : gsap.to($('.nm-note.nm-' + k), { autoAlpha: 0, y: -12, duration: .35, ease: 'power2.in' });
  gsap.set($$('.nm-note', names), { autoAlpha: 0 });

  // Серая японская надпись позади слова, которое ушло на середину: 'a' — TOYOTA, 'b' — слоган; в финале её нет
  const JP = { a: jpToyota, b: jpSlogan };
  gsap.set([jpSlogan, jpToyota], { xPercent: -50, yPercent: -50 });
  function jpShow(k, delay = .55) {
    const tl = gsap.timeline();
    [jpSlogan, jpToyota].forEach(el => {
      if (el === JP[k]) tl.fromTo(el, { autoAlpha: 0, y: 30, scale: .94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.5, ease: 'power2.out' }, delay);
      else if (gsap.getProperty(el, 'opacity') > 0) tl.to(el, { autoAlpha: 0, scale: .96, duration: .45, ease: 'power2.in' }, 0);
    });
    return tl;
  }

  // Перевести оба слова в вид k: движение и объём вместе; объём набирается медленно, по мере того как слово растёт
  function nmMove(k, dur = 1.15) {
    const pose = nmPose(k), [ds, dt] = DEPTH[k];
    return gsap.timeline()
      .to(nmSlogan, { ...pose.slogan, duration: dur, ease: 'power3.inOut' }, 0)
      .to(nmToyota, { ...pose.toyota, duration: dur, ease: 'power3.inOut' }, 0)
      .add(depthTo(nmSlogan, ds), ds ? .35 : 0)
      .add(depthTo(nmToyota, dt), dt ? .35 : 0)
      .add(jpShow(k), 0);
  }

  // 0 → 1: экран белеет, «Начни своё невозможное» поднимается наверх во всю ширину, TOYOTA встаёт по центру под ним
  async function introToNames() {
    const L = nmLayout(), pose = nmPose('a', L);
    const fsIntro = parseFloat(getComputedStyle(slogan).fontSize), fwIntro = parseFloat(getComputedStyle(introWord).fontSize);
    gsap.set(nmRule, { scaleX: 0 });
    await gsap.timeline()
      .set(slogan, { textShadow: 'none' })
      .fromTo(cols, { yPercent: i => i % 2 ? -101 : 101, y: 0 },
        { yPercent: 0, duration: .8, stagger: { each: .06, from: 'random' }, ease: 'power3.inOut' }, 0)
      .to(slogan, { ...toPoint(slogan, L.top.cx, L.top.cy, L.fs / fsIntro), color: INK, duration: 1.1, ease: 'power3.inOut' }, .1)
      .to(introWord, { ...toPoint(introWord, L.row.cx, L.row.cy, L.ft * L.small.toyota / fwIntro), color: INK, duration: 1.1, ease: 'power3.inOut' }, .1);
    // Передаём слова из интро в слайд — они стоят ровно там же, пока ещё плоские
    gsap.set(nmSlogan, { ...pose.slogan, opacity: 1, '--d': 0 });
    gsap.set(nmToyota, { ...pose.toyota, opacity: 1, '--d': 0 });
    gsap.set(names, { autoAlpha: 1 });
    gsap.set(intro, { autoAlpha: 0 });
    loop.paused = true;
    warm('supra');
    body.dataset.stage = 'names';
    nmState = 'a';
    await gsap.timeline()
      .add(depthTo(nmSlogan, 1), 0)
      .add(jpShow('a', .3), 0)
      .to(nmRule, { scaleX: 1, duration: .9, ease: 'power3.inOut' }, 0)
      .add(nmInfo('a', true), .15);
  }

  // 1 → 0: обратно в интро
  async function namesToIntro() {
    const L = nmLayout();
    const fsIntro = parseFloat(getComputedStyle(slogan).fontSize), fwIntro = parseFloat(getComputedStyle(introWord).fontSize);
    await gsap.timeline()
      .add(nmInfo('a', false), 0)
      .add(jpShow(null), 0)
      .to(nmRule, { scaleX: 0, duration: .5, ease: 'power2.in' }, 0)
      .add(depthTo([nmSlogan, nmToyota], 0), 0);
    gsap.set(slogan, { ...toPoint(slogan, L.top.cx, L.top.cy, L.fs / fsIntro), color: INK });
    gsap.set(introWord, { ...toPoint(introWord, L.row.cx, L.row.cy, L.ft * L.small.toyota / fwIntro), color: INK });
    gsap.set(intro, { autoAlpha: 1 });
    gsap.set(names, { autoAlpha: 0 });
    gsap.set([nmSlogan, nmToyota], { opacity: 0 });
    loop.paused = false;
    body.dataset.stage = 'intro';
    await gsap.timeline()
      .to([slogan, introWord], { x: 0, y: 0, scale: 1, color: '#fff', duration: 1.1, ease: 'power3.inOut' }, 0)
      .to(cols, { yPercent: i => i % 2 ? -101 : 101, duration: .8, stagger: { each: .06, from: 'random' }, ease: 'power3.inOut' }, .2);
    gsap.set(slogan, { clearProps: 'textShadow' });
  }

  // 1 ↔ 2: TOYOTA уходит наверх и набирает объём, слоган — вниз и становится плоским (и обратно)
  async function swapNames(k) {
    await gsap.timeline()
      .add(nmInfo(k === 'a' ? 'b' : 'a', false), 0)
      .add(nmMove(k), .15)
      .add(nmInfo(k, true), .9);
    nmState = k;
  }

  // 2 → 3: текст и линия уходят, слоган и TOYOTA встают вместе посередине
  async function namesToCenter() {
    await gsap.timeline()
      .add(nmInfo('b', false), 0)
      .to(nmRule, { scaleX: 0, duration: .6, ease: 'power2.inOut' }, 0)
      .add(nmMove('c', 1.3), .15);
    nmState = 'c';
  }

  // 3 → 2: обратно — TOYOTA наверх, слоган в центр, текст о слогане
  async function centerToNames() {
    await gsap.timeline()
      .add(nmMove('b', 1.3), 0)
      .to(nmRule, { scaleX: 1, duration: .8, ease: 'power3.inOut' }, .4)
      .add(nmInfo('b', true), .9);
    nmState = 'b';
  }

  // При смене размера окна слова встают на новые места
  addEventListener('resize', () => {
    if (body.dataset.stage === 'names' && !busy) {
      const pose = nmPose(nmState);
      gsap.set(nmSlogan, pose.slogan);
      gsap.set(nmToyota, pose.toyota);
    }
  });

  /* ================= 3. МАШИНЫ: машина разрезает лист и едет на фоне ================= */
  const tear = $('#tear');
  const TEXT = '[data-a], .car-bigword';

  /*
   * Ролик каждой машины: сначала въезд, с loop — 30-секундная петля.
   * nose — передний край машины в кадре (доля ширины видео) по времени ролика, замерено покадрово;
   * у машины, которая едет справа налево (dir = -1), доли считаются от правого края.
   * cutY — высота разреза (доля высоты видео). Нос ведёт разрез до tRun → разрез убегает к краю до tSplit →
   * половинки разлетаются; к tMid машина в середине кадра. Въезд идёт со скоростью slow, потом обычная
   */
  const CARS = {
    supra: {
      dir: 1, loop: 3.68, slow: .7, cutY: .46, tRun: .4, tSplit: .8, tMid: 1.16,
      nose: [[0, .02], [.04, .062], [.08, .119], [.12, .169], [.16, .256], [.2, .306], [.24, .344],
        [.28, .409], [.32, .444], [.36, .472], [.4, .5], [.44, .55], [.48, .572], [.52, .591], [.56, .631],
        [.6, .644], [.68, .678], [.76, .697], [.84, .722], [.92, .741], [1, .756], [1.16, .791]]
    },
    celica: {
      dir: -1, loop: 2.72, slow: .7, cutY: .55, tRun: .35, tSplit: .75, tMid: 1,
      nose: [[0, .59], [.24, .61], [.4, .64], [.56, .67], [.72, .72], [.88, .78], [1.04, .84], [1.15, .87]]
    },
    // Камера ведёт машину, поэтому в кадре она почти на месте — разрез быстро отрывается от носа
    soarer: {
      dir: -1, loop: 1.5, slow: .7, cutY: .5, tRun: .3, tSplit: .7, tMid: .95,
      nose: [[0, .53], [.5, .55], [.7, .58], [1, .6]]
    }
  };
  for (const [name, cfg] of Object.entries(CARS)) {
    cfg.scene = $(`.scene[data-car="${name}"]`);
    cfg.video = $('.car-video', cfg.scene);
    cfg.big = $('.car-bigword', cfg.scene);
    cfg.video.addEventListener('ended', () => { cfg.video.currentTime = cfg.loop; cfg.video.play().catch(() => {}); });
  }
  // Большое имя внизу страницы — целиком в ширину экрана, какой бы длины ни было слово
  const fitBig = () => Object.values(CARS).forEach(({ big }) => {
    big.style.fontSize = '100px';
    big.style.fontSize = Math.min(innerWidth * .31, innerWidth * .9 / big.offsetWidth * 100) + 'px';
  });
  fitBig();
  document.fonts.ready.then(fitBig);
  addEventListener('resize', fitBig);
  // Видео не качаются при открытии страницы: Supra — как только ушли с интро (к разрезу она уже готова),
  // остальные — пока смотрят Supra, до выбора машины
  const warm = (...names) => names.forEach(n => {
    const v = CARS[n].video;
    if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
  });

  let car = 'supra';                 // машина, которая сейчас на экране (или была на нём последней)
  const CAR = () => CARS[car];

  const nose = (cfg, t) => {
    const N = cfg.nose;
    for (let i = 1; i < N.length; i++) {
      const [t1, x1] = N[i];
      if (t <= t1) { const [t0, x0] = N[i - 1]; return lerp(x0, x1, clamp01((t - t0) / (t1 - t0))); }
    }
    return N[N.length - 1][1];
  };
  // Где кадр видео (object-fit: cover) лежит на экране
  const cover = cfg => {
    const vw = cfg.video.videoWidth || 1280, vh = cfg.video.videoHeight || 720;
    const k = Math.max(innerWidth / vw, innerHeight / vh);
    return { w: vw * k, h: vh * k, x: (innerWidth - vw * k) / 2, y: (innerHeight - vh * k) / 2 };
  };
  const cutY = (cfg = CARS.supra) => { const c = cover(cfg); return c.y + cfg.cutY * c.h; };

  // Лист рисуется в текстуру, а WebGL поворачивает её половинки вокруг острия разреза,
  // как у листа, разрезанного ножницами: верхняя уходит вверх, нижняя вниз, впереди острия лист целый.
  // У самого острия угол нарастает плавно — бумага изгибается, а не рвётся. Вдоль краёв — мягкая тень.
  // dir = -1 — тот же разрез, отражённый по горизонтали: машина режет справа налево
  const VERT = `attribute vec2 p; varying vec2 uv;
    void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `precision highp float;
    uniform sampler2D tex; uniform vec2 res;
    uniform float dir, tip, cut, bend, ang, outUp, outDown;
    varying vec2 uv;
    void main() {
      vec2 p = uv * res;
      if (dir < 0.) p.x = res.x - p.x;
      float a = ang * smoothstep(0., bend, tip - p.x);
      float c = cos(a), s = sin(a), tilt = 1. + .3 * (1. - p.x / res.x);
      vec2 qt = p - vec2(tip, cut) + vec2(0., outUp * tilt);
      vec2 qb = p - vec2(tip, cut) - vec2(0., outDown * tilt);
      vec2 st = vec2(qt.x * c + qt.y * s, qt.y * c - qt.x * s) + vec2(tip, cut);
      vec2 sb = vec2(qb.x * c - qb.y * s, qb.y * c + qb.x * s) + vec2(tip, cut);
      if (dir < 0.) { st.x = res.x - st.x; sb.x = res.x - sb.x; }
      float aTop = clamp(cut - st.y + .5, 0., 1.), aBot = clamp(sb.y - cut + .5, 0., 1.);
      vec4 top = texture2D(tex, vec2(st.x, min(st.y, cut - .5)) / res);
      vec4 bot = texture2D(tex, vec2(sb.x, max(sb.y, cut + .5)) / res);
      float sh = .42 * smoothstep(0., 2., st.y - sb.y) * max(exp(-max(st.y - cut, 0.) / 14.), exp(-max(cut - sb.y, 0.) / 14.));
      gl_FragColor = top * aTop + bot * aBot + vec4(0., 0., 0., sh) * max(0., 1. - aTop - aBot);
    }`;
  const glCanvas = document.createElement('canvas');
  const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  let uni = null;
  if (gl) {
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]].forEach(([type, src]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(prog, sh);
    });
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
     [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    uni = Object.fromEntries(['res', 'dir', 'tip', 'cut', 'bend', 'ang', 'outUp', 'outDown']
      .map(n => [n, gl.getUniformLocation(prog, n)]));
  }

  // Слово так, как оно сейчас на экране: размер, место и объём (тёмная тень, белый просвет, само слово)
  function paintWord(ctx, el) {
    const d = parseFloat(gsap.getProperty(el, '--d')) || 0;
    const size = parseFloat(el.style.fontSize) * gsap.getProperty(el, 'scale');
    const layers = d > .001 ? [[.06 * d, INK], [.03 * d, '#fff'], [0, INK]] : [[0, INK]];
    ctx.save();
    ctx.textAlign = 'center';
    if (el === nmSlogan) {
      const span = el.firstElementChild, r = span.getBoundingClientRect(), text = span.textContent;
      ctx.font = `700 ${size}px Unbounded`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${-.035 * size}px`;
      const m = ctx.measureText(text);
      ctx.translate(r.left + r.width / 2, r.top + r.height / 2);
      ctx.scale(1, 1.65);                                  // слоган вытянут по высоте, как в CSS
      const base = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      layers.forEach(([o, col]) => { ctx.fillStyle = col; ctx.fillText(text, o * size, base + o * size); });
    } else {
      ctx.font = `800 ${size}px Archivo`;
      if ('fontStretch' in ctx) ctx.fontStretch = 'expanded';
      const m = ctx.measureText('TOYOTA');
      const base = (size - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
      $$('span', el).forEach(sp => {
        const b = sp.getBoundingClientRect();
        layers.forEach(([o, col]) => { ctx.fillStyle = col; ctx.fillText(sp.textContent, b.left + b.width / 2 + o * size, b.top + base + o * size); });
      });
    }
    ctx.restore();
  }

  // Имя машины из полосы выбора (наклонный Russo One) там, где оно сейчас стоит на экране
  function paintName(ctx, el) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize) * gsap.getProperty(el, 'scale');
    ctx.save();
    ctx.font = `400 ${size}px "Russo One"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = cs.color;
    const m = ctx.measureText(el.textContent);
    ctx.translate(r.left + r.width / 2, r.top + r.height / 2);
    ctx.transform(1, 0, Math.tan(-12 * Math.PI / 180), 1, 0, 0);   // тот же наклон, что в CSS
    ctx.fillText(el.textContent, 0, (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2);
    ctx.restore();
  }

  // Листы для разреза: белый лист со словами и полоса выбора, растянутая на весь экран
  const paintNames = ctx => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    paintWord(ctx, nmSlogan);
    paintWord(ctx, nmToyota);
  };
  const paintStrip = strip => ctx => {
    ctx.fillStyle = getComputedStyle($('.strip-bg', strip)).backgroundColor;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    paintName(ctx, $('.strip-name', strip));
  };

  // Подготовить холст разреза поверх видео; false — если WebGL нет
  function openTear(paint, withBlade) {
    if (!gl) return false;
    const W = innerWidth, H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(W, H));
    const sheet = document.createElement('canvas');
    sheet.width = Math.round(W * dpr); sheet.height = Math.round(H * dpr);
    const ctx = sheet.getContext('2d');
    ctx.scale(dpr, dpr);
    paint(ctx);
    glCanvas.width = sheet.width; glCanvas.height = sheet.height;
    gl.viewport(0, 0, sheet.width, sheet.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.uniform2f(uni.res, W, H);
    tear.innerHTML = '';
    tear.append(glCanvas);
    if (withBlade) { const blade = document.createElement('i'); blade.className = 'blade'; tear.append(blade); }
    return true;
  }

  function drawSheet(u) {
    for (const k in u) gl.uniform1f(uni[k], u[k]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Кадр разреза для времени ролика t (координаты острия — в «отражённом» пространстве, если машина едет влево)
  function drawTear(t, cfg) {
    const W = innerWidth, H = innerHeight, c = cover(cfg), y = cutY(cfg);
    // Разрез только разгоняется: острие плавно отрывается от носа машины и всё быстрее летит к краю,
    // а половинки начинают разлетаться чуть раньше, чем острие дошло до края, — тоже с разгоном
    const run = Math.pow(clamp01((t - cfg.tRun) / (cfg.tSplit - cfg.tRun)), 2);
    const tip = lerp(c.x + nose(cfg, t) * c.w + .06 * c.w, W * 1.02, run);
    const out = Math.pow(clamp01((t - cfg.tSplit + .12) / (cfg.tMid - cfg.tSplit + .12)), 2);
    const ang = .56 * smooth(t / .25);                                               // ~32°: половинки раскрываются, как челюсти
    drawSheet({ dir: cfg.dir, tip, cut: y, bend: .12 * c.w, ang, outUp: out * (y + 40), outDown: out * (H - y + 40) });
    const blade = $('.blade', tear);
    blade.style.transform = `translate(${cfg.dir > 0 ? tip : W - tip}px, ${y - 1}px) scaleX(${cfg.dir})`;
    blade.style.opacity = 1 - run;
  }

  async function playFrom(cfg, time, rate) {
    const v = cfg.video;
    if (v.readyState < 3) await once(v, 'canplay', 4000);
    v.playbackRate = rate;
    if (Math.abs(v.currentTime - time) > .01) { v.currentTime = time; await once(v, 'seeked', 1000); }
    try { await v.play(); } catch (e) { /* без видео разрез всё равно пройдёт по часам */ }
  }

  // Пока открыта машина: ролик разгоняется с замедленного въезда до обычной скорости ещё во время разреза
  // (вторая половина разреза идёт всё быстрее) и дальше крутится по петле
  function videoTick() {
    if (body.dataset.stage !== 'car') return;
    const cfg = CAR(), v = cfg.video, t = v.currentTime;
    if (t > cfg.tRun) {
      const r = lerp(cfg.slow, 1, Math.pow(clamp01((t - cfg.tRun) / (cfg.tMid - cfg.tRun + .2)), 1.5));
      if (Math.abs(r - v.playbackRate) > .02) v.playbackRate = r;
    }
    if (v.duration && t >= v.duration - .05) v.currentTime = cfg.loop;
    requestAnimationFrame(videoTick);
  }

  // Машина name въезжает и разрезает лист sheetEl (нарисованный paint), потом её видео остаётся на фоне
  async function cutInto(name, paint, sheetEl) {
    const cfg = CARS[name];
    car = name;
    warm(...Object.keys(CARS));
    Object.values(CARS).forEach(o => { if (o !== cfg) { o.scene.classList.remove('is-on'); o.video.pause(); } });
    gsap.set($$(TEXT, cfg.scene), { opacity: 0 });
    gsap.set(cfg.video, { '--shade': 0 });
    cfg.scene.classList.add('is-on');
    cfg.scene.scrollTop = 0;
    const ready = openTear(paint, true);
    await playFrom(cfg, 0, cfg.slow);
    body.dataset.stage = 'car';
    videoTick();
    if (ready) {
      drawTear(0, cfg);
      gsap.set(sheetEl, { autoAlpha: 0 });
      const t0 = performance.now();
      await new Promise(done => {
        const tick = () => {
          // Время берём из видео; если оно застряло — разрез догоняет по часам
          const t = Math.max(cfg.video.currentTime, (performance.now() - t0) / 1000 * cfg.slow - .4);
          drawTear(Math.min(t, cfg.tMid), cfg);
          if (t >= cfg.tMid) return done();
          requestAnimationFrame(tick);
        };
        tick();
      });
      tear.innerHTML = '';
    } else {
      await gsap.to(sheetEl, { autoAlpha: 0, duration: .8, ease: 'power2.inOut' });
    }
    enter(cfg);
  }

  // 3 → 4: Supra въезжает слева и разрезает белый лист со словами
  const centerToSupra = () => cutInto('supra', paintNames, names);

  // 4 → 3: текст уходит, половинки листа съезжаются обратно
  async function supraToCenter() {
    const cfg = CARS.supra;
    await gsap.timeline()
      .to($$(TEXT, cfg.scene), { opacity: 0, duration: .35, ease: 'power2.in' }, 0)
      .to(cfg.video, { '--shade': 0, duration: .35, ease: 'power2.in' }, 0);
    body.dataset.stage = 'names';
    if (openTear(paintNames, false)) {
      const H = innerHeight, y = cutY(cfg), s = { out: 1 };
      const draw = () => drawSheet({ dir: 1, tip: -1e4, cut: y, bend: 1, ang: 0, outUp: s.out * (y + 40), outDown: s.out * (H - y + 40) });
      draw();
      await gsap.to(s, { out: 0, duration: .8, ease: 'power3.inOut', onUpdate: draw });
      gsap.set(names, { autoAlpha: 1 });
      tear.innerHTML = '';
    } else {
      await gsap.to(names, { autoAlpha: 1, duration: .6 });
    }
    cfg.scene.classList.remove('is-on');
    cfg.video.pause();
  }

  // Появление текста поверх видео
  function enter(cfg) {
    const els = $$(`${TEXT}, [data-a] *`, cfg.scene);
    gsap.killTweensOf(els);
    gsap.set(els, { clearProps: 'transform,opacity' });
    gsap.timeline()
      .to(cfg.video, { '--shade': 1, duration: 1, ease: 'power2.out' }, 0)
      .from(cfg.big, { xPercent: 70, opacity: 0, duration: 1.1, ease: 'expo.out' })
      .from($$('.car-text [data-a]', cfg.scene), { x: -80, opacity: 0, skewX: -20, duration: .55, stagger: .07, ease: 'power4.out' }, .1);
  }

  /* ================= 4. ВЫБОР МАШИНЫ: три полосы ================= */
  const garage = $('#garage'), strips = $$('.strip', garage);
  const stripOf = name => $(`.strip[data-car="${name}"]`, garage);

  // Сдвиг и масштаб, при которых имя в полосе совпадёт с большим словом внизу страницы машины
  // (шрифт и наклон у них одинаковые, поэтому хватает сдвига центров и отношения размеров)
  function nameToBig(nameEl, cfg) {
    const a = nameEl.getBoundingClientRect(), b = cfg.big.getBoundingClientRect();
    // центр имени без текущего сдвига (масштаб и наклон центр не смещают)
    const ax = a.left + a.width / 2 - gsap.getProperty(nameEl, 'x'), ay = a.top + a.height / 2 - gsap.getProperty(nameEl, 'y');
    return {
      x: b.left + b.width / 2 - ax, y: b.top + b.height / 2 - ay,
      scale: parseFloat(getComputedStyle(cfg.big).fontSize) / parseFloat(getComputedStyle(nameEl).fontSize)
    };
  }

  function resetGarage() {
    gsap.set(strips, { clearProps: 'all' });
    gsap.set($$('.strip-bg, .strip-name, .strip-note', garage), { clearProps: 'all' });
  }

  // 4 → 5: большое имя внизу уезжает вверх в свою полосу, под ней появляются остальные
  async function carToGarage() {
    const cfg = CAR(), strip = stripOf(car), nameEl = $('.strip-name', strip), others = strips.filter(s => s !== strip);
    resetGarage();
    gsap.set(garage, { autoAlpha: 1 });
    gsap.set(strip, { zIndex: 2, overflow: 'visible' });
    gsap.set($('.strip-bg', strip), { scaleY: 0, transformOrigin: '50% 100%' });
    gsap.set($('.strip-note', strip), { opacity: 0 });
    gsap.set(others, { y: innerHeight });
    gsap.set(nameEl, { ...nameToBig(nameEl, cfg), opacity: 0 });
    await gsap.timeline()
      .to($$('.car-text [data-a]', cfg.scene), { opacity: 0, x: -40, duration: .45, stagger: .03, ease: 'power2.in' }, 0)
      .to(nameEl, { opacity: 1, duration: .3 }, .15)
      .to(cfg.big, { opacity: 0, duration: .3 }, .15)
      .to(nameEl, { x: 0, y: 0, scale: 1, duration: 1.1, ease: 'power3.inOut' }, .3)
      .to($('.strip-bg', strip), { scaleY: 1, duration: .9, ease: 'power3.inOut' }, .35)
      .to(others, { y: 0, duration: .9, stagger: .1, ease: 'power3.out' }, .75)
      .to($('.strip-note', strip), { opacity: .75, duration: .4 }, 1.2);
    cfg.video.pause();
    body.dataset.stage = 'garage';
    gsap.set(strips, { clearProps: 'zIndex,overflow' });
  }

  // 5 → 4 колесом назад: полосы уходят, имя возвращается вниз большим словом, видео идёт дальше
  async function garageToCar() {
    const cfg = CAR(), strip = stripOf(car), nameEl = $('.strip-name', strip), others = strips.filter(s => s !== strip);
    cfg.video.play().catch(() => {});
    body.dataset.stage = 'car';
    videoTick();
    gsap.set(strip, { zIndex: 2, overflow: 'visible' });
    await gsap.timeline()
      .to($('.strip-note', strip), { opacity: 0, duration: .25 }, 0)
      .to(others, { y: innerHeight, duration: .7, stagger: .06, ease: 'power3.in' }, 0)
      .to($('.strip-bg', strip), { scaleY: 0, transformOrigin: '50% 100%', duration: .8, ease: 'power3.inOut' }, .2)
      .to(nameEl, { ...nameToBig(nameEl, cfg), duration: 1, ease: 'power3.inOut' }, .2)
      .to(nameEl, { opacity: 0, duration: .3 }, 1)
      .to(cfg.big, { opacity: 1, duration: .3 }, 1)
      .to($$('.car-text [data-a]', cfg.scene), { opacity: 1, x: 0, duration: .5, stagger: .04, ease: 'power3.out' }, .9);
    gsap.set(garage, { autoAlpha: 0 });
    resetGarage();
  }

  // Клик по полосе: она растягивается на весь экран, имя уходит вниз, и машина разрезает этот лист
  async function pickCar(name) {
    const cfg = CARS[name], strip = stripOf(name), nameEl = $('.strip-name', strip), others = strips.filter(s => s !== strip);
    // CSS-переход ширины полос (для наведения) здесь мешает: раскладка должна меняться сразу
    gsap.set(strips, { transition: 'none' });
    // Куда встанет имя, когда полоса займёт весь экран: замеряем в конечной раскладке и возвращаем как было
    gsap.set(others, { flexGrow: 0 });
    const to = nameToBig(nameEl, cfg);
    gsap.set(others, { flexGrow: 1, overflow: 'hidden' });
    gsap.set(strip, { zIndex: 2 });
    await gsap.timeline()
      .to($('.strip-note', strip), { opacity: 0, duration: .25 }, 0)
      .to(others, { flexGrow: 0, duration: .8, ease: 'power3.inOut' }, 0)
      .to(nameEl, { ...to, duration: 1.1, ease: 'power3.inOut' }, .1);
    await cutInto(name, paintStrip(strip), garage);
    resetGarage();
  }

  strips.forEach(strip => strip.addEventListener('click', () => {
    if (strip.dataset.car) run(async () => { await pickCar(strip.dataset.car); step = CAR_STEP; });
  }));

  /* ================= Переходы между шагами ================= */
  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; lastNav = performance.now(); }
  }

  async function goTo(to) {
    if (busy || to === step || to < 0 || to > LAST) return;
    const from = step;
    await run(async () => {
      step = to;
      if (from === 0 && to === NAME_A) await introToNames();
      else if (from === NAME_A && to === 0) await namesToIntro();
      else if (from === NAME_A && to === NAME_B) await swapNames('b');
      else if (from === NAME_B && to === NAME_A) await swapNames('a');
      else if (from === NAME_B && to === CENTER) await namesToCenter();
      else if (from === CENTER && to === NAME_B) await centerToNames();
      else if (from === CENTER && to === CAR_STEP) await centerToSupra();
      else if (from === CAR_STEP && to === CENTER) await supraToCenter();
      else step = from; // дальние прыжки не поддерживаем
    });
  }
  // Со страницы машины вниз — выбор машины. Назад со страницы Supra — к листу со словами,
  // с остальных машин — снова к выбору; из выбора назад — к машине, с которой пришли
  const toGarage = () => run(async () => { await carToGarage(); step = GARAGE; });
  const next = () => step === CAR_STEP ? toGarage() : step < CAR_STEP ? goTo(step + 1) : null;
  const prev = () => {
    if (step === GARAGE) return run(async () => { await garageToCar(); step = CAR_STEP; });
    if (step === CAR_STEP && car !== 'supra') return toGarage();
    return goTo(step - 1);
  };

  intro.addEventListener('click', next);

  // Колесо / тачпад: один «щелчок» — один шаг; на странице машины сначала доскролливаем текст
  const canScroll = dy => {
    if (step !== CAR_STEP) return false;
    const sc = CAR().scene;
    return sc.scrollHeight > sc.clientHeight + 2 &&
      (dy > 0 ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2 : sc.scrollTop > 0);
  };
  let acc = 0;
  addEventListener('wheel', e => {
    if (canScroll(e.deltaY)) { acc = 0; return; }
    if (busy || performance.now() - lastNav < 450) { acc = 0; return; }
    acc += e.deltaY;
    if (Math.abs(acc) > 40) { acc > 0 ? next() : prev(); acc = 0; }
  }, { passive: true });

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('button.strip') && (e.key === 'Enter' || e.key === ' ')) return; // кнопки полос жмутся сами
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  });

  let ty = 0;
  addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', e => {
    const dy = ty - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 50 || canScroll(dy)) return;
    dy > 0 ? next() : prev();
  }, { passive: true });
})();
