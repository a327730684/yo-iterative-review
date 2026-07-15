---
description: 需要完成一个大型功能开发时，使用此命令
argument-hint: <description of the feature to implement>
---

启动一个流程

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
        - 管理进度1: [ ]设计功能点文档 
        - 管理进度2: [ ]设计开发计划文档
        - 管理进度3: [ ]实现功能开发
        - 管理进度4: [ ]代码review
        - 管理进度5: [ ]功能测试
        ```
        这里只写入这个模版，用以指导你管理后续的开发进度。

    - spec.md 需求整体设计，功能点文档（只新建，暂不写入）
    - plan.md 开发的计划文档（只新建，暂不写入）
    - test-plan.md 测试计划文档（只新建，暂不写入）

3. 安排 `功能设计agent` 根据提供的需求，完成 `spec.md` 文件。要求：
    - `功能设计agent`，只返回完成或失败，不返回额外信息。
    - 完成后，提供文档地址，要求用户查阅，并等待用户确认。
    - 用户确认后修改feature.md文件，将管理进度1的[ ]替换为[x]。

