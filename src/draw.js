import * as THREE from 'three';
import { pick } from './config.js';

// ============================================================
//  Hand-drawn canvas textures
// ============================================================
export const Draw = (() => {
  const jit = (a) => (Math.random() * 2 - 1) * a;
  function wobblyPath(ctx, pts, close, j = 2) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] + jit(j), y = p[1] + jit(j);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (close) ctx.closePath();
  }
  function ellipsePts(cx, cy, rx, ry, n = 28) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  }
  function shape(ctx, pts, fill, stroke = '#2b2622', lw = 4, j = 2) {
    // crayon-ish fill: two slightly offset translucent layers, then pencil outline
    if (fill) {
      ctx.fillStyle = fill; ctx.globalAlpha = 0.85;
      wobblyPath(ctx, pts, true, j); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.save(); ctx.translate(jit(3), jit(3)); wobblyPath(ctx, pts, true, j); ctx.fill(); ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; wobblyPath(ctx, pts, true, j); ctx.stroke(); }
  }
  function line(ctx, pts, stroke = '#2b2622', lw = 4, j = 2) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    wobblyPath(ctx, pts, false, j); ctx.stroke();
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }

  const SKINS = ['#f6d6b8', '#e9b98f', '#d9a070', '#f3c9ad'];
  const SHIRTS = ['#ffffff', '#f4e27a', '#9fd3f2', '#f7a8c4', '#b7e3a1', '#f5f5f5'];
  const HAIRS = ['#2b2622', '#4a2f1d', '#1d1f3a', '#6b3a1e'];

  // state: 'normal' | 'hurt' | 'out'
  function kid(v, state) {
    const c = canvas(256, 512), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 512);
    const cx = 128, headY = 130, headR = 62;
    // legs
    shape(ctx, [[96, 330], [122, 330], [118, 470], [92, 470]], '#3b4a8a');
    shape(ctx, [[134, 330], [160, 330], [164, 470], [138, 470]], '#3b4a8a');
    shape(ctx, [[86, 466], [124, 466], [128, 490], [82, 490]], '#2b2622');
    shape(ctx, [[132, 466], [170, 466], [174, 490], [128, 490]], '#2b2622');
    // body
    shape(ctx, [[82, 200], [174, 200], [184, 340], [72, 340]], v.shirt);
    // collar
    line(ctx, [[112, 200], [128, 224], [144, 200]], '#2b2622', 3);
    // left arm (viewer's left) hanging
    shape(ctx, [[82, 205], [60, 300], [78, 306], [96, 220]], v.shirt);
    shape(ctx, ellipsePts(68, 310, 13, 13, 14), v.skin);
    if (state !== 'out') {
      // right arm holds a Nerf blaster forward
      shape(ctx, [[160, 205], [224, 262], [214, 280], [152, 232]], v.shirt);
      shape(ctx, ellipsePts(222, 272, 14, 14, 14), v.skin);
      // blaster
      shape(ctx, [[184, 236], [250, 236], [250, 262], [184, 262]], '#f28a1a');
      shape(ctx, [[200, 262], [218, 262], [222, 292], [204, 292]], '#2f6fd1');
      shape(ctx, [[250, 242], [256, 242], [256, 256], [250, 256]], '#2f6fd1', '#2b2622', 3);
    } else {
      // right arm raised with a white flag
      shape(ctx, [[160, 205], [196, 110], [214, 116], [178, 220]], v.shirt);
      shape(ctx, ellipsePts(206, 108, 14, 14, 14), v.skin);
      line(ctx, [[206, 108], [206, 10]], '#6b3a1e', 5);
      shape(ctx, [[208, 12], [252, 30], [208, 58]], '#ffffff');
    }
    if (v.leader) { // the wave leader's armband and ribbon
      shape(ctx, [[70, 236], [96, 228], [100, 252], [74, 262]], '#d8432b', '#2b2622', 2);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.translate(85, 250); ctx.rotate(-0.25); ctx.fillText(v.bully ? '老大' : '班長', 0, 0); ctx.restore();
      shape(ctx, [[cx - 8, 224], [cx + 8, 224], [cx, 250]], '#f4e27a', '#2b2622', 2);
    }
    // head
    shape(ctx, ellipsePts(cx, headY, headR, headR + 4), v.skin);
    // hair
    if (v.hair === 0) { // bowl cut
      shape(ctx, [[cx - 66, headY - 8], [cx - 60, headY - 48], [cx - 20, headY - 70], [cx + 24, headY - 70], [cx + 62, headY - 46], [cx + 66, headY - 8], [cx + 40, headY - 32], [cx, headY - 40], [cx - 40, headY - 30]], v.hairColor);
    } else if (v.hair === 1) { // pigtails
      shape(ctx, [[cx - 64, headY - 10], [cx - 56, headY - 52], [cx, headY - 72], [cx + 56, headY - 52], [cx + 64, headY - 10], [cx + 20, headY - 40], [cx - 20, headY - 40]], v.hairColor);
      shape(ctx, ellipsePts(cx - 78, headY + 10, 18, 30, 16), v.hairColor);
      shape(ctx, ellipsePts(cx + 78, headY + 10, 18, 30, 16), v.hairColor);
      shape(ctx, ellipsePts(cx - 72, headY - 18, 9, 9, 10), '#d8432b');
      shape(ctx, ellipsePts(cx + 72, headY - 18, 9, 9, 10), '#d8432b');
    } else { // spiky
      shape(ctx, [[cx - 64, headY - 12], [cx - 70, headY - 60], [cx - 36, headY - 42], [cx - 24, headY - 92], [cx, headY - 50], [cx + 20, headY - 96], [cx + 34, headY - 44], [cx + 72, headY - 64], [cx + 64, headY - 12], [cx, headY - 34]], v.hairColor);
    }
    if (v.cleaner) { // the cleaning crew: a white apron over the shirt and a blue cap
      shape(ctx, [[96, 206], [160, 206], [172, 336], [84, 336]], '#ffffff', '#2b2622', 3);
      line(ctx, [[104, 206], [96, 190], [160, 190], [152, 206]], '#2b2622', 3);
      shape(ctx, [[cx - 62, headY - 30], [cx - 50, headY - 74], [cx, headY - 86], [cx + 50, headY - 74], [cx + 62, headY - 30], [cx + 88, headY - 24], [cx + 86, headY - 10], [cx - 64, headY - 14]], '#2f6fd1', '#2b2622', 3);
    }
    if (v.bully) { // the gang's red bandana, knotted at the side
      shape(ctx, [[cx - 66, headY - 16], [cx + 66, headY - 16], [cx + 64, headY + 2], [cx - 64, headY + 2]], '#d8432b', '#2b2622', 2);
      shape(ctx, [[cx + 60, headY - 10], [cx + 92, headY - 22], [cx + 88, headY + 4], [cx + 62, headY + 2]], '#d8432b', '#2b2622', 2);
    }
    // face
    const ey = headY + 6;
    if (state === 'normal') {
      shape(ctx, ellipsePts(cx - 24, ey, 7, 9, 10), '#2b2622', null);
      shape(ctx, ellipsePts(cx + 24, ey, 7, 9, 10), '#2b2622', null);
      line(ctx, [[cx - 36, ey - 22], [cx - 12, ey - 26]], '#2b2622', 4); // determined brows
      line(ctx, [[cx + 12, ey - 26], [cx + 36, ey - 22]], '#2b2622', 4);
      line(ctx, [[cx - 18, ey + 32], [cx, ey + 40], [cx + 18, ey + 30]], '#2b2622', 4);
    } else if (state === 'hurt') {
      line(ctx, [[cx - 32, ey - 8], [cx - 16, ey + 6]], '#2b2622', 4); line(ctx, [[cx - 32, ey + 6], [cx - 16, ey - 8]], '#2b2622', 4);
      line(ctx, [[cx + 16, ey - 8], [cx + 32, ey + 6]], '#2b2622', 4); line(ctx, [[cx + 16, ey + 6], [cx + 32, ey - 8]], '#2b2622', 4);
      shape(ctx, ellipsePts(cx, ey + 36, 14, 18, 12), '#8a2a2a');
    } else {
      shape(ctx, ellipsePts(cx - 24, ey, 8, 8, 10), '#2b2622', null);
      shape(ctx, ellipsePts(cx + 24, ey, 8, 8, 10), '#2b2622', null);
      // tears
      shape(ctx, [[cx - 30, ey + 10], [cx - 20, ey + 10], [cx - 25, ey + 36]], '#6fb7ef', '#2b2622', 2);
      shape(ctx, [[cx + 20, ey + 10], [cx + 30, ey + 10], [cx + 25, ey + 36]], '#6fb7ef', '#2b2622', 2);
      line(ctx, [[cx - 16, ey + 40], [cx, ey + 30], [cx + 16, ey + 40]], '#2b2622', 4);
    }
    // cheeks
    ctx.globalAlpha = 0.5; shape(ctx, ellipsePts(cx - 40, ey + 20, 10, 6, 10), '#f28a8a', null); shape(ctx, ellipsePts(cx + 40, ey + 20, 10, 6, 10), '#f28a8a', null); ctx.globalAlpha = 1;
    return c;
  }
  function kidVariant() {
    return { skin: pick(SKINS), shirt: pick(SHIRTS), hair: Math.floor(Math.random() * 3), hairColor: pick(HAIRS) };
  }

  // def: a TEACHERS entry (style + weak-point keys); flags: { [key]: still there?, mood: 'angry'|'cry' }
  function teacher(def, flags) {
    const c = canvas(256, 640), ctx = c.getContext('2d');
    const cx = 128, headY = 120, headR = 58, st = def.style, skin = '#f0cfae';
    // legs: skirt or pants
    if (st.pants) {
      shape(ctx, [[84, 330], [126, 330], [122, 590], [86, 590]], st.bottom);
      shape(ctx, [[130, 330], [172, 330], [170, 590], [134, 590]], st.bottom);
    } else {
      const hem = st.dress ? 540 : 470;
      shape(ctx, [[70, 330], [186, 330], [204 + (st.dress ? 16 : 0), hem], [52 - (st.dress ? 16 : 0), hem]], st.bottom);
      shape(ctx, [[96, hem - 2], [120, hem - 2], [120, 590], [96, 590]], skin);
      shape(ctx, [[136, hem - 2], [160, hem - 2], [160, 590], [136, 590]], skin);
    }
    shape(ctx, [[84, 586], [124, 586], [128, 612], [80, 612]], '#2b2622');
    shape(ctx, [[132, 586], [172, 586], [176, 612], [128, 612]], '#2b2622');
    // body
    shape(ctx, [[78, 196], [178, 196], [190, 340], [66, 340]], st.top);
    if (st.coat) { shape(ctx, [[70, 196], [186, 196], [198, 420], [58, 420]], '#ffffff'); line(ctx, [[128, 200], [128, 410]], '#2b2622', 2); shape(ctx, [[104, 196], [152, 196], [140, 236], [116, 236]], st.bottom, '#2b2622', 2); }
    else if (st.dress) { line(ctx, [[100, 200], [128, 240], [156, 200]], '#2b2622', 3); }
    else { line(ctx, [[128, 210], [128, 330]], '#2b2622', 2); [[128, 240], [128, 270], [128, 300]].forEach(p => shape(ctx, ellipsePts(p[0], p[1], 5, 5, 8), '#f4e27a', '#2b2622', 2)); }
    if (def.id === 'pe') { line(ctx, [[84, 206], [96, 330]], '#ffffff', 6, 1); line(ctx, [[172, 206], [160, 330]], '#ffffff', 6, 1); }
    if (st.suit) { shape(ctx, [[100, 196], [156, 196], [128, 262]], '#ffffff', '#2b2622', 2); line(ctx, [[78, 200], [112, 236], [128, 340]], '#2b2622', 2); line(ctx, [[178, 200], [144, 236], [128, 340]], '#2b2622', 2); }
    if (flags.tie) shape(ctx, [[120, 206], [136, 206], [142, 300], [128, 318], [114, 300]], st.tie || '#d8432b', '#2b2622', 3);
    if (flags.clipboard) { shape(ctx, [[96, 236], [160, 236], [160, 318], [96, 318]], '#b98556'); shape(ctx, [[104, 246], [152, 246], [152, 310], [104, 310]], '#ffffff', '#2b2622', 2); [262, 278, 294].forEach(y => line(ctx, [[112, y], [144, y]], '#2b2622', 2, 1)); }
    // left arm (canvas left) holds the under-arm item
    shape(ctx, [[78, 202], [40, 300], [60, 310], [96, 220]], st.coat ? '#ffffff' : st.top);
    shape(ctx, ellipsePts(48, 316, 14, 14, 14), skin);
    if (flags.book) { shape(ctx, [[18, 236], [78, 236], [84, 316], [24, 316]], '#2f7d4f'); ctx.fillStyle = '#fbf6e6'; ctx.font = '26px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('教', 50, 270); ctx.fillText('案', 50, 300); }
    if (flags.ball) { shape(ctx, ellipsePts(44, 290, 40, 40, 20), '#d8432b'); shape(ctx, [[6, 282], [82, 282], [82, 298], [6, 298]], '#fbf6e6', null); line(ctx, [[6, 282], [82, 282]], '#2b2622', 3, 1); line(ctx, [[6, 298], [82, 298]], '#2b2622', 3, 1); }
    if (flags.sheet) { shape(ctx, [[14, 240], [80, 236], [86, 318], [20, 322]], '#ffffff'); [256, 272, 288, 304].forEach(y => line(ctx, [[24, y], [76, y]], '#2b2622', 2, 1)); ctx.fillStyle = '#2b2622'; ctx.font = 'bold 30px "Patrick Hand", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', 50, 300); }
    if (flags.reports) { shape(ctx, [[14, 236], [82, 232], [88, 318], [20, 322]], '#ffffff'); [252, 268, 284, 300].forEach(y => line(ctx, [[26, y], [76, y]], '#2b2622', 2, 1)); ctx.fillStyle = '#d8432b'; ctx.font = 'bold 34px "Patrick Hand", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('59', 50, 296); }
    if (flags.papers) { shape(ctx, [[12, 240], [80, 232], [88, 318], [20, 326]], '#ffffff'); shape(ctx, [[18, 234], [84, 228], [90, 310], [24, 318]], '#fbf6e6', '#2b2622', 3); [254, 270, 286, 302].forEach(y => line(ctx, [[30, y], [78, y]], '#2b2622', 2, 1)); ctx.fillStyle = '#d8432b'; ctx.font = 'bold 30px "Patrick Hand", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('100', 54, 262); }
    if (flags.badge) { shape(ctx, [[86, 258], [128, 258], [128, 282], [86, 282]], '#ffffff', '#2b2622', 3); ctx.fillStyle = '#2b2622'; ctx.font = 'bold 16px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('監考', 107, 276); }
    if (flags.trophy) { shape(ctx, [[18, 250], [82, 250], [70, 300], [30, 300]], '#f4e27a'); shape(ctx, [[42, 300], [58, 300], [62, 320], [38, 320]], '#f4e27a'); shape(ctx, [[26, 318], [74, 318], [74, 328], [26, 328]], '#b98556'); line(ctx, ellipsePts(16, 266, 10, 12, 10).concat([ellipsePts(16, 266, 10, 12, 10)[0]]), '#2b2622', 3, 1); line(ctx, ellipsePts(84, 266, 10, 12, 10).concat([ellipsePts(84, 266, 10, 12, 10)[0]]), '#2b2622', 3, 1); }
    if (flags.rack) { shape(ctx, [[10, 250], [86, 250], [86, 316], [10, 316]], '#b7e3a1'); [24, 48, 72].forEach(x => { shape(ctx, [[x - 6, 236], [x + 6, 236], [x + 6, 300], [x - 6, 300]], 'rgba(160,210,255,0.6)', '#2b2622', 2); shape(ctx, [[x - 6, 280], [x + 6, 280], [x + 6, 300], [x - 6, 300]], pick(['#2f7d4f', '#d8432b', '#f28a1a']), null); }); }
    // right arm (canvas right) raised, holding the hand item
    shape(ctx, [[178, 202], [226, 150], [242, 164], [192, 226]], st.coat ? '#ffffff' : st.top);
    shape(ctx, ellipsePts(236, 150, 15, 15, 14), skin);
    if (flags.chalk) shape(ctx, [[232, 138], [240, 138], [244, 100], [236, 100]], '#ffffff', '#2b2622', 3);
    if (flags.baton) { line(ctx, [[236, 150], [250, 70]], '#ffffff', 6, 1); line(ctx, [[236, 150], [250, 70]], '#2b2622', 2, 1); shape(ctx, ellipsePts(250, 68, 5, 5, 8), '#2b2622', null); }
    if (flags.megaphone) { shape(ctx, [[226, 140], [250, 90], [256, 96], [256, 160], [240, 156]], '#d8432b', '#2b2622', 3); shape(ctx, [[224, 142], [240, 142], [240, 160], [224, 160]], '#2b2622', null); }
    if (flags.mic) { line(ctx, [[236, 150], [236, 110]], '#2b2622', 6, 1); shape(ctx, ellipsePts(236, 96, 16, 18, 12), '#5a4e47', '#2b2622', 3); [[-8], [0], [8]].forEach(([dx]) => line(ctx, [[236 + dx, 84], [236 + dx, 108]], 'rgba(255,255,255,0.5)', 2, 1)); }
    if (flags.stamp) { shape(ctx, [[226, 146], [246, 146], [246, 100], [226, 100]], '#b98556', '#2b2622', 3); shape(ctx, [[216, 100], [256, 100], [256, 84], [216, 84]], '#d8432b', '#2b2622', 3); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('不及格', 236, 97); }
    if (flags.manual) { shape(ctx, [[214, 96], [254, 92], [256, 150], [218, 154]], '#f4e27a'); ctx.fillStyle = '#2b2622'; ctx.font = '18px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('實', 236, 116); ctx.fillText('驗', 236, 138); }
    // a stopwatch on a cord at the chest
    if (flags.stopwatch) { line(ctx, [[100, 200], [128, 262], [156, 200]], '#2b2622', 3, 1); shape(ctx, ellipsePts(128, 282, 22, 22, 18), '#e4e8ec', '#2b2622', 4); shape(ctx, [[122, 254], [134, 254], [134, 262], [122, 262]], '#2b2622', null); line(ctx, [[128, 282], [128, 268]], '#d8432b', 3); line(ctx, [[128, 282], [140, 286]], '#2b2622', 3); }
    // whistle on a cord at the chest
    if (flags.whistle) { line(ctx, [[100, 200], [128, 268], [156, 200]], '#d8432b', 3, 1); shape(ctx, [[112, 262], [146, 262], [150, 282], [120, 290], [108, 278]], '#f4e27a', '#2b2622', 3); }
    // head, hair
    shape(ctx, ellipsePts(cx, headY, headR, headR + 6), skin);
    const hc = st.hairColor;
    if (st.hair === 'bun') { shape(ctx, [[cx - 62, headY - 6], [cx - 56, headY - 50], [cx, headY - 72], [cx + 56, headY - 50], [cx + 62, headY - 6], [cx + 30, headY - 36], [cx - 30, headY - 36]], hc); shape(ctx, ellipsePts(cx, headY - 78, 26, 20, 16), hc); }
    else if (st.hair === 'short') { shape(ctx, [[cx - 64, headY - 10], [cx - 60, headY - 52], [cx - 20, headY - 74], [cx + 24, headY - 74], [cx + 62, headY - 48], [cx + 66, headY - 10], [cx + 42, headY - 30], [cx, headY - 40], [cx - 42, headY - 28]], hc); }
    else if (st.hair === 'long') { shape(ctx, [[cx - 66, headY + 90], [cx - 64, headY - 30], [cx - 40, headY - 70], [cx + 40, headY - 70], [cx + 64, headY - 30], [cx + 66, headY + 90], [cx + 44, headY + 80], [cx + 50, headY - 10], [cx + 20, headY - 40], [cx - 20, headY - 40], [cx - 50, headY - 10], [cx - 44, headY + 80]], hc); }
    else if (st.hair === 'bald') { shape(ctx, [[cx - 62, headY + 10], [cx - 60, headY - 20], [cx - 48, headY - 10], [cx - 46, headY + 20]], hc); shape(ctx, [[cx + 62, headY + 10], [cx + 60, headY - 20], [cx + 48, headY - 10], [cx + 46, headY + 20]], hc); ctx.globalAlpha = 0.5; shape(ctx, ellipsePts(cx - 18, headY - 40, 14, 8, 10), '#ffffff', null); ctx.globalAlpha = 1; }
    else { shape(ctx, [[cx - 62, headY - 6], [cx - 56, headY - 50], [cx, headY - 72], [cx + 56, headY - 50], [cx + 62, headY - 6], [cx + 30, headY - 36], [cx - 30, headY - 36]], hc); shape(ctx, [[cx + 40, headY - 40], [cx + 70, headY - 30], [cx + 86, headY + 60], [cx + 60, headY + 70]], hc); shape(ctx, ellipsePts(cx + 52, headY - 34, 9, 9, 10), '#d8432b', '#2b2622', 2); }
    if (flags.cap) { shape(ctx, [[cx - 66, headY - 46], [cx - 56, headY - 92], [cx + 56, headY - 92], [cx + 66, headY - 46]], st.top); shape(ctx, [[cx - 70, headY - 46], [cx + 90, headY - 50], [cx + 92, headY - 36], [cx - 70, headY - 32]], st.top); line(ctx, [[cx, headY - 92], [cx, headY - 46]], '#2b2622', 3, 1); }
    if (flags.clip) { shape(ctx, [[cx + 22, headY - 70], [cx + 54, headY - 60], [cx + 50, headY - 46], [cx + 18, headY - 56]], '#f4e27a', '#2b2622', 3); shape(ctx, ellipsePts(cx + 36, headY - 58, 6, 6, 8), '#d8432b', null); }
    // face
    const ey = headY + 4;
    if (flags.mood === 'cry') {
      line(ctx, [[cx - 34, ey - 6], [cx - 14, ey + 2]], '#2b2622', 4); line(ctx, [[cx + 14, ey + 2], [cx + 34, ey - 6]], '#2b2622', 4);
      shape(ctx, [[cx - 30, ey + 8], [cx - 18, ey + 8], [cx - 24, ey + 48]], '#6fb7ef', '#2b2622', 2);
      shape(ctx, [[cx + 18, ey + 8], [cx + 30, ey + 8], [cx + 24, ey + 48]], '#6fb7ef', '#2b2622', 2);
      shape(ctx, ellipsePts(cx, ey + 38, 18, 14, 12), '#8a2a2a');
    } else {
      shape(ctx, ellipsePts(cx - 24, ey, 7, 8, 10), '#2b2622', null);
      shape(ctx, ellipsePts(cx + 24, ey, 7, 8, 10), '#2b2622', null);
      line(ctx, [[cx - 40, ey - 30], [cx - 10, ey - 18]], '#2b2622', 5);
      line(ctx, [[cx + 10, ey - 18], [cx + 40, ey - 30]], '#2b2622', 5);
      if (def.id === 'music') shape(ctx, ellipsePts(cx, ey + 36, 10, 14, 10), '#8a2a2a'); // singing
      else line(ctx, [[cx - 20, ey + 36], [cx, ey + 28], [cx + 20, ey + 36]], '#2b2622', 4);
      if ((def.id === 'math' && !flags.glasses) || (def.id === 'chief' && !flags.glasses) || (def.id === 'science' && !flags.goggles)) { line(ctx, [[cx - 34, ey - 2], [cx - 14, ey - 2]], '#2b2622', 5); line(ctx, [[cx + 14, ey - 2], [cx + 34, ey - 2]], '#2b2622', 5); }
    }
    if (flags.glasses) { shape(ctx, ellipsePts(cx - 24, ey, 20, 17, 16), 'rgba(160,210,255,0.35)', '#2b2622', 4); shape(ctx, ellipsePts(cx + 24, ey, 20, 17, 16), 'rgba(160,210,255,0.35)', '#2b2622', 4); line(ctx, [[cx - 4, ey], [cx + 4, ey]], '#2b2622', 4); }
    if (flags.goggles) { shape(ctx, [[cx - 50, ey - 18], [cx + 50, ey - 18], [cx + 50, ey + 14], [cx - 50, ey + 14]], 'rgba(160,210,255,0.45)', '#2b2622', 5); line(ctx, [[cx - 50, ey - 4], [cx - 62, ey - 8]], '#2b2622', 5); line(ctx, [[cx + 50, ey - 4], [cx + 62, ey - 8]], '#2b2622', 5); }
    return c;
  }
  function alertIcon() {
    const c = canvas(64, 96), ctx = c.getContext('2d');
    ctx.font = 'bold 84px "Patrick Hand", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#fbf6e6'; ctx.strokeText('!', 32, 50); ctx.fillStyle = '#d8432b'; ctx.fillText('!', 32, 50);
    return c;
  }
  // the bullseye inside the urinal: red centre, white and red rings
  function bullseye() {
    const c = canvas(256, 256), ctx = c.getContext('2d'), cx = 128;
    [[124, '#2b2622'], [116, '#ffffff'], [92, '#d8432b'], [68, '#ffffff'], [44, '#d8432b'], [22, '#2b2622']].forEach(([r, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cx, r, 0, 6.283); ctx.fill(); });
    ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 3; [116, 92, 68, 44].forEach(r => { ctx.beginPath(); ctx.arc(cx, cx, r, 0, 6.283); ctx.stroke(); });
    return c;
  }
  function nameTag(text, bg = '#fbf6e6', fg = '#2b2622') {
    const c = canvas(256, 80), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 6; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(8, 8, 240, 64, 14); else ctx.rect(8, 8, 240, 64);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg; ctx.font = 'bold 40px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 42);
    return c;
  }
  function noteIcon() {
    const c = canvas(96, 96), ctx = c.getContext('2d');
    ctx.font = 'bold 76px "Patrick Hand", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#fbf6e6'; ctx.strokeText('♪', 48, 52); ctx.fillStyle = '#2b2622'; ctx.fillText('♪', 48, 52);
    return c;
  }

  // the sleeping bully: a big kid in a striped tank top
  function bully(state) {
    const c = canvas(256, 512), ctx = c.getContext('2d');
    const cx = 128, headY = 120, headR = 68, skin = '#eac19a';
    shape(ctx, [[86, 330], [124, 330], [120, 470], [80, 470]], '#4a4a4a');
    shape(ctx, [[132, 330], [170, 330], [176, 470], [136, 470]], '#4a4a4a');
    shape(ctx, [[72, 466], [126, 466], [130, 492], [68, 492]], '#2b2622');
    shape(ctx, [[130, 466], [184, 466], [188, 492], [126, 492]], '#2b2622');
    shape(ctx, [[64, 196], [192, 196], [206, 340], [50, 340]], '#ffffff');
    [[228], [262], [296]].forEach(([y]) => line(ctx, [[58, y], [198, y + 4]], '#2f6fd1', 9, 2));
    line(ctx, [[84, 200], [96, 330]], '#d8432b', 7, 2); line(ctx, [[172, 200], [160, 330]], '#d8432b', 7, 2);
    shape(ctx, [[64, 200], [30, 300], [54, 312], [86, 220]], skin);
    shape(ctx, [[192, 200], [226, 300], [202, 312], [170, 220]], skin);
    shape(ctx, ellipsePts(40, 318, 16, 16, 14), skin); shape(ctx, ellipsePts(216, 318, 16, 16, 14), skin);
    shape(ctx, ellipsePts(cx, headY, headR, headR + 2), skin);
    shape(ctx, [[cx - 70, headY - 20], [cx - 60, headY - 60], [cx, headY - 74], [cx + 60, headY - 60], [cx + 70, headY - 20], [cx, headY - 44]], '#2b2622');
    shape(ctx, [[cx + 22, headY + 28], [cx + 54, headY + 20], [cx + 56, headY + 32], [cx + 24, headY + 40]], '#f4d9b0', '#2b2622', 2);
    const ey = headY + 4;
    if (state === 'sleep') {
      line(ctx, [[cx - 38, ey], [cx - 24, ey + 6], [cx - 10, ey]], '#2b2622', 4);
      line(ctx, [[cx + 10, ey], [cx + 24, ey + 6], [cx + 38, ey]], '#2b2622', 4);
      shape(ctx, ellipsePts(cx, ey + 36, 10, 12, 10), '#8a2a2a');
      shape(ctx, ellipsePts(cx + 30, ey + 46, 9, 12, 10), 'rgba(160,210,255,0.8)', '#2b2622', 2);
    } else {
      shape(ctx, ellipsePts(cx - 24, ey, 9, 9, 10), '#2b2622', null);
      shape(ctx, ellipsePts(cx + 24, ey, 9, 9, 10), '#2b2622', null);
      line(ctx, [[cx - 44, ey - 34], [cx - 8, ey - 16]], '#2b2622', 6); line(ctx, [[cx + 8, ey - 16], [cx + 44, ey - 34]], '#2b2622', 6);
      shape(ctx, [[cx - 26, ey + 28], [cx + 26, ey + 28], [cx + 22, ey + 46], [cx - 22, ey + 46]], '#ffffff', '#2b2622', 3);
      [[-14], [0], [14]].forEach(([dx]) => line(ctx, [[cx + dx, ey + 28], [cx + dx, ey + 46]], '#2b2622', 2));
      ctx.globalAlpha = 0.45; shape(ctx, ellipsePts(cx, headY + 10, 60, 50, 16), '#f06060', null); ctx.globalAlpha = 1;
    }
    return c;
  }
  // the class monitor: pigtails, armband, notebook
  function monitor(state) {
    const c = canvas(256, 512), ctx = c.getContext('2d');
    const cx = 128, headY = 130, headR = 60, skin = '#f6d6b8', hairColor = '#2b2622';
    shape(ctx, [[82, 330], [174, 330], [182, 400], [74, 400]], '#3b4a8a');
    shape(ctx, [[98, 398], [120, 398], [118, 470], [94, 470]], skin); shape(ctx, [[136, 398], [158, 398], [162, 470], [138, 470]], skin);
    shape(ctx, [[86, 466], [124, 466], [128, 490], [82, 490]], '#2b2622'); shape(ctx, [[132, 466], [170, 466], [174, 490], [128, 490]], '#2b2622');
    shape(ctx, [[82, 200], [174, 200], [180, 336], [76, 336]], '#ffffff');
    line(ctx, [[112, 200], [128, 224], [144, 200]], '#2b2622', 3);
    shape(ctx, [[cx - 8, 224], [cx + 8, 224], [cx, 250]], '#d8432b', '#2b2622', 2);
    shape(ctx, [[82, 205], [58, 300], [78, 306], [98, 220]], '#ffffff');
    shape(ctx, [[72, 232], [98, 224], [102, 248], [76, 258]], '#d8432b', '#2b2622', 2);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.translate(87, 246); ctx.rotate(-0.25); ctx.fillText('班長', 0, 0); ctx.restore();
    shape(ctx, ellipsePts(68, 312, 13, 13, 14), skin);
    shape(ctx, [[174, 205], [214, 262], [200, 278], [160, 232]], '#ffffff');
    shape(ctx, ellipsePts(210, 272, 13, 13, 14), skin);
    shape(ctx, [[180, 236], [236, 226], [242, 290], [186, 300]], '#f4e27a');
    line(ctx, [[190, 250], [228, 244]], '#2b2622', 2); line(ctx, [[192, 264], [230, 258]], '#2b2622', 2); line(ctx, [[194, 278], [226, 272]], '#2b2622', 2);
    line(ctx, [[232, 236], [250, 206]], '#d8432b', 5, 1);
    shape(ctx, ellipsePts(cx, headY, headR, headR + 4), skin);
    shape(ctx, [[cx - 62, headY - 10], [cx - 54, headY - 52], [cx, headY - 72], [cx + 54, headY - 52], [cx + 62, headY - 10], [cx + 20, headY - 40], [cx - 20, headY - 40]], hairColor);
    shape(ctx, ellipsePts(cx - 76, headY + 14, 17, 30, 16), hairColor); shape(ctx, ellipsePts(cx + 76, headY + 14, 17, 30, 16), hairColor);
    shape(ctx, ellipsePts(cx - 70, headY - 14, 9, 9, 10), '#f4e27a'); shape(ctx, ellipsePts(cx + 70, headY - 14, 9, 9, 10), '#f4e27a');
    const ey = headY + 6;
    if (state === 'cry') {
      line(ctx, [[cx - 32, ey - 4], [cx - 14, ey + 4]], '#2b2622', 4); line(ctx, [[cx + 14, ey + 4], [cx + 32, ey - 4]], '#2b2622', 4);
      shape(ctx, [[cx - 30, ey + 10], [cx - 18, ey + 10], [cx - 24, ey + 44]], '#6fb7ef', '#2b2622', 2); shape(ctx, [[cx + 18, ey + 10], [cx + 30, ey + 10], [cx + 24, ey + 44]], '#6fb7ef', '#2b2622', 2);
      shape(ctx, ellipsePts(cx, ey + 38, 16, 12, 12), '#8a2a2a');
    } else {
      shape(ctx, ellipsePts(cx - 24, ey, 7, 9, 10), '#2b2622', null); shape(ctx, ellipsePts(cx + 24, ey, 7, 9, 10), '#2b2622', null);
      line(ctx, [[cx - 36, ey - 20], [cx - 12, ey - 18]], '#2b2622', 4); line(ctx, [[cx + 12, ey - 18], [cx + 36, ey - 20]], '#2b2622', 4);
      line(ctx, [[cx - 14, ey + 34], [cx + 14, ey + 34]], '#2b2622', 4);
    }
    return c;
  }
  function ballTex() {
    const c = canvas(256, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#d8432b'; ctx.fillRect(0, 0, 256, 128);
    shape(ctx, [[0, 50], [256, 50], [256, 78], [0, 78]], '#fbf6e6', null);
    line(ctx, [[0, 50], [256, 50]], '#2b2622', 4, 1.5); line(ctx, [[0, 78], [256, 78]], '#2b2622', 4, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
    return c;
  }
  // a 正 tally mark drawn stroke by stroke (n = 0..5)
  function tally(ctx, x, y, size, n, color) {
    const u = size;
    const strokes = [
      [[x, y], [x + u, y]],
      [[x + u * 0.5, y], [x + u * 0.5, y + u]],
      [[x + u * 0.5, y + u * 0.5], [x + u, y + u * 0.5]],
      [[x + u * 0.15, y + u * 0.45], [x + u * 0.15, y + u]],
      [[x - u * 0.05, y + u], [x + u * 1.05, y + u]],
    ];
    for (let i = 0; i < Math.min(5, n); i++) line(ctx, strokes[i], color, 5, 1.5);
  }
  // sticker-style icons for the special items
  function itemIcon(id) {
    const c = canvas(128, 128), ctx = c.getContext('2d');
    shape(ctx, [[14, 10], [116, 14], [118, 116], [10, 112]], '#fbf6e6', '#2b2622', 4, 2);
    ctx.textAlign = 'center';
    if (id === 'double') {
      shape(ctx, [[30, 26], [98, 26], [98, 104], [30, 104]], '#ffffff', '#2b2622', 3);
      [44, 58, 72, 86].forEach(y => line(ctx, [[38, y], [90, y]], 'rgba(185,207,230,0.9)', 2, 1));
      ctx.fillStyle = '#d8432b'; ctx.font = 'bold 40px "Patrick Hand", sans-serif'; ctx.save(); ctx.translate(64, 78); ctx.rotate(-0.25); ctx.fillText('100', 0, 0); ctx.restore();
    } else if (id === 'infinite') {
      shape(ctx, ellipsePts(64, 70, 34, 36, 20), 'rgba(160,210,255,0.5)', '#2b2622', 3);
      shape(ctx, [[44, 30], [84, 30], [84, 42], [44, 42]], '#d8432b', '#2b2622', 3);
      [[52, 62, '#f28a1a'], [72, 58, '#f4e27a'], [62, 80, '#f7a8c4'], [78, 82, '#b7e3a1']].forEach(([x, y, col]) => shape(ctx, ellipsePts(x, y, 9, 9, 10), col, '#2b2622', 2));
    } else if (id === 'speed') {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42; pts.push([64 + Math.cos(a) * r, 66 + Math.sin(a) * r]); }
      shape(ctx, pts, '#f4e27a', '#2b2622', 3);
      ctx.fillStyle = '#2b2622'; ctx.font = 'bold 22px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('讚', 64, 74);
    } else {
      shape(ctx, ellipsePts(64, 64, 40, 40, 24), '#ffffff', '#2b2622', 4);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; line(ctx, [[64 + Math.cos(a) * 33, 64 + Math.sin(a) * 33], [64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38]], '#2b2622', 3, 1); }
      line(ctx, [[64, 64], [64, 36]], '#2b2622', 4, 1); line(ctx, [[64, 64], [84, 72]], '#2b2622', 4, 1);
      shape(ctx, ellipsePts(64, 64, 4, 4, 8), '#d8432b', null);
    }
    return c;
  }
  function tiles() {
    const c = canvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#d7dfd6'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#cfd8cf' : '#dde4dc'; ctx.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); }
    for (let k = 0; k <= 4; k++) { line(ctx, [[k * 128, 0], [k * 128, 512]], 'rgba(60,70,60,0.5)', 3, 1.5); line(ctx, [[0, k * 128], [512, k * 128]], 'rgba(60,70,60,0.5)', 3, 1.5); }
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    return c;
  }
  function staffWall() {
    const c = canvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#fff8ec'; ctx.fillRect(0, 0, 512, 512);
    for (let g = 0; g < 2; g++) for (let i = 0; i < 5; i++) line(ctx, [[0, 120 + g * 220 + i * 18], [512, 120 + g * 220 + i * 18]], 'rgba(90,78,71,0.45)', 2, 1);
    ctx.fillStyle = 'rgba(43,38,34,0.55)'; ctx.font = 'bold 60px "Patrick Hand", sans-serif';
    [[80, 160], [260, 140], [420, 175], [150, 380], [360, 360]].forEach(([x, y]) => ctx.fillText(Math.random() < 0.5 ? '♪' : '♩', x, y));
    return c;
  }
  // the front board: chalkboard (classroom), whiteboard (lab) or staff whiteboard (music); strokes = 班長's tally
  function blackboard(strokes = 0, style = 'chalk') {
    const c = canvas(1024, 320), ctx = c.getContext('2d');
    const white = style !== 'chalk';
    ctx.fillStyle = white ? '#f7f9f7' : '#335c4b'; ctx.fillRect(0, 0, 1024, 320);
    if (!white) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 1500; i++) ctx.fillRect(Math.random() * 1024, Math.random() * 320, 3, 1); }
    const ink = white ? '#2f4f8a' : 'rgba(255,255,255,0.9)', ink2 = white ? '#d8432b' : 'rgba(255,170,160,0.95)', ink3 = white ? '#2f7d4f' : 'rgba(255,230,160,0.9)';
    ctx.textAlign = 'left';
    if (style === 'chalk') {
      ctx.fillStyle = ink; ctx.font = '54px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('今日課程：下課', 40, 80);
      ctx.fillStyle = ink3; ctx.font = '38px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('3 + 4 = 7', 60, 150); ctx.fillText('值日生：小明、小美', 60, 210);
      ctx.fillStyle = ink2; ctx.font = '44px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('誰再丟泡棉彈就罰站！', 420, 150); line(ctx, [[420, 162], [900, 166]], ink2, 4, 3);
      line(ctx, ellipsePts(800, 250, 30, 30, 16).concat([ellipsePts(800, 250, 30, 30, 16)[0]]), ink3, 4, 2);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(ctx, [[800 + Math.cos(a) * 38, 250 + Math.sin(a) * 38], [800 + Math.cos(a) * 52, 250 + Math.sin(a) * 52]], ink3, 4, 2); }
      line(ctx, [[940, 220], [940, 270], [920, 300]], ink, 4, 2); line(ctx, [[940, 270], [960, 300]], ink, 4, 2); line(ctx, [[910, 240], [970, 240]], ink, 4, 2); line(ctx, ellipsePts(940, 205, 15, 15, 12).concat([ellipsePts(940, 205, 15, 15, 12)[0]]), ink, 4, 2);
    } else if (style === 'lab') {
      ctx.fillStyle = ink; ctx.font = '50px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('實驗室規則', 40, 76);
      ctx.font = '34px Iansui, "Noto Sans TC", sans-serif'; ctx.fillStyle = '#2b2622';
      ['1. 藥水不能喝', '2. 不要跟骷髏握手', '3. 泡棉彈不是實驗器材'].forEach((t, i) => ctx.fillText(t, 60, 130 + i * 48));
      ctx.fillStyle = ink2; ctx.font = '42px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('H₂O + 泡棉 = ？', 560, 110);
      // a flask doodle
      line(ctx, [[760, 160], [760, 210], [720, 290], [840, 290], [800, 210], [800, 160]], ink3, 5, 2); shape(ctx, [[728, 262], [832, 262], [840, 290], [720, 290]], 'rgba(47,125,79,0.5)', null);
      [[770, 240], [800, 225], [785, 205]].forEach(([x, y]) => line(ctx, ellipsePts(x, y, 6, 6, 8).concat([ellipsePts(x, y, 6, 6, 8)[0]]), ink3, 3, 1));
    } else if (style === 'toilet') { // the cleaning crew's sign above the urinal
      ctx.fillStyle = ink2; ctx.font = '64px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('清潔中，請勿進入', 60, 110);
      ctx.fillStyle = '#2b2622'; ctx.font = '34px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('值班：清潔隊全員　　拖把 4 支　水桶 3 桶', 60, 180);
      ctx.fillStyle = ink; ctx.font = '40px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('射中紅心者優先使用', 60, 250);
      line(ctx, [[720, 60], [720, 280]], ink, 4, 2); shape(ctx, ellipsePts(860, 170, 70, 70, 24), '#f4e27a', '#2b2622', 4); shape(ctx, ellipsePts(860, 170, 40, 40, 20), '#d8432b', '#2b2622', 3); shape(ctx, ellipsePts(860, 170, 14, 14, 12), '#2b2622', null);
    } else {
      for (let i = 0; i < 5; i++) line(ctx, [[40, 70 + i * 22], [980, 70 + i * 22]], '#2b2622', 2, 1);
      ctx.fillStyle = '#2b2622'; ctx.font = 'bold 70px "Patrick Hand", sans-serif'; ctx.fillText('𝄞', 50, 150);
      [[220, 136], [300, 114], [380, 125], [460, 92], [540, 114], [620, 136], [700, 103], [780, 125]].forEach(([x, y]) => { shape(ctx, ellipsePts(x, y, 11, 8, 10), '#2b2622', null); line(ctx, [[x + 10, y], [x + 10, y - 50]], '#2b2622', 4, 1); });
      ctx.fillStyle = ink; ctx.font = '40px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('今天唱：下課歌', 40, 230);
      ctx.fillStyle = ink2; ctx.font = '36px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('Do Re Mi 不是泡棉彈', 560, 230);
    }
    if (strokes > 0) {
      ctx.fillStyle = white ? '#2b2622' : 'rgba(255,255,255,0.92)'; ctx.font = '34px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('班長記名：你', 420, 300 - (style === 'chalk' ? 38 : 0));
      const full = Math.floor(strokes / 5), rest = strokes % 5, ty = style === 'chalk' ? 232 : 270, col = white ? '#2b2622' : 'rgba(255,255,255,0.92)';
      for (let i = 0; i < full; i++) tally(ctx, 640 + i * 52, ty, 36, 5, col);
      if (rest) tally(ctx, 640 + full * 52, ty, 36, rest, col);
    }
    return c;
  }
  function banner(text) {
    const c = canvas(1024, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#d8432b'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 1012, 244);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#f4e27a' : '#ffffff'; ctx.beginPath(); ctx.moveTo(i * 76, 0); ctx.lineTo(i * 76 + 38, 34); ctx.lineTo(i * 76 + 76, 0); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 120px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 150);
    return c;
  }
  function poster(style) {
    const c = canvas(512, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#fbf6e6'; ctx.fillRect(0, 0, 512, 256); line(ctx, [[4, 4], [508, 4], [508, 252], [4, 252], [4, 4]], '#2b2622', 6, 2);
    if (style === 'periodic') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cols = ['#f7a8c4', '#9fd3f2', '#b7e3a1', '#f4e27a', '#ffd0a0'];
      const syms = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Hg', 'Pb', 'U'];
      syms.forEach((sy, i) => { const x = 30 + (i % 10) * 46, y = 40 + Math.floor(i / 10) * 60; shape(ctx, [[x - 20, y - 24], [x + 20, y - 24], [x + 20, y + 24], [x - 20, y + 24]], cols[i % 5], '#2b2622', 2, 1); ctx.fillStyle = '#2b2622'; ctx.font = 'bold 20px "Patrick Hand", sans-serif'; ctx.fillText(sy, x, y + 2); });
      ctx.fillStyle = '#2b2622'; ctx.font = '26px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('元素週期表（小學生版）', 256, 232);
    } else {
      const cx = 256, hy = 100;
      shape(ctx, ellipsePts(cx, hy, 60, 66, 20), '#f0cfae');
      if (style === 'composer') shape(ctx, [[cx - 70, hy - 10], [cx - 76, hy - 70], [cx - 30, hy - 96], [cx + 30, hy - 96], [cx + 76, hy - 70], [cx + 70, hy - 10], [cx + 40, hy - 40], [cx - 40, hy - 40]], '#e8e8e8');
      else shape(ctx, [[cx - 66, hy - 20], [cx - 60, hy - 76], [cx, hy - 96], [cx + 60, hy - 76], [cx + 66, hy - 20], [cx + 30, hy - 44], [cx - 30, hy - 44]], '#2b2622');
      shape(ctx, ellipsePts(cx - 22, hy + 4, 6, 7, 8), '#2b2622', null); shape(ctx, ellipsePts(cx + 22, hy + 4, 6, 7, 8), '#2b2622', null);
      line(ctx, [[cx - 18, hy + 34], [cx, hy + 40], [cx + 18, hy + 34]], '#2b2622', 3);
      shape(ctx, [[cx - 90, 256], [cx - 70, hy + 60], [cx + 70, hy + 60], [cx + 90, 256]], style === 'composer' ? '#2b3a67' : '#5a4e47');
      ctx.fillStyle = '#2b2622'; ctx.font = '26px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(style === 'composer' ? '音樂家 貝多芬' : '音樂家 莫札特', 256, 236);
    }
    return c;
  }
  function skeleton() {
    const c = canvas(192, 512), ctx = c.getContext('2d');
    const bone = '#fbf6e6', ink = '#2b2622', cx = 96;
    shape(ctx, ellipsePts(cx, 60, 40, 44, 18), bone, ink, 4); shape(ctx, ellipsePts(cx - 15, 56, 9, 11, 10), ink, null); shape(ctx, ellipsePts(cx + 15, 56, 9, 11, 10), ink, null);
    line(ctx, [[cx - 14, 88], [cx + 14, 88]], ink, 3); [[-8], [0], [8]].forEach(([dx]) => line(ctx, [[cx + dx, 82], [cx + dx, 94]], ink, 2));
    line(ctx, [[cx, 104], [cx, 300]], bone, 10, 1); line(ctx, [[cx, 104], [cx, 300]], ink, 3, 1);
    for (let i = 0; i < 5; i++) { const y = 130 + i * 24; line(ctx, [[cx - 36 + i * 4, y], [cx + 36 - i * 4, y]], bone, 8, 1); line(ctx, [[cx - 36 + i * 4, y], [cx + 36 - i * 4, y]], ink, 2, 1); }
    shape(ctx, [[cx - 34, 300], [cx + 34, 300], [cx + 30, 330], [cx - 30, 330]], bone, ink, 3);
    [[-1, 0], [1, 0]].forEach(([s]) => { line(ctx, [[cx + s * 30, 120], [cx + s * 62, 230], [cx + s * 54, 300]], bone, 9, 1); line(ctx, [[cx + s * 30, 120], [cx + s * 62, 230], [cx + s * 54, 300]], ink, 3, 1); line(ctx, [[cx + s * 20, 330], [cx + s * 26, 420], [cx + s * 22, 500]], bone, 10, 1); line(ctx, [[cx + s * 20, 330], [cx + s * 26, 420], [cx + s * 22, 500]], ink, 3, 1); });
    return c;
  }
  function planeIcon() {
    const c = canvas(96, 96), ctx = c.getContext('2d');
    shape(ctx, [[6, 60], [90, 20], [50, 84], [44, 56]], '#ffffff', '#2b2622', 4, 1); line(ctx, [[44, 56], [90, 20]], '#2b2622', 3, 1);
    return c;
  }
  function speechIcon(text) {
    const c = canvas(256, 128), ctx = c.getContext('2d');
    shape(ctx, [[8, 10], [248, 10], [248, 92], [150, 92], [120, 120], [126, 92], [8, 92]], '#ffffff', '#2b2622', 6, 2);
    ctx.fillStyle = '#2b2622'; ctx.font = 'bold 40px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 52);
    return c;
  }
  function paperWall(bg = '#fbf6e6') {
    const c = canvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(185,207,230,0.7)'; ctx.lineWidth = 2;
    for (let y = 32; y < 512; y += 48) line(ctx, [[0, y], [512, y]], 'rgba(185,207,230,0.7)', 2, 1);
    ctx.fillStyle = 'rgba(90,78,71,0.06)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    return c;
  }
  function floor() {
    const c = canvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#d9b68a'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      const y = i * 128;
      ctx.fillStyle = i % 2 ? '#d3ad7f' : '#dfbd92'; ctx.fillRect(0, y, 512, 128);
      line(ctx, [[0, y], [512, y]], 'rgba(90,60,40,0.55)', 3, 1.5);
      const off = (i % 2) * 256;
      line(ctx, [[off, y], [off, y + 128]], 'rgba(90,60,40,0.55)', 3, 1.5);
      for (let k = 0; k < 6; k++) line(ctx, [[Math.random() * 512, y + 10 + Math.random() * 108], [Math.random() * 512, y + 10 + Math.random() * 108]], 'rgba(120,80,50,0.18)', 2, 4);
    }
    return c;
  }
  function grass() {
    const c = canvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#9fcf7a'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) { const x = Math.random() * 512, y = Math.random() * 512, l = 4 + Math.random() * 8; line(ctx, [[x, y], [x + (Math.random() - 0.5) * 4, y - l]], Math.random() < 0.5 ? 'rgba(70,130,50,0.55)' : 'rgba(190,225,140,0.6)', 2, 1); }
    for (let i = 0; i < 18; i++) { const x = Math.random() * 512, y = Math.random() * 512; ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#f4e27a'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fill(); }
    return c;
  }
  function window_() {
    const c = canvas(256, 384), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#8fc7f3'); g.addColorStop(1, '#dff0fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 384);
    [[60, 90, 40], [170, 160, 50], [100, 260, 36]].forEach(([x, y, r]) => {
      shape(ctx, ellipsePts(x, y, r * 1.6, r * 0.9, 18), '#ffffff', 'rgba(90,120,160,0.6)', 3, 3);
    });
    line(ctx, [[128, 0], [128, 384]], '#2b2622', 8, 1); line(ctx, [[0, 192], [256, 192]], '#2b2622', 8, 1);
    return c;
  }
  function milkCarton() {
    const c = canvas(128, 192), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 192);
    shape(ctx, [[0, 70], [128, 70], [128, 112], [0, 112]], '#2f6fd1', null);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('鮮奶', 64, 102);
    ctx.fillStyle = '#2b2622'; ctx.font = '18px Iansui, "Noto Sans TC", sans-serif'; ctx.fillText('營養午餐', 64, 150); ctx.fillText('全脂', 64, 40);
    line(ctx, [[0, 0], [128, 0]], '#2b2622', 4, 1); line(ctx, [[0, 190], [128, 190]], '#2b2622', 4, 1);
    return c;
  }
  function gradientMap() {
    const data = new Uint8Array([150, 205, 240, 255]);
    const t = new THREE.DataTexture(data, 4, 1, THREE.RedFormat); t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }
  return { kid, kidVariant, teacher, nameTag, bullseye, noteIcon, alertIcon, planeIcon, speechIcon, tiles, staffWall, poster, banner, skeleton, grass, bully, monitor, ballTex, itemIcon, paperWall, floor, blackboard, window: window_, milkCarton, gradientMap, tex, canvas };
})();
