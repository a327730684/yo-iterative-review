---
name: yo-dev-xxl
description: 帮助完成一个大的功能开发，从设计->实现->review->测试
---

# Your task list

1. 大概理解业务需求，提供列表要求用户选择可用的agent作为subagent。主要提供三类agent:
    - 功能设计agent
    - 前端agent
    - 后端agent
    
    每类agent选择列表最后一项是系统默认agent(以便无可用agent时可使用系统默认)。
    注意：subagent使用的agent可由用户指定名称，或你默认挑选。

2. **文档目录**：在 {project_dir}/.claude/voyo_dev/{yyyy-MM-dd}-{feature_name}/目录下，构建本次开发的文档目录，并于其下创建以下文件：
    - feature.md 记录用户的原始需求，记录使用了哪些agent（新建，写入），写入你的管理进度。
    
        管理进度模版：
        ```
        {填充开发简要描述 ，300字以内}
        agent提醒: 注意阅读 `yo-dev-xxl` skill , 明确你当前的管理的进度位置。

        - 管理进度1: [ ]设计产品文档
        - 管理进度2: [ ]设计项目实施文档
        - 管理进度3: [ ]设计开发计划文档
        - 管理进度4: [ ]实现功能开发
        - 管理进度5: [ ]代码review
        - 管理进度6: [ ]功能测试

        ```
        这里只写入这个模版，用以指导你管理后续的开发进度。

    - spec.md 需求整体设计，功能点文档（只新建，暂不写入）
    - code_plan.md 项目代码设计文案（只新建，暂不写入）
    - plan_{backend|frontend}.md 开发的计划文档（只新建，暂不写入）, 分别对应后端和前端的开发计划。 若存在后端或前端时，则只创建对应的计划文档。

3. 直接spwan一个默认的agent作为 `功能设计agent`， 根据提供的需求，完成 `spec.md` 文件。要求：
    - `功能设计agent`，只返回完成或失败，不返回额外信息。
    - 作为设计agent, 只负责产品功能设计，因为此agent不了解技术方案，所以千万不要对技术框架，方案，细节进行设计。
    - 完成后，提供文档地址，要求用户查阅，并等待用户确认。
    - 用户确认后修改feature.md文件，将**管理进度1**的[ ]替换为[x]。

4. spawn一个默认agent， 读取指定的前后端agent 内容，完成 `code_plan.md` 文件。
    - `设计代码agent`，只返回完成或失败，不返回额外信息。
    - 读取确定的`前端/后端agent` 内容，了解技术底座，根据 `spec.md` 产品文档，完成项目实施计划文档. 
    - 用户确认后修改feature.md文件，将**管理进度2**的[ ]替换为[x]。

4. 安排 `前端/后端agent` 根据 `code_plan.md` 文件，完成 `plan_{backend|frontend}.md`文件。要求：
    - plan_{backend|frontend}.md 文件的设计要求:
        - 根据code_plan.md文件中的设计文案， 制定实施任务。
        - 任务拆分大模块，每个大模块下再拆分为若干**小功能**。用 markdown checkbox 记录进度。
        - 每大功能及其下的小功能的 checkbox 初始状态为未完成。
        如：
        ```
        - 功能1
            - [ ] 子功能1
            - [ ] 子功能2
        - 功能2
            - [ ] 子功能3
            - [ ] 子功能4
        ```
        - 不要构建测试任务，后面有专业测试流程。

    - `前端/后端agent`，只返回完成或失败，不返回额外信息。
    - 完成后，你亲自将**管理进度2**的[ ]替换为[x]。

5. 安排一个 **监管agent**(xxl-supervisor), 让它创建 代码agent`前端/后端agent` 根据 `code_plan.md` 和 `plan_{backend|frontend}.md` 文件，完成代码功能的开发。要求：
    - 告诉它 **文档目录** 的路径
    - `监管agent`，只返回简单的完成或失败，不返回执行过程。
    - 完成后，你读取`feature.md`，并由你亲自将**管理进度3**的[ ]替换为[x]。

6. 安排 **reviewer manager agent**(xxl-review-manager), 让它根据 `plan_{backend|frontend}.md` 文件，完成代码review。要求：
    - 告诉它 **文档目录** 的路径
    - 如果同时存在前后端代码需要review, 则启动两个**reviewer manager agent**, 并发完成review。否则只启动一个
    - spawn此agent时，需要传入side参数（frontend/backend）。
    - 完成后, 你读取`feature.md`, 并由你亲自将**管理进度4**的[ ]替换为[x]。

7. 安排 **test manager agent**(xxl-test-manager), 完成全部端的功能测试。要求：
    - 告诉它 **文档目录** 的路径
    - 完成后, 你读取`feature.md`, 并由你亲自将**管理进度5**的[ ]替换为[x]。 


注意点：5到7步，因为时间较长，注意严格对待manger agent，当其返回信息时，注意查看其是否关闭。若关闭，但返回的信息未告知任务完全完成，则注意重启它，并要求完成安排的任务。