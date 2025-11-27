<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>读者注册</h1>
        <p>欢迎注册图书管理系统，成为我们的读者</p>
      </div>

      <el-form
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        label-width="100px"
        size="large"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <h3>基本信息</h3>
          
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="registerForm.username"
              placeholder="请输入用户名（3-50个字符）"
              @blur="checkUsername"
            >
              <template #suffix>
                <el-icon v-if="usernameChecking" class="is-loading">
                  <Loading />
                </el-icon>
                <el-icon v-else-if="usernameAvailable === true" style="color: #67c23a">
                  <Check />
                </el-icon>
                <el-icon v-else-if="usernameAvailable === false" style="color: #f56c6c">
                  <Close />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="registerForm.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="registerForm.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              show-password
            />
          </el-form-item>

          <el-form-item label="真实姓名" prop="real_name">
            <el-input
              v-model="registerForm.real_name"
              placeholder="请输入真实姓名"
            />
          </el-form-item>
        </div>

        <!-- 联系信息 -->
        <div class="form-section">
          <h3>联系信息</h3>
          
          <el-form-item label="邮箱" prop="email">
            <el-input
              v-model="registerForm.email"
              placeholder="请输入邮箱地址（选填）"
            />
          </el-form-item>

          <el-form-item label="验证码" prop="verificationCode" v-if="registerForm.email">
            <el-input
              v-model="registerForm.verificationCode"
              placeholder="请输入邮箱验证码"
              style="width: 60%"
            >
              <template #append>
                <el-button 
                  @click="handleSendCode" 
                  :disabled="codeSending || countdown > 0"
                  :loading="codeSending"
                >
                  {{ countdown > 0 ? `${countdown}秒后重试` : '获取验证码' }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="手机号" prop="phone">
            <el-input
              v-model="registerForm.phone"
              placeholder="请输入手机号（选填）"
            />
          </el-form-item>
        </div>

        <!-- 个人信息 -->
        <div class="form-section">
          <h3>个人信息</h3>
          
          <el-form-item label="性别" prop="gender">
            <el-radio-group v-model="registerForm.gender">
              <el-radio label="男">男</el-radio>
              <el-radio label="女">女</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="部门/单位" prop="department">
            <el-input
              v-model="registerForm.department"
              placeholder="请输入所在部门或单位（选填）"
            />
          </el-form-item>
        </div>

        <!-- 服务条款 -->
        <div class="form-section">
          <el-form-item prop="agreement">
            <el-checkbox v-model="registerForm.agreement">
              我已阅读并同意
              <el-button type="text" @click="showTerms = true">《图书馆服务条款》</el-button>
            </el-checkbox>
          </el-form-item>
        </div>

        <!-- 提交按钮 -->
        <el-form-item>
          <!-- 提示信息 -->
          <div v-if="!registerForm.agreement" class="agreement-tip">
            <el-alert
              title="请先阅读并同意服务条款才能注册"
              type="info"
              :closable="false"
              show-icon
            />
          </div>
          
          <div class="register-btn-container">
            <el-button
              type="primary"
              size="large"
              :loading="submitting"
              :disabled="!registerForm.agreement"
              @click="handleRegister"
              class="register-btn"
            >
              {{ registerForm.agreement ? '立即注册' : '请先同意服务条款' }}
            </el-button>
          </div>
        </el-form-item>

        <div class="login-link">
          已有账号？
          <router-link to="/login">立即登录</router-link>
        </div>
      </el-form>
    </div>

    <!-- 服务条款对话框 -->
    <el-dialog v-model="showTerms" title="图书馆服务条款" width="600px">
      <div class="terms-content">
        <h4>1. 服务说明</h4>
        <p>本图书管理系统为读者提供图书借阅、查询、预约等服务。</p>
        
        <h4>2. 用户责任</h4>
        <p>用户应妥善保管借书证，不得转借他人使用。如有遗失应及时挂失。</p>
        
        <h4>3. 借阅规则</h4>
        <p>普通读者最多可借阅5本图书，借期为30天，可续借一次。</p>
        
        <h4>4. 违约责任</h4>
        <p>逾期归还图书将产生滞纳金，损坏或遗失图书需按规定赔偿。</p>
        
        <h4>5. 隐私保护</h4>
        <p>我们将严格保护用户隐私信息，不会向第三方泄露个人信息。</p>
      </div>
      
      <template #footer>
        <el-button @click="showTerms = false">关闭</el-button>
        <el-button type="primary" @click="acceptTerms">同意条款</el-button>
      </template>
    </el-dialog>

    <!-- 注册成功对话框 -->
    <el-dialog v-model="showSuccess" title="注册成功" width="500px" :close-on-click-modal="false">
      <div class="success-content">
        <div class="success-icon">
          <el-icon size="60" color="#67c23a">
            <Check />
          </el-icon>
        </div>
        <h3>恭喜您，注册成功！</h3>
        <div class="success-info">
          <p><strong>用户名：</strong>{{ successInfo.username }}</p>
          <p><strong>真实姓名：</strong>{{ successInfo.real_name }}</p>
          <p><strong>借书证号：</strong>{{ successInfo.card_number }}</p>
          <p><strong>注册日期：</strong>{{ successInfo.register_date }}</p>
          <p><strong>有效期至：</strong>{{ successInfo.expire_date }}</p>
        </div>
        <el-alert
          title="请妥善保管您的借书证号，这是您借阅图书的重要凭证"
          type="info"
          :closable="false"
          show-icon
        />
      </div>
      
      <template #footer>
        <el-button type="primary" @click="goToLogin">立即登录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, Close, Loading } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { sendVerificationCode } from '@/api/auth'

const router = useRouter()

