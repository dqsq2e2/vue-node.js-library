<template>
  <div class="profile-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>个人中心</h2>
      <p>管理您的个人信息和账户设置</p>
    </div>

    <el-row :gutter="20">
      <!-- 左侧：个人信息卡片 -->
      <el-col :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="profile-card" shadow="never" v-loading="userInfoLoading">
          <template #header>
            <div class="card-header">
              <span>个人信息</span>
              <el-button type="primary" size="small" @click="editMode = !editMode">
                {{ editMode ? '取消编辑' : '编辑信息' }}
              </el-button>
            </div>
          </template>

          <div class="profile-info">
            <!-- 头像 -->
            <div class="avatar-section">
              <el-avatar :size="80" :src="userInfo.avatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <h3>{{ userInfo.username || '未知用户' }}</h3>
              <el-tag :type="getRoleType(userInfo.role)" size="small">
                {{ getRoleText(userInfo.role) }}
              </el-tag>
            </div>

            <!-- 基本信息 -->
            <div class="info-section">
              <el-form v-if="editMode" :model="editForm" :rules="editRules" ref="editFormRef" label-width="80px">
                <el-form-item label="用户名" prop="username">
                  <el-input v-model="editForm.username" disabled />
                </el-form-item>
                <el-form-item label="邮箱" prop="email">
                  <el-input v-model="editForm.email" placeholder="请输入新邮箱" />
                </el-form-item>
                <el-form-item v-if="editForm.email && editForm.email !== userInfo.email" label="验证码" prop="emailCode">
                  <div style="display: flex; gap: 10px;">
                    <el-input v-model="editForm.emailCode" placeholder="请输入6位验证码" maxlength="6" style="flex: 1;" />
                    <el-button 
                      :disabled="sendCodeDisabled" 
                      @click="handleSendEmailCode"
                      :loading="sendingCode"
                    >
                      {{ sendCodeText }}
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item label="手机号" prop="phone">
                  <el-input v-model="editForm.phone" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleUpdateProfile" :loading="updateLoading">
                    保存修改
                  </el-button>
                </el-form-item>
              </el-form>

              <div v-else class="info-display">
                <div class="info-item">
                  <span class="label">用户名：</span>
                  <span class="value">{{ userInfo.username }}</span>
                </div>
                <div class="info-item">
                  <span class="label">邮箱：</span>
                  <span class="value">{{ userInfo.email || '未设置' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">手机号：</span>
                  <span class="value">{{ userInfo.phone || '未设置' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">角色：</span>
                  <span class="value">{{ getRoleText(userInfo.role) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">状态：</span>
                  <el-tag :type="getStatusTagType(userInfo.status)" size="small">
                    {{ getStatusText(userInfo.status) }}
                  </el-tag>
                </div>
                <div class="info-item">
                  <span class="label">注册时间：</span>
                  <span class="value">{{ formatDate(userInfo.created_time) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">最后登录：</span>
                  <span class="value">{{ userInfo.last_login ? formatDate(userInfo.last_login) : '从未登录' }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：统计信息和快捷操作 -->
      <el-col :xs="24" :sm="24" :md="16" :lg="16">
        <div class="right-content">
        <!-- 统计卡片 -->
        <el-row :gutter="20" class="stats-row">
          <el-col :xs="24" :sm="8" :md="8" :lg="8">
            <el-card class="stat-card" shadow="never">
              <div class="stat-content">
                <div class="stat-icon">
                  <el-icon color="#409eff"><Reading /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ readerStats.total_borrowed || 0 }}</div>
                  <div class="stat-label">{{ userInfo.role === 'reader' ? '总借阅量' : '总记录数' }}</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8" :md="8" :lg="8">
            <el-card class="stat-card" shadow="never">
              <div class="stat-content">
                <div class="stat-icon">
                  <el-icon color="#67c23a"><SuccessFilled /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ readerStats.current_borrowed || 0 }}</div>
                  <div class="stat-label">当前借出</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8" :md="8" :lg="8">
            <el-card class="stat-card" shadow="never">
              <div class="stat-content">
                <div class="stat-icon">
                  <el-icon color="#f56c6c"><WarningFilled /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ readerStats.overdue_count || 0 }}</div>
                  <div class="stat-label">逾期图书</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 快捷操作 -->
        <el-card class="actions-card" shadow="never">
          <template #header>
            <span>快捷操作</span>
          </template>
          
          <div class="actions-grid">
            <div class="action-item" @click="handleChangePassword">
              <el-icon><Lock /></el-icon>
              <span>修改密码</span>
            </div>
            <div class="action-item" v-if="userInfo.role === 'reader'" @click="goToBorrow">
              <el-icon><Reading /></el-icon>
              <span>我的借阅</span>
            </div>
            <div class="action-item" v-if="userInfo.role !== 'reader'" @click="goToDashboard">
              <el-icon><DataBoard /></el-icon>
              <span>管理后台</span>
            </div>
            <div class="action-item" @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              <span>退出登录</span>
            </div>
          </div>
        </el-card>

        <!-- 最近活动 -->
        <el-card class="activity-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>{{ userInfo.role === 'reader' ? '最近借阅记录' : '最近借阅记录' }}</span>
              <el-button 
                type="primary" 
                size="small" 
                @click="goToBorrowManagement"
                v-if="recentBorrows.length > 0"
              >
                更多
              </el-button>
            </div>
          </template>
          
          <el-table :data="displayedBorrows" style="width: 100%" v-loading="borrowLoading" :show-header="false">
            <el-table-column prop="book_title" show-overflow-tooltip />
            <el-table-column prop="borrow_date" width="120" />
            <el-table-column prop="due_date" width="120" />
            <el-table-column prop="status" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          
          <div v-if="recentBorrows.length === 0" class="no-data">
            <el-empty description="暂无借阅记录" />
          </div>
        </el-card>
        </div>
      </el-col>
    </el-row>

    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="400px"
      :before-close="handleClosePasswordDialog"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="当前密码" prop="currentPassword">
          <el-input
            v-model="passwordForm.currentPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="passwordDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmitPassword" :loading="passwordLoading">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  User, Lock, Reading, DataBoard, SwitchButton, 
  SuccessFilled, WarningFilled 
} from '@element-plus/icons-vue'
import { getUserInfo, updateProfile, changePassword, sendEmailChangeCode } from '@/api/auth'
import { getBorrowList, getBorrowStats } from '@/api/borrow'

const store = useStore()
const router = useRouter()

// 响应式数据
const editMode = ref(false)
const updateLoading = ref(false)
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const borrowLoading = ref(false)
const editFormRef = ref(null)
const passwordFormRef = ref(null)

// 用户信息
const userInfo = ref({})
const userInfoLoading = ref(false)

// 编辑表单
const editForm = reactive({
  username: '',
  email: '',
  emailCode: '',
  phone: ''
})

// 编辑表单验证规则
const editRules = {
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  emailCode: [
    { required: true, message: '请输入邮箱验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码必须是6位数字', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 验证码相关状态
const sendingCode = ref(false)
const countdown = ref(0)
const sendCodeDisabled = computed(() => sendingCode.value || countdown.value > 0)
const sendCodeText = computed(() => {
  if (countdown.value > 0) {
    return `${countdown.value}秒后重发`
  }
  return '发送验证码'
})

// 修改密码表单
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 密码表单验证规则
const passwordRules = {
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 读者统计信息
const readerStats = ref({
  total_borrowed: 0,
  current_borrowed: 0,
  overdue_count: 0
})

// 最近借阅记录
const recentBorrows = ref([])

// 计算属性 - 显示的借阅记录（只显示前2条）
const displayedBorrows = computed(() => {
  return recentBorrows.value.slice(0, 2)
})

// 跳转到借阅管理页面
const goToBorrowManagement = () => {
  router.push('/borrow')
}

// 方法
const getRoleType = (role) => {
  const types = {
    'super_admin': 'danger',
    'admin': 'warning',
    'librarian': 'success',
    'reader': 'info'
  }
  return types[role] || 'info'
}

const getRoleText = (role) => {
  const texts = {
    'super_admin': '超级管理员',
    'admin': '系统管理员',
    'librarian': '图书管理员',
    'reader': '读者'
  }
  return texts[role] || '未知'
}

const getStatusTagType = (status) => {
  if (!status) return 'info'
  const statusLower = status.toString().toLowerCase()
  const types = {
    'active': 'success',
    'inactive': 'danger',
    'disabled': 'danger',
    'enabled': 'success',
    '激活': 'success',
    '禁用': 'danger',
    '正常': 'success',
    'normal': 'success'
  }
  return types[status] || types[statusLower] || 'info'
}

const getStatusText = (status) => {
  if (!status) return '未知'
  const texts = {
    'active': '激活',
    'inactive': '禁用',
    'disabled': '禁用',
    'enabled': '激活',
    '激活': '激活',
    '禁用': '禁用',
    '正常': '正常',
    'normal': '正常'
  }
  return texts[status] || status
}

const getStatusType = (status) => {
  const types = {
    '借出': 'primary',
    '已归还': 'success',
    '逾期': 'danger'
  }
  return types[status] || 'info'
}

const formatDate = (dateValue) => {
  if (!dateValue) return ''
  try {
    // 处理各种日期格式：字符串、Date对象等
    let date
    if (dateValue instanceof Date) {
      date = dateValue
    } else {
      date = new Date(dateValue)
    }
    
    if (isNaN(date.getTime())) return ''
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    console.error('日期格式化失败:', error, dateValue)
    return ''
  }
}

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    userInfoLoading.value = true
    
    const response = await getUserInfo()
    
    if (response && response.data) {
      if (response.data.success && response.data.data) {
        // 标准响应格式：{ success: true, data: {...} }
        userInfo.value = response.data.data
        initEditForm()
      } else if (response.data.success === false) {
        throw new Error(response.data.message || 'API调用失败')
      } else {
        // 直接返回用户数据
        userInfo.value = response.data
        initEditForm()
      }
    } else {
      throw new Error('API响应格式异常')
    }
  } catch (error) {
    // API调用失败，继续使用store中的信息
    // 这样可以确保页面正常显示，同时在后台尝试获取最新信息
    console.warn('获取最新用户信息失败，使用缓存信息:', error.message)
  } finally {
    userInfoLoading.value = false
  }
}

// 初始化编辑表单
const initEditForm = () => {
  editForm.username = userInfo.value.username || ''
  editForm.email = userInfo.value.email || ''
  editForm.emailCode = ''
  editForm.phone = userInfo.value.phone || ''
  countdown.value = 0
}

// 发送邮箱验证码
const handleSendEmailCode = async () => {
  if (!editForm.email) {
    ElMessage.warning('请先输入新邮箱')
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }

  if (editForm.email === userInfo.value.email) {
    ElMessage.warning('新邮箱与当前邮箱相同')
    return
  }

  try {
    sendingCode.value = true
    await sendEmailChangeCode({ newEmail: editForm.email })
    ElMessage.success('验证码已发送到新邮箱，请查收')
    
    // 开始倒计时
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error) {
    ElMessage.error(error.message || '发送验证码失败')
  } finally {
    sendingCode.value = false
  }
}

// 更新个人信息
const handleUpdateProfile = () => {
  editFormRef.value.validate((valid) => {
    if (valid) {
      // 如果修改了邮箱但没有输入验证码
      if (editForm.email !== userInfo.value.email && !editForm.emailCode) {
        ElMessage.warning('请输入邮箱验证码')
        return
      }

      updateLoading.value = true
      const updateData = {
        phone: editForm.phone
      }
      
      // 只有当邮箱发生变化时才包含邮箱和验证码
      if (editForm.email !== userInfo.value.email) {
        updateData.email = editForm.email
        updateData.emailCode = editForm.emailCode
      }

      updateProfile(updateData).then(() => {
        ElMessage.success('个人信息更新成功')
        editMode.value = false
        countdown.value = 0
        // 重新获取用户信息
        store.dispatch('user/getInfo')
        fetchUserInfo()
      }).catch((error) => {
        ElMessage.error(error.message || '更新失败')
      }).finally(() => {
        updateLoading.value = false
      })
    }
  })
}

// 修改密码
const handleChangePassword = () => {
  passwordDialogVisible.value = true
}

const handleSubmitPassword = () => {
  passwordFormRef.value.validate((valid) => {
    if (valid) {
      passwordLoading.value = true
      changePassword({
        oldPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword
      }).then(() => {
        ElMessage.success('密码修改成功')
        passwordDialogVisible.value = false
        resetPasswordForm()
      }).catch((error) => {
        ElMessage.error(error.message || '密码修改失败')
      }).finally(() => {
        passwordLoading.value = false
      })
    }
  })
}

const handleClosePasswordDialog = () => {
  resetPasswordForm()
}

const resetPasswordForm = () => {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  if (passwordFormRef.value) {
    passwordFormRef.value.resetFields()
  }
}

// 快捷操作
const goToBorrow = () => {
  router.push('/borrow')
}

const goToDashboard = () => {
  router.push('/')
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.dispatch('user/logout').then(() => {
      router.push('/login')
      ElMessage.success('退出登录成功')
    })
  }).catch(() => {
    // 用户点击取消，不做任何操作
  })
}

// 获取用户统计信息（读者或管理员）
const fetchReaderStats = async () => {
  // 移除角色限制，让所有用户都能看到统计
  // if (userInfo.value.role !== 'reader') return
  
  try {
    borrowLoading.value = true
    
    // 1. 获取最近2条借阅记录用于显示
    const recentResponse = await getBorrowList({
      page: 1,
      limit: 2
    })
    
    console.log('借阅记录API响应:', recentResponse)
    console.log('recentResponse.data:', recentResponse.data)
    console.log('recentResponse.data.success:', recentResponse.data.success)
    console.log('recentResponse.data.success类型:', typeof recentResponse.data.success)
    console.log('判断结果:', !!recentResponse.data.success)
    
    // 检查借阅记录数据
    if (recentResponse.success && recentResponse.data && recentResponse.data.records) {
      recentBorrows.value = recentResponse.data.records || []
      console.log('✅ 最近借阅记录设置成功:', recentBorrows.value)
      console.log('记录数量:', recentBorrows.value.length)
      
      // 显示每条记录的详细信息
      recentBorrows.value.forEach((record, index) => {
        console.log(`记录${index + 1}:`, {
          book_title: record.book_title,
          borrow_date: record.borrow_date,
          due_date: record.due_date,
          status: record.status
        })
      })
    } else {
      console.warn('❌ 无法提取借阅记录数据:', recentResponse)
      recentBorrows.value = []
    }
    
    // 2. 获取借阅统计信息
    try {
      const statsResponse = await getBorrowStats()
      console.log('统计API完整响应:', statsResponse)
      console.log('statsResponse类型:', typeof statsResponse)
      console.log('statsResponse.data:', statsResponse.data)
      console.log('statsResponse.data类型:', typeof statsResponse.data)
      console.log('statsResponse.data.data:', statsResponse.data?.data)
      console.log('statsResponse.data.data类型:', typeof statsResponse.data?.data)
      
      // 检查各种可能的数据路径
      if (statsResponse && statsResponse.data) {
        console.log('✅ 找到statsResponse.data')
        
        // 处理不同格式的统计数据
        let stats = null
        const data = statsResponse.data
        
        if (data.total_borrowed !== undefined) {
          // 读者个人统计格式
          console.log('✅ 检测到读者个人统计格式')
          stats = data
        } else if (data.overall) {
          // 管理员统计格式
          console.log('✅ 检测到管理员统计格式')
          stats = {
            total_borrowed: data.overall.total_borrowed || 0,
            current_borrowed: data.overall.current_borrowed || 0,
            overdue_count: data.overall.overdue_count || 0,
            total_fines: data.overall.total_fines || 0
          }
        } else {
          console.log('❌ 无法找到统计数据')
          console.log('statsResponse.data的所有键:', Object.keys(data))
          throw new Error('无法找到统计数据路径')
        }
        
        console.log('最终使用的统计数据:', stats)
        
        // 设置统计数据
        readerStats.value = {
          total_borrowed: stats.total_borrowed || 0,
          current_borrowed: stats.current_borrowed || 0,
          overdue_count: stats.overdue_count || 0,
          total_fines: stats.total_fines || 0
        }
        
        console.log('✅ 统计数据设置成功:', readerStats.value)
      } else {
        console.warn('❌ 无法提取统计数据:', statsResponse)
        throw new Error('无法提取统计数据')
      }
    } catch (statsError) {
      console.warn('统计API失败，使用简单备用方案:', statsError.message)
      
      // 简单备用方案：只获取第一页记录进行基本统计
      try {
        const fallbackResponse = await getBorrowList({
          page: 1,
          limit: 100
        })
        
        if (fallbackResponse.data.success) {
          const records = fallbackResponse.data.data.records || []
          console.log('备用方案记录:', records)
          
          readerStats.value = {
            total_borrowed: records.length, // 注意：这只是部分统计
            current_borrowed: records.filter(r => r.status === '借出').length,
            overdue_count: records.filter(r => r.status === '逾期').length
          }
          console.log('备用方案统计结果:', readerStats.value)
        }
      } catch (fallbackError) {
        console.error('备用方案也失败了:', fallbackError)
        // 设置默认值
        readerStats.value = {
          total_borrowed: 0,
          current_borrowed: 0,
          overdue_count: 0
        }
      }
    }
  } catch (error) {
    console.error('获取读者统计失败:', error)
    // 设置默认值
    readerStats.value = {
      total_borrowed: 0,
      current_borrowed: 0,
      overdue_count: 0
    }
  } finally {
    borrowLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  // 先使用store中的信息作为初始值
  const storeUserInfo = store.getters.userInfo
  
  if (storeUserInfo && Object.keys(storeUserInfo).length > 0) {
    userInfo.value = storeUserInfo
    initEditForm()
  } else {
    // 如果store中没有信息，尝试从localStorage恢复
    try {
      await store.dispatch('user/getInfo')
      const refreshedUserInfo = store.getters.userInfo
      if (refreshedUserInfo) {
        userInfo.value = refreshedUserInfo
        initEditForm()
      }
    } catch (error) {
      console.error('从localStorage恢复用户信息失败:', error)
    }
  }
  
  // 然后尝试获取完整信息（包含最新的时间字段）
  await fetchUserInfo()
  
  // 所有用户都获取统计信息
  fetchReaderStats()
})
</script>

<style scoped>
.profile-container {
  padding: 20px;
}

/* 底部对齐方案 - 让右侧整体与左侧等高 */
.profile-card {
  min-height: 500px;
}

/* 右侧内容使用flex布局，让最近借阅记录填充剩余空间 */
.right-content {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

/* 统计和快捷操作固定高度，最近借阅记录填充剩余空间 */
.activity-card {
  flex: 1;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.page-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.profile-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.avatar-section {
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;
}

.avatar-section h3 {
  margin: 15px 0 10px 0;
  color: #303133;
}

.info-section {
  padding: 0 10px;
}

.info-display .info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: #909399;
  font-size: 14px;
}

.info-item .value {
  color: #303133;
  font-weight: 500;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 100px;
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stat-icon {
  font-size: 32px;
  margin-right: 15px;
}

.stat-info .stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  line-height: 1;
}

.stat-info .stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.actions-card {
  margin-bottom: 20px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-item:hover {
  background: #e9ecef;
  transform: translateY(-2px);
}

.action-item .el-icon {
  font-size: 24px;
  color: #409eff;
  margin-bottom: 8px;
}

.action-item span {
  font-size: 14px;
  color: #303133;
}

.activity-card {
  margin-bottom: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.no-data {
  text-align: center;
  padding: 20px;
}

/* 确保卡片内容也填充空间 */
.activity-card .el-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 表格填充剩余空间 */
.activity-card .el-table {
  flex: 1;
}

@media (max-width: 768px) {
  .profile-container {
    padding: 10px;
  }
  
  .page-header {
    text-align: center;
  }
  
  .page-header h2 {
    font-size: 20px;
  }
  
  .page-header p {
    font-size: 13px;
  }
  
  .profile-card {
    margin-bottom: 15px;
  }
  
  .avatar-section {
    text-align: center;
  }
  
  .avatar-section .el-avatar {
    width: 60px !important;
    height: 60px !important;
  }
  
  .avatar-section h3 {
    font-size: 16px;
  }
  
  .card-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .stats-row .el-col {
    margin-bottom: 10px;
  }
  
  .stat-card {
    height: 80px;
  }
  
  .stat-icon {
    font-size: 24px;
    margin-right: 10px;
  }
  
  .stat-info .stat-value {
    font-size: 18px;
  }
  
  .stat-info .stat-label {
    font-size: 12px;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  
  .action-item {
    padding: 15px;
  }
  
  .action-item .el-icon {
    font-size: 20px;
  }
  
  .action-item span {
    font-size: 12px;
  }
  
  .right-content {
    margin-top: 0;
  }
}
</style>
