/* Droploft mark — motion engine, v13.
   Everything flows. No element ever jumps, and no edge ever changes speed in an instant: every move starts from rest
   and lands softly, falls are slowed by the loft before they are caught, and moves overlap so the eye is handed on.
   Drop: a small raindrop forms above the loft and falls. Loft: the two beads move in to meet it, take it at its
   waist and give with it. Held there, it opens into the mark, and the beads ride out with its widest point until
   they let go of it and rest. The static mark is the last frame: the drop, held at its waist.
   Units are the canon's: bar width 2, pitch 3, corner radius 0.353 × width, y grows downward, apex 0. */
(function (root) {
  const GEO = {
    W: 2, RX: 0.706, P: 3, BX: 19.895,
    top: [0, 9.994, 15.954, 21.965, 26.945, 30.935],
    bot: [57.923, 57.923, 55.857, 53.935, 49.946, 44.885],
    bead: [32.867, 38.939]
  };
  const P0 = (GEO.bead[0] + GEO.bead[1]) / 2;            // the bead line, the drop's waist: 35.903
  const K = c => Math.abs(c - 5);
  const X = c => (c - 5) * GEO.P;
  const TOP = c => GEO.top[K(c)], BOT = c => GEO.bot[K(c)];
  const FILE = GEO.bead[1] - GEO.bead[0];                 // a file is bead-sized: 6.072 u
  const EDGE = X(10) + GEO.W / 2;                         // the drop's widest point: 16 u from the axis
  const REST_GAP = GEO.BX - GEO.W / 2 - EDGE;             // the canon's gap between drop and bead: 2.895 u
  const BOX = { x: -55, y: -26, w: 110, h: 110 };
  const STATIC_BOX = { x: -22, y: -1, w: 44, h: 60 };
  const C11 = [...Array(11)].map((_, c) => c);

  // ---------- easing: cubic Béziers in CSS terms, and one spring ----------
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const BX = s => ((ax * s + bx) * s + cx) * s, BY = s => ((ay * s + by) * s + cy) * s, dBX = s => (3 * ax * s + 2 * bx) * s + cx;
    const f = u => {
      if (u <= 0) return 0; if (u >= 1) return 1;
      let s = u;
      for (let i = 0; i < 8; i++) { const e = BX(s) - u, d = dBX(s); if (Math.abs(e) < 1e-9) return BY(s); if (Math.abs(d) < 1e-6) break; s -= e / d; if (s < 0 || s > 1) break; }
      let a = 0, b = 1; s = u;
      for (let i = 0; i < 50; i++) { if (BX(s) < u) a = s; else b = s; s = (a + b) / 2; }
      return BY(s);
    };
    f.css = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    return f;
  }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const smoother = u => { u = clamp01(u); return u * u * u * (u * (6 * u - 15) + 10); };
  const EASE = {
    move: bezier(.45, 0, .15, 1),   // every move of something already on screen: from rest, landing softly
    grow: bezier(.3, 0, .1, 1),     // something forming from a point
    open: bezier(.35, 0, .5, 1)     // the drop opening out of the loft's give, arriving rather than creeping
  };
  const tw = (t, t0, d, ease) => ease(clamp01((t - t0) / d));
  const mix = (a, b, u) => a + (b - a) * u;
  // the loft's give: a damped spring, released at tau = 0 from displacement x0 with speed v0
  const GIVE = { f: 2.2, z: .6 };
  function spring(x0, v0, tau, f = GIVE.f, z = GIVE.z) {
    if (tau <= 0) return x0 + v0 * tau;
    const w = 2 * Math.PI * f;
    if (z >= 1) return (x0 + (v0 + w * x0) * tau) * Math.exp(-w * tau);
    const wd = w * Math.sqrt(1 - z * z), B = (v0 + z * w * x0) / wd;
    return Math.exp(-z * w * tau) * (x0 * Math.cos(wd * tau) + B * Math.sin(wd * tau));
  }
  // a fall that the loft slows: gravity eased in over `ramp`, free fall until tf, then a quintic brake that arrives
  // at y1 with speed vc and acceleration a1, so position, speed and acceleration are all continuous
  function fall(t0, y0, y1, G, tf, vc, a1, ramp = .06) {
    const free = s => {
      if (s <= 0) return [0, 0, 0];
      if (s < ramp) { const u = s / ramp; return [G * ramp * ramp * (u ** 4 / 4 - u ** 5 / 10), G * ramp * (u ** 3 - u ** 4 / 2), G * smooth(u)]; }
      const q = s - ramp; return [.15 * G * ramp * ramp + .5 * G * ramp * q + .5 * G * q * q, .5 * G * ramp + G * q, G];
    };
    const [db, vb, ab] = free(tf), yb = y0 + db, tb = 2 * (y1 - yb) / (vb + vc);
    const brake = s => {
      const T = tb, u = Math.min(s / T, 1), u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
      const P = [yb, vb * T, ab * T * T, a1 * T * T, vc * T, y1];
      const H = [1 - 10 * u3 + 15 * u4 - 6 * u5, u - 6 * u3 + 8 * u4 - 3 * u5, .5 * u2 - 1.5 * u3 + 1.5 * u4 - .5 * u5, .5 * u3 - u4 + .5 * u5, -4 * u3 + 7 * u4 - 3 * u5, 10 * u3 - 15 * u4 + 6 * u5];
      const dH = [-30 * u2 + 60 * u3 - 30 * u4, 1 - 18 * u2 + 32 * u3 - 15 * u4, u - 4.5 * u2 + 6 * u3 - 2.5 * u4, 1.5 * u2 - 4 * u3 + 2.5 * u4, -12 * u2 + 28 * u3 - 15 * u4, 30 * u2 - 60 * u3 + 30 * u4];
      let y = 0, v = 0; for (let i = 0; i < 6; i++) { y += H[i] * P[i]; v += dH[i] * P[i]; }
      return [y, v / T];
    };
    return {
      t0, tb: t0 + tf, tc: t0 + tf + tb, vb, vc,
      at(t) {
        if (t <= t0 + tf) { const [d, v] = free(t - t0); return [y0 + d, v]; }
        return brake(t - t0 - tf);
      }
    };
  }

  // ---------- frames: bars with ids, plus the two beads as [top, bottom, |x|] ----------
  const bar = (id, x, top, bot, w = GEO.W) => ({ id, x, top, bot, w, rx: GEO.RX * w / GEO.W, filed: true });
  const canonBar = c => bar('b' + c, X(c), TOP(c), BOT(c));
  const BEADS = (top = GEO.bead[0], bot = GEO.bead[1], x = GEO.BX) => [[top, bot, x], [top, bot, x]];
  const canon = () => ({ pills: C11.map(canonBar), posts: BEADS() });
  const empty = () => ({ pills: [], posts: BEADS() });
  const gone = () => ({ pills: [], posts: [] });
  // the drop drawn at a scale about its waist, its waist at (0, wy); sx and sy stretch it with its speed
  // scX sets the whole drop's width and spacing (one value for every bar, so gaps stay in proportion); scY each bar's height
  const dropBar = (c, scX, scY, wy, sy = 1) => bar('b' + c, X(c) * scX, wy + (TOP(c) - P0) * scY * sy, wy + (BOT(c) - P0) * scY * sy, GEO.W * scX);
  const STRETCH = .1 / 240;                               // drawn out by its speed: 10 % at 240 u/s
  // lengthwise only: nothing moves sideways while it falls, so at small sizes the bars keep their place on the pixel grid
  const stretchOf = v => [1, 1 + STRETCH * v];

  function sequence(name, dur, frameAt, moments, phases) {
    const phaseAt = t => { let p = phases[0]; for (const q of phases) if (t >= q.t) p = q; return p.name; };
    const at = t => { const tt = Math.min(Math.max(t, 0), dur); return { frame: frameAt(tt), phase: phaseAt(tt), t: tt }; };
    const frames = fps => { const n = Math.ceil(dur * fps - 1e-9), out = [];
      for (let i = 0; i <= n; i++) { const t = Math.min(dur, i / fps), tp = (i - 1) / fps;
        const ev = moments.filter(e => e.t > tp + 1e-9 && e.t <= t + 1e-9); out.push(Object.assign(at(t), { i, cut: ev.length ? ev.map(e => e.name).join(' + ') : null })); }
      return out; };
    return { name, dur, events: moments, phases, at, frames };
  }

  // ---------- reveal ----------
  const REV = {
    beads: { t0: 0, d: .3 },                                   // the loft draws in: two beads
    s: .4,                                                     // the drop forms small: a raindrop
    form: { t0: .16, d: .3, stagger: .006, wy: -4 },           // high above the loft, blooming from its centre
    release: .51, G: 1500, tf: .21, vc: 165,                   // let go after a breath, it falls; the loft slows it to 165 u/s
    reach: 'waist',                                            // the beads close as it falls: driven by its waist, not the clock,
    clasp: { f: 5 },                                           // arriving with a little closing speed that a stiff spring takes up
    lift: 1,                                                   // rising a unit to meet it
    grip: .5,                                                  // they take it at its waist, half a unit off its edge
    soft: [.025, .07],                                         // contact is eased over 25 ms before and 70 ms after
    load: .45,                                                 // a bead is drawn out by the weight it takes
    unfold: { lag: .05, d: .4, stagger: .012 },                // held, it opens into the mark from the bottom of the give, centre first
    letGo: { lag: .14, d: .46 },                               // the beads ride out with it and settle a beat after the last bars land, in one movement
    hold: .2,
    tension: { d: .12, amt: .03 }                              // before it lets go the drop draws itself out a little, as a hanging drop does
  };
  const W_GIVE = 2 * Math.PI * GIVE.f;
  REV.yc = P0 - REV.lift;                                      // contact: a unit above the waist line, where the beads have risen to
  REV.path = fall(REV.release, REV.form.wy, REV.yc, REV.G, REV.tf, REV.vc, W_GIVE * W_GIVE * REV.lift - 2 * GIVE.z * W_GIVE * REV.vc);
  REV.tc = REV.path.tc;                                        // the waist meets the beads
  REV.tu = REV.tc + REV.unfold.lag;
  REV.tg = REV.tu + REV.letGo.lag;
  REV.settled = Math.max(REV.tu + 5 * REV.unfold.stagger + REV.unfold.d, REV.tg + REV.letGo.d);
  REV.end = REV.settled + REV.hold;
  REV.xc = EDGE * REV.s * stretchOf(REV.vc)[0] + GEO.W / 2 + REV.grip;   // where the beads take it
  // the beads' closing speed at contact (the reach's slope there, 0.5 of the unit, times the waist's speed), taken up by the clasp
  REV.vClasp = .5 * (EDGE * 0 + GEO.BX - (EDGE * REV.s + GEO.W / 2 + REV.grip)) * REV.vc / (REV.yc - REV.form.wy);
  REV.giveMax = (() => { let m = 0; for (let tau = 0; tau < .5; tau += .0005) m = Math.max(m, spring(-REV.lift, REV.vc, tau)); return m; })();   // how far below the waist line loft and drop sink
  // the waist: still while forming, falling, slowed, then giving with the loft and springing back to the waist line
  const waist = t => {
    if (t <= REV.tc) return REV.path.at(t);
    const tau = t - REV.tc, h = 1e-4, d = spring(-REV.lift, REV.vc, tau);
    return [P0 + d, (spring(-REV.lift, REV.vc, tau + h) - d) / h];
  };
  function revealAt(t) {
    if (t >= REV.end) return canon();
    const R = REV, s = R.s, [wy, v] = waist(t), [sx, sy0] = stretchOf(v);
    const sy = sy0 + R.tension.amt * (t <= R.release ? smooth((t - R.release + R.tension.d) / R.tension.d) : 1 - smooth((t - R.release) / .1));
    // the drop
    const sc = c => t < R.tu ? s : mix(s, 1, tw(t, R.tu + K(c) * R.unfold.stagger, R.unfold.d, EASE.open));
    const pills = [];
    const uLead = tw(t, R.form.t0, R.form.d, EASE.grow);                       // the centre bar leads the drop's width
    if (t > R.form.t0) for (const c of C11) {
      const u = tw(t, R.form.t0 + K(c) * R.form.stagger, R.form.d, EASE.grow);
      if (u <= 0) continue;
      pills.push(dropBar(c, sc(5) * uLead, sc(c) * u, wy, sy));
    }
    // the loft: beads drawn in; closing and rising as the drop falls, so they arrive with it; taking it at the waist and
    // giving with it; riding out with its widest point as it opens; letting go to rest as the last bars land
    const bIn = tw(t, R.beads.t0, R.beads.d, EASE.grow);
    if (bIn <= 0 && !R.fromLoft) return { pills, posts: [] };
    const p = clamp01((wy - R.form.wy) / (R.yc - R.form.wy)), reach = t >= R.tc ? 1 : p * p * (2.5 - 1.5 * p), rise = t >= R.tc ? 1 : smooth(p);
    const clasp = t > R.tc ? spring(0, R.vClasp, t - R.tc, R.clasp.f, 1) : 0;
    const hold = smooth((t - (R.tc - R.soft[0])) / (R.soft[0] + R.soft[1]));
    const gap = mix(R.grip, REST_GAP, tw(t, R.tg, R.letGo.d, EASE.open));
    const ride = EDGE * sc(5) + GEO.W / 2 + gap;
    const x = mix(mix(GEO.BX, R.xc, reach) - clasp, ride - clasp, hold);
    const dy = mix(-R.lift * rise, wy - P0, hold), load = (wy - P0) * smooth((t - R.tc) / .14) * R.load;
    const b = R.fromLoft ? 1 : bIn;
    const half = FILE / 2 * b;
    return { pills, posts: BEADS(P0 - half + dy - load * .3, P0 + half + dy + load * .7, x) };
  }
  const revealMoments = [
    [{ t: REV.beads.t0, name: 'Loft', what: 'the loft draws in: two beads' },
     { t: REV.form.t0, name: 'Forms', what: 'a small drop blooms above the loft' },
     { t: REV.release, name: 'Let go', what: 'it falls' },
     { t: (() => { let t = REV.release; for (;;) { const p = (REV.path.at(t)[0] - REV.form.wy) / (REV.yc - REV.form.wy); if (p * p * (2.5 - 1.5 * p) >= .05) return t; t += .0005; } })(), name: 'Reach', what: 'the beads close and rise to meet it, in step with its fall' },
     { t: REV.tc, name: 'Caught', what: 'they take it at its waist; loft and drop sink together and spring back' },
     { t: REV.tu, name: 'Opens', what: 'held, it opens into the mark; the beads ride out with its widest point' },
     { t: REV.tg, name: 'Rests', what: 'the beads let go to their rest' }].sort((a, b) => a.t - b.t),
    [{ t: 0, name: 'The loft' }, { t: REV.form.t0, name: 'A drop forms' }, { t: REV.release, name: 'Falls' }, { t: REV.tc, name: 'Caught' },
     { t: REV.tu, name: 'Opens' }, { t: REV.settled, name: 'Held' }]];
  const reveal = sequence('reveal', REV.end, revealAt, ...revealMoments);
  // from the empty loft (after put away): the beads are already there, nothing blinks out; the same reveal otherwise
  // it begins 120 ms in, where the drop starts to form: with the beads already there, there is nothing to wait for
  REV.fromLoftSkip = .12;
  const revealFromLoft = sequence('revealFromLoft', REV.end - REV.fromLoftSkip, t => { REV.fromLoft = true; const F = revealAt(t + REV.fromLoftSkip); REV.fromLoft = false; return F; },
    revealMoments[0].filter(e => e.name !== 'Loft').map(e => Object.assign({}, e, { t: e.t - REV.fromLoftSkip })),
    revealMoments[1].map(q => Object.assign({}, q, { t: Math.max(0, q.t - REV.fromLoftSkip) })));

  // ---------- ingest: a file forms above a bead, falls, is slowed, and the bead takes it in ----------
  const ING = { period: 1.3, form: { d: .18, top: -12 }, hang: .04, G: 1500, tf: .21, vc: 120, take: { f: 3.4, z: .9 }, give: 3, feet: 2 };   // the reveal's own fall
  const TAKE_W = 2 * Math.PI * ING.take.f;
  function fileOf(f) {
    const tr = f.t0 + ING.form.d + ING.hang, y0 = (f.top ?? ING.form.top) + FILE;   // the file's foot falls to the bead's head
    const a1 = -2 * ING.take.z * TAKE_W * ING.vc + TAKE_W * TAKE_W * FILE;   // the take's starting acceleration
    const path = fall(tr, y0, GEO.bead[0], ING.G, ING.tf, ING.vc, a1);
    return { tr, path, tl: path.tc };
  }
  function readingAt(files, t) {
    const F = canon();
    const foot = [0, 0], late = [];
    for (const f of files) {
      const T = fileOf(f), i = f.side < 0 ? 0 : 1, x = f.side * GEO.BX;
      if (t <= f.t0) continue;
      if (t < T.tl) {                                        // forming, hanging, falling
        const u = tw(t, f.t0, ING.form.d, EASE.grow), [footY, v] = T.path.at(t), [sx, sy] = stretchOf(v);
        const mid = footY - FILE / 2 * sy, h = FILE * u * sy, w = GEO.W * Math.sqrt(u) * sx;
        F.pills.push({ id: f.id, x, top: mid - h / 2, bot: mid + h / 2, w, rx: GEO.RX * w / GEO.W, filed: true });
        continue;
      }
      // taken in: the file slides on down into the bead, its foot slowing to the bead's foot, until it lies within it;
      // the bead gives under it. Its foot leads, as it did while falling, so nothing changes speed at contact
      const tau = t - T.tl, h = 1e-4;
      const e = spring(-FILE, ING.vc, tau, ING.take.f, ING.take.z), v = (spring(-FILE, ING.vc, tau + h, ING.take.f, ING.take.z) - e) / h;
      const [sx, sy] = stretchOf(v), bot = GEO.bead[1] + e;
      late.push({ id: f.id, x, top: bot - FILE * sy, bot, w: GEO.W * sx, rx: GEO.RX * sx, filed: true });
      const g = spring(0, ING.give * 2 * Math.PI * GIVE.f, tau) * smooth(tau / .04);
      foot[i] += g;
      F.pills.forEach((p, c) => { if (p.id[0] === 'b') p.bot += g * ING.feet * (BOT(c) - P0) / (GEO.bot[0] - P0) / (1 + ((c - (f.side < 0 ? 0 : 10)) / 2.5) ** 2); });
    }
    F.posts = [0, 1].map(i => [GEO.bead[0] + foot[i] * .4, GEO.bead[1] + foot[i], GEO.BX]);
    F.pills.push(...late);
    return F;
  }
  const mkReading = (name, files) => {
    files.forEach((f, i) => { f.id = 'f' + i; });
    const mom = [];
    files.forEach(f => { const T = fileOf(f); mom.push({ t: f.t0, name: 'Forms', what: 'a file forms above a bead' }, { t: T.tl, name: 'Taken in', what: `the ${f.side < 0 ? 'left' : 'right'} bead takes it in` }); });
    const T0 = fileOf(files[0]);
    return sequence(name, ING.period, t => readingAt(files, t), mom.sort((a, b) => a.t - b.t),
      [{ t: 0, name: 'Holds' }, { t: files[0].t0, name: 'A file forms' }, { t: T0.tr, name: 'Falls' }, { t: T0.tl, name: 'Taken in' }, { t: Math.max(...files.map(f => fileOf(f).tl)) + .4, name: 'Holds' }]);
  };
  const ingest = mkReading('ingest', [{ side: 1, t0: .05 }]);
  const ingestBurst = mkReading('ingestBurst', [{ side: -1, t0: .05 }, { side: 1, t0: .18, top: -9 }, { side: -1, t0: .36, top: -15 }]);
  // below 96 px a file is five pixels or less and its fall is a flicker: there a bead takes the file in without the fall —
  // its head draws up as if a file had arrived and settles back on the same spring, and the loft gives
  ING.tick = { up: .12 };
  function tickAt(ticks, t) {
    const F = canon(), head = [0, 0], foot = [0, 0];
    for (const k of ticks) {
      const tau = t - k.at, i = k.side < 0 ? 0 : 1;
      if (tau <= 0) continue;
      head[i] += tau < ING.tick.up ? -FILE * smoother(tau / ING.tick.up) : spring(-FILE, 0, tau - ING.tick.up, ING.take.f, ING.take.z);
      const g = spring(0, ING.give * 2 * Math.PI * GIVE.f, tau) * smooth(tau / .04);
      foot[i] += g;
      F.pills.forEach((p, c) => { p.bot += g * ING.feet * (BOT(c) - P0) / (GEO.bot[0] - P0) / (1 + ((c - (k.side < 0 ? 0 : 10)) / 2.5) ** 2); });
    }
    F.posts = [0, 1].map(i => [GEO.bead[0] + head[i] + foot[i] * .4, GEO.bead[1] + foot[i], GEO.BX]);
    return F;
  }
  const mkTick = (name, ticks) => sequence(name, ING.period, t => tickAt(ticks, t),
    ticks.map(k => ({ t: k.at, name: 'Taken in', what: `the ${k.side < 0 ? 'left' : 'right'} bead takes a file in, without the fall (below 96 px)` })),
    [{ t: 0, name: 'Holds' }, { t: ticks[0].at, name: 'Taken in' }, { t: ticks[ticks.length - 1].at + .5, name: 'Holds' }]);
  // with no fall to watch, what must match across sizes is the time to first feedback: a tick answers when the file
  // would have begun to form (50 ms) plus a beat, and a burst keeps the burst's own spacing
  const ingestTick = mkTick('ingestTick', [{ side: 1, at: .1 }]);
  const ingestTickBurst = mkTick('ingestTickBurst', [{ side: -1, at: .1 }, { side: 1, at: .23 }, { side: -1, at: .41 }]);

  // ---------- put away: the beads close on the drop as it folds back into a small drop, outer bars first; a breath,
  // as before the let-go; then it is drawn in to its waist and the beads close over it until the loft is one bead,
  // holding it, giving under its weight; then the loft opens again into its two beads and they go back to rest ----------
  const EX = { fold: { t0: 0, d: .36, stagger: .006 }, grip: { t0: 0, d: .36 }, take: { t0: .52, d: .3 }, closed: .03, release: { d: .38 }, swell: 25, s: .4 };
  EX.tm = EX.take.t0 + EX.take.d;                              // the loft has closed over it: one bead
  EX.part = bezier(.2, 0, .45, 1);                             // the loft opens a little more briskly than it lands, so the two part cleanly
  EX.release.t0 = EX.tm + EX.closed;
  EX.tk = EX.take.t0 + EX.take.d * .7;                         // its weight goes into the loft
  EX.end = Math.max(EX.release.t0 + EX.release.d + .06, EX.tk + .45);
  function exitAt(t) {
    if (t >= EX.end) return empty();
    const m = tw(t, EX.take.t0, EX.take.d, EASE.move);
    const fold = c => mix(1, EX.s, tw(t, EX.fold.t0 + (5 - K(c)) * EX.fold.stagger, EX.fold.d, EASE.move));
    const scX = fold(0) * (1 - m);                             // the outer bars lead the drop's width
    const pills = [];
    for (const c of C11) { const v = fold(c) * (1 - m); if (v > .002) pills.push(dropBar(c, scX, v, P0)); }
    const gap = mix(REST_GAP, REV.grip, tw(t, EX.grip.t0, EX.grip.d, EASE.move));
    // riding its edge half a unit off it, and only as the last of it goes in closing over it until the two are one
    // riding its edge half a unit off it, and as the last of it goes in closing over it over 100 ms, never slowing
    // inside the pause-sign proportion, until the two are one
    const close = mix(EDGE * scX + GEO.W / 2 + gap, 0, smooth((t - EX.tm + .13) / .1));
    const x = mix(close, GEO.BX, tw(t, EX.release.t0, EX.release.d, EX.part));
    const sw = spring(0, EX.swell, t - EX.tk) * smooth((t - EX.tk) / .05) * (1 - smooth((t - EX.end + .15) / .15));   // the loft's give, drawn out more below than above
    return { pills, posts: BEADS(GEO.bead[0] - sw * .6, GEO.bead[1] + sw * 1.4, x) };
  }
  const exit = sequence('exit', EX.end, exitAt,
    [{ t: EX.fold.t0, name: 'Folds', what: 'the beads close on the drop as it folds back, outer bars first' },
     { t: EX.take.t0, name: 'Taken in', what: 'after a breath, drawn in to its waist as the beads close over it until the loft is one bead, holding it' },
     { t: EX.release.t0, name: 'Opens', what: 'the loft opens again into its two beads, which go back to rest' }],
    [{ t: 0, name: 'Folds' }, { t: EX.take.t0, name: 'Taken in' }, { t: EX.end, name: 'The loft waits' }]);

  // ---------- one renderer for every output ----------
  function toSVG(F) {
    const r3 = v => Math.round(v * 1000) / 1000;
    const pill = p => { const h = p.bot - p.top; if (h <= .001 || p.w <= .001) return ''; const r = r3(Math.min(p.rx, h / 2, p.w / 2)); return `<rect x="${r3(p.x - p.w / 2)}" y="${r3(p.top)}" width="${r3(p.w)}" height="${r3(h)}" rx="${r}" ry="${r}"/>`; };
    let out = F.pills.map(pill).join('');
    F.posts.forEach((q, i) => { out += pill({ x: (i ? 1 : -1) * (q[2] ?? GEO.BX), top: q[0], bot: q[1], w: GEO.W, rx: GEO.RX }); });
    return out;
  }

  // ---------- static pixel designs below 48 px ----------
  const profileAt = x => { const u = Math.min(15, Math.abs(x)) / 3, i = Math.min(4, Math.floor(u)), f = u - i;
    return [GEO.top[i] + (GEO.top[i + 1] - GEO.top[i]) * f, GEO.bot[i] + (GEO.bot[i + 1] - GEO.bot[i]) * f]; };
  function pixelMark(px, n, o = {}) {
    const s = px / GEO.bot[0], bw = o.bw || 1, pitch = o.solid ? 1 : (o.pitch || 2), half = (n - 1) / 2;
    const unitPitch = o.unitPitch || pitch / s, span = (n - 1) * pitch + bw, left = Math.round((px - span) / 2);
    const pills = [];
    for (let j = -half; j <= half; j++) {
      const ux = j * unitPitch, [t, b] = j === 0 ? [0, GEO.bot[0]] : profileAt(ux);
      const y0 = Math.max(0, Math.round(t * s)), y1 = Math.min(px, Math.max(y0 + 2, Math.round(b * s)));
      pills.push({ x: left + (j + half) * pitch, w: bw, y0, y1 });
    }
    const posts = [];
    if (o.posts) { const pw = o.pw || bw, y0 = Math.round(GEO.bead[0] * s), y1 = Math.round(GEO.bead[1] * s), gap = o.gap || 3;
      posts.push({ x: left - gap - pw, w: pw, y0, y1 }, { x: left + span + gap, w: pw, y0, y1 }); }
    return { px, pills, posts, kind: o.solid ? 'solid drop' : `${n} bars${o.posts ? ' and the beads' : ''}` };
  }
  const SMALLSIZES = [
    pixelMark(16, 9, { solid: true, unitPitch: 1 / (16 / GEO.bot[0]) * 1.05, posts: true, gap: 1 }),
    pixelMark(24, 7, { posts: true, gap: 2 }),
    pixelMark(32, 9, { posts: true, gap: 2 })
  ];

  const SIZES = { motionFromPx: 48, ingestFallFromPx: 96, note: 'the motion is drawn from the vector frames at any size from 48 px; ingest and ingestBurst drop their files from 96 px, and from 48 to 95 px ingestTick and ingestTickBurst play instead, a bead taking a file in without the fall; at 48–64 px the small falling drop renders as a tone (its gaps are under a pixel) and resolves into bars as it opens — keep it, never substitute fewer bars; while it opens at those sizes the stripes alias for a frame or two as their pitch sweeps through 1–2 px (measured, not snapped: snapping to whole pixels would bring back stepping); below 48 px the mark is static on the pixel grid, with its beads' };
  const QUEUE = { pacing: 'one reading period (1.3 s) at a time', note: 'one file: ingest. Several: ingestBurst, up to three per period' };

  root.DroploftMotion = {
    GEO, P0, FILE, EDGE, REST_GAP, BOX, STATIC_BOX, EASE, GIVE, REV, ING, EX, SIZES, QUEUE, SMALLSIZES, K, X,
    bezier, spring, pixelMark, canon, empty, gone, toSVG,
    reveal, revealFromLoft, ingest, ingestBurst, ingestTick, ingestTickBurst, exit
  };
})(typeof window !== 'undefined' ? window : globalThis);
