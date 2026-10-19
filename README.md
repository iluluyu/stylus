<div align="right">

[English](README.en-US.md) | 简体中文

</div>

# stylus

面向 AI 编码智能体的**学术写作技能集** —— 按 [Agent Skills](https://agentskills.io/specification)
规范打包，可加载进任何兼容该规范的智能体：Claude Code、Codex、dsh、zcode、Zed、
opencode、pi 等。

stylus（拉丁语"铁笔"）只做一件事：**帮助科研人员用英文写好学术文本**。
每个技能是一个自包含的 Markdown 文件夹 —— `SKILL.md` 承载工作流与核心规则，
`references/` 存放按需加载的细则。纯 Markdown，零依赖、零构建、不绑定厂商。

## 技能清单

| 技能 | 简介 | 适用场景 |
|---|---|---|
| [math-writing](skills/math-writing/) | 数学写作规范：证明的散文式行文、公式的语法角色与标点、记号一致性、四 C 审校标准 | 撰写 / 修改 / 审校证明、定理、推导、LaTeX 论文草稿 |
| [scientific-paper-writing](skills/scientific-paper-writing/) | 科研论文写作：结构（Whitesides）、句子（Gopen & Swan）、措辞（Manchester 短语库）三大支柱，Fast / Learn 双模式 | 规划 / 起草 / 修改 / 润色英文科研稿件（PRL、Nature、PRX 等） |

两个技能互补：`math-writing` 管数学文本怎么写对，`scientific-paper-writing`
管整篇论文怎么写好。

## 安装

本仓库是技能合集，整仓克隆一次，再把需要的技能链接（或复制）到智能体的
skills 目录即可：

```bash
git clone https://github.com/iluluyu/stylus.git
```

### 一次克隆，多个智能体共用

Codex、Zed、dsh 都会读取共享目录 `~/.agents/skills/`，软链一次全部生效：

```bash
ln -s /path/to/stylus/skills/math-writing              ~/.agents/skills/math-writing
ln -s /path/to/stylus/skills/scientific-paper-writing ~/.agents/skills/scientific-paper-writing
```

### 按智能体安装

如果你的智能体使用独立的 skills 目录，把软链换成对应位置：

| 智能体 | skills 目录 |
|---|---|
| Codex (OpenAI) | `~/.agents/skills/` |
| Zed | `~/.agents/skills/` |
| dsh (DeepSeek) | `~/.dsh/skills/`（也读取 `~/.agents/skills/`） |
| zcode (Z.ai) | `~/.zcode/skills/` |
| Claude Code | `~/.claude/skills/` |
| opencode | `~/.config/opencode/skills/` |
| pi | `~/.pi/agent/skills/` |

更新：在 stylus 目录里 `git pull`，软链自动跟随最新内容。

### 只想要一个技能

不想整仓克隆时，可以单独抽取某个技能文件夹：

```bash
npx degit iluluyu/stylus/skills/math-writing math-writing
```

### 网页版客户端（Claude.ai 等）

把 `skills/<name>/` 打包成 zip 上传即可。注意
[规范](https://agentskills.io/specification)要求文件夹名与技能 `name` 一致：
解压后顶层必须是 `math-writing/` 或 `scientific-paper-writing/`，
不要多包一层 `stylus-main/`。

## 仓库结构

```
stylus/
├── README.md / README.en-US.md    # 中英文文档（默认中文）
├── LICENSE                        # MIT
└── skills/
    ├── math-writing/
    │   ├── SKILL.md               # 核心规则 + 路由（触发时整体加载）
    │   └── references/
    │       ├── proof-writing.md       # 起草：证明写作规范
    │       └── paper-checklist.md     # 审校：四 C 标准 + QA 清单
    └── scientific-paper-writing/
        ├── SKILL.md               # 工作流：双模式 + 原则代码索引
        └── references/
            ├── structure.md               # P 系：论文结构
            ├── sentences.md               # S 系：句子结构
            ├── phrasing.md                # W 系：措辞
            └── grammar-and-conventions.md # G/C 系：语法与物理写作惯例
```

技能内容一律用英文书写（产出对象是英文论文），但触发词同时支持中英文，
例如"论文润色""帮我改证明""快速模式"。

## 内容来源与致谢

技能思想改编自以下公开材料，版权归各自作者：

- **math-writing** — John M. Lee, *Guidelines for Writing Proofs*
  （华盛顿大学 Math 300 讲义，2018 秋）；"Academic writing" 审校幻灯片
  （四 C 原则 + 检查清单）。
- **scientific-paper-writing** — G. D. Gopen & J. A. Swan,
  "The Science of Scientific Writing"（*American Scientist* **78**, 1990）；
  G. M. Whitesides, "Whitesides' Group: Writing a Paper"
  （*Advanced Materials* **16**, 2004）；曼彻斯特大学 *Academic Phrasebank*。

技能中的所有示例均为原创，未复制原文。

## 许可

[MIT](LICENSE)

## 关键词

学术写作 · 数学写作 · 论文润色 · 学术英语 · 科研写作 · LaTeX · Agent Skills ·
