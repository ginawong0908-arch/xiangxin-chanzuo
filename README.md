# 祥心禅坐

极简禅坐计时器。宣纸、墨字、呼吸。

---

## 快速开始

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:5173
```

## 技术栈

| 层 | 选型 |
|---|---|
| 构建 | Vite 5 + TypeScript |
| 文字排版引擎 | [@chenglou/pretext](https://github.com/chenglou/pretext) |
| 字体 | LXGW WenKai（Google Fonts）+ Noto Serif CJK 备选 |
| 渲染 | Canvas（主字呼吸动效）+ DOM（UI） |

## 核心架构

```
src/
  main.ts      状态机：home → sitting → ending → home
  breath.ts    Canvas 呼吸动效（pretext 精确居中）
  timer.ts     静默倒计时
  data/zi.json 字库（数组，随时可加字）
  style.css    宣纸风格 + CSS 过渡
public/audio/  环境音 + 磬声（见下方）
```

### pretext 的用途

`breath.ts` 用 `prepareWithSegments` + `measureNaturalWidth` 获取字形的精确 advance width，配合 canvas `measureText` 的 ascent/descent，计算出字形的**光学中心**。呼吸缩放以此为原点，而不是元素盒子中点——这是 CSS `transform-origin: 50%` 做不到的。

## 字库扩展

编辑 `src/data/zi.json`，每条格式：

```json
{ "zi": "禅", "ji": "禅心无碍" }
```

## 音频文件

`public/audio/` 下放四个文件，当前为占位静音文件，请用真实音源替换：

| 文件 | 用途 |
|---|---|
| `wind.mp3` | 风声环境音（随机三选一） |
| `birds.mp3` | 鸟鸣环境音 |
| `water.mp3` | 水声环境音 |
| `bell.mp3` | 结束磬声 |

### 推荐免费音源

#### Freesound（[freesound.org](https://freesound.org)）— CC0 / CC-BY

| 文件 | 搜索关键词 |
|---|---|
| wind.mp3 | `gentle wind forest ambience` |
| birds.mp3 | `birds singing morning forest` |
| water.mp3 | `stream water gentle flowing` |
| bell.mp3 | `tibetan singing bowl` 或 `zen bell single` |

注意勾选 **License: Creative Commons 0** 筛选完全免版权素材。

#### Pixabay 音频（[pixabay.com/music](https://pixabay.com/music/)）— 完全免费商用

搜索关键词：`forest ambience`、`zen bell`、`morning birds`、`water stream`

下载后用 [Audacity](https://www.audacityteam.org/) 或 ffmpeg 裁剪为 30–60 秒循环片段，保存为 mp3（128kbps 足够）。

## P1 预留接口

`main.ts` 中的 `getTodayZi()` 已留钩子。接入农历 / 节气时，修改此函数返回对应字条目即可，无需改动其他文件。

## 构建生产版本

```bash
npm run build   # 输出到 dist/
npm run preview # 本地预览 dist/
```
