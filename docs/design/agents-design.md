# Agents 设计思路

## 功能 1：校对 Agent（Proofreader）

### 定位

校对 Agent 是一个**只读的设计审查者**，作用于“实现之前”或“设计完成后”。

它不修改代码，也不直接判断“代码是否满足需求”，而是检查：

- 当前设计（需求、方案、接口、数据流）本身是否正确、合理；
- 是否存在遗漏、矛盾、风险或需要特别注意的问题点。

### 与 Reviewer 的分工

| | Reviewer | Proofreader |
|---|---|---|
| 阶段 | 实现后 | 设计后 / 实现前 |
| 检查对象 | 已实现的代码 | 设计方案 |
| 核心问题 | “代码是否满足需求？” | “设计是否正确、合理、完整？” |
| 是否修改代码 | 否 | 否 |

### 设计要点

1. **输入**
   - Requirements：原始需求。
   - Design：设计文档、方案说明或接口草案。
   - Context（可选）：技术栈、约束、已有相关代码。

2. **输出**
   - 结构化 JSON：`status`、`reason`、`issues`。
   - `issues` 每项包含 `severity`（block/warning/info）、`category`（correctness/completeness/consistency/risk/maintainability）、`target`、`problem`、`suggestion`、`why_it_matters`。

3. **校对维度**
   - 正确性：设计是否满足需求核心目标，逻辑是否自洽。
   - 完整性：功能点、边界条件、异常处理是否遗漏。
   - 一致性：设计内部及与项目约定是否一致。
   - 风险：性能、安全、并发、可靠性风险。
   - 可维护性：是否过度设计，职责是否清晰。

4. **行为约束**
   - 只读不修改。
   - 基于实际文件内容，不凭记忆假设。
   - 聚焦设计层，不陷入具体代码实现细节。
   - 单次最多 10 条 issues。

### 实现位置

详细 prompt 见 `agents/proofreader.md`。
