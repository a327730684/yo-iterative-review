skills/yo-vitest中构建 skill 关于指导agent如何使用vitest完成前端的测试.


## vitest指南

前端项目下保证构建:

- vitest.config.ts

- vitest.setup.ts

     - 保证vitest.setup.ts下引入前端 main.ts下引用的核心依赖， 比如 `element-plus` , `guava-ui`, `fortawesome`；
     - 引入jsdom环境, 用于测试vue组件的dom操作.

```js
//引入全局的组件
config.global.component= {}
// 引入带install()的插件, 比如 `element-plus`, `createRouter实例`,
config.globa.plugins = []
// 引入jsdom 的localStorage, sessionStorage;
await import("jsdom").then(({JSDOM})=>{
    const dom= new JSDOM("",{url: "http://localhost"});
    (globalThis as any).localStorage= dom.window.localStorage;
    (globalThis as any).sessionStorage= dom.window.sessionStorage;
})

```

## 编写测试文件

构建前端项目下测试目录 vitest_test/ 
- 测试目录下构建当前测试需要的 [feature].test.ts
- vite.config.ts 中
```
test{
     environment: "jsdom",
     globals: true,
     include: ['vitest_test/**/[feature].test.ts'],
     setupFiles: ['vitest.setup.ts']
}
```

## 使用@vue/test-utils 测试vue组件的dom操作

大体使用介绍
```js

import {mount} from "@vue/test-utils";

test("test AComponent", async ()=>{
     const wrapper=mount(AComponent);
     const aComponent:any=wrapper.vm; //获取组件实例。

     const confirmButton=wrapper.findComponent("[data-test="confirm-button"]"); // 获取按钮 比如<el-button data=test="confirm-button"></el-button>

     confirmButton.trigger("click"); // 触发点击事件

     const state= aComponent.state;  //获取组件中定义的 state= reactive({...});

     aComponent.confirm();  // 调用组件中定义的 const confirm= ()=>{};  方法。

})
```
针对dialog/modal的测试：

```js
pageWrapper.findComponent("input"); // input存在于dialog 中，而dialog teleport 到 body ， 此处无法直接获取到input元素。

pageWrapper.getComponent("el-dialog");  // 

```


注意： 大多数的页面级别的component， 直接通过mount此component完成测试， 除非组件需要从vue router中获取参数。

