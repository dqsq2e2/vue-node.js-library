<template>
  <div class="navbar">
    <div class="navbar-left">
      <!-- 折叠按钮 -->
      <el-button
        type="text"
        @click="toggleSidebar"
        class="sidebar-toggle"
      >
        <el-icon><Fold v-if="sidebar.opened" /><Expand v-else /></el-icon>
      </el-button>
      
      <!-- 面包屑导航 -->
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
          <router-link v-if="item.path" :to="item.path">{{ item.title }}</router-link>
          <span v-else>{{ item.title }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <div class="navbar-right">
      <!-- 数据库状态指示器 -->
      <div class="database-status" v-if="currentDatabase">
        <el-tooltip :content="`当前主数据库: ${currentDatabase.toUpperCase()}`" placement="bottom">
          <el-tag :type="getDatabaseTagType(currentDatabase)" size="small">
            <el-icon><Coin /></el-icon>
            {{ currentDatabase.toUpperCase() }}
          </el-tag>
        </el-tooltip>
      </div>
      
      <!-- 用户下拉菜单 -->
      <el-dropdown @command="handleCommand" class="user-dropdown">
        <span class="user-info">
          <el-avatar :size="32" :src="userInfo?.avatar">
            <el-icon><User /></el-icon>
          </el-avatar>
          <span class="username">{{ userInfo?.real_name || userInfo?.username }}</span>
          <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>
              个人中心
            </el-dropdown-item>
            <el-dropdown-item command="changePassword">
              <el-icon><Lock /></el-icon>
              修改密码
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    
    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="changePasswordVisible"
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
          <el-button @click="changePasswordVisible = false">取消</el-button>
          <el-button type="primary" @click="handleChangePassword" :loading="passwordLoading">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { changePassword } from '@/api/auth'
import { getCurrentDatabase } from '@/api/database'

export default {
  name: 'Navbar',
  setup() {
    const store = useStore()
    const router = useRouter()
    const route = useRoute()
    
    // 响应式数据
    const changePasswordVisible = ref(false)
    const passwordLoading = ref(false)
    const currentDatabase = ref('')
    const passwordFormRef = ref(null)
    
    // 修改密码表单
    const passwordForm = ref({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    
    // 表单验证规则
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
            if (value !== passwordForm.value.newPassword) {
              callback(new Error('两次输入的密码不一致'))
            } else {
              callback()
            }
          },
          trigger: 'blur'
        }
      ]
    }
    
    // 计算属性
    const sidebar = computed(() => store.state.app.sidebar)
    const userInfo = computed(() => store.getters.userInfo)
    
    // 面包屑导航
    const breadcrumbs = computed(() => {
      const matched = route.matched.filter(item => item.meta && item.meta.title)
      const breadcrumbs = []
      
      matched.forEach(item => {
        breadcrumbs.push({
          title: item.meta.title,
          path: item.path === route.path ? null : item.path
        })
      })
      
      return breadcrumbs
    })
    
    // 方法
    const toggleSidebar = () => {
      store.dispatch('app/toggleSideBar')
    }
    
    const getDatabaseTagType = (database) => {
      const typeMap = {
        mysql: 'primary',
        mariadb: 'success',
        greatsql: 'warning'
      }
      return typeMap[database] || 'info'
    }
    
    const handleCommand = (command) => {
      switch (command) {
        case 'profile':
          router.push('/profile')
          break
        case 'changePassword':
          changePasswordVisible.value = true
          break
        case 'logout':
          handleLogout()
          break
      }
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
    
    const handleChangePassword = () => {
      passwordFormRef.value.validate((valid) => {
        if (valid) {
          passwordLoading.value = true
          changePassword({
            oldPassword: passwordForm.value.currentPassword,
            newPassword: passwordForm.value.newPassword,
            confirmPassword: passwordForm.value.confirmPassword
          }).then(() => {
            ElMessage.success('密码修改成功')
            changePasswordVisible.value = false
            resetPasswordForm()
          }).catch((error) => {
            ElMessage.error(error.response?.data?.message || '密码修改失败')
          }).finally(() => {
            passwordLoading.value = false
          })
        }
      })
    }
    
    const handleClosePasswordDialog = () => {
      resetPasswordForm()
      changePasswordVisible.value = false
    }
    
    const resetPasswordForm = () => {
      passwordForm.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      if (passwordFormRef.value) {
        passwordFormRef.value.resetFields()
      }
    }
    
    const fetchCurrentDatabase = async () => {
      // 只有在用户已登录且是管理员时才获取数据库信息
      if (!store.getters.token || !userInfo.value) {
        return
      }
      
      // 只有管理员才需要看到数据库信息
      if (userInfo.value.role !== 'admin') {
        return
      }
      
      try {
        const response = await getCurrentDatabase()
        currentDatabase.value = response.data.currentPrimaryDB
      } catch (error) {
        // 静默处理错误，不在控制台显示
        // 这个功能不是必需的，失败了也不影响系统使用
        currentDatabase.value = 'MySQL' // 设置默认值
      }
    }
    
    // 生命周期
    onMounted(() => {
      // 延迟获取数据库信息，确保用户已登录
      setTimeout(() => {
        if (store.getters.token) {
          fetchCurrentDatabase()
          // 每30秒更新一次数据库状态
          setInterval(fetchCurrentDatabase, 30000)
        }
      }, 1000)
    })
    
    return {
      sidebar,
      userInfo,
      breadcrumbs,
      currentDatabase,
      changePasswordVisible,
      passwordLoading,
      passwordForm,
      passwordRules,
      passwordFormRef,
      toggleSidebar,
      getDatabaseTagType,
      handleCommand,
      handleChangePassword,
      handleClosePasswordDialog
    }
  }
}
</script>

<style scoped>
.navbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.sidebar-toggle {
  font-size: 18px;
  color: #606266;
}

.breadcrumb {
  font-size: 14px;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.database-status {
  display: flex;
  align-items: center;
}

.user-dropdown {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #606266;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 12px;
    height: 56px;
  }
  
  .navbar-left {
    gap: 8px;
  }
  
  .sidebar-toggle {
    font-size: 20px;
    padding: 8px;
  }
  
  .breadcrumb {
    display: none;
  }
  
  .navbar-right {
    gap: 12px;
  }
  
  .database-status {
    display: none;
  }
  
  .username {
    display: none;
  }
  
  .user-info {
    padding: 6px 8px;
  }
}

@media (max-width: 480px) {
  .navbar {
    height: 52px;
  }
  
  .user-info .el-avatar {
    width: 28px !important;
    height: 28px !important;
  }
}
</style>
