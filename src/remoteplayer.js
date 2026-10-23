import * as THREE from 'three';
import { COOP } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { freshUp } from './upgrades.js';
import { PaperFigure } from './paperfigure.js';

// The other player as seen from here: a paper kid with a name tag, driven by network state.
export class RemotePlayer extends PaperFigure {
  constructor(game, skin) {
    super(game.scene, () => Draw.kid(skin.v, 'normal'), 0.9, 1.35);
    this.game = game; this.skin = skin; this.hp = 5; this.eye = 1.25; this.yaw = 0; this.crouch = false; this.targetSy = 1;
    this.pos = this.group.position; this.ammo = 0; this.reserve = 0; this.up = freshUp(); this.maxHp = 5;
    this.sitting = false; this.sitT = 0; this.invuln = 0; this.hurtCd = 0; this.seat = null; this.texState = 'normal'; this.sayT = 0; this.bubble = null; this.offline = false; this.shots = 0; this.hits = 0;
    const c = Draw.canvas(256, 80), ctx = c.getContext('2d');
    ctx.fillStyle = '#fbf6e6'; ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 6; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(8, 8, 240, 64, 14); else ctx.rect(8, 8, 240, 64);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2622'; ctx.font = 'bold 40px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(skin.name, 128, 42);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: Draw.tex(c), transparent: true, depthTest: false }));
    this.tag.scale.set(0.64, 0.2, 1); this.tag.position.set(0, 1.6, 0); this.group.add(this.tag);
    this.group.visible = false;
  }
  setTex(st) { if (this.texState === st) return; this.texState = st; this.setTexture(Draw.kid(this.skin.v, st)); }
  applyInput(s) {
    this.group.visible = true; this.offline = false;
    if (s.sh !== undefined) this.shots = s.sh;
    if (s.sit !== undefined) { if (s.sit && !this.sitting) { this.sitting = true; this.setTex('out'); } else if (!s.sit && this.sitting) { this.sitting = false; this.setTex('normal'); } }
    const W = this.game.world;
    if (this.sitting) { if (s.sx !== undefined) this.setTarget(s.sx, W.heightAt(s.sx, s.sz), s.sz); return; }
    this.setTarget(s.x, W.heightAt(s.x, s.z), s.z); this.yaw = s.yaw; this.eye = s.eye; this.crouch = !!s.c; this.targetSy = this.crouch ? 0.5 : 1;
    if (s.hp !== undefined) this.hp = s.hp; if (s.ammo !== undefined) this.ammo = s.ammo; if (s.res !== undefined) this.reserve = s.res;
  }
  eyePos() { return new THREE.Vector3(this.group.position.x, this.group.position.y + (this.sitting ? 0.8 : this.eye), this.group.position.z); }
  // host side: damage and penalty sitting for the guest
  hurt() {
    if (this.hurtCd > 0 || this.sitting || this.invuln > 0 || this.offline) return;
    this.hurtCd = 0.7; this.hp--; this.flash = 0.15;
    if (this.hp <= 0) this.game.onPlayerDown(this);
  }
  sitDown(seat, secs = COOP.sitSeconds) { const sy = this.game.world.heightAt(seat.x, seat.z); this.sitting = true; this.sitT = secs; this.seat = seat; this.setTarget(seat.x, sy, seat.z); this.group.position.set(seat.x, sy, seat.z); this.setTex('out'); this.targetSy = 0.72; }
  standUp(hp) { this.sitting = false; this.hp = hp; this.invuln = COOP.invuln; this.setTex('normal'); this.targetSy = this.crouch ? 0.5 : 1; }
  say(text) {
    if (this.bubble) { this.group.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    const c = Draw.canvas(320, 120), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 6; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(10, 10, 300, 80, 22); else ctx.rect(10, 10, 300, 80);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(140, 88); ctx.lineTo(160, 116); ctx.lineTo(180, 88); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2622'; ctx.font = 'bold 40px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 160, 52);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: Draw.tex(c), transparent: true, depthTest: false }));
    this.bubble.scale.set(1.0, 0.375, 1); this.bubble.position.set(0.1, 2.05, 0); this.group.add(this.bubble); this.sayT = 2.2;
  }
  update(dt) {
    if (!this.group.visible) return;
    this.hurtCd -= dt; this.invuln = Math.max(0, this.invuln - dt);
    if (this.sitting && this.game.isHost) { this.sitT -= dt; if (this.sitT <= 0) { this.standUp(1); this.game.message((this.skin.name) + '自己站起來了', '只剩 1 顆心', 1.5); } }
    if (this.bubble) { this.sayT -= dt; if (this.sayT <= 0) { this.group.remove(this.bubble); this.bubble = null; } }
    this.remoteUpdate(dt, this.game.camera.position, !this.sitting);
    this.group.scale.y += (this.targetSy - this.group.scale.y) * Math.min(1, dt * 10);
    this.tag.position.y = 1.45 * this.group.scale.y + 0.2;
  }
}
