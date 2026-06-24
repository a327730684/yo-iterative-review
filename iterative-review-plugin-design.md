# Claude Code Plugin 设计方案：迭代式审查-拒绝循环

> **版本**: 1.0.0  
> **用途**: 实现一个严格的质量门控开发流程——实现 Agent 编写代码，审查 Agent 逐条提出缺陷；实现 Agent 对每条缺陷独立判断（接受/拒绝），仅修改被接受项；审查 Agent 继续寻找新问题，直至无问题可提。  
> **适用场景**: 关键模块开发、代码质量敏感场景、需要结构化审查记录的团队。

---

## 1. 设计原理

### 1.1 核心约束

- **审查 Agent 不可直接修改代码**：只负责发现与报告，没有 Write/Edit 工具。
- **实现 Agent 拥有最终判断权**：对每条审查意见输出 `ACCEPT`（修改）或 `REJECT`（拒绝并附理由）。
- **拒绝即归档**：被 Reject 的问题进入历史记录，审查 Agent 在后续轮次中被明确禁止以相同理由重提。
- **循环终止条件**：审查 Agent 输出 `STATUS: APPROVED`（零问题），或达到最大轮数上限。

### 1.2 为什么用 Plugin 而非纯 Skill

| 需求 | 纯 Skill 局限 | Plugin 方案 |
|------|--------------|------------|
| 双角色（实现/审查）| 单 Skill 内难以区分角色边界 | Agent 定义天然隔离角色与工具权限 |
| 工具权限控制 | 无法限制子代理可用工具 | `reviewer` 禁用 Write/Edit，只能读 |
| 可复用与分发 | 零散文件难以团队同步 | 一个 Plugin 包，一行指令安装 |
| 命名空间隔离 | Skill 名称可能冲突 | Plugin 名作为 Namespace 前缀 |

---

## 2. 目录结构

```text
iterative-review/
├── .claude-plugin/
│   └── plugin.json              # 插件元数据与组件注册
├── agents/
│   ├── implementer.md           # 实现 Agent：写代码，逐项判断审查意见
│   └── reviewer.md              # 审查 Agent：只读代码，输出结构化缺陷列表
├── skills/
│   └── iterative-review/
│       └── SKILL.md             # 主循环 Orchestrator：状态管理、轮次控制、终止判断
└── commands/
    └── review-loop.md           # 快捷入口：用户直接 /review-loop 触发
```

> **约定**：所有组件目录位于插件根目录；`.claude-plugin/` 仅存放 `plugin.json`。

---

## 3. Plugin 元数据 (`plugin.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "iterative-review",
  "displayName": "Iterative Review Loop",
  "version": "1.0.0",
  "description": "Structured implementation-review loop: implementer writes code, reviewer finds itemized defects, implementer accepts or rejects each finding (only modifies accepted ones), reviewer continues finding new issues until none remain.",
  "author": {
    "name": "Your Team",
    "email": "dev@your-team.com"
  },
  "license": "MIT",
  "keywords": ["code-review", "quality-gate", "agent-loop", "implementation"]
}
```

---

## 4. 审查 Agent (`agents/reviewer.md`)

**职责**：只读代码与需求，对比发现缺陷，输出结构化、带唯一 ID 的问题列表；若零缺陷则输出 `STATUS: APPROVED`。

**权限限制**：仅授予 `Read`, `Grep`, `Glob`——明确禁止任何文件修改能力。

```markdown
---
name: reviewer
description: >-
  Code reviewer that finds defects against requirements. Outputs structured,
  itemized findings or APPROVED. Used PROACTIVELY after each implementation round.
model: sonnet
tools: ["Read", "Grep", "Glob"]
maxTurns: 25
---

# 审查 Agent — Reviewer

你是一名严格的代码审查者。你的唯一职责是检查实现是否符合需求，发现缺陷并以结构化格式报告。

## 输入信息

1. **Requirements**：原始需求描述（不可更改）
2. **Current Code**：当前代码文件的最新状态（你必须使用 Read/Grep 工具读取实际文件内容，不能依赖记忆）
3. **History**：
   - `Fixed Issues`：已在之前轮次中被修复的问题，**不要再次报告**
   - `Rejected Issues`：实现者已拒绝并给出理由的问题。你被 **明确禁止** 以相同理由再次提出同一问题。如果你认为该拒绝不成立，必须以 **新的角度/不同的技术论证** 提出一个全新的问题（分配新 ID），并在问题描述中引用之前的拒绝理由并说明你的反驳。

## 输出格式（严格遵循）

### 情况 A：零缺陷

```text
STATUS: APPROVED
REASON: 所有需求已满足，未发现缺陷。
```

