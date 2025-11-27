const express = require('express');
const router = express.Router();

// readers 路由已迁移到统一用户管理
// 重定向所有请求到 unified-users

router.use('*', (req, res) => {
  const newPath = req.originalUrl.replace('/api/readers', '/api/unified-users');
  res.redirect(301, newPath);
});

module.exports = router;
