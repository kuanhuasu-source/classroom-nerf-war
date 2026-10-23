// The four teachers who can walk back into the classroom. Weak-point positions are local to the
// paper figure: x positive = the viewer's right (same side as the canvas), y up, metres. Each has three weak-point items; losing one changes her behaviour.
export const TEACHERS = [
  {
    id: 'math', name: '數學老師', move: 'pace', speed: 1.5, attack: 'chalk', interval: 1.6,
    style: { top: '#c5584a', bottom: '#4b3f6b', hair: 'bun', hairColor: '#3a2a2a' },
    wp: [
      { key: 'glasses', label: '眼鏡', local: [0, 1.86, 0], r: 0.3, color: 0x9fd3f2, size: [0.3, 0.1, 0.03], lost: ['眼鏡掉了！', '老師看不清楚，準度大降'] },
      { key: 'chalk', label: '粉筆', local: [0.49, 1.86, 0], r: 0.27, color: 0xffffff, size: [0.03, 0.03, 0.12], lost: ['粉筆飛了！', '老師沒東西可丟了……大概'] },
      { key: 'book', label: '教案', local: [-0.36, 1.33, 0], r: 0.28, color: 0x2f7d4f, size: [0.3, 0.4, 0.05], lost: ['教案掉了！', '老師忘記要教什麼，走得更慢'] },
    ],
    intro: ['數學老師回來了！！', '打掉她的眼鏡、粉筆、教案'], sfx: 'teacher',
  },
  {
    id: 'pe', name: '體育老師', move: 'run', speed: 2.8, attack: 'ball', interval: 2.2, special: 'charge', specialEvery: 7,
    style: { top: '#2f6fd1', bottom: '#2f6fd1', pants: true, hair: 'short', hairColor: '#2b2622' },
    wp: [
      { key: 'whistle', label: '哨子', local: [0, 1.5, 0], r: 0.27, color: 0xf4e27a, size: [0.08, 0.08, 0.08], lost: ['哨子掉了！', '吹不了哨，不會再衝刺'] },
      { key: 'ball', label: '躲避球', local: [-0.4, 1.3, 0], r: 0.32, color: 0xd8432b, size: [0.3, 0.3, 0.3], lost: ['球被打飛了！', '老師沒球可丟'] },
      { key: 'cap', label: '帽子', local: [0, 2.08, 0], r: 0.3, color: 0x2f6fd1, size: [0.3, 0.12, 0.3], lost: ['帽子掉了！', '老師不好意思，跑慢一半'] },
    ],
    intro: ['體育老師回來了！！', '她吹哨之後會衝過來，快閃'], sfx: 'whistle',
  },
  {
    id: 'music', name: '音樂老師', move: 'glide', speed: 1.2, attack: 'notes', interval: 2.0,
    style: { top: '#f7a8c4', bottom: '#f7a8c4', dress: true, hair: 'long', hairColor: '#6b3a1e' },
    wp: [
      { key: 'baton', label: '指揮棒', local: [0.5, 1.9, 0], r: 0.28, color: 0xffffff, size: [0.02, 0.02, 0.3], lost: ['指揮棒飛了！', '只剩單音'] },
      { key: 'sheet', label: '樂譜', local: [-0.38, 1.3, 0], r: 0.3, color: 0xffffff, size: [0.28, 0.36, 0.02], lost: ['樂譜散了！', '老師忘詞，唱得慢'] },
      { key: 'clip', label: '髮夾', local: [0.22, 2.0, 0], r: 0.27, color: 0xf4e27a, size: [0.12, 0.08, 0.03], lost: ['髮夾掉了！', '老師音準跑掉了'] },
    ],
    intro: ['音樂老師回來了！！', '她一開口就是三個音符'], sfx: 'chord',
  },
  {
    id: 'science', name: '自然老師', move: 'anchor', speed: 1.0, attack: 'tube', interval: 3.0, special: 'experiment', specialEvery: 9,
    style: { top: '#ffffff', bottom: '#5a4e47', coat: true, pants: true, hair: 'ponytail', hairColor: '#2b2622' },
    wp: [
      { key: 'goggles', label: '護目鏡', local: [0, 1.86, 0], r: 0.3, color: 0x9fd3f2, size: [0.3, 0.1, 0.05], lost: ['護目鏡掉了！', '老師看不清楚，準度大降'] },
      { key: 'rack', label: '試管架', local: [-0.4, 1.3, 0], r: 0.32, color: 0xb7e3a1, size: [0.3, 0.2, 0.1], lost: ['試管架翻了！', '沒有試管可丟'] },
      { key: 'manual', label: '實驗手冊', local: [0.48, 1.86, 0], r: 0.28, color: 0xf4e27a, size: [0.2, 0.28, 0.03], lost: ['實驗手冊掉了！', '老師不會做實驗了'] },
    ],
    intro: ['自然老師回來了！！', '綠色的藥水不要踩'], sfx: 'bubble',
  },
];
export const BOSSES = [
  {
    id: 'dean', boss: true, name: '教務主任', wpHp: 4, scale: 1.1, move: 'pace', speed: 2.0, attack: 'planes', interval: 2.4,
    specials: [{ kind: 'broadcast', every: 9 }, { kind: 'rollcall', every: 12 }],
    style: { top: '#5a4e47', bottom: '#2b2622', pants: true, suit: true, hair: 'short', hairColor: '#2b2622', tie: '#d8432b' },
    wp: [
      { key: 'megaphone', label: '擴音器', local: [0.5, 1.9, 0], r: 0.3, color: 0xd8432b, size: [0.25, 0.25, 0.3], lost: ['擴音器摔了！', '不會再廣播'] },
      { key: 'reports', label: '成績單', local: [-0.4, 1.3, 0], r: 0.32, color: 0xffffff, size: [0.3, 0.36, 0.03], lost: ['成績單飛了！', '只剩一張一張丟'] },
      { key: 'clipboard', label: '點名板', local: [0, 1.4, 0], r: 0.3, color: 0xb98556, size: [0.3, 0.4, 0.03], lost: ['點名板掉了！', '不會再叫人進來'] },
    ],
    intro: ['教務主任來了！！', '廣播的時候要蹲下'], sfx: 'tattle',
  },
  {
    id: 'principal', boss: true, name: '校長', wpHp: 5, scale: 1.3, move: 'pace', speed: 1.2, attack: 'speech', interval: 2.2,
    specials: [{ kind: 'slam', every: 10 }],
    style: { top: '#2b3a67', bottom: '#2b3a67', pants: true, suit: true, hair: 'bald', hairColor: '#8a8a8a', tie: '#f4e27a' },
    wp: [
      { key: 'mic', label: '麥克風', local: [0.5, 1.9, 0], r: 0.3, color: 0x5a4e47, size: [0.1, 0.3, 0.1], lost: ['麥克風掉了！', '校長的話不會再追人'] },
      { key: 'trophy', label: '獎盃', local: [-0.4, 1.3, 0], r: 0.34, color: 0xf4e27a, size: [0.3, 0.4, 0.3], lost: ['獎盃摔了！', '不會再頒獎砸人'] },
      { key: 'tie', label: '領帶', local: [0, 1.45, 0], r: 0.3, color: 0xf4e27a, size: [0.1, 0.5, 0.03], lost: ['領帶被射掉了！', '校長氣到跑更快'] },
    ],
    intro: ['校長親自來了！！', '他的話會追著你跑'], sfx: 'chord',
  },
];
// 會考委員會三人組：只在活動中心出現，三人同時站上舞台。每人兩個弱點、兩格血，倒一個其餘加班變快，只剩一個會下台追人。
export const COMMITTEE = {
  id: 'committee', name: '會考委員會', wpHp: 3, intro: ['會考委員會來了！！', '三位監考官上台。鐘響時要蹲下'], sfx: 'tattle',
  members: [
    {
      id: 'chief', name: '主考官', short: '主考', boss: true, group: 'committee', move: 'stage', chase: true, speed: 1.4, attack: 'planes', planesKey: 'papers', interval: 3.2,
      specials: [{ kind: 'collect', every: 14 }], enterTo: [0, -4.7],
      style: { top: '#4b3f6b', bottom: '#2b2622', pants: true, suit: true, hair: 'bald', hairColor: '#8a8a8a', tie: '#2f6fd1' },
      wp: [
        { key: 'glasses', label: '老花眼鏡', local: [0, 1.86, 0], r: 0.3, color: 0x9fd3f2, size: [0.3, 0.1, 0.03], lost: ['老花眼鏡掉了！', '主考官看不清，考卷亂飛'] },
        { key: 'papers', label: '考卷', local: [-0.4, 1.3, 0], r: 0.32, color: 0xffffff, size: [0.3, 0.36, 0.04], lost: ['考卷散了一地！', '不會再喊收卷'] },
      ],
    },
    {
      id: 'timer', name: '監考官（碼表）', short: '監考A', boss: true, group: 'committee', move: 'stage', chase: true, speed: 1.8, attack: 'planes', interval: 4.2,
      specials: [{ kind: 'countdown', every: 12 }], enterTo: [-2.6, -5.3],
      style: { top: '#5a4e47', bottom: '#2b2622', pants: true, suit: true, hair: 'short', hairColor: '#2b2622', tie: '#d8432b' },
      wp: [
        { key: 'stopwatch', label: '碼表', local: [0, 1.45, 0], r: 0.3, color: 0x7a8794, size: [0.16, 0.16, 0.05], lost: ['碼表摔壞了！', '不會再倒數盯人'] },
        { key: 'tie', label: '領帶', local: [0, 1.75, 0], r: 0.24, color: 0xd8432b, size: [0.1, 0.5, 0.03], lost: ['領帶被射掉了！', '監考官不好意思，走慢了'] },
      ],
    },
    {
      id: 'stamper', name: '監考官（印章）', short: '監考B', boss: true, group: 'committee', move: 'stage', chase: true, speed: 1.3, attack: 'planes', interval: 4.8,
      specials: [{ kind: 'stamp', every: 11 }], enterTo: [2.6, -5.3],
      style: { top: '#2b3a67', bottom: '#2b3a67', pants: true, suit: true, hair: 'bun', hairColor: '#3a2a2a', tie: '#f4e27a' },
      wp: [
        { key: 'stamp', label: '印章', local: [0.5, 1.9, 0], r: 0.3, color: 0xd8432b, size: [0.14, 0.26, 0.14], lost: ['印章飛了！', '不會再蓋不及格'] },
        { key: 'badge', label: '名牌', local: [-0.3, 1.5, 0], r: 0.26, color: 0xffffff, size: [0.26, 0.14, 0.02], lost: ['名牌掉了！', '沒人知道她是誰，丟得慢'] },
      ],
    },
  ],
};
export const teacherById = (id) => TEACHERS.find(t => t.id === id) || BOSSES.find(t => t.id === id) || COMMITTEE.members.find(t => t.id === id) || TEACHERS[0];