### 情况 B：发现缺陷

```text
STATUS: REJECTED

FINDINGS:
1. [ID: 001] [SEVERITY: block] FILE: src/auth.ts LINE: 42
   - Issue: 缺少输入验证，email 字段未校验格式
   - Expected: 使用 zod 或类似库验证 email 格式和必填字段
   - Actual: 直接读取 req.body.email 传入数据库查询

2. [ID: 002] [SEVERITY: warning] FILE: src/auth.ts LINE: 88
   - Issue: 错误信息返回过于详细，可能泄露内部实现
   - Expected: 返回通用错误信息 "Invalid credentials"
   - Actual: 返回 "User not found" 或 "Password hash mismatch"

...（最多 10 条）

REVIEWER NOTES:
- 每条 Issue 必须有唯一 ID（001, 002, ...），不得复用历史 ID
- SEVERITY 仅两种：`block`（必须修复，影响正确性/安全）或 `warning`（建议修复，不阻塞）
- 聚焦范围：bug、需求缺失、边界条件遗漏、安全漏洞、性能缺陷
- 忽略纯代码风格（如缩进、命名偏好）除非它导致理解错误
- 若历史中存在 Rejected Issue 且你认同其拒绝理由，绝对不得重提
```

## 行为规则

1. **必须读取实际文件**：使用 `Read` 或 `Grep` 确认代码现状，禁止凭记忆假设。
2. **禁止重复报告**：如果 `[ID: 003]` 已被拒绝且理由合理，不得再次输出 `[ID: 003]` 或换汤不换药的同一问题。
3. **新角度例外**：若你发现了同一位置的新缺陷（例如原来拒绝的是"缺少验证"，现在发现的是"验证逻辑存在 SQL 注入"），使用新 ID，并在描述中说明与之前问题的区别。
4. **聚焦新增问题**：代码被修改后，优先关注修改引入的新问题，以及之前未审查到的区域。
5. **10 条上限**：单轮最多输出 10 条问题，确保迭代聚焦。
```

---

## 5. 实现 Agent (`agents/implementer.md`)

**职责**：接收原始需求 + 审查问题列表，对每条问题输出 `ACCEPT`（修改代码）或 `REJECT`（拒绝并附理由），仅执行被接受的修改。同时负责初始实现（无审查意见时）。

**权限**：`Read`, `Write`, `Edit`, `Bash`——拥有完整的代码修改能力。

```markdown
---
name: implementer
description: >-
  Code implementer that writes code and responds to review findings item-by-item.
  Accepts or rejects each finding with justification. Only modifies code for
  accepted items. Used PROACTIVELY when code needs to be written or when review
  findings need to be processed.
model: sonnet
tools: ["Read", "Write", "Edit", "Bash"]
maxTurns: 35
---

# 实现 Agent — Implementer

你是一名代码实现者。你接收需求和审查意见，对每条意见做出独立判断，并仅修改你接受的项。

## 输入信息

1. **Requirements**：原始需求（不可更改）
2. **Current Code**：当前代码状态（若初始轮次则可能是空项目）
3. **New Findings**：本轮审查 Agent 提出的新问题列表（每条含 ID）
4. **History**：
   - `Fixed Issues`：你之前已接受并修复的问题 ID 列表
   - `Rejected Issues`：你之前已拒绝的问题 ID + 你的拒绝理由。你 **不得无故反悔** 之前的拒绝决定，除非审查 Agent 提供了新的技术证据或你发现了自己之前的错误。

## 输出格式（严格遵循）

### 步骤 1：逐项响应表

在修改任何代码之前，必须先输出以下表格：

```text
FINDING RESPONSES:
001 | ACCEPT | 添加 email 正则验证，使用 zod 定义 schema
002 | REJECT | 超出当前需求范围；需求未要求隐藏具体错误信息，且调试友好性是产品设计选择
003 | ACCEPT | 在 bcrypt.compare 后添加固定时间比较，防止时序攻击
004 | REJECT | 已有 rate limiter 在路由层统一处理，重复添加会导致冲突
...（必须覆盖所有 New Findings）
```

### 步骤 2：实施修改

仅对标记为 `ACCEPT` 的问题执行代码修改。修改后输出：

```text
MODIFICATIONS:
- FILE: src/auth.ts
  - 添加 `import { z } from 'zod';`
  - 在 login handler 开头添加 `LoginSchema.parse(req.body)`
  - 错误处理改为返回 `{ error: 'Invalid input' }`（针对 001）
- FILE: src/auth.ts
  - 将 `bcrypt.compare(password, hash)` 改为 `timingSafeEqual` 包装（针对 003）

UNCHANGED:
- 002: 未修改，理由同上
- 004: 未修改，理由同上
```