// 响应式数据
const registerFormRef = ref(null)
const submitting = ref(false)
const showTerms = ref(false)
const showSuccess = ref(false)
const usernameChecking = ref(false)
const usernameAvailable = ref(null)
const codeSending = ref(false)
const countdown = ref(0)

// 表单数据
const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  real_name: '',
  email: '',
  phone: '',
  gender: '',
  department: '',
  verificationCode: '',
  agreement: false
})

// 注册成功信息
const successInfo = ref({})

// 表单验证规则
const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在3到50个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  real_name: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { max: 50, message: '姓名长度不能超过50个字符', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  id_card: [
    { pattern: /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/, message: '请输入正确的身份证号', trigger: 'blur' }
  ],
  agreement: [
    { 
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error('请阅读并同意服务条款'))
        } else {
          callback()
        }
      }, 
      trigger: 'change' 
    }
  ]
}

// 检查用户名是否可用
const checkUsername = async () => {
  if (!registerForm.username || registerForm.username.length < 3) {
    usernameAvailable.value = null
    return
  }

  usernameChecking.value = true
  usernameAvailable.value = null

  try {
    // 使用公开的用户名检查API
    const response = await request.get(`/unified-users/check-username/${registerForm.username}`)
    if (response.success) {
      usernameAvailable.value = response.available
    }
  } catch (error) {
    console.error('检查用户名失败:', error)
  } finally {
    usernameChecking.value = false
  }
}

// 发送验证码
const handleSendCode = async () => {
  if (!registerForm.email) {
    ElMessage.warning('请先输入邮箱地址')
    return
  }

  // 验证邮箱格式
  const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailReg.test(registerForm.email)) {
    ElMessage.warning('请输入有效的邮箱地址')
    return
  }

  codeSending.value = true
  try {
    await sendVerificationCode({ email: registerForm.email })
    ElMessage.success('验证码已发送，请查收邮件')
    
    // 开始倒计时
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error) {
    console.error('发送验证码失败:', error)
  } finally {
    codeSending.value = false
  }
}

// 处理注册
const handleRegister = async () => {
  try {
    // 表单验证
    const valid = await registerFormRef.value.validate()
    if (!valid) return

    // 检查用户名是否可用
    if (usernameAvailable.value === false) {
      ElMessage.error('用户名已存在，请更换')
      return
    }

    submitting.value = true

    const response = await request.post('/unified-users/register', {
      username: registerForm.username,
      password: registerForm.password,
      real_name: registerForm.real_name,
      email: registerForm.email || undefined,
      phone: registerForm.phone || undefined,
      gender: registerForm.gender || undefined,
      department: registerForm.department || undefined,
      verificationCode: registerForm.verificationCode || undefined
    })

    if (response.success) {
      successInfo.value = response.data
      showSuccess.value = true
      ElMessage.success('注册成功！')
    } else {
      ElMessage.error(response.message || '注册失败')
    }

  } catch (error) {
    console.error('注册失败:', error)
    ElMessage.error('注册失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

// 同意条款
const acceptTerms = () => {
  registerForm.agreement = true
  showTerms.value = false
}

// 跳转到登录页
const goToLogin = () => {
  showSuccess.value = false
  router.push('/login')
}
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px 20px 40px 20px;
}

.register-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 600px;
  margin-top: 20px;
  margin-bottom: 20px;
}

.register-header {
  text-align: center;
  margin-bottom: 30px;
}

.register-header h1 {
  color: #303133;
  margin: 0 0 10px 0;
  font-size: 28px;
  font-weight: 600;
}

.register-header p {
  color: #909399;
  margin: 0;
  font-size: 14px;
}

.form-section {
  margin-bottom: 30px;
}

.form-section h3 {
  color: #409eff;
  font-size: 16px;
  margin: 0 0 20px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #e4e7ed;
}

.agreement-tip {
  margin-bottom: 15px;
}

.register-btn-container {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.register-btn {
  min-width: 200px;
  padding: 12px 40px;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  color: #909399;
}

.login-link a {
  color: #409eff;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}

.terms-content {
  max-height: 400px;
  overflow-y: auto;
}

.terms-content h4 {
  color: #303133;
  margin: 15px 0 8px 0;
}

.terms-content p {
  color: #606266;
  line-height: 1.6;
  margin: 0 0 10px 0;
}

.success-content {
  text-align: center;
}

.success-icon {
  margin-bottom: 20px;
}

.success-content h3 {
  color: #67c23a;
  margin: 0 0 20px 0;
}

.success-info {
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  text-align: left;
}

.success-info p {
  margin: 8px 0;
  color: #303133;
}

.success-info strong {
  color: #409eff;
  display: inline-block;
  width: 80px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-button) {
  border-radius: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .register-container {
    padding: 10px;
  }
  
  .register-card {
    padding: 20px;
    margin-top: 10px;
    margin-bottom: 10px;
    border-radius: 8px;
  }
  
  .register-header h1 {
    font-size: 24px;
  }
  
  .form-section {
    margin-bottom: 20px;
  }
  
  .form-section h3 {
    font-size: 14px;
  }
  
  .register-btn {
    min-width: 180px;
    padding: 10px 30px;
  }
}

@media (max-width: 480px) {
  .register-container {
    padding: 5px;
  }
  
  .register-card {
    padding: 15px;
    margin-top: 5px;
    margin-bottom: 5px;
  }
  
  .register-header {
    margin-bottom: 20px;
  }
  
  .register-header h1 {
    font-size: 20px;
  }
  
  .register-header p {
    font-size: 12px;
  }
  
  .register-btn {
    min-width: 160px;
    padding: 8px 25px;
    font-size: 14px;
  }
}
</style>
