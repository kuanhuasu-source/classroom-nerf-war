# 課桌大戰 Classroom Nerf War

瀏覽器第一人稱 Nerf 槍大戰原型，Three.js 製作。

## 開發

```bash
npm install
npm run dev            # 本機開發伺服器，開 http://localhost:5173
npm run build          # 產出 dist/，給 GitHub Pages
npm run build:single   # 產出 dist-single/index.html 單檔版，給 Claude Artifact
python3 tools/artifact-body.py dist-single/index.html out.html   # 轉成 Artifact 用的頁面
```

## 雙人連線

首頁按「開房間」會得到四個字母的房號，隊友按「輸入房號」加入；房主再按「開始」。預設走 PeerJS 的公用信令伺服器。

本機測試可以自己架一個：

```bash
npx peerjs --port 9000 --path / --host 127.0.0.1
# 然後兩個分頁都開 http://localhost:5173/?peer=local
```

純程式測試用的假連線：同時開 `?role=host` 與 `?role=guest` 兩個分頁，兩邊的 `window.__transport` 互相搬運訊息（見 `src/net/transport.js`）。

平衡用的機器人：`tools/balance-bot.js` + `tools/balance-test.cjs` 跑單人，`tools/coop-bot.js` + `tools/coop-balance-test.cjs` 開兩個分頁走假連線跑雙人（參數：bot 所在資料夾、難度、場數），都需要先 `npm run build` 並在 `dist/` 起一個靜態伺服器在 8766 埠。

雙人模式的差別：同學人數 1.4 倍、同時開火多一人、老師弱點多 1 格；小明一開始帶大彈匣、小美帶磁鐵手套；清波後不暫停，畫面下方的卡片列給 10 秒選升級，沒選自動拿第一張；牆上貼紙的 buff 誰射中誰拿（慢動作除外，整間教室一起慢）；補彈盒裝 30 發、會出現在比較缺彈的人附近；隊友 30 秒內重連會拿回原本的升級、彈藥和血量。

推到 `main` 分支會由 `.github/workflows/deploy.yml` 自動建置並部署到 GitHub Pages。

## 專案結構

```
src/
├── main.js        進入點
├── config.js      所有數值設定（難度、彈藥、教室元素機率）
├── audio.js       WebAudio 合成音效
├── draw.js        手繪貼圖產生器
├── world.js       教室幾何、碰撞、尋路格
├── darts.js       泡棉彈與粉筆
├── paperfigure.js 紙片人基底
├── student.js / teacher.js / bully.js / monitor.js / dodgeball.js / item.js
├── teachers.js    四位老師與兩位大 Boss 的定義
├── layouts.js     三間教室的資料（大小、掩體、擺設、門、道具點）
├── player.js      玩家、Nerf 槍
├── ui.js          HUD 與選單
└── game.js        主迴圈、波次、計分、buff
legacy/index-single-file.html   拆分前的單檔版本，留作對照
```

## 操作

| 鍵 | 功能 |
| --- | --- |
| 滑鼠 | 視角、左鍵開火 |
| W A S D | 移動 |
| Shift | 跑步 |
| Ctrl | 蹲下（躲課桌後） |
| R | 重裝彈匣（打空會自動換） |
| 走過地上的泡棉彈 | 撿起來當備用彈 |
| E | 走到罰坐的隊友旁邊救他（連線模式） |
| 1 2 3 4 | 喊話：掩護我、我沒彈了、惡霸醒了、班長來了（連線模式） |

手機／平板（偵測到觸控就自動切換，`body.touch`）：

| 動作 | 操作 |
| --- | --- |
| 走路 | 畫面左半邊按住拖曳，會出現浮動搖桿 |
| 轉視角 | 畫面右半邊拖曳 |
| 射擊 | 右下「射擊」按住連射，或在右半邊點一下射一發 |
| 重裝、蹲 | 右下貼紙按鈕（蹲是切換） |
| 救隊友 | 隊友罰坐時右下出現「救！」（連線模式） |
| 喊話 | 畫面上方四個小按鈕（連線模式） |
| 暫停 | 右上「Ⅱ」 |

觸控模式不會要求滑鼠鎖定；升級卡片直接點。
| Esc | 暫停 |

## 難度

首頁可選簡單／普通／困難，預設普通。差別在同時開火的人數上限、同學探頭到開火的延遲、彈速、每波人數與清波回血。細節見 `DESIGN.md` 4.4a。

## 升級

六波之後才是老師。每清一波從三張卡片選一個升級（彈匣、換彈、射速、雙管、彈速、磁鐵、書包、回收、蛙鏡、便當），按 1、2、3 或點卡片。單人模式選卡時暫停；雙人模式不暫停、10 秒內要選。老師戰時課桌上會出現鉛筆盒補彈。

## 教室裡要注意的

- 後排趴著睡覺的惡霸：別射他，他會丟書包（範圍攻擊）。
- 走道上的躲避球：射它可以把它打飛去撞同學。
- 垃圾桶：射倒會冒臭煙，煙裡的同學看不到也射不了。
- 前門上的水桶：射下來門口變水坑，走進來的同學直接滑倒出局，每波可用一次。
- 每波最後進來的是班長（紅臂章、名牌）：血多、更準，在場時其他同學更兇；先打倒她，其他人會慌。
- 牆上出現的貼紙：射中拿 buff（分數雙倍、彈匣不減、加速、慢動作）。
- 老師戰有機率換成大 Boss：教務主任（廣播音波要蹲、紙飛機、點名叫人）或校長（追蹤泡泡、頒獎砸地）。`?teacher=dean` / `?teacher=principal` 可指定。
- 三間教室隨機或指定：三年二班、自然教室、音樂教室（首頁可選，`?map=lab` 可指定）。
- 老師戰是四位老師隨機一位：數學（丟粉筆）、體育（丟球、吹哨衝刺）、音樂（扇形音符）、自然（試管藥水攤、腳下實驗）。網址加 `?teacher=pe` 可指定。

設計文件見 `DESIGN.md`。
