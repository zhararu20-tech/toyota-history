/**
 * SliceLoop — 6 visible vertical slices drawn from a pool of 18 (3 images x 6 slices).
 * At random moments a visible slice is replaced by a hidden one, or two visible slices swap.
 * Transition: new slice wipes in from the bottom or top with a thin accent line at the edge.
 * Zero dependencies. Usage: new SliceLoop(canvasEl, { images: [...], interval: 1100, duration: 800 })
 */
class SliceLoop {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = opts.images;                 // array of image URLs, each = one row of `cols` equal slices
    this.cols = opts.cols ?? 6;                // slices per source image == visible slots
    this.interval = opts.interval ?? 1100;     // avg ms between changes
    this.duration = opts.duration ?? 800;      // wipe ms (0 = instant swap)
    this.accent = opts.accent ?? 'rgba(145,132,217,.9)';
    this.bg = opts.bg ?? '#000';
    this.paused = false;
    this.total = this.images.length * this.cols;
    this.ready = Promise.all(this.images.map(src => new Promise((ok, err) => {
      const im = new Image(); im.onload = () => ok(im); im.onerror = err; im.src = src;
    }))).then(ims => {
      this.ims = ims;
      this.c.width = ims[0].naturalWidth; this.c.height = ims[0].naturalHeight;
      this.sw = this.c.width / this.cols;
      const ids = [...Array(this.total).keys()].sort(() => Math.random() - .5);
      this.slots = ids.slice(0, this.cols).map(id => ({ id, old: null, t0: 0, dir: 1 }));
      this.next = performance.now() + 600;
      const loop = t => { if (this.dead) return; this.frame(t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    });
  }
  destroy() { this.dead = true; cancelAnimationFrame(this.raf); }
  toggle() { this.paused = !this.paused; if (!this.paused) this.next = performance.now() + 300; }

  busy(s, now) { return s.old != null && now - s.t0 < this.duration; }

  event(now) {
    const free = this.slots.map((_, i) => i).filter(i => !this.busy(this.slots[i], now));
    if (!free.length) return;
    const pick = () => free.splice(Math.floor(Math.random() * free.length), 1)[0];
    if (free.length >= 2 && Math.random() < .45) {            // swap two visible slices
      const a = this.slots[pick()], b = this.slots[pick()], ia = a.id, ib = b.id;
      Object.assign(a, { old: ia, id: ib, t0: now, dir: 1 });
      Object.assign(b, { old: ib, id: ia, t0: now, dir: -1 });
    } else {                                                   // replace with a hidden slice
      const s = this.slots[pick()], used = new Set(this.slots.map(x => x.id));
      const hidden = [...Array(this.total).keys()].filter(i => !used.has(i));
      Object.assign(s, { old: s.id, id: hidden[Math.floor(Math.random() * hidden.length)], t0: now, dir: Math.random() < .5 ? 1 : -1 });
    }
  }

  frame(now) {
    if (!this.paused && now >= this.next) { this.event(now); this.next = now + this.interval * (.6 + Math.random() * .8); }
    // On pause with no wipe in progress the picture doesn't change — skip redrawing it every frame
    const still = this.paused && !this.slots.some(s => this.busy(s, now));
    if (still && this.drawnStill) return;
    this.drawnStill = still;
    const { ctx, sw } = this, W = this.c.width, H = this.c.height;
    ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H);
    const draw = (id, x) => ctx.drawImage(this.ims[Math.floor(id / this.cols)], (id % this.cols) * sw, 0, sw, H, x, 0, sw, H);
    this.slots.forEach((s, i) => {
      const x = i * sw, raw = s.old == null || !this.duration ? 1 : Math.min(1, (now - s.t0) / this.duration);
      if (raw >= 1) return draw(s.id, x);
      const p = raw < .5 ? 4 * raw ** 3 : 1 - Math.pow(-2 * raw + 2, 3) / 2;   // easeInOutCubic
      draw(s.old, x);
      const y0 = s.dir > 0 ? H * (1 - p) : 0, y1 = s.dir > 0 ? H : H * p;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y0, sw, y1 - y0); ctx.clip(); draw(s.id, x); ctx.restore();
      ctx.fillStyle = this.accent; ctx.fillRect(x, (s.dir > 0 ? y0 : y1) - 1.5, sw, 3);
    });
  }
}
