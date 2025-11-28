# 多数据库同步的图书馆管理系统

基于 Vue 3 + Node.js + Express 的多数据库同步图书馆管理系统，支持 MySQL、MariaDB、GreatSQL 三种数据库的实时同步。

## 系统特性

### 核心功能
- **多数据库支持**：同时支持 MySQL、MariaDB、GreatSQL 三种数据库
- **实时数据同步**：跨数据库实时和定时数据同步，支持冲突检测与处理
- **权限管理**：多级用户权限控制系统（管理员/图书管理员/读者）
- **完整业务**：图书管理、分类管理、读者管理、借阅管理、逾期处理
- **邮件通知**：逾期提醒、冲突通知等邮件服务
- **报表统计**：借阅统计、热门图书、读者分析等可视化报表

### 技术特性
- **RESTful API**：标准化的 API 接口设计
- **JWT 认证**：安全的用户认证和授权
- **实时通信**：WebSocket 支持实时状态更新
- **数据验证**：完整的输入验证和错误处理
- **日志记录**：详细的操作日志和同步日志

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Vue 3 + Element Plus + ECharts + Axios |
| **后端** | Node.js + Express.js |
| **数据库** | MySQL 8.x / MariaDB 11.x / GreatSQL 8.x |
| **认证** | JWT + bcryptjs |
| **实时通信** | Socket.IO |
| **邮件** | Nodemailer |
| **任务调度** | node-cron |
| **日志** | Winston |

## 项目结构

```
vue-nodejs-library-main/
├── frontend/                # 前端项目 (Vue 3)
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── components/     # 公共组件
│   │   ├── api/            # API 接口
│   │   ├── router/         # 路由配置
│   │   ├── store/          # Vuex 状态管理
│   │   └── utils/          # 工具函数
│   ├── public/             # 静态资源
│   └── package.json
│
├── src/                     # 后端源代码
│   ├── app.js              # 应用入口
│   ├── config/
│   │   └── database.js     # 数据库连接配置
│   ├── middleware/
│   │   ├── auth.js         # 认证中间件
│   │   └── errorHandler.js # 错误处理
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 认证
│   │   ├── books.js        # 图书管理
│   │   ├── categories.js   # 分类管理
│   │   ├── borrow.js       # 借阅管理
│   │   ├── unified-users.js # 统一用户管理
│   │   ├── sync.js         # 同步管理
│   │   └── reports.js      # 报表统计
│   ├── services/
│   │   ├── syncService.js  # 数据同步服务
│   │   └── emailService.js # 邮件服务
│   └── utils/
│       ├── logger.js       # 日志工具
│       └── overdueChecker.js # 逾期检查
│
├── sql/                     # 数据库脚本
│   ├── init-database.sql   # 表结构 + 视图
│   ├── init-data.sql       # 初始数据
│   ├── init-triggers.sql   # 同步触发器
│   └── stored-procedures.sql # 存储过程
│
├── scripts/                 # 工具脚本
│   ├── init-all-databases.js # 数据库初始化
│   └── simulate-conflict.js  # 冲突模拟测试
│
├── uploads/                 # 文件上传目录
├── logs/                    # 日志目录
├── .env.example            # 环境变量模板
├── package.json            # 后端依赖
└── README.md
```

---

## 快速部署

### 一、环境要求

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **数据库**（三选一或全部）：
  - MySQL 8.x（端口 3306）
  - MariaDB 11.x（端口 3307）
  - GreatSQL 8.x（端口 3308）

### 二、克隆项目

```bash
git clone <repository-url>
cd vue-nodejs-library-main
```

### 三、配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# ========== 服务器配置 ==========
PORT=3000
NODE_ENV=development

# ========== JWT 配置 ==========
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=24h

# ========== 数据库配置 ==========
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=library_management

# MariaDB
MARIADB_HOST=localhost
MARIADB_PORT=3307
MARIADB_USER=root
MARIADB_PASSWORD=your_password
MARIADB_DATABASE=library_management

# GreatSQL
GREATSQL_HOST=localhost
GREATSQL_PORT=3308
GREATSQL_USER=root
GREATSQL_PASSWORD=your_password
GREATSQL_DATABASE=library_management

# ========== 同步配置 ==========
SYNC_ENABLED=true
SYNC_INTERVAL=60000

