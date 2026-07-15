# Font Awesome 在 Vue 中的使用

在 Vue 项目中使用 Font Awesome 图标库，可以通过 npm 安装。

## 安装

```bash
npm install @fortawesome/fontawesome-svg-core
npm install @fortawesome/free-solid-svg-icons
npm install @fortawesome/vue-fontawesome
```

## 配置

在 main.js 中注册：

```js
import { library } from '@fortawesome/fontawesome-svg-core';
import { faUser, faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(faUser, faHome);
app.component('font-awesome-icon', FontAwesomeIcon);
```

## 使用

```html
<font-awesome-icon icon="user" />
<font-awesome-icon icon="home" />
```
