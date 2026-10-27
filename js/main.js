(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const RED = '#eb0a1e', INK = '#25262b', GREY = '#d5d5d8';

  // Плёночное зерно: генерируем шум один раз
  (() => {
    const c = document.createElement('canvas'), n = 160;
    c.width = c.height = n;
    const x = c.getContext('2d'), d = x.createImageData(n, n);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 46;
    }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
  })();

  /*
   * Всё листается колесом по шагам:
   * 0 — интро «Управляй мечтой»
   * 1 — TOYOTA выходит вперёд, появляется эмблема
   * 2 — расшифровка: буквы T O Y O T A проходят подряд, название краснеет, остановка
   * 3..5 — машины
   */
  const LOGO_FIRST = 1, LOGO_LAST = 2, CARS_FIRST = 3;
  const scenes = $$('.scene');
  const LAST = CARS_FIRST + scenes.length - 1;
  let step = 0, busy = false, lastNav = 0;

  /* ================= 1. INTRO ================= */
  const intro = $('#intro'), cols = $$('.intro-cols i');
  const introWord = $('.intro-word'), slogan = $('.intro-slogan');
  const loop = new SliceLoop($('#sliceLoop'), {
    images: ['img/slices-1.png', 'img/slices-2.png', 'img/slices-3.png'],
    interval: 900, duration: 750,
    accent: 'rgba(235,10,30,.95)', bg: '#161826'
  });
  gsap.from([slogan, introWord], { y: 30, opacity: 0, duration: 1.2, stagger: .2, delay: .3, ease: 'power3.out' });

  /* ================= 2. LOGO ================= */
  const emblem = $('#emblem'), pieces = $$('#emblem .pc');
  const LETTER_SIG = [0, 1, 2, 1, 0, 3]; // T O Y O T A → позиция в data-sig (T, O, Y, A)
  const word = $('#word'), letters = $$('#word span');

  // Сдвиг и масштаб, при которых центр элемента окажется в точке (cx, cy)
  const toPoint = (el, cx, cy, scale) => {
    gsap.set(el, { clearProps: 'transform' });
    const r = el.getBoundingClientRect();
    return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2), scale };
  };
  const bigScale = () => Math.min(1.5, innerWidth * .8 / word.offsetWidth); // offsetWidth не зависит от трансформаций

  // k: 0 — эмблема целиком, 1..6 — буква, 7 — финал
  function setLogo(k) {
    const d = .55;
    pieces.forEach(pc => {
      const lit = k >= 1 && k <= 6 && pc.dataset.sig[LETTER_SIG[k - 1]] === '1';
      gsap.to(pc, { color: k === 7 || lit ? RED : k >= 1 ? GREY : INK, duration: d });
    });
    letters.forEach((el, i) => {
      const active = i === k - 1;
      const red = k === 7 || i < k;
      gsap.to(el, { scale: active ? 1.7 : 1, color: red ? RED : INK, duration: active ? .6 : .45,
        ease: active ? 'back.out(2.2)' : 'power2.out' });
    });
    if (k === 7) gsap.fromTo(word, { scale: 1 }, { scale: 1.08, duration: .35, yoyo: true, repeat: 1, ease: 'power2.out' });
    return gsap.delayedCall(d, () => {});
  }

  // Расшифровка одним жестом: вперёд — T, O, Y, O, T, A и всё красное; назад — эмблема сразу гаснет целиком
  const HOLD = .5;
  async function decode(dir) {
    if (dir < 0) return setLogo(0);
    const ks = [1, 2, 3, 4, 5, 6, 7];
    for (const [i, k] of ks.entries()) {
      await setLogo(k);
      if (i < ks.length - 1) await gsap.delayedCall(HOLD, () => {});
    }
  }

  // 0 → 1: слоган уходит, TOYOTA выходит на первый план, экран белеет, появляется эмблема
  async function introToLogo() {
    const big = bigScale();
    const tl = gsap.timeline();
    tl.to(slogan, { y: -60, opacity: 0, duration: .6, ease: 'power2.in' }, 0)
      .fromTo(cols, { yPercent: i => i % 2 ? -101 : 101, y: 0 },
        { yPercent: 0, duration: .8, stagger: { each: .06, from: 'random' }, ease: 'power3.inOut' }, 0)
      .to(introWord, { ...toPoint(introWord, innerWidth / 2, innerHeight / 2,
          big * word.offsetWidth / introWord.offsetWidth),
        color: INK, duration: 1.1, ease: 'power3.inOut' }, .1);
    await tl;
    // Передаём надпись из интро в настоящую, под эмблемой
    gsap.set(word, { ...toPoint(word, innerWidth / 2, innerHeight / 2, big), opacity: 1 });
    gsap.set(intro, { autoAlpha: 0 });
    loop.paused = true;
    body.dataset.stage = 'logo';
    setLogo(0);
    await gsap.timeline()
      .to(word, { x: 0, y: 0, scale: 1, duration: 1, ease: 'power3.inOut' }, .2)
      .fromTo(emblem, { opacity: 0, scale: .6, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'expo.out' }, .55);
  }

  // 1 → 0: обратно в интро
  async function logoToIntro() {
    await gsap.timeline()
      .to(emblem, { opacity: 0, scale: .6, y: 30, duration: .5, ease: 'power2.in' }, 0)
      .to(word, { ...toPoint(word, innerWidth / 2, innerHeight / 2, bigScale()), duration: .8, ease: 'power3.inOut' }, .1);
    gsap.set(word, { opacity: 0 });
    gsap.set(intro, { autoAlpha: 1 });
    loop.paused = false;
    body.dataset.stage = 'intro';
    await gsap.timeline()
      .to(cols, { yPercent: i => i % 2 ? -101 : 101, duration: .8, stagger: { each: .06, from: 'random' }, ease: 'power3.inOut' }, 0)
      .to(introWord, { x: 0, y: 0, scale: 1, color: '#fff', duration: 1, ease: 'power3.inOut' }, .1)
      .to(slogan, { y: 0, opacity: 1, duration: .7, ease: 'power3.out' }, .5);
  }

  // 8 → 9: эмблема и надпись уходят, Toyota AA открывается кругом, как в старом кино
  async function logoToCars() {
    await gsap.to([emblem, word], { y: -40, opacity: 0, duration: .6, stagger: .07, ease: 'power2.in' });
    gsap.set('#logo-stage', { autoAlpha: 0 });
    body.dataset.stage = 'cars';
    show(0);
    enter(0, .35);
    await gsap.fromTo(scenes[0], { clipPath: 'circle(0% at 50% 50%)' },
      { clipPath: 'circle(75% at 50% 50%)', duration: 1.3, ease: 'power2.inOut', clearProps: 'clipPath' });
  }

  async function carsToLogo() {
    await gsap.to(scenes[0], { clipPath: 'circle(0% at 50% 50%)', duration: 1, ease: 'power2.inOut' });
    scenes[0].classList.remove('is-on');
    gsap.set(scenes[0], { clearProps: 'clipPath' });
    gsap.set('#logo-stage', { autoAlpha: 1 });
    body.dataset.stage = 'logo';
    await gsap.to([word, emblem], { y: 0, opacity: 1, duration: .6, stagger: .07, ease: 'power3.out' });
  }

  /* ================= 3. МАШИНЫ ================= */
  const navBtns = $$('#nav button');

  function show(i) {
    scenes.forEach((s, k) => s.classList.toggle('is-on', k === i));
    scenes[i].scrollTop = 0;
    body.dataset.scene = scenes[i].dataset.scene;
    navBtns.forEach((b, k) => b.classList.toggle('on', k === i));
  }

  // Появление контента — у каждой машины свой характер
  const ENTER = {
    aa(s, d) {
      return gsap.timeline({ delay: d })
        .from($('.film', s), { opacity: 0, y: 40, rotate: -4, duration: 1.3, ease: 'power3.out' })
        .from($$('.aa-text [data-a]', s), { opacity: 0, y: 18, duration: .7, stagger: .12, ease: 'steps(5)' }, .25);
    },
    supra(s, d) {
      return gsap.timeline({ delay: d })
        .from($('.supra-bigword', s), { xPercent: 70, opacity: 0, duration: 1.1, ease: 'expo.out' })
        .from($('.supra-photo', s), { x: '40vw', rotate: 8, duration: .9, ease: 'back.out(1.4)' }, 0)
        .from($('.supra-sticker', s), { scale: 0, rotate: -200, duration: .6, ease: 'back.out(2)' }, .55)
        .from($$('.supra-text [data-a]', s), { x: -80, opacity: 0, skewX: -20, duration: .55, stagger: .07, ease: 'power4.out' }, .1);
    },
    camry(s, d) {
      return gsap.timeline({ delay: d })
        .from($('.camry-photo img', s), { x: 140, opacity: 0, scale: 1.06, duration: 1.6, ease: 'expo.out' })
        .from($$('.camry-text [data-a]', s), { y: 26, opacity: 0, filter: 'blur(10px)', duration: .9, stagger: .08, ease: 'power3.out' }, .15);
    }
  };
  function enter(i, delay = 0) {
    const s = scenes[i];
    const els = $$('[data-a], [data-a] *, .supra-bigword, .camry-photo img', s);
    gsap.killTweensOf(els);
    gsap.set(els, { clearProps: 'transform,opacity,filter' });
    ENTER[s.dataset.scene](s, delay);
  }

  // Цветные шторки: в 90-е — красная, в наши дни — синяя
  const WIPES = {
    aa:    ['#e7e1d3', '#111'],
    supra: ['#ffd400', '#e10a17'],
    camry: ['#5ad1ff', '#0a3d7a']
  };
  async function wipeTo(i, dir) {
    const [c1, c2] = WIPES[scenes[i].dataset.scene];
    const bands = $$('#wipe div');
    gsap.set(bands[0], { background: c1 });
    gsap.set(bands[1], { background: c2 });
    gsap.set(bands, { x: dir > 0 ? '110vw' : '-200vw', skewX: -14 });
    await gsap.to(bands, { x: '-35vw', duration: .7, stagger: .09, ease: 'power3.in' });
    show(i);
    enter(i, .25);
    await gsap.to(bands.reverse(), { x: dir > 0 ? '-220vw' : '120vw', duration: .85, stagger: .09, ease: 'power3.out' });
  }

  /* ================= Переходы между шагами ================= */
  const inLogo = s => s >= LOGO_FIRST && s <= LOGO_LAST;

  async function goTo(to) {
    if (busy || to === step || to < 0 || to > LAST) return;
    busy = true;
    const from = step;
    step = to;
    if (from === 0 && to === 1) await introToLogo();
    else if (from === 1 && to === 0) await logoToIntro();
    else if (inLogo(from) && inLogo(to)) await decode(to - from);
    else if (from === LOGO_LAST && to === CARS_FIRST) await logoToCars();
    else if (from === CARS_FIRST && to === LOGO_LAST) await carsToLogo();
    else if (from >= CARS_FIRST && to >= CARS_FIRST) await wipeTo(to - CARS_FIRST, Math.sign(to - from));
    else { step = from; } // дальние прыжки не поддерживаем
    busy = false;
    lastNav = performance.now();
  }
  const next = () => goTo(step + 1), prev = () => goTo(step - 1);

  navBtns.forEach((b, k) => b.addEventListener('click', () => goTo(CARS_FIRST + k)));
  intro.addEventListener('click', next);
  $('.replay').addEventListener('click', () => location.reload());

  // Колесо / тачпад: один «щелчок» — один шаг; в сценах с машинами сначала доскролливаем контент
  const canScroll = dy => {
    if (step < CARS_FIRST) return false;
    const s = scenes[step - CARS_FIRST];
    return s.scrollHeight > s.clientHeight + 2 &&
      (dy > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 0);
  };
  let acc = 0;
  addEventListener('wheel', e => {
    if (canScroll(e.deltaY)) { acc = 0; return; }
    if (busy || performance.now() - lastNav < 450) { acc = 0; return; }
    acc += e.deltaY;
    if (Math.abs(acc) > 40) { acc > 0 ? next() : prev(); acc = 0; }
  }, { passive: true });

  addEventListener('keydown', e => {
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