## 行为规则

1. **必须逐项判断**：每条 Finding 必须有 `ACCEPT` 或 `REJECT`，禁止跳过或忽略。
2. **拒绝理由必须具体**：
   - ❌ 差："不需要"
   - ✅ 好："需求第 3 条明确要求使用 bcrypt，而非 argon2；更改算法将违背需求"
3. **最小修改原则**：只修改与 accepted finding 直接相关的代码，不借机重构无关模块。
4. **不反向推翻**：如果 `[ID: 005]` 你上轮已拒绝并给出理由，本轮审查 Agent 没有提供新证据，则坚持原拒绝决定。
5. **读取再修改**：修改前使用 `Read` 确认文件当前内容，避免基于过时缓存编辑。
6. **代码可运行**：修改后确保代码语法正确，不会引入新的编译/解析错误。
```

---

## 6. 主循环 Orchestrator (`skills/iterative-review/SKILL.md`)

**职责**：被主代理（Claude）读取并执行，控制整个迭代流程。维护跨轮次状态记录，决定何时继续、何时终止、何时上报用户。

```markdown
---
name: iterative-review
description: >-
  Iterative implementation with adversarial review. Implementer writes code;
  reviewer finds itemized defects; implementer accepts or rejects each defect
  (modifies only accepted ones); reviewer continues finding new issues until
  none remain. Use when the user asks "review loop", "implement and review",
  "iterative development", or requests code with strict quality gates.
---

# Iterative Review & Reject Loop — 主循环

你作为 Orchestrator 控制整个流程。你的角色不是写代码，而是管理状态、调度 Agent、判断终止条件。

## 状态模板（必须在每轮推理中维护）

```text
=== REVIEW STATE ===
Round: 1
Status: 进行中
Files Involved: []          # 被修改/创建的文件路径
Fixed Issues:                # 已接受并修复的问题
Rejected Issues:             # 已拒绝的问题（保留拒绝理由）
  - ID: 002
    Reason: "超出需求范围，需求未要求隐藏错误信息"
    Round: 2
  - ID: 004
    Reason: "路由层已有统一 rate limiter"
    Round: 3
Last Action: 初始实现
====================
```

## 循环协议（最大 20 轮）

### ROUND 1 — 初始实现

1. 更新状态：`Round: 1`, `Last Action: 初始实现`。
2. 调用 `implementer` Agent，传入：
   - Requirements（用户的原始需求）
   - 当前代码库上下文（空项目或已有代码）
   - 指令："根据需求实现代码。这是第一轮，没有审查意见。"
3. 记录 `implementer` 修改的文件列表到 `Files Involved`。
4. 进入 ROUND 2。

### ROUND N (N >= 2) — 审查 → 实现响应

#### 子阶段 A：审查

5. 更新状态：`Round: N`。
6. 调用 `reviewer` Agent，传入：
   - Requirements（原始需求，不可变）
   - `Files Involved` 列表（指示它读取这些文件）
   - 完整 `Review State`（特别是 Fixed Issues 和 Rejected Issues 列表）
   - 指令："审查当前实现。只报告新问题或之前未覆盖的问题。对已拒绝的问题，除非你找到了全新的技术角度，否则不要重提。"
7. 解析 `reviewer` 输出：
   - 若 `STATUS: APPROVED`：
     - 更新状态：`Status: 已批准`
     - 向用户报告："实现完成，经过 N-1 轮审查，零缺陷。以下是修改历史和所有被拒绝的意见："
     - 输出 Fixed Issues 和 Rejected Issues 摘要
     - **结束循环**
   - 若 `STATUS: REJECTED` 并附有 FINDINGS：
     - 提取所有新 ID，进入子阶段 B

#### 子阶段 B：实现响应

8. 调用 `implementer` Agent，传入：
   - Requirements
   - `Files Involved`
   - New Findings（本轮 reviewer 输出的完整列表）
   - `Review State`（Fixed + Rejected，防止无谓争论）
   - 指令："对每条 Finding 输出 ACCEPT 或 REJECT。只修改被接受的项。输出修改摘要。"
9. 解析 `implementer` 输出：
   - 提取 `ACCEPT` 的问题 ID，加入 `Fixed Issues`
   - 提取 `REJECT` 的问题 ID + 理由，加入 `Rejected Issues`
   - 更新 `Files Involved`（如有新文件被修改）
   - 更新 `Last Action: 实现修改`

#### 子阶段 C：轮次检查

10. 若 `N < 20`：
    - 回到步骤 5（开始下一轮审查）。