# ========== 邮件配置 ==========
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your_email@qq.com
SMTP_PASS=your_smtp_password
```

### 四、安装依赖

```bash
# 后端依赖
npm install

# 前端依赖
cd frontend
npm install
cd ..
```

### 五、初始化数据库

```bash
# 初始化所有数据库（表结构 + 初始数据 + 触发器 + 存储过程 + 视图）
node scripts/init-all-databases.js

# 只初始化指定数据库
node scripts/init-all-databases.js --db=mysql
node scripts/init-all-databases.js --db=mariadb
node scripts/init-all-databases.js --db=greatsql

# 跳过某些步骤
node scripts/init-all-databases.js --skip-data       # 跳过初始数据
node scripts/init-all-databases.js --skip-triggers   # 跳过触发器
node scripts/init-all-databases.js --skip-procedures # 跳过存储过程
```

**初始化内容：**
| 文件 | 内容 |
|------|------|
| `init-database.sql` | 10 张表 + 1 个视图 |
| `init-data.sql` | 管理员账号、示例分类 |
| `init-triggers.sql` | 15 个同步触发器 |
| `stored-procedures.sql` | 4 个存储过程 |

### 六、启动服务

```bash
# === 开发模式 ===

# 启动后端（端口 3000）
npm run dev

# 启动前端（另一个终端，端口 8080）
cd frontend
npm run serve

# === 生产模式 ===

# 构建前端
cd frontend
npm run build

# 启动后端
npm start
```

### 七、访问系统

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:8080 |
| 后端 API | http://localhost:3000/api |
| 健康检查 | http://localhost:3000/health |

**默认管理员账号：**
- 用户名：`admin`
- 密码：`admin123`

---

## 生产环境部署

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 构建前端
cd frontend && npm run build && cd ..

# 启动后端
pm2 start src/app.js --name library-backend

# 查看状态
pm2 status
pm2 logs library-backend

# 设置开机启动
pm2 startup
pm2 save
```

### 使用 Docker

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mysql
      - mariadb
      - greatsql

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  mysql:
    image: mysql:8
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: library_management
    volumes:
      - mysql_data:/var/lib/mysql

  mariadb:
    image: mariadb:11
    ports:
      - "3307:3306"
    environment:
      MARIADB_ROOT_PASSWORD: your_password
      MARIADB_DATABASE: library_management
    volumes:
      - mariadb_data:/var/lib/mysql

  greatsql:
    image: greatsql/greatsql:8.0.32-27
    ports:
      - "3308:3306"
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: library_management
    volumes:
      - greatsql_data:/var/lib/mysql

volumes:
  mysql_data:
  mariadb_data:
  greatsql_data:
```

**启动：**

```bash
docker-compose up -d
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/library/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

---

## API 文档

### 认证接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/change-password` | 修改密码 |
| GET | `/api/auth/profile` | 获取用户信息 |

### 图书管理

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/books` | 获取图书列表 | 所有用户 |
| GET | `/api/books/:id` | 获取图书详情 | 所有用户 |
| POST | `/api/books` | 添加图书 | 管理员/图书管理员 |
| PUT | `/api/books/:id` | 更新图书 | 管理员/图书管理员 |
| DELETE | `/api/books/:id` | 删除图书 | 管理员/图书管理员 |

### 借阅管理

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/borrow` | 获取借阅记录 | 认证用户 |
| POST | `/api/borrow/borrow` | 借书 | 管理员/图书管理员 |
| POST | `/api/borrow/return/:id` | 还书 | 管理员/图书管理员 |
| POST | `/api/borrow/renew/:id` | 续借 | 管理员/图书管理员 |
| GET | `/api/borrow/overdue` | 获取逾期记录 | 管理员/图书管理员 |

