# CLAUDE_zh.md

此文件是 Claude Code 在本仓库的实现指导文档。

## 角色

- 产品与方向由项目拥有者决策。
- Claude Code 负责可落地、可维护的技术实现。

## 项目范围

Ksu-App 是 Electron 桌面应用，内置 AI 对话助手。

### 技术栈

- Electron
- React 19 + TypeScript
- TanStack Router（文件路由）
- Tailwind CSS v4

## AI 对话开发指引

### 目标架构

- Main 进程承载助手运行时。
- 助手通过统一工具注册表调用内部工具。
- 工具采用“函数契约 + 类型约束”模式。

### 必须流程

1. 解析用户请求。
2. 生成工具执行计划。
3. 以类型化参数执行工具。
4. 返回带结果依据的简洁答复。
5. 错误按类型上抛，不吞错。

### 工具契约模板

- `name`
- `description`
- `inputSchema`
- `outputSchema`
- `execute(input, ctx)`
- `cacheTtlMs`
- `errorMap`

### 第一批工具

- `get_user_info`
- `get_personal_info`
- `get_grades`
- `get_calendar`

## 工程约束

- 接口构建统一集中，禁止散落在页面层。
- 助手链路与 UI 链路的会话/请求行为保持一致。
- 按层拆分：`request`、`ksu`、`assistant/tools`。
- 禁止手动编辑 `src/routeTree.gen.ts`。

## 常用命令

```bash
npm run electron:dev
npm run format
npm run lint
npm run typecheck
npm run electron:build
```
