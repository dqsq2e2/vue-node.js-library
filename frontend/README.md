# 图书管理系统前端

基于 Vue 3 + Element Plus 的现代化图书管理系统前端界面，支持多数据库同步管理。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.x | 渐进式 JavaScript 框架 |
| Element Plus | 2.x | Vue 3 UI 组件库 |
| Vue Router | 4.x | 官方路由管理器 |
| Vuex | 4.x | 状态管理 |
| Axios | 1.x | HTTP 客户端 |
| ECharts | 5.x | 数据可视化图表库 |
| vue-echarts | 6.x | ECharts Vue 封装 |

## 项目结构

```
frontend/
├── public/
│   └── index.html          # HTML 模板（含 favicon）
├── src/
│   ├── api/                # API 接口模块
│   │   ├── auth.js         # 认证接口
│   │   ├── books.js        # 图书管理
│   │   ├── borrow.js       # 借阅管理
│   │   ├── categories.js   # 分类管理
│   │   ├── readers.js      # 读者管理
│   │   ├── reports.js      # 统计报表
│   │   ├── sync.js         # 同步管理
│   │   ├── database.js     # 数据库管理
│   │   └── unified-users.js # 统一用户管理
│   ├── assets/
│   │   └── css/global.css  # 全局样式
│   ├── components/         # 公共组件
│   ├── router/index.js     # 路由配置
│   ├── store/              # Vuex 状态管理
│   │   ├── index.js
│   │   └── modules/
│   │       ├── user.js     # 用户状态
│   │       └── app.js      # 应用状态
│   ├── utils/
│   │   ├── request.js      # Axios 封装
│   │   ├── auth.js         # Token 管理
│   │   └── index.js        # 工具函数
│   ├── views/              # 页面组件
│   │   ├── Layout/         # 布局框架
│   │   ├── Login/          # 登录页
│   │   ├── Register/       # 注册页
│   │   ├── Dashboard/      # 仪表盘
│   │   ├── Books/          # 图书管理
│   │   ├── Categories/     # 分类管理
│   │   ├── Borrow/         # 借阅管理
│   │   ├── UnifiedUsers/   # 统一用户管理
│   │   ├── Profile/        # 个人中心
│   │   ├── DatabaseManagement/ # 数据库管理
│   │   └── Error/          # 错误页面
│   ├── App.vue
│   └── main.js
├── vue.config.js           # Vue CLI 配置
└── package.json
```

---

## 功能模块

### 用户认证
- 登录 / 登出 / 注册
- JWT Token 认证
- 三种角色权限（管理员 / 图书管理员 / 读者）
- 个人信息修改、密码修改

### 图书管理
- 图书列表（分页、搜索、筛选）
- 图书增删改查
- 封面图片上传
- 图书浏览（读者视图）

### 分类管理
- 树形分类结构
- 分类增删改查
- 子分类管理

### 借阅管理
- 借书 / 还书 / 续借
- 借阅记录查询
- 逾期图书管理
- 借阅统计

### 用户管理（管理员）
- 统一用户管理（管理员/图书管理员/读者）
- 用户增删改查
- 角色分配

### 数据库管理（管理员）
- 多数据库状态监控
- 主数据库切换
- 同步日志查看
- 冲突记录管理（查看/批量解决）

### 统计报表
- 系统数据概览
- 借阅趋势图表
- 热门图书排行
- 活跃读者统计

### 仪表盘快捷操作
- 添加图书
- 添加用户/读者
- 添加借阅
- 添加分类

---

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run serve
```

访问 http://localhost:8080

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

---

## 配置说明

### 开发代理

`vue.config.js` 配置了开发代理：

```javascript
devServer: {
  port: 8080,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `VUE_APP_API_BASE_URL` | API 基础地址（生产环境） |

---

## 路由结构

| 路径 | 页面 | 权限 |
|------|------|------|
| `/login` | 登录 | 公开 |
| `/register` | 注册 | 公开 |
| `/dashboard` | 仪表盘 | 认证用户 |
| `/books` | 图书管理 | 管理员/图书管理员 |
| `/books/browse` | 图书浏览 | 所有用户 |
| `/categories` | 分类管理 | 管理员/图书管理员 |
| `/borrow` | 借阅管理 | 认证用户 |
| `/users/unified` | 用户管理 | 管理员/图书管理员 |
| `/database` | 数据库管理 | 管理员 |
| `/profile` | 个人中心 | 认证用户 |

---

## 权限控制

| 角色 | 可访问页面 |
|------|-----------|
| `admin` | 所有页面 |
| `librarian` | 图书、分类、借阅、用户（仅读者）、报表 |
| `reader` | 图书浏览、个人借阅记录、个人中心 |

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

---

## 部署

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/library/frontend/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 浏览器支持

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88

---

## 许可证

MIT License
