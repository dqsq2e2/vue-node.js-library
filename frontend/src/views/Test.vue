<template>
  <div class="test-page">
    <h1>API测试页面</h1>
    
    <div class="test-section">
      <h2>登录测试</h2>
      <el-button @click="testLogin" type="primary">测试登录</el-button>
      <p v-if="loginResult">登录结果: {{ loginResult }}</p>
    </div>
    
    <div class="test-section">
      <h2>数据库状态测试</h2>
      <el-button @click="testDatabase" type="success">测试数据库状态</el-button>
      <p v-if="dbResult">数据库状态: {{ dbResult }}</p>
    </div>
    
    <div class="test-section">
      <h2>用户信息测试</h2>
      <el-button @click="testUserInfo" type="warning">测试用户信息</el-button>
      <p v-if="userResult">用户信息: {{ userResult }}</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { login, getUserInfo } from '@/api/auth'
import { getCurrentDatabase } from '@/api/database'
import { ElMessage } from 'element-plus'

export default {
  name: 'Test',
  setup() {
    const loginResult = ref('')
    const dbResult = ref('')
    const userResult = ref('')
    
    const testLogin = async () => {
      try {
        const response = await login({
          username: 'admin',
          password: '123456'
        })
        loginResult.value = JSON.stringify(response.data, null, 2)
        ElMessage.success('登录测试成功')
      } catch (error) {
        loginResult.value = `错误: ${error.message}`
        ElMessage.error('登录测试失败')
      }
    }
    
    const testDatabase = async () => {
      try {
        const response = await getCurrentDatabase()
        dbResult.value = JSON.stringify(response.data, null, 2)
        ElMessage.success('数据库状态测试成功')
      } catch (error) {
        dbResult.value = `错误: ${error.message}`
        ElMessage.error('数据库状态测试失败')
      }
    }
    
    const testUserInfo = async () => {
      try {
        const response = await getUserInfo()
        userResult.value = JSON.stringify(response.data, null, 2)
        ElMessage.success('用户信息测试成功')
      } catch (error) {
        userResult.value = `错误: ${error.message}`
        ElMessage.error('用户信息测试失败')
      }
    }
    
    return {
      loginResult,
      dbResult,
      userResult,
      testLogin,
      testDatabase,
      testUserInfo
    }
  }
}
</script>

<style scoped>
.test-page {
  padding: 20px;
}

.test-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.test-section h2 {
  margin-top: 0;
  color: #409eff;
}

.test-section p {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  white-space: pre-wrap;
  font-family: monospace;
}
</style>
