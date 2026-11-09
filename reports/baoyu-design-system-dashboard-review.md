# 独立引入设计系统与实验看板，先验权利与价值

**BLUF：design-system 值得作为可选的视觉规范管理工具，不值得为了“科研素材库”而安装；dashboard 更值得优先做独立科研试点，但只能定位为结果探索与展示层。** 前者实际提供编辑器、Ember 咖啡品牌示例和 Seazar token 样本，并没有已核实的专业科研图库；后者提供文件数据、计算登记、交互与 Sources 追溯底座，科研图表和统计口径仍需编写与核验。建议将两者列为独立候选，权利明确后分别试点，**不立即整包公开分发，不让 dashboard 等待 design-system，也不先改 design**。基线是研究确认的最新 **v2.12.1 / `7db9784`**，完整 SHA 为 `7db9784ac4f4974d78ab166c7db1c706c0481c3d`；v1.3 仅为历史，不是本次比较目标。([固定版本](https://github.com/JimLiu/baoyu-design/commit/7db9784ac4f4974d78ab166c7db1c706c0481c3d)) **本轮仅综合源码／文档审查，没有安装、启动或测试两项新 skill**；下文“支持”表示有契约或源码依据，不表示运行验收通过。

## 一、随包素材主要演示设计系统，不补齐科研图库

回答“给了哪些素材”必须区分物理文件、JSON 内嵌示例、编辑器资源与截图。这里的设计 token 是颜色、字号、间距等命名参数，不等于已经绘制好的素材。design-system 主目录共 **19 个物理文件、4,506,034 B**，其中 editor 子树 3,821,621 B；体积主要用于运行工具，并不是四兆多科研图片。Ember 的逻辑文件嵌在 `artifact-type/demo.json` 内，不能再作为新增物理文件重复计数。([固定技能树](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/))

| 素材类别 | 实际附带内容 | 决策含义 |
|---|---|---|
| Ember 文件与组件 | `demo.json` 内嵌 **19 文件**：根 README、tokens.json、manifest.json；Icons/Logos 各一 README；3 SVG；Button/Badge 各 README 与 preview；Cover preview；bundle.js/css、index.d.ts、src/index.tsx；React/ReactDOM 两运行库。真正组件为 **Button、Badge**，Cover 是封面预览，不是第三个组件。 | 可学习格式、组件打包与用法，不是科研 UI 套件。([Ember](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/artifact-type/demo.json)) |
| Ember 图形、字体、照片 | `cup.svg`、`ember-mark.svg`、`ember-wordmark.svg` 共 **3 SVG**；没有独立照片文件或 fonts 路径，`type.fonts=[]`；字标是系统 sans 栈的文本，不是字形轮廓。 | 有杯子和品牌标识，不附文字字体包、仪器照片或科学符号库。([Ember](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/artifact-type/demo.json)) |
| Ember token | **11 个颜色 token、5 个间距 token、3 个圆角 token、3 个阴影 token**，明暗两主题，sans/mono 系统栈与 5 个文字样式；颜色包括 surface、ink、ember、leaf、link 等 UI 语义。 | 是咖啡品牌视觉示例，不是已验证的论文分类调色板。([Ember](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/artifact-type/demo.json)) |
| Seazar 样本 | `sample-seazar-tokens.json`：**21 个颜色 token、5 个间距 token、3 个圆角 token、2 个尺寸 token、3 个阴影 token**，明暗／高对比三主题、5 文字样式；字体数组为空，含 Okabe–Ito 状态色用法。 | 是 token 参考，不是完整系统、图表或字体资源包。([Seazar](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/artifact-type/reference/sample-seazar-tokens.json)) |
| Nimbus 与根目录图片 | README 的天气 app 系统 Nimbus 是截图；根 assets 有 6 张 WebP 展示图、2 个 PPTX 流程 SVG，未找到可安装的 Nimbus 系统目录。 | 展示效果不等于附带其 tokens、组件和字体原件。([展示说明](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/README.md#L66-L70)、[图片树](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d/assets/)) |
| 编辑器 UI 与 catalog | 外置 Anthropicons-FizzyLake WOFF2 36,864 B，CSS 另嵌 Anthropicons-Variable 34,628 B；相邻 claude-design 的 Google Fonts catalog 是 **1,773 个家族名称**及相关元数据。 | UI 图标字体不是科研图库；名称目录不是已下载字体，更不是整库出版授权。([UI CSS](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/scripts/editor/assets/index-P4rxb6lX.css)、[字体目录](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design/artifact-type/reference/google-fonts-families.json)) |

Ember 是 **worked example，不是已证实一键可导入的完整原生系统**：demo 外层为 title/content/comments，content 仅含 v/files；19 个逻辑文件没有当前本地要求的 `design-system.json`，也没有实际 `tokens.css` 条目，虽然 manifest 列举了后者。能否直接导入未实测，须经物化和索引契约验收；参考明确要求不要直接重新发布该示例。([本地文件契约](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L23-L63)、[示例使用边界](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/artifact-type/reference/from-code.md#L129-L132)) 已核查文件树与示例**没有提供可直接调用的仪器、生物医学、数学节点或论文 panel 素材库**；旧 archive 的 chart-stage、watercolor-kit 等另属归档内容，不能冒充当前系统模板，也不据文件名推定兼容。([归档树](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d/archive/baoyu-design/starter-components/))

**我们不需要把 Ember 的杯子、品牌标识和按钮风格放进默认科研产物。** 它们适合当格式与预览示例；Seazar 适合参考参数组织；UI 字体仅随原生编辑器保留，不抽作科研图库。真正需要补建的，是我们自己的方法配色、文字层级、科研节点与连线规范，以及来源和权利明确的领域素材；这些是未来原创工作，不是引入后自动获得的功能。

它的价值因此是**管理有权使用的资源与视觉规则**，不是采购素材。机构 logo、照片、字体和领域 SVG 应由用户提供，或经明确授权导入；无来源时 Agent 新写 token、Cover 或图形属于新增工作，“可创建”不能写成“已附带”。单篇论文的字号、颜色和 panel 参数留在项目即可；跨项目反复维护这些规范时，design-system 才值得承担独立工具的维护成本。([创建与来源规则](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L132-L154))

## 二、两项 skill 各交独立项目，互操作只走显式副本

**用户硬约束，不是已验证的上游事实：**未来 `skills/design-system` 与 `skills/dashboard` 必须各自独立安装、运行、测试；没有嵌套 SKILL，不跨兄弟目录调用脚本或资源，不强制读取／加载其他 skill，不建立共同 runtime、根级 profile 包或总控。运行时和必要测试依赖由各自声明、自包含；复制一份自身后应能工作，即使另一项及现有 design/slides/scifig 全部不可访问。这里的目录名是建议，并非已经实施。

| 独立候选 | 触发与责任 | 独立交付及明确不负责的部分 |
|---|---|---|
| design-system | 创建／维护可复用视觉规范、合法资产和组件说明；已有 `design-system.json` 时修订该项目。 | 交 `project/design-system.json`、tokens、README、预览及实际使用的组件／字体／blob；CSS、manifest、API cards 只有生成后才列入交付。不是论文图编译器。([原生结构](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L49-L63)) |
| dashboard | 把现成结果文件做成可探索、可追溯页面；已有 db/store 时维护该看板。 | 交 `db/<collection>/<id>.json`、附件、页面脚本、来源／公式／更新说明及可编辑项目备份；`src/` HTML 仅是工作副本，不能替代 store。不是实验 runner。([原生结构](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L20-L93)) |

可选互操作仅接受**用户显式指定文件，校验后导入当前项目副本**，登记源版本／hash、导入时间及转换规则；重开只读副本，源文件更新必须明确重新导入。dashboard 可将导入的视觉值映射至 `dash/look`，但该机制只取受校验的颜色、字号、圆角和字体栈，`system` 是备注，不能加载 DS 组件、字体文件或建立同步。([映射边界](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/artifact-type/reference/design-system.md#L18-L161))

现有 design 的原生消费需要项目内 `ds/` 副本和 canvas 索引记录，不是链接编辑器网页；现有本地说明仍有云端文案覆盖不足，**只列为以后可选集成问题，不是任一新 skill 的前置任务**。([本地消费参考](../skills/design/artifact-type/reference/design-system-components.md#L7)、[固定上游本地覆盖](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design/SKILL.md#L132-L140)) slides 保持 deck-stage/PPTX 路线，既不迁移 runtime，也不成为新增依赖；scifig 的 Python/Typst、palette、规范、源码与兼容指针全部**零改动**，严格定量图继续遵循其自身流程。([slides 边界](../skills/slides/PROVENANCE.md#L20)、[scifig 契约](../skills/scifig/SKILL.md#L34))

## 三、dashboard 值在结果追溯，正确性与出版导出不能外包

上游本地数据入口是 **CSV/TSV/JSON 文件**：Agent 自行取数、转换、upload，再登记 dataset；不是页面直接连接数据库／API。替换附件并更新同一 dataset 的 source 与时间元数据后，页面订阅更新；`schedule` 是说明，`staleAfterHours` 是陈旧提示，均非定时任务。参数状态、重画、calc 登记和 d3 helpers 已有底座，筛选控件、联动逻辑、收敛／消融图、缺失处理和实验语义仍由 Agent 编写。它不是“选图即得科研模板”，`runs/pageCheck` 也是页面诊断而非实验执行日志。([数据、API 与本地限制](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md)、[d3 范围](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/artifact-type/reference/design-defaults.md#L244-L271))

**Sources 能解释“这项输出引用了什么”，不能保证“结论正确”。** `data-source/field/where/row` 等标记可关联文件、行、单格；calc 可展示输入与函数。仅标整个图的来源不等于每个点自动具有完整 lineage；上传预聚合表也不能恢复未附的逐 seed 日志。blob hash 标识附件字节，不认证实验真实性；更新时间、作者名也不是签名。CSV 数值须自行转换，缺失值不能转成零，UI 过滤更不是行级权限。([计算与标记契约](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L130-L271)、[blob 实现](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/scripts/artifact.mjs#L4050-L4107))

**Stylus 自建建议，尚不存在：**以优化算法多种子结果为首例，外部完成实验后导出 runs 长表、observations 长表及 metadata sidecar，记录 run_id、数据／代码版本、seed、状态、指标方向、单位和预算。按 dataset×method×metric 分组；显示失败数与有效 n，收敛按 evaluation 或 wall time 明确对齐，消融区分配对与非配对比较。简单计算登记 calc，复杂区间／检验外部预计算并保存输入 hash 和公式；不把多个时间点当独立重复，不用最好 seed 代表方法。这些是科研适配与验收要求，不是上游现成功能。

| 导出层次 | 当前证据与不可越界的承诺 |
|---|---|
| 数据与可编辑项目 | Sources CSV、whole-folder ZIP／CLI archive 有文档契约，但本轮未下载或恢复验证。([CSV](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/artifact-type/reference/design-defaults.md#L225-L233)、[ZIP](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L29-L42)) |
| 静态 handoff | bundle 有 JSON manifest＋静态 HTML 路径，含冻结数值、裁剪行为／样式和 canvas/img 光栅化逻辑；**未证实本地 UI 可达或下载成功**，不能宣传为已验证导出。([对应 bundle](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/scripts/editor/assets/index-qXbVz6oJ.js)) |
| 出版或跨产品 | 未确认论文级 SVG/PDF/EPS、字体嵌入、300 DPI 保证；文档的跨产品 export 是借目标 connector 重建，不是一键迁移。([导出说明](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/artifact-type/reference/exporting.md)) |

因此推荐它服务**规模可控、已完成实验的组会探索与项目复盘**；不推荐承载训练日志流、GPU 调度、超参搜索、统计推断或论文矢量母版。DS 自身也有格式边界：tokens.json 使用特定列表结构，不可把 DTCG/W3C `$value` 文件直接当原生输入；CSS/cards 属生成物，组件预览成功也不证明兼容其他消费 runtime。([DS 格式](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L49-L125))

## 四、包体可接受，混合许可与数据边界才是硬门槛

DS 的约 **4.30 MiB** 与 dashboard 的 **25 文件、4,389,126 B，约4.19 MiB** 都不是主要障碍，且不是 RAM、启动或吞吐指标。前者基础调用需 Node 20+，后者 Node 22+；编辑器已预构建，dashboard 基础运行无需 npm 安装，仍需浏览器与 localhost 权限。DS 导入外部组件才另涉 npm、peer、esbuild 与执行代码风险，不应混同基础依赖。([DS 调用](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L157-L166)、[dashboard 树及调用](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard)、[组件导入](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L221-L236))

dashboard 每附件上限 **15 MiB**、每 JSON 文档 **256 KiB**，批量最多 50 writes、累计 1 MiB；大型轨迹应在外部可复现汇总，而非拆成大量碎片伪装实时分析引擎。多文档写入先校验再逐文件落盘，不能等同数据库崩溃事务；多人编辑也需防覆盖。([写入限制与实现](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/scripts/artifact.mjs#L3790-L4050)、[并发边界](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L457-L486))

**保留 NOTICE 是归属与条件记录，不是新增授权。** 上游区分维护者原创本地工具的 MIT、Anthropic 改编说明／references／编辑器／Anthropicons，以及第三方各自许可；NOTICE 明言本项目不授予相关 Anthropic 材料许可。不能以 MIT badge、公开下载、注明来源或保留 NOTICE 代替打包／再分发权利确认，也不据此直接作所有法域的违法结论。两项应分别完成权利清单；未澄清前不把相关材料复制进 Stylus 发布包。([NOTICE](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/NOTICE.md))

本地也不等于保密：附件明文保存，archive 含历史与评论；持有文件夹者可读原始数据。LAN 分享为明文 HTTP、角色链接可转发，还需考虑 tailnet 可达范围；应默认不开分享／hook，仅上传最小脱敏数据。dashboard 用户页面的无外网、无 modules/React/storage 等沙箱规则，不等于整个运行壳或 Agent 工作流无外传；模型上下文、工具与日志需另审。([文件与页面规则](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L130-L257)、[共享规则](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md#L409-L450))

维护建议是**技术素材、原生格式、runtime/editor/reference 尽量完整保留，精简自写入口说明，不裁剪 editor bundle**；各 skill 各存来源 pin、文件 hash manifest、原创差异与许可证，升级各自回归，不共享运行资源、不全仓盲升。预编译降低安装成本，却增加审计与修复难度；hash 只证明对应 pin，不证明安全。模型费用、修复轮数与资源消耗应在试点记录，不编造绝对人天或零成本承诺。

## 五、分阶段独立试点，以各自验收决定保留或撤回

以下是 **Stylus 建议方案与未来测试，不是本轮结果**。准备阶段分别确认权利、pin、目录命名和各自依赖；某项权利或技术受阻，只暂停该项，不阻塞另一项。两项独立合成试点可并行；若只能选一个，优先 dashboard，因为它直接检验现有实验结果的比较与解释收益。DS 只有在确有跨项目规范维护需求时再投入，不以增加一个颜色配置文件作为立项理由。此阶段不改 design、slides 或 scifig，不安装外部组件库，不生成所谓已完成的科研 profile。

| 独立验收对象 | 必须取得的证据 | 拒绝或撤回条件 |
|---|---|---|
| 两项各自的隔离安装 | 干净环境只暴露当前 skill，按其 Node／测试依赖完成安装、运行、检查；工具记录中读取其他 SKILL、跨兄弟目录取资源次数为零，不借用兄弟 skill 的 runtime、node_modules 或缓存补缺；正常声明的 Node/npm 依赖不受此限制。manifest 与完整 notices 分别核对。 | 缺 sibling 就失败、必须先装另一 skill、隐藏软链或权利未清，均停止相应发布。 |
| design-system 独立项目 | 自建最小视觉系统，合法原生索引＋tokens＋README＋Cover；编辑→磁盘→reload，验证未知字段保留、主题显示与生成 CSS/cards。若使用 Ember 参考，明确物化过程，不假定 demo 自带索引；错误 token／DTCG 形状有告警或拒绝。 | token 静默丢失、生成文件失效、预览无法重开或项目依赖外部原件，暂停 DS；不先要求 design 消费成功。 |
| dashboard 独立结果页 | 仅用默认 look、自带合成数据跑 store 读写、筛选／reset、刷新、Sources 与独立数值期望对照；空、错、加载中不显示旧成功结果；CSV 重读、archive 移到另一绝对路径后重开一致。 | 数值或来源错误、失败 seed 被隐去、数据更新残留、不可恢复，停止该看板交付；无需 DS、dataviz 或 scifig 参与测试。 |
| 每项可选文件导入 | 用户指定数据／样式后生成项目副本和 hash；移走或修改原件、移动项目，旧项目仍独立运行，直到明确重新导入；无法读取时明报错，不搜索其他 skill 补齐。 | 回读源目录、热链接、自动同步或把导入文件当指令，撤回该导入功能，不伪称独立。 |

静态 `check` 不代替上述浏览器与数值验收：DS 的 check 不证明生成文件／预览可渲染；dashboard 可能出现尚未运行页面检查的 notChecked 分支，不能以 problems=0 宣称页面正确。后续须另获执行授权，保存实际 Node／浏览器版本、诊断与操作记录，才能标记通过。([DS check 边界](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-design-system/SKILL.md#L157-L166)、[dashboard 检查实现](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/scripts/artifact.mjs#L4900-L4996))

建议的 dashboard 黄金 fixture 为明确标注 synthetic 的两数据集×两方法×三 seed×四 step，共 48 行曲线、12 行最终结果。令 loss 为数据集偏移（A=0、B=10）＋方法偏移（baseline=2、improved=0）＋seed 偏移（−0.5、0、0.5）＋step 值（8、4、2、1）。验收目标是 A 最终均值 3／1，各 n=3、样本 std=0.5，改进差值 −2；B 整体加 10，不能被错误混入 A。预期值须由独立验证脚本复算；这些是拟定输入与目标，不是已经创建或测试的数据。再以重复 key、空值、NaN、失败 run、单位冲突做负例，检查提示与来源定位。首轮不做显著性检验，先证明最基本的数值诚实。

通过后各自进入小范围真实项目 opt-in，记录实现／修复轮数、模型成本、打开与刷新耗时、峰值内存和产物大小，再决定是否常规保留。可选视觉导入放在基本功能之后；design 本地说明补充若另立项目，应单独验收，slides 映射不在本次新增依赖链中，scifig 保持零改动。未来实施验收应检查存量文件差异与指纹，不能把旧测试记录当本轮已跑回归。

撤回也按项执行：恢复**工具 pin 与用户项目内容两层基线**，撤下该新增 skill 的安装链接，关闭其共享并停止自有服务；保存可读数据与原生备份，不删除用户项目，不要求其他 skill 降级。archive 含历史／评论，需按数据保留要求处理；关分享无法收回已被复制的文件。([备份与共享契约](https://github.com/JimLiu/baoyu-design/blob/7db9784ac4f4974d78ab166c7db1c706c0481c3d/skills/claude-dashboard/SKILL.md))

**仍待关闭的 Gaps：**混合许可的具体可分发范围；两项真正独立安装与原生 round-trip；Ember 物化／索引；字体与组件兼容；浏览器、容量和性能；离线抓包、角色权限与恶意输入防护；dashboard 静态 handoff 的本地入口及效果；出版矢量／分辨率质量。审查只对压缩 bundle 做有限静态取证，未完成全代码安全审计、第三方许可逐项核验或可复现构建验证；本轮没有运行这些测试，不能写为通过。静态 handoff 未证实不阻断文件型科研探索试点，但不允许对外交付相应导出承诺。

## 结论

值得投资的不是“再加一个素材目录”，而是减少规范漂移和缩短结果核对链。**先给 dashboard 一个不依赖任何其他 skill 的小型验证机会；design-system 按实际复用需求单独评估，权利未明则均不公开打包。** 只有在原件不可访问、兄弟 skill 不存在时仍能打开、解释与验证产物，才算取得独立工具的收益；否则只是把依赖藏进了漂亮界面。专业科研素材与出版级母版仍是独立缺口，不能用编辑器截图、来源面板或 ZIP 交付掩盖。
