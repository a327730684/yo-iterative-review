## 安装依赖

```bash
npm i --save @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/vue-fontawesome@latest-3
```

## main.ts 全局注册

```typescript
import { library } from '@fortawesome/fontawesome-svg-core'
import { faUser, faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faUser, faLock)
app.component('font-awesome-icon', FontAwesomeIcon)
```

## 模板中使用

```vue
<font-awesome-icon icon="user" />
<font-awesome-icon :icon="['fas', 'user']" />
```

## 懒加载（Tree Shaking）— 按需导入单个图标

```typescript
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp'
import { faUser } from '@fortawesome/free-solid-svg-icons/faUser'
library.add(faArrowUp, faUser)
```
