import { Profile } from './profile.js';

// 故事模式「Jason 的畢業週」：六年二班的 Jason 在畢業前最後一週，每天一章，把每個玩法串起來。
// 章節是資料；Game.startStory 套用章節的玩法、地圖、難度、波次與老師，結束時用 starsFor 算星星，Progress 存在瀏覽器。
export const STORY = {
  title: 'Jason 的畢業週',
  chapters: [
    {
      id: 'mon', day: '星期一', weather: '☀️', title: '最後一週的第一堂下課', mode: 'class', map: 'classroom', level: 'easy', waves: [3, 4, 4], teacher: 'math',
      diary: ['畢業前最後一週。媽媽說這週要當乖孩子。', '下課鐘一響，班長就宣布：泡棉彈大戰，畢業週特別版。'],
      goal: '撐過三波同學，再把數學老師的眼鏡、粉筆、教案打掉。',
      hints: { start: '躲在課桌後面，同學探頭再打！', clear: '清光了！地上的泡棉彈記得撿。', boss: '老師只有紅圈有用，別打身體。' },
      end: '數學老師說：再丟一次就留級！……她應該是開玩笑。',
    },
    {
      id: 'tue', day: '星期二', weather: '⛅', title: '憋不住的第二節', mode: 'toilet', level: 'easy', time: 100,
      diary: ['第二節上到一半，肚子開始叫。', '衝到廁所，清潔隊正在拖地。阿姨說：射破架上的罐子就讓你用。'],
      goal: '100 秒內射破 8 個罐子。只有三滴血，被潑到水會變慢。',
      hints: { start: '拖把桶後面可以蹲，水球躲開就好。', low: '剩兩罐！別被通馬桶打到。' },
      end: '阿姨：下次早點來！（我也不想啊。）',
    },
    {
      id: 'wed', day: '星期三', weather: '🌧', title: '自然教室的綠色藥水', mode: 'class', map: 'lab', level: 'normal', waves: [4, 4, 5, 5], teacher: 'science',
      diary: ['下雨天，自然課改成室內泡棉彈。', '自然老師說她有新藥水要試。綠色那個，不要踩。'],
      goal: '四波同學，然後自然老師的護目鏡、試管架、實驗手冊。',
      hints: { start: '實驗桌後面安全，圓凳不要卡到。', boss: '綠色的藥水會留在地上，繞開！' },
      end: '老師的藥水把走廊染綠了，值日生哭了。',
    },
    {
      id: 'thu', day: '星期四', weather: '☀️', title: '午餐大作戰', mode: 'lunch', level: 'normal',
      diary: ['今天輪到我們抬午餐。小美說她站車上射，我推。', '隔壁班的搶菜王已經在走廊等了。'],
      goal: '推餐車到蒸飯室裝菜，再推回六年二班；湯別灑光。裝完菜換手，回程換你射。',
      hints: { start: '我在車上，你專心推！轉角要提前。', back: '換我推！搶菜王貼過來你就打。' },
      end: '咖哩剩一半，但大家說很好吃。',
    },
    {
      id: 'fri_am', day: '星期五上午', weather: '🌤', title: '隔壁學校來踢館', mode: 'siege', level: 'hard', waves: [4, 5, 6, 7, 8, 9], bosses: { 3: 'gang1', 6: 'king' },
      diary: ['隔壁學校的惡霸軍團說要在我們畢業前「討回公道」。', '校門、圍牆、水溝蓋，他們哪裡都進得來。'],
      goal: '守住操場六波。第 3 波惡霸老大、第 6 波惡霸大王。彈藥無限。',
      hints: { start: '水溝蓋會掀開，注意背後！', boss: '大王一直丟板擦，被粉筆灰罩到就先退。' },
      end: '大王的皇冠掉在水溝蓋旁邊。警衛伯伯說他會處理。',
    },
    {
      id: 'fri_pm', day: '星期五下午', weather: '🌇', title: '活動中心的會考委員會', mode: 'class', map: 'hall', level: 'hard', waves: [5, 6, 7], teacher: 'committee',
      diary: ['畢業典禮彩排，會考委員會突然出現在舞台上。', '主考官說：想畢業，先通過我們的「泡棉彈會考」。'],
      goal: '三波同學，然後三位監考官。鐘響的時候一定要蹲下。',
      hints: { start: '二樓看台可以上去，樓梯在兩側。', boss: '聽到鐘聲就蹲！站著會被三個人一起丟。' },
      end: '主考官蓋了一個章：准予畢業（泡棉彈科）。',
      finale: true,
    },
    {
      id: 'secret', hidden: true, day: '畢業典禮', weather: '🎓', title: '校長親自出馬', mode: 'class', map: 'classroom', level: 'exam', waves: [6, 7, 8], teacher: 'principal',
      diary: ['畢業典禮上，校長拿起麥克風……然後拿起泡棉槍。', '「六年二班，這六年來你們丟壞了 37 支板擦。」'],
      goal: '最後一戰：校長的麥克風、獎盃、領帶。會考難度。',
      hints: { start: '這是真的會考難度，牛奶一出現就去喝。', boss: '校長的話會追著你跑，別站著不動。' },
      end: '校長笑著說：畢業快樂。然後把槍沒收了。',
    },
  ],
  epilogue: ['六年二班，畢業快樂。', '泡棉彈、板擦、咖哩和皇冠，都收進這本紀念冊了。'],
};
export const chapterById = (id) => STORY.chapters.find(c => c.id === id);

// progress lives in the browser: stars per chapter
export const Progress = {
  data: null,
  load() { if (this.data) return this.data; this.data = Profile.get('story') || { stars: {} }; if (!this.data.stars) this.data.stars = {}; return this.data; },
  save() { Profile.put('story', this.data); },
  stars(id) { return this.load().stars[id] || 0; },
  setStars(id, n) { const d = this.load(); if (n > (d.stars[id] || 0)) { d.stars[id] = n; this.save(); } },
  // a chapter opens when the one before it has at least one star; the secret one needs three stars everywhere else
  unlocked(ch) { const list = STORY.chapters, i = list.indexOf(ch); if (ch.hidden) return this.allThree(); if (i === 0) return true; return this.stars(list[i - 1].id) > 0; },
  allThree() { return STORY.chapters.filter(c => !c.hidden).every(c => this.stars(c.id) >= 3); },
  finished() { return STORY.chapters.filter(c => !c.hidden).every(c => this.stars(c.id) > 0); },
  next(ch) { const list = STORY.chapters, i = list.indexOf(ch); for (let k = i + 1; k < list.length; k++) if (!list[k].hidden || this.allThree()) return list[k]; return null; },
  reset() { this.data = { stars: {} }; this.save(); },
};

// 1 star for the win, the other two for how it went
export function starsFor(ch, g) {
  const p = g.player, acc = p.shots >= 20 ? p.hits / p.shots : 0;
  if (ch.mode === 'lunch') return g.lunchMode ? Math.max(1, g.lunchMode.stars()) : 1;
  if (ch.mode === 'toilet') return 1 + (g.timeLeft >= 30 ? 1 : 0) + (g.wetCount === 0 ? 1 : 0);
  if (ch.mode === 'siege') return 1 + (g.damageTaken <= 4 ? 1 : 0) + (acc >= 0.35 ? 1 : 0);
  return 1 + (p.hp >= 3 ? 1 : 0) + (acc >= 0.4 ? 1 : 0);
}
Profile.onSwitch(() => { Progress.data = null; });
export const starText = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
