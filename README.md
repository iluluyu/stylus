<div align="right">

[English](README.en-US.md) | 简体中文

</div>

# stylus

面向 AI 编码智能体的**学术写作、科研绘图与演示技能集**，遵循 [Agent Skills](https://agentskills.io/specification) 规范，适用于 Claude Code、Codex、Zed、dsh、zcode、opencode、pi 等兼容 Agent Skills 的智能体环境。

stylus 帮助科研人员**写清论文、画清方法、讲清研究**。各个技能均支持单独安装与独立使用；写作规范无额外运行时依赖，科研绘图支持 Python 与 Typst，设计画布基于原生本地编辑器，演示文稿支持 HTML 浏览与 PPTX 导出。

## 技能列表

| 技能 | 简介 | 适用场景 |
|---|---|---|
| [math-writing](skills/math-writing/) | 数学写作规范：涵盖定理证明散文结构、公式语法标点、记号一致性与四 C 审校标准。 | 撰写、修改、翻译或审校数学定理、证明推导与 LaTeX 论文草稿。 |
| [scientific-paper-writing](skills/scientific-paper-writing/) | 英文科研论文写作：融合 Whitesides 结构、Gopen & Swan 句式和曼彻斯特短语库，支持 Fast 与 Learn 双模式。 | 规划、起草、重构或润色高水平英文期刊论文（PRL、Nature 系列、PRX 等）。 |
| [scifig](skills/scifig/) | 出版级矢量科研绘图：Python (matplotlib) 绘制数据图，Typst 绘制方法图与排版拼版，内置自动检查并导出 SVG/PDF/PNG。 | 绘制期刊规格的数据图、算法流程图、方法总览图及多子图拼版。 |
| [design](skills/design/) | 原生科研构图画布：基于 claude-design (v2.12.1/7db9784)，用 `canvas.json` 与 `.dc.html` 构思方法示意与机理图，通过预编译本地编辑器预览与导出。 | 人机协同绘制论文 Figure 1、系统架构图、机理示意图与流程图。 |
| [slides](skills/slides/) | 科研演说幻灯片：基于 HTML `deck-stage` 构建清晰叙事的 16:9 演示文稿，支持本地预览与导出为 PDF 或可编辑 PPTX。 | 制作组会报告、学术会议演讲、学位答辩幻灯片及课件。 |

## 安装指南

整仓克隆后，根据所用智能体将所需技能软链或复制至对应的 skills 目录：

```bash
git clone https://github.com/iluluyu/stylus.git
cd stylus
```

### 1. 软链接至智能体（推荐）

以标准共享目录 `~/.agents/skills/` 为例（Codex、Zed、dsh 默认支持）：

```bash
mkdir -p ~/.agents/skills
ln -s "$(pwd)/skills/math-writing"              ~/.agents/skills/
ln -s "$(pwd)/skills/scientific-paper-writing" ~/.agents/skills/
ln -s "$(pwd)/skills/scifig"                   ~/.agents/skills/
ln -s "$(pwd)/skills/design"                   ~/.agents/skills/
ln -s "$(pwd)/skills/slides"                   ~/.agents/skills/
```

### 2. 单技能独立获取

如需单独提取某个技能，可直接复制或使用 `npx degit`：

```bash
# 复制现有目录
mkdir -p ~/.agents/skills
cp -r skills/math-writing ~/.agents/skills/

# 或无需克隆直接下载
mkdir -p ~/.agents/skills
npx degit iluluyu/stylus/skills/math-writing ~/.agents/skills/math-writing
```

### 常见智能体技能目录

| 智能体 | 技能目录路径 |
|---|---|
| Codex (OpenAI) / Zed / dsh | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| dsh (专属) | `~/.dsh/skills/` |
| zcode (Z.ai) | `~/.zcode/skills/` |
| opencode | `~/.config/opencode/skills/` |
| pi | `~/.pi/agent/skills/` |

## 依赖与快速使用

各技能按需索取运行时依赖：

- **math-writing / scientific-paper-writing**：纯 Markdown 工作流与参考规范，无环境依赖，安装后即可提示智能体直接加载。
- **scifig**：使用 Python（数据图表，如 `matplotlib`、`numpy`）与 Typst（方法示意与多面板拼版）；运行示例图校验：
  ```bash
  python skills/scifig/scripts/check.py skills/scifig/examples/fig_method.typ
  ```
  完整环境与字体依赖详见 [scifig SKILL.md](skills/scifig/SKILL.md)。
- **design**：需要 Node.js 20+，内置全套预编译编辑器，无需 `npm install`：
  ```bash
  node skills/design/scripts/artifact.mjs open skills/design/examples/research-canvas
  ```
- **slides**：需要 Node.js 22.18+。本地预览（访问 `http://127.0.0.1:4311/examples/research-deck/index.html`）：
  ```bash
  node skills/slides/scripts/serve.mjs skills/slides 4311
  ```
  PPTX 导出工具链依赖 Chromium 与 Playwright，使用前需在工具目录安装依赖：
  ```bash
  npm ci --prefix skills/slides/agents/gen-pptx
  npm exec --prefix skills/slides/agents/gen-pptx -- playwright install chromium
  npm run build --prefix skills/slides/agents/gen-pptx
  ```

## 内容来源

- **math-writing**：改编自 John M. Lee 的 *Guidelines for Writing Proofs*（华盛顿大学）及 Academic writing 四 C 审校标准。
- **scientific-paper-writing**：源自 Gopen & Swan 的 *The Science of Scientific Writing*、Whitesides 的 *Whitesides' Group: Writing a Paper* 与曼彻斯特大学 *Academic Phrasebank*。
- **design**：源自 [baoyu-design v2.12.1](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d) 的 `claude-design`，保留原生画布、本地编辑器与科研规范适配。
- **slides**：基于 HTML `deck-stage` 组件与本地独立 PPTX 导出工具链，参考同版本 `claude-slides` 演说规范。

## 许可证

本项目原创内容与整合工具代码采用 [MIT](LICENSE) 许可证；上游组件、编辑器快照与第三方库保留各自条款，详见 [design 来源说明](skills/design/PROVENANCE.md) 与 [slides 来源说明](skills/slides/PROVENANCE.md)。
