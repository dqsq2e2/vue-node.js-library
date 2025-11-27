<template>
  <div class="login-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="decoration-circle circle-1"></div>
      <div class="decoration-circle circle-2"></div>
      <div class="decoration-circle circle-3"></div>
    </div>
    
    <!-- 登录卡片 -->
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <div class="logo-icon">
            <el-icon size="48"><Reading /></el-icon>
          </div>
          <h1 class="title">图书管理系统</h1>
        </div>
        <p class="subtitle">智能化图书管理平台</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form-content"
        auto-complete="on"
        label-position="left"
      >
        <el-form-item prop="username">
          <el-input
            ref="usernameRef"
            v-model="loginForm.username"
            placeholder="请输入用户名"
            name="username"
            type="text"
            tabindex="1"
            auto-complete="on"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            ref="passwordRef"
            v-model="loginForm.password"
            :type="passwordType"
            placeholder="请输入密码"
            name="password"
            tabindex="2"
            auto-complete="on"
            size="large"
            prefix-icon="Lock"
            @keyup.enter="handleLogin"
          >
            <template #suffix>
              <el-icon class="password-icon" @click="showPassword">
                <component :is="passwordType === 'password' ? 'View' : 'Hide'" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-button
          :loading="loading"
          type="primary"
          size="large"
          class="login-button"
          @click.prevent="handleLogin"
        >
          <span v-if="!loading">立即登录</span>
          <span v-else>登录中...</span>
        </el-button>
        
        <!-- 注册链接 -->
        <div class="register-link">
          还没有账号？
          <router-link to="/register" class="register-text">立即注册</router-link>
        </div>
      </el-form>
      
      <!-- 底部信息 -->
      <div class="login-footer">
        <p class="footer-text">© 2025 图书管理系统 - 让阅读更简单</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, nextTick, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Reading } from '@element-plus/icons-vue'

export default {
  name: 'Login',
  setup() {
    const store = useStore()
    const router = useRouter()
    const route = useRoute()
    
    // 响应式数据
    const loginFormRef = ref(null)
    const usernameRef = ref(null)
    const passwordRef = ref(null)
    const passwordType = ref('password')
    const loading = ref(false)
    const redirect = ref(undefined)
    
    // 登录表单
    const loginForm = reactive({
      username: '',
      password: ''
    })
    
    // 表单验证规则
    const loginRules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
      ]
    }
    
    // 方法
    const showPassword = () => {
      if (passwordType.value === 'password') {
        passwordType.value = ''
      } else {
        passwordType.value = 'password'
      }
      nextTick(() => {
        passwordRef.value.focus()
      })
    }
    
    const handleLogin = () => {
      loginFormRef.value.validate((valid) => {
        if (valid) {
          loading.value = true
          store.dispatch('user/login', loginForm)
            .then(() => {
              ElMessage.success('登录成功')
              
              // 根据用户角色决定跳转路径
              const userInfo = store.getters.userInfo
              let redirectPath = redirect.value || '/'
              
              if (userInfo && userInfo.role === 'reader') {
                // 读者直接跳转到图书浏览
                redirectPath = '/books-browse'
              }
              
              router.push({ path: redirectPath, replace: true })
            })
            .catch((error) => {
              console.error('登录失败:', error)
              // 显示用户友好的错误信息
              let errorMessage = '登录失败'
              
              if (error.response) {
                const { status, data } = error.response
                switch (status) {
                  case 401:
                    errorMessage = '用户名或密码错误'
                    break
                  case 404:
                    errorMessage = '用户不存在'
                    break
                  case 429:
                    errorMessage = '登录尝试过于频繁，请稍后再试'
                    break
                  default:
                    errorMessage = data?.message || '登录失败，请重试'
                }
              } else if (error.message) {
                errorMessage = error.message
              }
              
              ElMessage.error(errorMessage)
            })
            .finally(() => {
              loading.value = false
            })
        } else {
          console.log('表单验证失败')
          return false
        }
      })
    }
    
    const getOtherQuery = (query) => {
      return Object.keys(query).reduce((acc, cur) => {
        if (cur !== 'redirect') {
          acc[cur] = query[cur]
        }
        return acc
      }, {})
    }
    
    // 生命周期
    onMounted(() => {
      if (loginForm.username === '') {
        usernameRef.value.focus()
      } else if (loginForm.password === '') {
        passwordRef.value.focus()
      }
    })
    
    // 监听路由变化
    const watchRoute = (route) => {
      const query = route.query
      if (query) {
        redirect.value = query.redirect
        loginForm.username = query.username || loginForm.username
        const otherQuery = getOtherQuery(query)
        if (Object.keys(otherQuery).length > 0) {
          redirect.value = redirect.value + '&' + new URLSearchParams(otherQuery).toString()
        }
      }
    }
    
    watchRoute(route)
    
    return {
      loginFormRef,
      usernameRef,
      passwordRef,
      passwordType,
      loading,
      loginForm,
      loginRules,
      showPassword,
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 200px;
  height: 200px;
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.circle-2 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 15%;
  animation-delay: 2s;
}

.circle-3 {
  width: 100px;
  height: 100px;
  bottom: 20%;
  left: 20%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
    opacity: 0.3;
  }
}

/* 登录卡片 */
.login-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.logo-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.logo-icon .el-icon {
  color: white;
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 16px;
  color: #7f8c8d;
  margin: 8px 0 0 0;
  font-weight: 400;
}

.login-form-content {
  width: 100%;
  margin-bottom: 32px;
}

.login-form-content .el-form-item {
  margin-bottom: 24px;
}

.login-form-content .el-input {
  border-radius: 12px;
}

.login-form-content .el-input__wrapper {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  transition: all 0.3s ease;
}

.login-form-content .el-input__wrapper:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.login-form-content .el-input.is-focus .el-input__wrapper {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.password-icon {
  cursor: pointer;
  user-select: none;
  color: #909399;
  transition: color 0.3s ease;
}

.password-icon:hover {
  color: #667eea;
}

.login-button {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.login-button:active {
  transform: translateY(0);
}

.register-link {
  text-align: center;
  margin-top: 20px;
  color: #909399;
  font-size: 14px;
}

.register-text {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}

.register-text:hover {
  color: #764ba2;
  text-decoration: underline;
}

.login-footer {
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.footer-text {
  font-size: 14px;
  color: #95a5a6;
  margin: 0;
  font-weight: 400;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-card {
    max-width: 90%;
    padding: 32px 24px;
    border-radius: 16px;
  }
  
  .title {
    font-size: 28px;
  }
  
  .logo-icon {
    width: 64px;
    height: 64px;
  }
  
  .logo-icon .el-icon {
    font-size: 32px;
  }
  
  .circle-1, .circle-2, .circle-3 {
    display: none;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px 20px;
  }
  
  .title {
    font-size: 24px;
  }
  
  .subtitle {
    font-size: 14px;
  }
}
</style>
