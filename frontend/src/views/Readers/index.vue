<template>
  <div class="readers-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>读者管理</h2>
        <p>管理读者信息和借阅权限</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加读者
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="姓名">
          <el-input 
            v-model="searchForm.name" 
            placeholder="请输入姓名"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="卡号">
          <el-input 
            v-model="searchForm.card_number" 
            placeholder="请输入卡号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input 
            v-model="searchForm.phone" 
            placeholder="请输入手机号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="会员类型">
          <el-select v-model="searchForm.membership_type" placeholder="选择会员类型" clearable style="width: 120px;">
            <el-option label="普通" value="普通" />
            <el-option label="VIP" value="VIP" />
            <el-option label="教师" value="教师" />
            <el-option label="学生" value="学生" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="选择状态" clearable style="width: 100px;">
            <el-option label="正常" value="正常" />
            <el-option label="冻结" value="冻结" />
            <el-option label="注销" value="注销" />
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
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 读者列表 -->
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading"
        :data="readerList" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @row-dblclick="handleRowDblClick"
        class="clickable-table"
        stripe
        border
      >
        <el-table-column v-if="!isMobile" type="selection" width="55" />
        <el-table-column v-if="!isMobile" type="index" label="序号" width="60" :index="(index) => (pagination.page - 1) * pagination.size + index + 1" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column v-if="!isMobile" prop="card_number" label="卡号" width="120" />
        <el-table-column v-if="!isMobile" prop="gender" label="性别" width="60">
          <template #default="{ row }">
            <el-tag :type="row.gender === '男' ? 'primary' : 'success'" size="small">
              {{ row.gender }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" prop="phone" label="手机号" width="120" />
        <el-table-column v-if="!isMobile" prop="email" label="邮箱" width="150" show-overflow-tooltip />
        <el-table-column v-if="!isMobile" prop="department" label="部门" width="100" show-overflow-tooltip />
        <el-table-column v-if="!isMobile" prop="membership_type" label="会员类型" width="80">
          <template #default="{ row }">
            <el-tag :type="getMembershipType(row.membership_type)" size="small">
              {{ row.membership_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" label="注册日期" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.register_date) }}
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" label="到期日期" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'text-danger': isExpiringSoon(row.expire_date) }">
              {{ formatDate(row.expire_date) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" prop="status" label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="isMobile ? '' : 100">
          <template #default="{ row }">
            <div class="action-buttons">
              <div class="desktop-actions" @click.stop>
                <el-dropdown @command="(cmd) => handleCommand(cmd, row)">
                  <el-button type="primary" size="small">操作<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div class="mobile-actions" @click.stop>
                <el-dropdown @command="(cmd) => handleCommand(cmd, row)">
                  <el-button type="primary" size="small">操作<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="650px"
      @close="handleDialogClose"
    >
      <el-form
        ref="readerFormRef"
        :model="readerForm"
        :rules="readerRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="readerForm.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="卡号" prop="card_number">
              <el-input v-model="readerForm.card_number" placeholder="请输入卡号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-select v-model="readerForm.gender" placeholder="选择性别" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="readerForm.phone" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="readerForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="部门" prop="department">
              <el-input v-model="readerForm.department" placeholder="请输入部门" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="会员类型" prop="membership_type">
              <el-select v-model="readerForm.membership_type" placeholder="选择会员类型" style="width: 100%">
                <el-option label="普通" value="普通" />
                <el-option label="VIP" value="VIP" />
                <el-option label="学生" value="学生" />
                <el-option label="教师" value="教师" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="注册日期" prop="register_date">
              <el-date-picker
                v-model="readerForm.register_date"
                type="date"
                placeholder="选择注册日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期" prop="expire_date">
              <el-date-picker
                v-model="readerForm.expire_date"
                type="date"
                placeholder="选择到期日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最大借阅" prop="max_borrow">
              <el-input-number
                v-model="readerForm.max_borrow"
                :min="1"
                :max="20"
                placeholder="最大借阅数"
                style="width: 100%; min-width: 120px;"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="readerForm.status" placeholder="选择状态" style="width: 100%">
                <el-option label="正常" value="正常" />
                <el-option label="冻结" value="冻结" />
                <el-option label="过期" value="过期" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="读者详情" width="500px">
      <div v-if="currentReader" class="reader-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="姓名">{{ currentReader.name }}</el-descriptions-item>
          <el-descriptions-item label="卡号">{{ currentReader.card_number }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ currentReader.gender }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ currentReader.phone }}</el-descriptions-item>
          <el-descriptions-item label="邮箱" :span="2">{{ currentReader.email }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ currentReader.department }}</el-descriptions-item>
          <el-descriptions-item label="会员类型">
            <el-tag :type="getMembershipType(currentReader.membership_type)" size="small">
              {{ currentReader.membership_type }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册日期">{{ formatDate(currentReader.register_date) }}</el-descriptions-item>
          <el-descriptions-item label="到期日期">{{ formatDate(currentReader.expire_date) }}</el-descriptions-item>
          <el-descriptions-item label="最大借阅">{{ currentReader.max_borrow }}本</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentReader.status)" size="small">
              {{ currentReader.status }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, ArrowDown } from '@element-plus/icons-vue'
import { getReaders, addReader, updateReader, deleteReader } from '@/api/readers'
import { formatDate } from '@/utils'

// 路由
const route = useRoute()

// 移动端检测
const isMobile = ref(window.innerWidth <= 768)
const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const readerList = ref([])
const selectedReaders = ref([])
const currentReader = ref(null)
const readerFormRef = ref(null)

// 搜索表单
const searchForm = reactive({
  name: '',
  card_number: '',
  phone: '',
  membership_type: '',
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 读者表单
const readerForm = reactive({
  reader_id: null,
  name: '',
  card_number: '',
  gender: '',
  phone: '',
  email: '',
  department: '',
  membership_type: '',
  register_date: '',
  expire_date: '',
  max_borrow: 5,
  status: '正常'
})

// 表单验证规则
const readerRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  card_number: [{ required: true, message: '请输入卡号', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  membership_type: [{ required: true, message: '请选择会员类型', trigger: 'change' }],
  register_date: [{ required: true, message: '请选择注册日期', trigger: 'change' }],
  expire_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }],
  max_borrow: [{ required: true, message: '请输入最大借阅数', trigger: 'blur' }]
}

// 计算属性
const dialogTitle = computed(() => {
  return readerForm.reader_id ? '编辑读者' : '添加读者'
})

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    '正常': 'success',
    '冻结': 'warning',
    '过期': 'danger'
  }
  return statusMap[status] || 'info'
}

// 获取会员类型
const getMembershipType = (type) => {
  const typeMap = {
    'VIP': 'warning',
    '教师': 'success',
    '学生': 'primary',
    '普通': 'info'
  }
  return typeMap[type] || 'info'
}

// 检查是否即将过期
const isExpiringSoon = (expireDate) => {
  if (!expireDate) return false
  const expire = new Date(expireDate)
  const now = new Date()
  const diffDays = Math.ceil((expire - now) / (1000 * 60 * 60 * 24))
  return diffDays <= 30 && diffDays >= 0
}

// 获取读者列表
const fetchReaders = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      size: pagination.size,
      ...searchForm
    }
    
    // 过滤空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key]
      }
    })
    
    const response = await getReaders(params)
    if (response.success) {
      // 统一用户管理API返回的是users数组，转换为读者格式
      const users = response.data.users || []
      readerList.value = users.map(user => ({
        reader_id: user.user_id,
        name: user.real_name,
        card_number: user.reader_profile?.card_number || '',
        gender: user.reader_profile?.gender || '',
        department: user.reader_profile?.department || '',
        membership_type: user.reader_profile?.membership_type || '',
        status: user.status,
        email: user.email,
        phone: user.phone,
        register_date: user.reader_profile?.register_date,
        expire_date: user.reader_profile?.expire_date,
        max_borrow: user.reader_profile?.max_borrow || 5,
        user_id: user.user_id
      }))
      pagination.total = response.data.pagination?.total || response.data.total || 0
    }
  } catch (error) {
    ElMessage.error('获取读者列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchReaders()
}

// 重置搜索
const handleReset = () => {
  Object.keys(searchForm).forEach(key => {
    searchForm[key] = ''
  })
  pagination.page = 1
  fetchReaders()
}

// 分页大小改变
const handleSizeChange = (size) => {
  pagination.size = size
  pagination.page = 1
  fetchReaders()
}

// 当前页改变
const handleCurrentChange = (page) => {
  pagination.page = page
  fetchReaders()
}

// 选择改变
const handleSelectionChange = (selection) => {
  selectedReaders.value = selection
}

// 添加读者
const handleAdd = () => {
  resetForm()
  // 设置默认日期
  const today = new Date().toISOString().split('T')[0]
  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  
  readerForm.register_date = today
  readerForm.expire_date = nextYear.toISOString().split('T')[0]
  
  dialogVisible.value = true
}

// 编辑读者
const handleEdit = (row) => {
  Object.keys(readerForm).forEach(key => {
    if (key === 'max_borrow') {
      readerForm[key] = row[key] || 5
    } else {
      readerForm[key] = row[key] || ''
    }
  })
  dialogVisible.value = true
}

// 查看详情
const handleView = (row) => {
  currentReader.value = row
  detailVisible.value = true
}

// 行单击事件
const handleRowClick = (row) => {
  if (isMobile.value) {
    handleView(row)
  }
}

// 行双击事件
const handleRowDblClick = (row) => {
  if (!isMobile.value) {
    handleView(row)
  }
}

// 处理下拉菜单命令
const handleCommand = (cmd, row) => {
  if (cmd === 'edit') handleEdit(row)
  else if (cmd === 'view') handleView(row)
  else if (cmd === 'delete') handleDelete(row)
}

// 删除读者
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除读者"${row.name}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await deleteReader(row.reader_id)
    if (response.success) {
      ElMessage.success('删除成功')
      fetchReaders()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!readerFormRef.value) return
  
  try {
    await readerFormRef.value.validate()
    submitting.value = true
    
    const formData = { ...readerForm }
    
    // 数据格式化处理
    if (formData.register_date) {
      // 确保日期格式正确
      const date = new Date(formData.register_date)
      formData.register_date = date.toISOString().split('T')[0] // YYYY-MM-DD格式
    }
    if (formData.expire_date) {
      // 确保日期格式正确
      const date = new Date(formData.expire_date)
      formData.expire_date = date.toISOString().split('T')[0] // YYYY-MM-DD格式
    }
    
    // 确保数字类型正确
    if (formData.max_borrow !== undefined && formData.max_borrow !== null) {
      formData.max_borrow = parseInt(formData.max_borrow)
    }
    
    let response
    
    if (formData.reader_id) {
      // 更新时，从数据中移除reader_id，只发送需要更新的字段
      const { reader_id, ...updateData } = formData
      response = await updateReader(reader_id, updateData)
    } else {
      // 添加时，移除reader_id字段
      delete formData.reader_id
      response = await addReader(formData)
    }
    
    if (response.success) {
      ElMessage.success(formData.reader_id ? '更新成功' : '添加成功')
      dialogVisible.value = false
      fetchReaders()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleDialogClose = () => {
  resetForm()
}

// 重置表单
const resetForm = () => {
  Object.keys(readerForm).forEach(key => {
    if (key === 'max_borrow') {
      readerForm[key] = 5
    } else if (key === 'status') {
      readerForm[key] = '正常'
    } else {
      readerForm[key] = key === 'reader_id' ? null : ''
    }
  })
  
  if (readerFormRef.value) {
    readerFormRef.value.clearValidate()
  }
}

// 生命周期
onMounted(() => {
  window.addEventListener('resize', handleResize)
  fetchReaders()
  
  // 检查是否需要自动打开添加对话框
  if (route.query.action === 'add') {
    handleAdd()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.readers-container {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left h2 {
  margin: 0 0 5px 0;
  color: #303133;
}

.header-left p {
  margin: 0;
  color: #909399;
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

.reader-detail {
  padding: 10px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.text-danger {
  color: #f56c6c;
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-card__body) {
  padding: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons .mobile-actions {
  display: none;
}

/* 移动端适配 */
@media (max-width: 768px) {
  /* 隐藏次要列和选择列 */
  :deep(.mobile-hide),
  :deep(.el-table-column--selection) {
    display: none !important;
  }
  
  /* 表格优化 - 强制占满宽度 */
  :deep(.el-table__header-wrapper table),
  :deep(.el-table__body-wrapper table) {
    width: 100% !important;
  }
  
  .readers-container {
    padding: 0;
  }
  
  .table-card {
    margin: 0 !important;
    border-radius: 0 !important;
  }
  
  .search-card {
    margin: 8px !important;
    border-radius: 8px !important;
  }
  
  .search-card :deep(.el-card__body) {
    padding: 12px !important;
  }
  
  .table-card :deep(.el-card__body) {
    padding: 8px 0 !important;
  }
  
  .page-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .action-buttons .desktop-actions {
    display: none;
  }
  
  .action-buttons .mobile-actions {
    display: block;
  }
}

/* 可点击表格样式 */
.clickable-table :deep(.el-table__row) {
  cursor: pointer;
}

.clickable-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>
