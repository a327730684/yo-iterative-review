---
name: yo-dev-xxl
description: 完成一个较大功能开发时，首选此skill
---

# Your task

1. 大概理解业务需求，提供列表要求用户选择可用的agent作为subagent。主要提供三类agent:
    - 功能设计agent
    - 前端agent
    - 后端agent
    
    每类agent选择列表最后一项是系统默认agent(以便无可用agent时可使用系统默认)。
    注意：如果系统prompt中有明确告知，比如后端开发，请使用agentA时，则该类可以直接用它，不必再询问用户。

2. **文档目录**：在 {project_dir}/.claude/voyo_dev/{yyyy-MM-dd}-{feature_name}/目录下，构建本次开发的文档目录，并于其下创建以下文件：
    - feature.md 记录用户的原始需求，记录使用了哪些agent（新建，写入），写入你的管理进度。
    
        管理进度模版：
        ```
        agent提醒: 注意阅读 `yo-dev-xxl` skill , 明确你当前的管理的进度位置。

        - 管理进度1: [ ]设计功能点文档 
        - 管理进度2: [ ]设计开发计划文档
        - 管理进度3: [ ]实现功能开发
        - 管理进度4: [ ]代码review
        - 管理进度5: [ ]功能测试

        ```
        这里只写入这个模版，用以指导你管理后续的开发进度。

    - spec.md 需求整体设计，功能点文档（只新建，暂不写入）
    - plan_{backend|frontend}.md 开发的计划文档（只新建，暂不写入）, 分别对应后端和前端的开发计划。 若存在后端或前端时，则只创建对应的计划文档。
    - test-plan_{backend|frontend}.md 测试计划文档（只新建，暂不写入）, 规则同上。

3. 安排 `功能设计agent` 根据提供的需求，完成 `spec.md` 文件。要求：
    - `功能设计agent`，只返回完成或失败，不返回额外信息。
    - 完成后，提供文档地址，要求用户查阅，并等待用户确认。
    - 用户确认后修改feature.md文件，将**管理进度1**的[ ]替换为[x]。

4. 安排 `前端/后端agent` 根据 `spec.md` 文件，完成 `plan_{backend|frontend}.md` 和 `test-plan_{backend|frontend}.md` 文件。要求：
    - plan_{backend|frontend}.md 文件的设计要求:
    ```
    - 将spec.md中的计划，拆解为任务。
    - 任务拆分大模块，每个大模块下再拆分为若干**小功能**。用 markdown checkbox 记录进度。
    - 每大功能及其下的小功能的 checkbox 初始状态为未完成。
    如：
    - 功能1
        - [ ] 子功能1
        - [ ] 子功能2
    - 功能2
        - [ ] 子功能3
        - [ ] 子功能4
    ```
    - test-plan_{backend|frontend}.md 文件的设计要求:
    ```
    - 基于 spec.md 中的功能点，编写测试用例。
    - 测试用例按大模块组织，每个大模块下包含具体用例。用 markdown checkbox 记录执行结果。
    - 用例描述需包含：测试目标、操作步骤、预期结果。
    如：
    - 功能1
        - [ ] 用例1: {测试目标} | 操作: {操作步骤} | 预期: {预期结果}
        - [ ] 用例2: {测试目标} | 操作: {操作步骤} | 预期: {预期结果}
    ```
    - `前端/后端agent`，只返回完成或失败，不返回额外信息。
    - 完成后，你亲自将**管理进度2**的[ ]替换为[x]。

5. 安排一个 **监管agent**(dev-supervisor), 让它创建 代码agent`前端/后端agent` 根据 `plan_{backend|frontend}.md` 文件，完成代码功能的开发。要求：
    - `监管agent`，只返回简单的完成或失败，不返回执行过程。
    - 完成后，你读取`feature.md`，并由你亲自将**管理进度3**的[ ]替换为[x]。

6. 安排 **reviewer manager agent**(dev-review-manager), 让它根据 `plan_{backend|frontend}.md` 文件，完成代码review。要求：
    - 如果同时存在前后端代码需要review, 则启动两个**reviewer manager agent**, 并发完成review。否则只启动一个
    - spawn此agent时，需要传入side参数（frontend/backend）。
    - 完成后, 你读取`feature.md`, 并由你亲自将**管理进度4**的[ ]替换为[x]。

7. 安排 **test manager agent**(dev-test-manager), 让它根据 `test-plan_{backend|frontend}.md` 文件，完成全部端的功能测试。要求：
    - 完成后, 你读取`feature.md`, 并由你亲自将**管理进度5**的[ ]替换为[x]。 