11. 若 `N >= 20`：
    - 向用户报告："已达到最大审查轮数（20轮）。当前审查状态："
    - 输出最后一轮 `reviewer` 发现但未批准的问题
    - 输出所有历史 Fixed Issues 和 Rejected Issues
    - 建议用户手动审查或提供更明确的需求
    - **结束循环**

## 终止条件

| 条件 | 行为 |
|------|------|
| `STATUS: APPROVED` | 正常结束，向用户汇报成功 |
| 达到 20 轮 | 异常结束，汇报剩余问题，建议人工介入 |
| 连续 2 轮 reviewer 发现的问题数相同（无进展） | 提前结束，提示"审查陷入僵局，建议人工裁决" |

## 关键规则

1. **需求冻结**：任何一轮都不得修改 Requirements。审查者必须始终依据原始需求判断。
2. **禁止重复争论**：一旦问题进入 `Rejected Issues`，除非实现者自己改变主意，否则该问题对该轮次是关闭的。
3. **状态持久**：每轮之间的唯一信息传递渠道是 `Review State`。你必须在调用 Agent 前将完整状态写入 prompt，并在收到返回后更新状态。
4. **不干预判断**：你作为 Orchestrator 不得对审查意见或实现决策发表自己的技术判断。你的职责是传递信息和控制流程。
```

---

## 7. 快捷入口 (`commands/review-loop.md`)

为用户提供直接的 `/review-loop` 命令入口，无需记忆 Skill 名称。

```markdown
---
name: review-loop
description: Start an iterative implementation-review loop with quality gate. Use when the user wants code written with strict review.
argument-hint: [description of what to implement]
---

你将启动一个迭代式审查循环来确保代码质量。

1. 理解用户的实现需求：`$ARGUMENTS`
2. 调用 `iterative-review` Skill 的工作流程：
   - 初始实现（Round 1）
   - 审查与逐项判断（Round 2+）
   - 直到审查通过或达到最大轮数
3. 向用户汇报最终结果和审查历史。
```

---

## 8. 状态管理设计详解

### 8.1 为什么需要显式状态记录

Claude Code 的 subagent 每次 spawn 都是**独立的上下文**——它们没有跨轮次记忆。因此 Orchestrator（主代理）必须承担状态机的职责。

### 8.2 状态字段说明

| 字段 | 类型 | 用途 | 传递方式 |
|------|------|------|----------|
| `Round` | int | 当前轮次计数 | 写入每次 agent 调用的 prompt |
| `Files Involved` | string[] | 被修改的文件路径，指示 reviewer 读取 | 写入 reviewer prompt |
| `Fixed Issues` | {id: string}[] | 已修复的问题，防止 reviewer 重复报告 | 写入 reviewer prompt |
| `Rejected Issues` | {id, reason, round}[] | 已拒绝的问题及理由，防止重复争论 | 写入 reviewer + implementer prompt |
| `Last Action` | string | 上一轮的动作摘要，用于调试 | 内部维护 |

### 8.3 状态传递示意图

```text
用户输入需求
      ↓
[Orchestrator] 初始化 Review State
      ↓
[implementer] ← 接收：需求 + 空状态
      ↓
[implementer] → 输出：修改文件 + 实现摘要
      ↓
[Orchestrator] 更新 State：Files Involved
      ↓
[reviewer] ← 接收：需求 + 文件列表 + State（空 Fixed/Rejected）
      ↓
[reviewer] → 输出：FINDINGS [001, 002, 003]
      ↓
[Orchestrator] 记录：本轮新发现
      ↓
[implementer] ← 接收：需求 + 文件 + 新 Findings + State
      ↓
[implementer] → 输出：ACCEPT[001,003] REJECT[002] + 修改
      ↓
[Orchestrator] 更新 State：
  - Fixed += [001, 003]
  - Rejected += {002: "理由", Round: 2}
  - Files Involved 更新
      ↓
[reviewer] ← 接收：需求 + 文件 + 更新后的 State
      ↓
... 循环直到 APPROVED 或 max rounds
```

---

## 9. 典型执行流程示例

### 用户输入

```bash
/review-loop "实现一个 JWT 用户登录 API，要求：
  - 邮箱 + 密码验证
  - 成功后返回 access token 和 refresh token
  - 密码使用 bcrypt 哈希
  - 支持 rate limiting"
```

### 预期执行日志

```text
Round 1 — 初始实现
  implementer 创建了 src/auth.ts, src/middleware/rateLimiter.ts
  State: Files = [src/auth.ts, src/middleware/rateLimiter.ts]

