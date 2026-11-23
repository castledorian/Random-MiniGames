import { COL, FONT, H, HUD_H, ITEMS, MAP_H, MAP_W, T, W, easeOutBack, formatTime, type ItemId } from './config';
import { drawChef, drawItem, drawItemIcon, drawRat, drawTrashLid, rr, starPath, text } from './draw';
import type { Game } from './engine';
import type { Chef, Order, Tile } from './types';

const TAU = Math.PI * 2;

export function renderGame(g: Game, ctx: CanvasRenderingContext2D) {
  const k = g.k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = COL.navy;
  ctx.fillRect(0, 0, W, H);

  drawWorld(g, ctx);
  drawOverlays(g, ctx);
  drawHud(g, ctx);
  drawBanners(g, ctx);
}

// ---------------------------------------------------------------------------
// world
// ---------------------------------------------------------------------------
function drawWorld(g: Game, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, MAP_W, MAP_H);
  ctx.clip();
  const s = g.trauma * g.trauma;
  const ox = (Math.random() * 2 - 1) * s * 20;
  const oy = (Math.random() * 2 - 1) * s * 20;
  const z = 1 + g.zoom;
  ctx.translate(MAP_W / 2 + ox, HUD_H + MAP_H / 2 + oy);
  ctx.scale(z, z);
  ctx.translate(-MAP_W / 2, -MAP_H / 2);

  if (g.staticCanvas) ctx.drawImage(g.staticCanvas, 0, 0, MAP_W, MAP_H);
  drawTunnels(g, ctx);

  const live = g.phase === 'playing' || g.phase === 'countdown';

  // target highlights
  if (live) {
    for (const c of g.chefs) {
      if (!c.target) continue;
      if (!g.coop && c.idx !== g.active && !c.autoChop) continue;
      const t = c.target;
      const pulse = 0.5 + 0.5 * Math.sin(g.t * 9);
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.1 * pulse;
      ctx.fillStyle = c.hero.color;
      rr(ctx, t.c * T + 2, t.r * T + 2, T - 4, T - 4, 8);
      ctx.fill();
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      ctx.strokeStyle = c.hero.color;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      rr(ctx, t.c * T + 5, t.r * T + 5, T - 10, T - 10, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const t of g.flat) drawTile(g, ctx, t);

  // rat warnings
  for (const r of g.rats) {
    if (r.state === 'run' && r.target) {
      const t = r.target;
      const blink = Math.sin(g.t * 14) > -0.2;
      if (blink) {
        const cx = t.c * T + T / 2;
        const cy = t.r * T - 8 - Math.abs(Math.sin(g.t * 8)) * 4;
        ctx.fillStyle = COL.red;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, TAU);
        ctx.fill();
        ctx.stroke();
        text(ctx, '!', cx, cy + 1, 18, '#fff', 'center', null);
      }
    }
  }

  // entities sorted by y
  const ents: { y: number; chef?: Chef; rat?: (typeof g.rats)[number] }[] = [];
  for (const c of g.chefs) ents.push({ y: c.y, chef: c });
  for (const r of g.rats) ents.push({ y: r.y, rat: r });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.chef) {
      drawChef(ctx, e.chef, g.t);
      // en plein passage de tunnel : le chef apparaît aussi de l'autre côté
      const ch = e.chef;
      if (ch.x < T * 0.6) drawChef(ctx, { ...ch, x: ch.x + MAP_W }, g.t);
      else if (ch.x > MAP_W - T * 0.6) drawChef(ctx, { ...ch, x: ch.x - MAP_W }, g.t);
    }
    else if (e.rat) drawRat(ctx, e.rat, g.t);
  }

  // chef tags
  if (g.phase !== 'idle') for (const c of g.chefs) drawChefTag(g, ctx, c);

  // particles
  for (const p of g.parts) {
    const a = p.life / p.max;
    ctx.globalAlpha = p.shape === 'smoke' ? a * 0.7 : Math.min(1, a * 1.8);
    ctx.fillStyle = p.color;
    switch (p.shape) {
      case 'circle':
      case 'smoke':
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, TAU);
        ctx.fill();
        break;
      case 'square':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
        break;
      case 'star':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        starPath(ctx, 0, 0, p.size, 0.45);
        ctx.fill();
        ctx.restore();
        break;
      case 'ring':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5 + 5 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, TAU);
        ctx.stroke();
        break;
    }
  }
  ctx.globalAlpha = 1;

  // action labels
  if (g.phase === 'playing') {
    for (const c of g.chefs) {
      if (!c.target || (!g.coop && c.idx !== g.active)) continue;
      const plan = g.plan(c, c.target);
      if (!plan) continue;
      drawPill(ctx, plan.label, c.target.c * T + T / 2, Math.max(16, c.target.r * T - 10), plan.bad ? COL.red : c.hero.dark);
    }
  }

  // floating texts
  for (const f of g.texts) {
    const age = f.max - f.life;
    const pop = age < 0.14 ? easeOutBack(age / 0.14) : 1;
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2.5);
    const x = Math.max(70, Math.min(MAP_W - 70, f.x));
    text(ctx, f.text, x, f.y, f.size * pop, f.color, 'center', COL.ink, 5);
  }
  ctx.globalAlpha = 1;

  // hint bar
  if (g.phase === 'playing' || g.phase === 'countdown') drawHints(g, ctx);

  ctx.restore();
}

