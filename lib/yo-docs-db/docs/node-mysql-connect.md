# Node.js 连接 MySQL

使用 mysql2 驱动连接 MySQL 数据库。

## 安装

```bash
npm install mysql2
```

## 连接代码

```js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10,
});

const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
console.log(rows);
```
