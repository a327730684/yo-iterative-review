---
name: yo-vitest
description: 指导 agent 在前端项目中使用 vitest 完成测试，包括 vitest 配置、setup 文件、测试目录结构与 @vue/test-utils 组件测试写法。
---

# Vitest 前端测试指南

## 触发条件
- 用户需要为前端（Vue）项目编写或运行单元测试
- 用户要求使用 vitest 测试组件、页面或业务逻辑
- 用户提及搭建/修复 vitest 测试环境

## 一、环境搭建

前端项目下保证存在两个文件：

### 1. `vitest.config.ts`

```ts
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["vitest_test/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
  },
});
```

### 2. `vitest.setup.ts`

职责：
- 引入前端 `main.ts` 中引用的核心依赖（如 `element-plus`、`guava-ui`、`fortawesome`）
- 引入 jsdom 环境，用于测试 Vue 组件的 DOM 操作

```ts
import { config } from "@vue/test-utils";

// 全局组件（无 install 的）
(config.global as any).components = {};

// 带 install() 的插件，如 element-plus、createRouter 实例
config.global.plugins = [
  /* ElementPlus, router */
];

// jsdom 的 localStorage / sessionStorage
await import("jsdom").then(({ JSDOM }) => {
  const dom = new JSDOM("", { url: "http://localhost" });
  (globalThis as any).localStorage = dom.window.localStorage;
  (globalThis as any).sessionStorage = dom.window.sessionStorage;
});
```

## 二、编写测试文件

- 在项目根目录下创建测试目录 `vitest_test/`
- 每个功能一个文件：`vitest_test/[feature].test.ts`
- `vitest.config.ts` 的 `include` 指向该目录（见上）

## 三、使用 @vue/test-utils 测试组件

### 基本用法

```ts
import { mount } from "@vue/test-utils";

test("test AComponent", async () => {
  const wrapper = mount(AComponent);
  const aComponent: any = wrapper.vm; // 组件实例

  // 获取按钮：<el-button data-test="confirm-button" />
  const confirmButton = wrapper.findComponent('[data-test="confirm-button"]');
  await confirmButton.trigger("click"); // 触发点击事件

  const state = aComponent.state; // 组件中 const state = reactive({...})
  aComponent.confirm(); // 调用组件中定义的 const confirm = () => {}
});
```

### Dialog / Modal 测试

`vitest.setup.ts` 中配置：

```ts
config.global.stubs = { teleport: true };
```

teleport 被 stub 后内容原处渲染，直接从外层 wrapper 查找节点即可：

```ts
pageWrapper.find("input");
pageWrapper.find('button[data-test="confirm-button"]');
```

## 注意事项

- 大多数页面级 component 直接 `mount` 即可完成测试，除非组件需要从 vue router 中获取参数（此时需传入 router 插件或 mock route）。