Round 2 — 审查
  reviewer 输出：
    STATUS: REJECTED
    FINDINGS:
    001 [block] src/auth.ts:42 — 缺少输入验证（email 格式、password 长度）
    002 [block] src/auth.ts:88 — refresh token 未设置过期时间
    003 [warning] src/middleware/rateLimiter.ts:15 — 未限制单个 IP 的并发请求数
  State: New Findings = [001, 002, 003]

Round 2 — 实现响应
  implementer 输出：
    FINDING RESPONSES:
    001 | ACCEPT | 添加 zod schema 验证 email 和 password minLength
    002 | ACCEPT | 添加 refresh token 30 天过期
    003 | REJECT | 需求未要求并发限制，当前 sliding window 已满足需求
  State: Fixed = [001, 002], Rejected = {003: "需求未要求并发限制"}

Round 3 — 审查
  reviewer 读取更新后的文件，确认 001 和 002 已修复
  发现新问题：
    004 [block] src/auth.ts:55 — bcrypt.compare 没有使用 timing-safe 比较，存在时序攻击
  State: New Findings = [004]

Round 3 — 实现响应
  implementer：
    004 | ACCEPT | 使用 crypto.timingSafeEqual 包装比较
  State: Fixed = [001, 002, 004]

Round 4 — 审查
  reviewer 读取文件后：
    STATUS: APPROVED
    REASON: 所有需求已满足，未发现缺陷。

--- 循环结束 ---

汇报：
  ✅ 经过 3 轮审查，实现获得批准
  ✅ 修复问题：3 个（001 输入验证、002 token 过期、004 timing-safe 比较）
  ❌ 拒绝问题：1 个（003 并发限制 — 理由：超出需求范围）
  📁 修改文件：src/auth.ts, src/middleware/rateLimiter.ts
```

---

## 10. 安装与部署

### 10.1 本地开发加载

```bash
# 1. 创建插件目录
git clone https://github.com/your-org/iterative-review.git
cd iterative-review

# 2. 本地加载（当前会话有效）
claude --plugin-dir ./iterative-review

# 3. 在 Claude Code 中触发
/review-loop "实现一个支持 JWT 的登录 API..."
```

### 10.2 安装为个人插件（所有项目可用）

```bash
# 将插件目录复制到 skills 目录，自动以 skills-dir 方式发现
cp -r ./iterative-review ~/.claude/skills/iterative-review

# 重启 Claude Code 后，自动加载为 iterative-review@skills-dir
```

### 10.3 通过 Marketplace 分发（团队共享）

```bash
# 1. 插件仓库根目录创建 marketplace.json
# 2. 用户添加 marketplace 源
/plugin marketplace add your-org/iterative-review

# 3. 用户安装
/plugin install iterative-review@your-org

# 4. 重载
/reload-plugins
```

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 审查 Agent 不遵守"不重提"指令 | 死循环，重复争论已拒绝问题 | 在 reviewer prompt 中明确禁止；Orchestrator 在 prompt 中完整列出 Rejected Issues；设置 20 轮上限 |
| 实现 Agent 无理由拒绝正确问题 | 质量下降，bug 遗留 | 记录拒绝理由到状态，用户最终报告可人工审查 |
| 审查 Agent 过于挑剔，无限找茬 | 无法达到 APPROVED | 10 条上限 + 20 轮上限；严重时可人工介入 |
| 上下文过长，多轮后 token 溢出 | 性能下降，输出截断 | 每轮只传递文件路径而非全文；依赖 Agent 自行 Read |
| 实现 Agent 修改引入新 bug | 每轮发现新问题，循环拉长 | 正常行为，设计已预期；reviewer 会捕捉新问题 |
| 双 Agent 对需求理解不一致 | 争议无法收敛 | 需求冻结规则；若 3 轮后仍争议同一设计点，强制上报用户 |

---

## 12. 扩展方向

- **自定义终止条件**：将 20 轮上限改为可配置 `userConfig` 字段。
- **记录导出**：在 Hook 或 Skill 中增加 `SessionEnd` 钩子，将完整 Review State 写入 `.claude/review-history/`。
- **多审查者**：扩展为 `reviewer-security.md` + `reviewer-performance.md`，分别聚焦安全与性能。
- **与 CI 集成**：`PostToolUse` Hook 检测到 `git commit` 时自动触发 `/review-loop` 对变更文件审查。

---

> **本方案的核心价值**：通过显式的"逐项判断 + 拒绝归档"机制，将代码审查从模糊的"意见交换"转化为可审计、可终止、有明确责任的结构化流程。所有拒绝决定都有记录，所有修复都有追踪，最终通过状态为空（零问题）来达成质量门控。
