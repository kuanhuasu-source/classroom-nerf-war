import { EMOTES } from './config.js';
import { $ } from './ui.js';

// Touch controls for phones and tablets. Left half of the screen: a floating stick for walking.
// Right half: drag to look, quick tap to fire once. Round sticker buttons: fire (hold), reload, crouch,
// pull up a partner (co-op), pause; a shout strip at the top in co-op.
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.on = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent));
    this.move = { x: 0, z: 0 }; this.crouch = false; this.stick = null; this.look = null; this.firing = false;
    if (!this.on) return;
    document.body.classList.add('touch');
    const layer = document.createElement('div'); layer.id = 'touch';
    layer.innerHTML = `
      <div id="tc-stick"><div class="knob"></div></div>
      <button class="tc-btn" id="tc-fire" type="button">射擊</button>
      <button class="tc-btn" id="tc-reload" type="button">重裝</button>
      <button class="tc-btn" id="tc-crouch" type="button">蹲</button>
      <button class="tc-btn" id="tc-revive" type="button">救！</button>
      <button class="tc-btn" id="tc-pause" type="button">Ⅱ</button>
      <div id="tc-emote">${[1, 2, 3, 4].map(i => `<button class="mini" type="button" data-n="${i}">${EMOTES[i].replace('！', '')}</button>`).join('')}</div>`;
    $('hud').appendChild(layer);
    this.layer = layer; this.stickEl = $('tc-stick'); this.knob = this.stickEl.firstElementChild;
    const g = game;
    const hold = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('active'); down(); }); const rel = e => { el.classList.remove('active'); if (up) up(); }; el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel); };
    hold('tc-fire', () => { this.firing = true; g.player.firing = true; g.player.tryFire(); }, () => { this.firing = false; g.player.firing = false; });
    hold('tc-reload', () => g.player.reload());
    hold('tc-crouch', () => { this.crouch = !this.crouch; $('tc-crouch').classList.toggle('held', this.crouch); });
    hold('tc-revive', () => g.tryRevive());
    hold('tc-pause', () => g.pause());
    $('tc-emote').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); e.stopPropagation(); g.emote(+b.dataset.n); } });
    // free areas: stick on the left, look on the right
    layer.addEventListener('pointerdown', e => {
      if (e.target !== layer && e.target !== this.stickEl && e.target !== this.knob) return;
      e.preventDefault();
      if (e.clientX < innerWidth * 0.45) { if (this.stick) return; this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.stickEl.style.display = 'block'; this.stickEl.style.left = e.clientX + 'px'; this.stickEl.style.top = e.clientY + 'px'; this.knob.style.transform = 'translate(-50%, -50%)'; }
      else { if (this.look) return; this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; }
    });
    layer.addEventListener('pointermove', e => {
      if (this.stick && e.pointerId === this.stick.id) {
        const R = 48; let dx = e.clientX - this.stick.x, dy = e.clientY - this.stick.y; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.move.x = dx / R; this.move.z = dy / R; // screen right = +x (strafe right), screen down = +z (backwards)
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (this.look && e.pointerId === this.look.id) {
        const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y; this.look.x = e.clientX; this.look.y = e.clientY; this.look.moved += Math.abs(dx) + Math.abs(dy);
        if (g.state === 'playing') g.player.look(dx * 2.4, dy * 2.4);
      }
    });
    const end = e => {
      if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.move.x = this.move.z = 0; this.stickEl.style.display = 'none'; }
      if (this.look && e.pointerId === this.look.id) { if (this.look.moved < 12 && performance.now() - this.look.t < 250 && g.state === 'playing') g.player.tryFire(); this.look = null; }
    };
    layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
    // keep the browser out of it: no pinch zoom, no double-tap zoom, no pull-to-refresh while playing
    const block = e => {
      if (e.touches && e.touches.length > 1) { e.preventDefault(); return; }
      const t = e.target; if (t === game.renderer.domElement || (t && t.closest && t.closest('#touch'))) e.preventDefault();
    };
    for (const n of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(n, block, { passive: false });
    for (const n of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(n, e => e.preventDefault(), { passive: false });
    document.addEventListener('dblclick', e => { if (e.target === game.renderer.domElement || (e.target.closest && e.target.closest('#touch'))) e.preventDefault(); });
    $('menu-note').textContent = '手機／平板：左半邊拖曳走路，右半邊拖曳轉視角、點一下射一發，右下的貼紙按鈕射擊、重裝、蹲。兩個人一起打：一個人開房間，另一個輸入房號。';
  }
  // called every frame: the revive button only when a partner needs it, the shout strip only in co-op
  update() {
    if (!this.on) return;
    const g = this.game, mate = g.isHost ? g.remote : g.hostFigure;
    $('tc-revive').style.display = g.coop && mate && mate.sitting && !g.player.sitting ? 'flex' : 'none';
    document.body.classList.toggle('coop', !!g.coop);
  }
  reset() { this.move.x = this.move.z = 0; this.stick = null; this.look = null; this.firing = false; if (this.on) this.stickEl.style.display = 'none'; }
}