### 同步管理

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/sync/status` | 获取同步状态 | 管理员 |
| GET | `/api/sync/logs` | 获取同步日志 | 管理员 |
| GET | `/api/sync/conflicts` | 获取冲突记录 | 管理员 |
| POST | `/api/sync/conflicts/:id/resolve` | 解决冲突 | 管理员 |
| POST | `/api/sync/conflicts/batch-resolve` | 批量解决冲突 | 管理员 |

---

## 功能展示

### 管理端界面

#### 仪表盘
提供系统数据统计概览，包括图书总量、借阅统计、读者信息等可视化图表。

![仪表盘](https://image.sjcnas.xyz/i/2025/11/28/10fxwm8.png)

#### 图书管理
支持图书的增删改查、批量导入、图书信息详细管理，包括封面上传、库存管理等功能。

![图书管理](https://image.sjcnas.xyz/i/2025/11/28/10gjw6b.png)

#### 分类管理
树形结构的图书分类管理，支持多级分类、拖拽排序等功能。

![分类管理](https://image.sjcnas.xyz/i/2025/11/28/10h2amg.png)

#### 读者管理
读者信息管理、借书证管理、会员等级设置等功能。

![读者管理](https://image.sjcnas.xyz/i/2025/11/28/10ho2e6.png)

#### 借阅管理
借阅记录查询、借书、还书、续借操作，支持逾期处理和罚款计算。

![借阅管理](https://image.sjcnas.xyz/i/2025/11/28/10i9wyn.png)

#### 数据库管理
多数据库同步状态监控、冲突记录查看与处理、同步日志查询等高级功能。

![数据库管理](https://image.sjcnas.xyz/i/2025/11/28/10j99sm.png)

### 用户端界面

#### 个人中心
用户个人信息管理、借阅历史查看、密码修改、邮箱验证等功能。

![个人中心](https://image.sjcnas.xyz/i/2025/11/28/10jvkk7.png)

#### 图书浏览
读者端图书检索、图书详情查看、在线借阅等功能，界面简洁友好。

![图书浏览](https://image.sjcnas.xyz/i/2025/11/28/10koqsd.png)

---

## 数据库设计

### 数据库关系图

![数据库关系图](https://image.sjcnas.xyz/i/2025/11/28/hcw9b2.png)

### E-R 图

![E-R图](https://image.sjcnas.xyz/i/2025/11/28/hcwavg.png)

### 核心表（10 张）

| 表名 | 描述 |
|------|------|
| `system_users` | 系统用户（管理员/图书管理员/读者） |
| `reader_profiles` | 读者档案（借书证、会员类型等） |
| `categories` | 图书分类（支持树形结构） |
| `books` | 图书信息 |
| `borrow_records` | 借阅记录 |
| `system_config` | 系统配置 |
| `operation_logs` | 操作日志 |
| `verification_codes` | 验证码 |
| `sync_log` | 同步日志 |
| `conflict_records` | 冲突记录 |

### 视图

| 视图名 | 描述 |
|--------|------|
| `user_complete_info` | 用户完整信息（关联 system_users + reader_profiles） |

### 存储过程（4 个）

| 存储过程 | 描述 |
|----------|------|
| `borrow_book` | 借书（含库存检查、借阅限制） |
| `return_book` | 还书（含逾期罚款计算） |
| `renew_book` | 续借（含次数限制） |
| `process_overdue_books` | 批量处理逾期图书 |

### 触发器（15 个）

为以下 5 张表各创建 3 个触发器（INSERT/UPDATE/DELETE）：
- `books`
- `borrow_records`
- `categories`
- `reader_profiles`
- `system_users`

---

## 同步机制

### 工作流程

```
数据变更 → 触发器记录到 sync_log → 定时任务处理 → 同步到目标数据库
                                        ↓
                                   检测到冲突
                                        ↓
                              记录到 conflict_records
                                        ↓
                                   邮件通知管理员
                                        ↓
                                   管理员处理冲突
```

### 冲突解决方案

| 方案 | 描述 |
|------|------|
| `source` | 使用源数据库数据覆盖 |
| `target` | 保留目标数据库数据 |
| `ignore` | 忽略冲突 |

---

## 权限系统

| 角色 | 权限 |
|------|------|
| `admin` | 系统管理、用户管理、数据库管理、所有业务功能 |
| `librarian` | 图书管理、借阅管理、读者管理 |
| `reader` | 查看图书、个人借阅记录、续借 |

---

## 常见问题

### 1. 数据库连接失败

```bash
# 检查数据库服务是否启动
# 检查 .env 中的数据库配置
node scripts/init-all-databases.js --db=mysql
```

### 2. 同步任务不执行

```bash
# 检查 .env 中 SYNC_ENABLED=true
# 查看同步日志
tail -f logs/sync.log
```

### 3. 邮件发送失败

```bash
# 检查 SMTP 配置
# QQ 邮箱需要使用授权码而非密码
```

### 4. 前端无法连接后端

```bash
# 检查后端是否启动在 3000 端口
# 检查前端 vue.config.js 中的代理配置
```

---

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
