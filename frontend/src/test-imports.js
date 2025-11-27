// 测试导入是否正常工作
console.log('🧪 测试模块导入...');

try {
  // 测试 API 工具导入
  const api = require('./utils/api.js');
  console.log('✅ API 工具导入成功:', typeof api.default);
  
  // 测试 request 工具导入
  const request = require('./utils/request.js');
  console.log('✅ Request 工具导入成功:', typeof request.default);
  
  console.log('🎉 所有模块导入测试通过！');
} catch (error) {
  console.error('❌ 模块导入失败:', error.message);
}
