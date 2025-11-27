<template>
  <div class="unified-users-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>{{ isLibrarian ? '读者管理' : '用户管理' }}</h1>
      <p>{{ isLibrarian ? '管理系统中的读者账号，包括借书证管理和读者信息维护' : '统一管理系统中的所有用户，包括管理员、图书管理员和读者' }}</p>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.search"
            placeholder="用户名、姓名、邮箱、手机号、借书证号"
            clearable
            style="width: 300px;"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="选择角色" clearable style="width: 150px;">
            <el-option v-if="isAdmin" label="全部" value="all" />
            <el-option v-if="isAdmin" label="管理员" value="admin" />
            <el-option v-if="isAdmin" label="图书管理员" value="librarian" />
            <el-option label="读者" value="reader" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="选择状态" clearable style="width: 120px;">
            <el-option label="激活" value="激活" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button v-if="isAdmin || isLibrarian" type="success" @click="handleAdd()">
            <el-icon><Plus /></el-icon>
            添加{{ isLibrarian ? '读者' : '用户' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 用户列表 -->
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading"
        :data="userList" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.limit + index + 1" />
        
        <el-table-column prop="real_name" label="姓名" width="120" show-overflow-tooltip />
        <el-table-column prop="username" label="用户名" width="150" show-overflow-tooltip />
        
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="getRoleType(row.role)">
              {{ getRoleText(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <!-- 读者专用列 -->
        <el-table-column 
          v-if="searchForm.role === 'reader' || searchForm.role === 'all'"
          prop="reader_profile.card_number" 
          label="借书证号" 
          width="130"
          show-overflow-tooltip 
        />
        
        <el-table-column 
          v-if="searchForm.role === 'reader' || searchForm.role === 'all'"
          prop="reader_profile.department" 
          label="部门" 
          width="150"
          show-overflow-tooltip 
        />
        
        <el-table-column 
          v-if="searchForm.role === 'reader'"
          prop="reader_profile.membership_type" 
          label="会员类型" 
          width="100"
        />
        
        <el-table-column prop="email" label="邮箱" width="180" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="130" />
        
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="last_login" label="最后登录" width="160">
          <template #default="{ row }">
            {{ formatDate(row.last_login) || '从未登录' }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="handleView(row)">
                查看
              </el-button>
              <el-button 
                v-if="canManageRole(row.role)" 
                type="warning" 
                size="small" 
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-dropdown v-if="canManageRole(row.role)" @command="(command) => handleDropdownCommand(command, row)">
                <el-button type="info" size="small">
                  更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="resetPassword">重置密码</el-dropdown-item>
                    <el-dropdown-item command="toggleStatus">
                      {{ row.status === '激活' ? '停用' : '激活' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 用户表单对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle" 
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form 
        ref="userFormRef" 
        :model="userForm" 
        :rules="userRules" 
        label-width="120px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input 
                v-model="userForm.username" 
                :placeholder="isEdit ? '用户名不可修改' : '请输入用户名'"
                :disabled="isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="真实姓名" prop="real_name">
              <el-input v-model="userForm.real_name" placeholder="请输入真实姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-select 
                v-model="userForm.role" 
                placeholder="选择角色" 
                style="width: 100%"
                @change="handleRoleChange"
                :disabled="isLibrarian"
              >
                <el-option v-if="isAdmin" label="管理员" value="admin" />
                <el-option v-if="isAdmin" label="图书管理员" value="librarian" />
                <el-option label="读者" value="reader" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="userForm.status" placeholder="选择状态" style="width: 100%">
                <el-option label="激活" value="激活" />
                <el-option label="停用" value="停用" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input 
                v-model="userForm.email" 
                type="email"
                placeholder="请输入邮箱" 
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input 
                v-model="userForm.phone" 
                type="tel"
                placeholder="请输入手机号" 
                clearable
                maxlength="11"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input 
            v-model="userForm.password" 
            type="password" 
            placeholder="请输入密码" 
            show-password
          />
        </el-form-item>
        
        <!-- 读者扩展字段 -->
        <template v-if="userForm.role === 'reader'">
          <el-divider content-position="left">读者信息</el-divider>
          
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="借书证号" prop="card_number">
                <el-input v-model="userForm.card_number" placeholder="请输入借书证号" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="性别" prop="gender">
                <el-select v-model="userForm.gender" placeholder="选择性别" style="width: 100%" clearable>
                  <el-option label="男" value="男" />
                  <el-option label="女" value="女" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="部门" prop="department">
                <el-input v-model="userForm.department" placeholder="请输入部门" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="会员类型" prop="membership_type">
                <el-select v-model="userForm.membership_type" placeholder="选择会员类型" style="width: 100%">
                  <el-option label="普通" value="普通" />
                  <el-option label="VIP" value="VIP" />
                  <el-option label="教师" value="教师" />
                  <el-option label="学生" value="学生" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="注册日期" prop="register_date">
                <el-date-picker
                  v-model="userForm.register_date"
                  type="date"
                  placeholder="选择注册日期"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="有效期至" prop="expire_date">
                <el-date-picker
                  v-model="userForm.expire_date"
                  type="date"
                  placeholder="选择有效期"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-form-item label="最大借书数" prop="max_borrow">
            <el-input-number
              v-model="userForm.max_borrow"
              :min="1"
              :max="20"
              style="width: 200px"
            />
          </el-form-item>
        </template>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '更新' : '创建' }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 用户详情对话框 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="600px">
      <div v-if="currentUser" class="user-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户ID">{{ currentUser.user_id }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ currentUser.username }}</el-descriptions-item>
          <el-descriptions-item label="真实姓名">{{ currentUser.real_name }}</el-descriptions-item>
          <el-descriptions-item label="角色">
            <el-tag :type="getRoleType(currentUser.role)">
              {{ getRoleText(currentUser.role) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ currentUser.email || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ currentUser.phone || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentUser.status)">
              {{ currentUser.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="最后登录">{{ formatDate(currentUser.last_login) || '从未登录' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentUser.created_time) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(currentUser.last_updated_time) }}</el-descriptions-item>
          
          <!-- 读者扩展信息 -->
          <template v-if="currentUser.reader_profile">
            <el-descriptions-item label="借书证号" :span="2">{{ currentUser.reader_profile.card_number }}</el-descriptions-item>
            <el-descriptions-item label="性别">{{ currentUser.reader_profile.gender || '未设置' }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ currentUser.reader_profile.department || '未设置' }}</el-descriptions-item>
            <el-descriptions-item label="会员类型">{{ currentUser.reader_profile.membership_type }}</el-descriptions-item>
            <el-descriptions-item label="最大借书数">{{ currentUser.reader_profile.max_borrow }}</el-descriptions-item>
            <el-descriptions-item label="注册日期">{{ formatDate(currentUser.reader_profile.register_date) }}</el-descriptions-item>
            <el-descriptions-item label="有效期至">{{ formatDate(currentUser.reader_profile.expire_date) }}</el-descriptions-item>
          </template>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, ArrowDown } from '@element-plus/icons-vue'
import { 
  getUnifiedUsers, 
  getUnifiedUser, 
  createUnifiedUser, 
  updateUnifiedUser, 
  deleteUnifiedUser,
  resetUserPassword 
} from '@/api/unified-users'
import { formatDate } from '@/utils'
import { useStore } from 'vuex'

// 路由和store
const route = useRoute()
const store = useStore()

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const isEdit = ref(false)
const userFormRef = ref(null)

// 当前用户信息和权限
const currentUserInfo = computed(() => store.getters.userInfo)
const isAdmin = computed(() => currentUserInfo.value?.role === 'admin')
const isLibrarian = computed(() => currentUserInfo.value?.role === 'librarian')
const canManageRole = (role) => {
  if (isAdmin.value) return true // 管理员可以管理所有角色
  if (isLibrarian.value) return role === 'reader' // 图书管理员只能管理读者
  return false
}

const searchForm = reactive({
  search: '',
  role: 'all',
  status: ''
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const userList = ref([])
const selectedUsers = ref([])
const currentUser = ref(null)

const userForm = reactive({
  user_id: null,
  username: '',
  password: '',
  real_name: '',
  role: 'reader',
  email: '',
  phone: '',
  status: '激活',
  // 读者扩展字段
  card_number: '',
  gender: '',
  department: '',
  membership_type: '普通',
  register_date: '',
  expire_date: '',
  max_borrow: 5
})

// 表单验证规则
const userRules = computed(() => ({
  username: isEdit.value ? [
    { min: 3, max: 50, message: '用户名长度在 3 到 50 个字符', trigger: 'blur' }
  ] : [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在 3 到 50 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' }
  ],
  real_name: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { max: 50, message: '姓名长度不能超过 50 个字符', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ],
  email: [
    { required: false, type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  phone: [
    { required: false, pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  card_number: [
    { 
      required: computed(() => userForm.role === 'reader'), 
      message: '请输入借书证号', 
      trigger: 'blur' 
    }
  ]
}))

// 计算属性
const dialogTitle = computed(() => {
  return isEdit.value ? '编辑用户' : '添加用户'
})

// 方法
const getRoleType = (role) => {
  const types = {
    admin: 'danger',
    librarian: 'warning',
    reader: 'success'
  }
  return types[role] || 'info'
}

const getRoleText = (role) => {
  const texts = {
    admin: '管理员',
    librarian: '图书管理员',
    reader: '读者'
  }
  return texts[role] || role
}

const getStatusType = (status) => {
  return status === '激活' ? 'success' : 'danger'
}

const fetchUsers = async () => {
  loading.value = true
  try {
    // 过滤掉空值参数
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    
    // 只添加非空的搜索参数
    if (searchForm.search) params.search = searchForm.search
    if (searchForm.role && searchForm.role !== 'all') params.role = searchForm.role
    if (searchForm.status) params.status = searchForm.status
    
    const response = await getUnifiedUsers(params)
    if (response.success) {
      userList.value = response.data.users
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchUsers()
}

const handleReset = () => {
  Object.assign(searchForm, {
    search: '',
    role: 'all',
    status: ''
  })
  pagination.page = 1
  fetchUsers()
}

const handleAdd = (defaultRole = null) => {
  resetForm()
  
  // 如果指定了默认角色，设置表单角色
  if (defaultRole) {
    userForm.role = defaultRole
  } else if (isLibrarian.value) {
    // 图书管理员默认只能添加读者
    userForm.role = 'reader'
  }
  
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = async (row) => {
  try {
    const response = await getUnifiedUser(row.user_id)
    if (response.success) {
      const user = response.data
      
      // 填充基础信息
      Object.keys(userForm).forEach(key => {
        if (user[key] !== undefined) {
          userForm[key] = user[key]
        }
      })
      
      // 填充读者扩展信息
      if (user.reader_profile) {
        Object.keys(user.reader_profile).forEach(key => {
          if (userForm[key] !== undefined) {
            userForm[key] = user.reader_profile[key]
          }
        })
      }
      
      isEdit.value = true
      dialogVisible.value = true
    }
  } catch (error) {
    console.error('获取用户详情失败:', error)
    ElMessage.error('获取用户详情失败')
  }
}

const handleView = async (row) => {
  try {
    const response = await getUnifiedUser(row.user_id)
    if (response.success) {
      currentUser.value = response.data
      detailVisible.value = true
    }
  } catch (error) {
    console.error('获取用户详情失败:', error)
    ElMessage.error('获取用户详情失败')
  }
}

const handleDropdownCommand = (command, row) => {
  switch (command) {
    case 'resetPassword':
      handleResetPassword(row)
      break
    case 'toggleStatus':
      handleToggleStatus(row)
      break
    case 'delete':
      handleDelete(row)
      break
  }
}

const handleResetPassword = (row) => {
  ElMessageBox.prompt('请输入新密码', '重置密码', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'password',
    inputValidator: (value) => {
      if (!value || value.length < 6) {
        return '密码长度至少6位'
      }
      return true
    }
  }).then(async ({ value }) => {
    try {
      await resetUserPassword(row.user_id, value)
      ElMessage.success('密码重置成功')
    } catch (error) {
      console.error('重置密码失败:', error)
      ElMessage.error('重置密码失败')
    }
  })
}

const handleToggleStatus = async (row) => {
  const newStatus = row.status === '激活' ? '停用' : '激活'
  const action = newStatus === '激活' ? '激活' : '停用'
  
  try {
    await ElMessageBox.confirm(`确定要${action}用户 ${row.real_name} 吗？`, '确认操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await updateUnifiedUser(row.user_id, { status: newStatus })
    ElMessage.success(`用户${action}成功`)
    fetchUsers()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${action}用户失败:`, error)
      ElMessage.error(`${action}用户失败`)
    }
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除用户 ${row.real_name} 吗？此操作不可恢复！`, '确认删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteUnifiedUser(row.user_id)
      ElMessage.success('用户删除成功')
      fetchUsers()
    } catch (error) {
      console.error('删除用户失败:', error)
      ElMessage.error('删除用户失败')
    }
  }).catch(() => {
    // 用户点击取消，不做任何操作
  })
}

const handleSubmit = () => {
  userFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      const formData = { ...userForm }
      
      // 如果不是读者角色，清除读者扩展字段
      if (formData.role !== 'reader') {
        delete formData.card_number
        delete formData.gender
        delete formData.department
        delete formData.membership_type
        delete formData.register_date
        delete formData.expire_date
        delete formData.max_borrow
      } else {
        // 如果是读者，确保日期格式正确
        if (formData.register_date) {
          formData.register_date = new Date(formData.register_date).toISOString().split('T')[0]
        }
        if (formData.expire_date) {
          formData.expire_date = new Date(formData.expire_date).toISOString().split('T')[0]
        }
      }
      
      if (isEdit.value) {
        await updateUnifiedUser(formData.user_id, formData)
        ElMessage.success('用户更新成功')
      } else {
        await createUnifiedUser(formData)
        ElMessage.success('用户创建成功')
      }
      
      dialogVisible.value = false
      fetchUsers()
    } catch (error) {
      console.error('提交失败:', error)
      
      // 显示具体的错误信息
      let errorMessage = isEdit.value ? '更新失败' : '创建失败'
      
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        }
        
        // 显示验证错误详情
        if (error.response.data.errors && error.response.data.errors.length > 0) {
          const validationErrors = error.response.data.errors.map(err => err.msg).join('; ')
          errorMessage += ': ' + validationErrors
        }
      }
      
      ElMessage.error(errorMessage)
    } finally {
      submitting.value = false
    }
  })
}

const handleRoleChange = (role) => {
  if (role === 'reader') {
    // 设置读者默认值
    userForm.register_date = new Date().toISOString().split('T')[0]
    userForm.expire_date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
}

const handleSelectionChange = (selection) => {
  selectedUsers.value = selection
}

const handleSizeChange = (size) => {
  pagination.limit = size
  pagination.page = 1
  fetchUsers()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  fetchUsers()
}

const resetForm = () => {
  Object.assign(userForm, {
    user_id: null,
    username: '',
    password: '',
    real_name: '',
    role: 'reader',
    email: '',
    phone: '',
    status: '激活',
    card_number: '',
    gender: '',
    department: '',
    membership_type: '普通',
    register_date: '',
    expire_date: '',
    max_borrow: 5
  })
  
  if (userFormRef.value) {
    userFormRef.value.clearValidate()
  }
}

// 生命周期
onMounted(() => {
  // 根据用户角色设置默认搜索条件
  if (isLibrarian.value) {
    // 图书管理员默认只显示读者
    searchForm.role = 'reader'
  }
  
  // 处理来自仪表盘的查询参数
  if (route.query.action === 'add') {
    const defaultRole = route.query.role || (isLibrarian.value ? 'reader' : null)
    handleAdd(defaultRole)
  }
  
  fetchUsers()
})
</script>

<style scoped>
.unified-users-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.page-header p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.search-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.user-detail {
  padding: 10px 0;
}

.dialog-footer {
  text-align: right;
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.action-buttons .el-button {
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .unified-users-container {
    padding: 10px;
  }
  
  .page-header h1 {
    font-size: 20px;
  }
}
</style>
