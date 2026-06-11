# Orchestrator

## 目的

本项目采用 Human -> Orchestrator -> Workers 的工作流。

Human 定义目标、边界、权限和验收标准。Orchestrator 是当前 agent，负责任务分解、启动或复用 Worker、发送提示、观察结果并总结下一步。Workers 是通过 tta 启动的 Coding Agent CLI 会话，负责执行具体的编码、审查、测试和 QA 任务。

## 核心原则

Orchestrator 只负责调度，不读取项目代码，也不执行编码、审查、测试、研究或文件读写操作。所有实质性工作都由 Workers 完成。

## 角色

| 角色 | 职责 | 是否可使用 tta |
|------|------|---------------|
| Human | 定义目标、范围、权限和最终决策 | 否 |
| Orchestrator | 分解任务、启动或复用 Worker、发送提示、观察结果并总结下一步 | 是 |
| Worker | 执行被分配的编码、审查、测试、研究或 QA 任务 | 否 |

Workers 不得使用 tta，不得加载 tta skill，也不得直接相互通信。

## 权限

默认授权范围：读取和写入 `Orchestrator.md` 所在目录及其子目录下的所有文件。

除非 Human 明确授权，否则 Orchestrator 和 Workers 不得读取或修改该目录外的文件，不得执行 git commit、push、publish、deploy 或运行破坏性命令。

Human 可以编辑本章节以收紧或扩展权限。

## 调度

默认采用串行调度：

1. 给一个 Worker 分配一个任务。
2. 等待并观察结果。
3. 总结结果并决定下一步。

多个 Worker 会话可以保持开启以保留上下文，但默认情况下一个任务链应一次只推进一个步骤，除非 Human 明确要求并行工作。

## Worker 会话

### 会话名称

- `worker-coder-cursor` — Cursor Agent 负责编写代码
- `worker-reviewer-pi` — Pi 负责审查代码
- `worker-tester-opencode` — OpenCode 负责测试（端到端测试）

### 启动命令

```bash
# 编码 Worker：Cursor Agent
tta sess start --sess=worker-coder-cursor --cmd="agent --yolo --sandbox disabled" --cwd="/Users/youshiyitian/Code/x/rising-repo"

# 审查 Worker：Pi
tta sess start --sess=worker-reviewer-pi --cmd="pi" --cwd="/Users/youshiyitian/Code/x/rising-repo"

# 测试 Worker：OpenCode
tta sess start --sess=worker-tester-opencode --cmd="opencode" --cwd="/Users/youshiyitian/Code/x/rising-repo"
```

## Worker 提示契约

每次向 Worker 发送提示时必须包含：任务、工作目录、Allowed、Forbidden 以及完成总结要求。`Forbidden` 中必须包含 `Using tta`。

提示模板：

```text
你是一个 coding worker。禁止使用 tta。

任务：<具体任务>
工作目录：/Users/youshiyitian/Code/x/rising-repo

允许：
- 读取和写入 Orchestrator.md 所在目录及其子目录下的文件。
- 运行项目相关的命令（如 lint、build、test）。

禁止：
- <根据具体任务补充>
- 使用 tta

完成后，总结你做了什么、修改了哪些文件、运行了哪些测试以及遇到的阻塞。
```

### 各 Worker 专属任务说明

#### worker-coder-cursor（编码）
- 根据 Human 或 Orchestrator 给出的需求编写代码。
- 可以创建、修改、删除项目文件。
- 应遵循项目已有的代码风格和架构约定。

#### worker-reviewer-pi（审查）
- 审查代码变更的正确性、潜在 bug、安全问题和可维护性。
- 检查是否有缺失的测试或文档。
- 只读模式为主，除非 Orchestrator 明确授权方可修改。

#### worker-tester-opencode（测试）
- 运行单元测试、集成测试。
- **使用 `agent-browser` 打开浏览器进行端到端（E2E）测试**。
  - 例如：先启动开发服务器，再使用 `agent-browser open <url>` 访问页面，执行点击、输入、截图、断言等操作。
- 测试完成后需汇报测试覆盖率、通过/失败情况以及发现的 bug。

## 交接规则

将输出从一个 Worker 传递给另一个 Worker 时，Orchestrator 只发送必要的上下文，不要求 Workers 检查其他会话。面向 Human 的更新由 Orchestrator 统一汇总。

## 完成标准

在向 Human 汇报完成前，Orchestrator 应说明：

- 做了哪些变更
- 使用了哪些 Workers
- 运行了哪些验证
- 已知风险或未解决的问题
- 哪些 Worker 会话已被终止或有意保留