function drawPill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  ctx.font = `15px ${FONT}`;
  const w = ctx.measureText(label).width + 18;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  rr(ctx, x - w / 2, y - 12, w, 24, 12);
  ctx.fill();
  ctx.stroke();
  text(ctx, label, x, y + 1, 15, '#fff', 'center', null);
}

function drawChefTag(g: Game, ctx: CanvasRenderingContext2D, c: Chef) {
  const bounce = Math.sin(g.t * 6 + c.idx) * 3;
  const y = c.y - 58 + bounce;
  if (g.coop) {
    drawPill(ctx, `J${c.idx + 1}`, c.x, y - 6, SLOT_COLORS[c.idx % 4]);
    return;
  }
  if (c.idx === g.active) {
    const big = 1 + c.swapFlash * 0.8;
    ctx.save();
    ctx.translate(c.x, y);
    ctx.scale(big, big);
    ctx.fillStyle = c.hero.accent;
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(9, -8);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (c.autoChop) {
    drawPill(ctx, 'COUPE TOUT SEUL', c.x, y - 4, '#0f6f58');
  } else {
    text(ctx, 'zZ', c.x + 4, y, 16, '#cfd6f5', 'center', COL.ink, 3);
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, color: string) {
  ctx.fillStyle = COL.ink;
  rr(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, x, y, Math.max(h, w * Math.min(1, p)), h, h / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  rr(ctx, x + 2, y + 1, Math.max(0, w * Math.min(1, p) - 4), h / 3, h / 6);
  ctx.fill();
}

function drawTile(g: Game, ctx: CanvasRenderingContext2D, t: Tile) {
  const x = t.c * T;
  const y = t.r * T;
  const hop = t.bounce * 7;
  const cx = x + T / 2;
  const cy = y + 28;
  switch (t.type) {
    case 'crate':
      drawItemIcon(ctx, t.crate as ItemId, cx, cy - hop - Math.abs(Math.sin(g.t * 2 + t.c)) * 1.5, 19);
      return;
    case 'trash':
      drawTrashLid(ctx, x, y, t.bounce, g.t);
      return;
    case 'counter':
    case 'board':
    case 'stove':
      break;
    default:
      return;
  }
  const it = t.item;
  if (t.type === 'stove' && it) {
    const d = ITEMS[it.id];
    if (d.cook || d.burn) {
      const hot = !!d.burn && it.prog > 0.6;
      const pulse = 0.5 + 0.5 * Math.sin(g.t * (hot ? 24 : 9));
      const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 36);
      grd.addColorStop(0, hot ? 'rgba(255,60,60,.75)' : 'rgba(255,170,60,.7)');
      grd.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, 36, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  if (!it) return;
  const wob = t.type === 'board' && t.busy > 0 ? Math.sin(g.t * 60) * 1.4 : 0;
  drawItem(ctx, it, cx + wob, cy - hop + (it.id === 'plate' ? 0 : 2), it.id === 'plate' ? 19 : 16);

  const d = ITEMS[it.id];
  if (t.type === 'board' && d.chop && it.prog > 0.001) {
    bar(ctx, x + 9, y + 46, 46, 9, it.prog, COL.yellow);
  }
  if (t.type === 'stove') {
    if (d.cook) bar(ctx, x + 9, y + 46, 46, 9, it.prog, COL.orange);
    else if (d.burn) {
      const hot = it.prog > 0.6;
      const flash = hot && Math.sin(g.t * 24) > 0;
      bar(ctx, x + 9, y + 46, 46, 9, it.prog, flash ? '#fff' : COL.red);
      if (hot) {
        const bx = cx;
        const by = y - 8 - Math.abs(Math.sin(g.t * 10)) * 4;
        ctx.fillStyle = COL.red;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx, by - 13);
        ctx.lineTo(bx + 13, by + 10);
        ctx.lineTo(bx - 13, by + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        text(ctx, '!', bx, by + 3, 16, '#fff', 'center', null);
      }
    }
  }
}

function tutorialHint(g: Game): string | null {
  if (g.delivered > 0 || g.elapsed > 45) return null;
  let cooked = false;
  let cooking = false;
  let holdRaw = false;
  for (const t of g.stoves) {
    if (t.item?.id === 'patty_raw') cooking = true;
    if (t.item?.id === 'patty_cooked') cooked = true;
  }
  for (const t of g.flat) {
    if (t.item?.id === 'patty_cooked' || t.item?.plate.includes('patty_cooked')) cooked = true;
  }
  for (const c of g.chefs) {
    if (c.held?.id === 'patty_cooked' || c.held?.plate.includes('patty_cooked')) cooked = true;
    if (c.held?.id === 'patty_raw') holdRaw = true;
  }
  if (cooked) return '③  PAIN + STEAK sur une ASSIETTE, puis SERVIR au guichet orange  ➜';
  if (holdRaw) return '②  Pose le steak sur un FOURNEAU pour le cuire';
  if (cooking) return '②  Pendant la cuisson : prends un PAIN et une ASSIETTE';
  return '①  Prends un STEAK dans la caisse rouge en haut';
}

function drawHints(g: Game, ctx: CanvasRenderingContext2D) {
  const touch = g.controls.touchActive;
  let line: string | null = null;
  if (g.elapsed < 16) {
    if (g.coop) line = 'Clavier A : ZQSD + E prendre, F couper, Maj pouvoir   ·   Clavier B : flèches + Entrée, ., Maj d.';
    else if (touch) line = 'PRENDRE / POSER  ·  maintenir COUPER  ·  POUVOIR  ·  CHANGER de chef';
    else line = 'ESPACE prendre/poser  ·  maintenir F couper  ·  MAJ pouvoir  ·  TAB changer de chef';
  }
  const tut = tutorialHint(g);
  let a = 1;
  if (g.phase === 'playing' && g.elapsed > 12) a = Math.max(0, 1 - (g.elapsed - 12) / 4);
  if (line && a > 0) {
    ctx.globalAlpha = a;
    ctx.font = `17px ${FONT}`;
    const w = ctx.measureText(line).width + 28;
    ctx.fillStyle = 'rgba(16,19,43,.82)';
    rr(ctx, MAP_W / 2 - w / 2, MAP_H - 92, w, 30, 15);
    ctx.fill();
    text(ctx, line, MAP_W / 2, MAP_H - 76, 17, '#fff', 'center', null);
    ctx.globalAlpha = 1;
  }
  if (tut && g.phase === 'playing') {
    ctx.font = `19px ${FONT}`;
    const w = ctx.measureText(tut).width + 30;
    const bob = Math.sin(g.t * 4) * 2;
    // fade out if a chef is walking underneath it
    const under = g.chefs.some((c) => c.y < 80 + 34 + 46 && Math.abs(c.x - MAP_W / 2) < w / 2 + 20);
    ctx.globalAlpha = under ? 0.25 : 1;
    ctx.fillStyle = 'rgba(255,210,63,.96)';
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 3;
    rr(ctx, MAP_W / 2 - w / 2, 80 + bob, w, 34, 17);
    ctx.fill();
    ctx.stroke();
    text(ctx, tut, MAP_W / 2, 97 + bob, 19, COL.ink, 'center', null);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// screen overlays (flash, vignette)
// ---------------------------------------------------------------------------
function drawOverlays(g: Game, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, MAP_W, MAP_H);
  ctx.clip();
  if (g.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, g.flash * 0.6);
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, HUD_H, MAP_W, MAP_H);
    ctx.globalAlpha = 1;
  }
  if (g.phase === 'playing' && g.timeLeft <= 10) {
    const p = 0.5 + 0.5 * Math.sin(g.t * 8);
    const grd = ctx.createRadialGradient(MAP_W / 2, HUD_H + MAP_H / 2, MAP_H * 0.35, MAP_W / 2, HUD_H + MAP_H / 2, MAP_W * 0.62);
    grd.addColorStop(0, 'rgba(255,40,70,0)');
    grd.addColorStop(1, `rgba(255,40,70,${0.25 + p * 0.25})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, HUD_H, MAP_W, MAP_H);
  }
  if (g.phase === 'over') {
    ctx.globalAlpha = Math.min(0.55, g.endT * 0.6);
    ctx.fillStyle = COL.navy;
    ctx.fillRect(0, HUD_H, MAP_W, MAP_H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function drawHud(g: Game, ctx: CanvasRenderingContext2D) {
  const grd = ctx.createLinearGradient(0, 0, 0, HUD_H);
  grd.addColorStop(0, '#2a3270');
  grd.addColorStop(1, COL.navy2);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = COL.orange;
  ctx.fillRect(0, HUD_H - 5, W, 5);
  ctx.fillStyle = COL.yellow;
  for (let i = 0; i < W; i += 40) ctx.fillRect(i, HUD_H - 5, 20, 5);

  // timer
  const low = g.phase === 'playing' && g.timeLeft <= 10;
  const pulse = low ? 1 + 0.1 * Math.abs(Math.sin(g.t * 8)) : 1;
  text(ctx, formatTime(g.timeLeft), 16, 33, 42 * pulse, low ? COL.red : '#fff', 'left', COL.ink, 5);

  // score
  const sp = 1 + g.scorePop * 0.4;
  ctx.fillStyle = COL.yellow;
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 2.5;
  starPath(ctx, 28, 71, 11 * sp, 0.5);
  ctx.fill();
  ctx.stroke();
  text(ctx, String(g.score), 46, 71, 28 * sp, COL.yellow, 'left', COL.ink, 5);

  // combo chip
  if (g.combo >= 2) {
    const mult = 1 + 0.2 * Math.min(g.combo - 1, 5);
    const s = 1 + g.comboPulse * 0.3;
    ctx.save();
    ctx.translate(142, 71);
    ctx.scale(s, s);
    ctx.fillStyle = COL.orange;
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 3;
    rr(ctx, -26, -13, 52, 26, 13);
    ctx.fill();
    ctx.stroke();
    text(ctx, `x${mult.toFixed(1)}`, 0, 1, 19, '#fff', 'center', null);
    ctx.restore();
  }

  // tickets
  const dt = Math.min(0.05, g.dt);
  const ease = 1 - Math.exp(-dt * 12);
  g.orders.forEach((o, i) => {
    const slot = 176 + i * 104;
    if (o.dispX < 0) o.dispX = slot;
    o.dispX += (slot - o.dispX) * ease;
    drawTicket(g, ctx, o);
  });
  if (g.orders.length === 0 && g.phase !== 'idle') {
    text(ctx, 'en attente de commandes…', 176, HUD_H / 2, 20, '#8f9bd0', 'left', null);
  }

  // chef badges
  const nC = g.chefs.length;
  const gap = nC > 2 ? 31 : 38;
  g.chefs.forEach((c, i) => {
    const cx = (nC > 2 ? 730 : 714) + (i - (nC > 2 ? 0.5 : 0)) * gap - (nC > 3 ? 18 : 0);
    const cy = 46;
    const solo = !g.coop;
    const act = solo && g.active === i;
    const sc = solo ? (act ? 1.12 : 0.88) : nC > 2 ? 0.78 : 1;
    const ready = c.dashCd <= 0;
    const prog = 1 - c.dashCd / c.hero.cd;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.globalAlpha = solo && !act ? 0.7 : 1;
    ctx.fillStyle = c.hero.color;
    ctx.strokeStyle = act ? '#fff' : g.coop ? SLOT_COLORS[i % 4] : COL.ink;
    ctx.lineWidth = act ? 3.5 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // ability glyph
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (c.hero.ability === 'dash') {
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(0, 0);
      ctx.lineTo(-6, 6);
      ctx.moveTo(1, -6);
      ctx.lineTo(7, 0);
      ctx.lineTo(1, 6);
      ctx.stroke();
    } else if (c.hero.ability === 'blink') {
      starPath(ctx, 0, 0, 8, 0.4);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      ctx.stroke();
    }
    // cooldown ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,19,43,.8)';
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = ready ? COL.yellow : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
    ctx.stroke();
    ctx.restore();
  });
  if (!g.coop) {
    text(ctx, 'TAB', 733, 82, 12, '#8f9bd0', 'center', null);
  }
}

function drawTicket(g: Game, ctx: CanvasRenderingContext2D, o: Order) {
  const w = 98;
  const h = 80;
  const enter = easeOutBack(Math.min(1, o.age / 0.4));
  let x = o.dispX;
  let y = 7 + (1 - enter) * -90;
  const frac = Math.max(0, o.t / o.max);
  const col = frac > 0.5 ? COL.green : frac > 0.25 ? COL.yellow : COL.red;
  let alpha = 1;
  let scale = 1;
  if (!o.leaving && o.t < 10) x += Math.sin(g.t * 55) * 1.6;
  if (o.leaving === 'done') {
    const p = Math.min(1, o.leaveT / 0.55);
    y -= p * 50;
    scale = 1 + p * 0.25;
    alpha = 1 - p;
  } else if (o.leaving === 'fail') {
    const p = Math.min(1, o.leaveT / 0.55);
    x += Math.sin(o.leaveT * 60) * 5 * (1 - p);
    y += p * 40;
    alpha = 1 - p;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  // card
  ctx.fillStyle = COL.cream;
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 3;
  rr(ctx, 0, 0, w, h, 10);
  ctx.fill();
  ctx.stroke();
  // header
  ctx.save();
  rr(ctx, 1.5, 1.5, w - 3, 22, 8);
  ctx.clip();
  ctx.fillStyle = o.leaving === 'fail' ? COL.red : o.leaving === 'done' ? COL.green : col;
  ctx.fillRect(0, 0, w, 23);
  ctx.restore();
  text(ctx, o.recipe.name, w / 2, 12.5, 15, '#fff', 'center', COL.ink, 3);
  // icons
  const items = o.recipe.items;
  const sp = Math.min(26, 92 / items.length);
  const start = w / 2 - ((items.length - 1) * sp) / 2;
  for (let i = 0; i < items.length; i++) {
    drawItemIcon(ctx, items[i], start + i * sp, 44, items.length > 3 ? 10.5 : 13);
  }
  // patience bar
  ctx.fillStyle = 'rgba(16,19,43,.25)';
  rr(ctx, 8, 66, w - 16, 8, 4);
  ctx.fill();
  ctx.fillStyle = col;
  rr(ctx, 8, 66, Math.max(8, (w - 16) * frac), 8, 4);
  ctx.fill();
  if (o.leaving === 'done') text(ctx, '✓', w / 2, 46, 40, '#fff', 'center', COL.green, 6);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// banners + countdown
// ---------------------------------------------------------------------------
function drawBanners(g: Game, ctx: CanvasRenderingContext2D) {
  const cx = MAP_W / 2;
  const cy = HUD_H + MAP_H * 0.42;
  if (g.phase === 'countdown') {
    const step = 1.35 / 3;
    const n = Math.max(1, Math.ceil(g.cd / step));
    const frac = (g.cd % step) / step; // 1 → 0
    const sc = 0.8 + frac * 0.9;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, 0.3 + frac * 1.2);
    text(ctx, String(n), 0, 0, 150, COL.yellow, 'center', COL.ink, 12);
    ctx.restore();
    ctx.globalAlpha = 1;
    text(ctx, 'EN PLACE !', cx, cy - 110, 34, '#fff', 'center', COL.ink, 6);
  }
  for (const b of g.banners) {
    const p = b.t / b.dur;
    let sc = 1;
    if (p < 0.15) sc = easeOutBack(p / 0.15);
    else if (p > 0.78) sc = 1 - (p - 0.78) / 0.22;
    sc = Math.max(0, sc);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.05);
    ctx.scale(sc, sc);
    text(ctx, b.text, 0, 0, b.size, b.color, 'center', COL.ink, Math.max(6, b.size / 8));
    if (b.sub) text(ctx, b.sub, 0, b.size * 0.7, Math.max(20, b.size * 0.32), '#fff', 'center', COL.ink, 5);
    ctx.restore();
  }
}

/** Couleurs des joueurs J1…J4 (identiques aux autres jeux du site). */
export const SLOT_COLORS = ['#22e6ff', '#ff3e5e', '#38e08a', '#ffd23f'];

/** Entrées de tunnel sur les bords : portail tourbillonnant + flèche. */
function drawTunnels(g: Game, ctx: CanvasRenderingContext2D) {
  for (const r of g.tunnelRows) {
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : MAP_W - T;
      const y = r * T;
      ctx.save();
      ctx.fillStyle = '#2a2350';
      ctx.fillRect(x, y, T, T);
      const cx = x + (side === 0 ? 10 : T - 10);
      const cy = y + T / 2;
      for (let k = 0; k < 3; k++) {
        const ph = (g.t * 1.4 + k / 3) % 1;
        ctx.strokeStyle = '#a46bff';
        ctx.globalAlpha = 0.9 * (1 - ph);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 6 + ph * 10, 20 + ph * 8, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 4, 16, 0, 0, TAU);
      ctx.fill();
      // flèche vers l'extérieur
      const ax = x + T / 2 + (side === 0 ? -4 : 4);
      const d = side === 0 ? -1 : 1;
      ctx.fillStyle = '#ffd23f';
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(g.t * 3));
      ctx.beginPath();
      ctx.moveTo(ax + d * 10, cy);
      ctx.lineTo(ax - d * 2, cy - 9);
      ctx.lineTo(ax - d * 2, cy + 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
