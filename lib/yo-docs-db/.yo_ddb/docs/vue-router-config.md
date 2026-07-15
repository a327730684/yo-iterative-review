# Vue Router 配置路由

Vue Router 是 Vue 的官方路由管理器。

## 安装

```bash
npm install vue-router@4
```

## 配置

```js
import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: () => import('./views/About.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
```
