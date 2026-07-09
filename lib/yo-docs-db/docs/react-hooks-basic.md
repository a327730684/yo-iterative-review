# React Hooks 基础

useState 和 useEffect 是最常用的 Hooks。

## useState

```jsx
const [count, setCount] = useState(0);
```

## useEffect

```jsx
useEffect(() => {
  document.title = `点击了 ${count} 次`;
}, [count]);
```

## 规则

- 只在函数组件或自定义 Hook 中调用
- 只在顶层调用，不在循环/条件/嵌套函数中调用
