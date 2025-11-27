<template>
  <div class="borrow-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>{{ isReader ? '我的借阅' : '借阅管理' }}</h2>
        <p>{{ isReader ? '查看和管理我的借阅记录' : '管理图书借阅、归还和续借' }}</p>
      </div>
      <div class="header-right" v-if="!isReader">
        <el-button type="primary" @click="handleBorrow">
          <el-icon><Plus /></el-icon>
          新增借阅
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.total_borrowed || 0 }}</div>
            <div class="stats-label">{{ isReader ? '我的总借阅' : '总借阅量' }}</div>
          </div>
          <el-icon class="stats-icon" color="#409EFF"><Reading /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.current_borrowed || 0 }}</div>
            <div class="stats-label">{{ isReader ? '当前借阅' : '当前借出' }}</div>
          </div>
          <el-icon class="stats-icon" color="#67C23A"><Document /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.overdue_count || 0 }}</div>
            <div class="stats-label">{{ isReader ? '我的逾期' : '逾期未还' }}</div>
          </div>
          <el-icon class="stats-icon" color="#F56C6C"><Warning /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.today_returns || 0 }}</div>
            <div class="stats-label">{{ isReader ? '今日归还' : '今日归还' }}</div>
          </div>
          <el-icon class="stats-icon" color="#E6A23C"><Check /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索和筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="读者姓名">
          <el-input 
            v-model="searchForm.reader_name" 
            placeholder="请输入读者姓名"
            clearable
            style="width: 180px;"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="图书名称">
          <el-input 
            v-model="searchForm.book_title" 
            placeholder="请输入图书名称"
            clearable
            style="width: 200px;"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="借阅状态">
          <el-select 
            v-model="searchForm.status" 
            placeholder="选择状态" 
            clearable
            style="width: 150px;"
          >
            <el-option label="借出" value="借出" />
            <el-option label="已还" value="已还" />
            <el-option label="逾期" value="逾期" />
            <el-option label="续借" value="续借" />
          </el-select>
        </el-form-item>
        <el-form-item label="借阅日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 240px;"
            @change="handleDateChange"
          />
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

    <!-- 借阅记录列表 -->
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading"
        :data="borrowList" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.size + index + 1" />
        <el-table-column prop="reader_name" label="读者姓名" width="120" />
        <el-table-column prop="card_number" label="卡号" width="120" />
        <el-table-column prop="book_title" label="图书名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="isbn" label="ISBN" width="130" />
        <el-table-column prop="borrow_date" label="借阅日期" width="110" />
        <el-table-column prop="due_date" label="应还日期" width="110">
          <template #default="{ row }">
            <span :class="{ 'text-danger': isOverdue(row.due_date, row.status) }">
              {{ row.due_date }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="return_date" label="归还日期" width="110">
          <template #default="{ row }">
            {{ row.return_date || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fine_amount" label="罚金" width="80">
          <template #default="{ row }">
            {{ row.fine_amount ? `¥${row.fine_amount}` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === '借出' || row.status === '逾期'"
              type="success" 
              size="small" 
              @click="handleReturn(row)"
            >
              归还
            </el-button>
            <el-button 
              v-if="row.status === '借出' && canRenew(row)"
              type="warning" 
              size="small" 
              @click="handleRenew(row)"
            >
              续借
            </el-button>
            <el-button type="info" size="small" @click="handleView(row)">
              详情
            </el-button>
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

    <!-- 新增借阅对话框 -->
    <el-dialog
      v-model="borrowDialogVisible"
      title="新增借阅"
      width="500px"
      @close="handleBorrowDialogClose"
    >
      <el-form
        ref="borrowFormRef"
        :model="borrowForm"
        :rules="borrowRules"
        label-width="100px"
      >
        <el-form-item label="读者" prop="reader_id">
          <el-select
            v-model="borrowForm.reader_id"
            placeholder="请选择读者"
            filterable
            remote
            :remote-method="searchReaders"
            :loading="readerSearchLoading"
            style="width: 100%"
          >
            <el-option
              v-for="reader in readerOptions"
              :key="reader.reader_id"
              :label="`${reader.name} (${reader.card_number})`"
              :value="reader.reader_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="图书" prop="book_id">
          <el-select
            v-model="borrowForm.book_id"
            placeholder="请选择图书"
            filterable
            remote
            :remote-method="searchBooks"
            :loading="bookSearchLoading"
            style="width: 100%"
          >
            <el-option
              v-for="book in bookOptions"
              :key="book.book_id"
              :label="`${book.title} (${book.isbn})`"
              :value="book.book_id"
              :disabled="book.available_copies <= 0"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="借阅天数" prop="borrow_days">
          <el-input-number
            v-model="borrowForm.borrow_days"
            :min="1"
            :max="90"
            placeholder="借阅天数"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="borrowForm.remarks"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="borrowDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleBorrowSubmit" :loading="submitting">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 归还对话框 -->
    <el-dialog
      v-model="returnDialogVisible"
      title="图书归还"
      width="400px"
    >
      <div v-if="currentBorrow">
        <p><strong>读者：</strong>{{ currentBorrow.reader_name }}</p>
        <p><strong>图书：</strong>{{ currentBorrow.book_title }}</p>
        <p><strong>借阅日期：</strong>{{ currentBorrow.borrow_date }}</p>
        <p><strong>应还日期：</strong>{{ currentBorrow.due_date }}</p>
        <p v-if="isOverdue(currentBorrow.due_date, currentBorrow.status)" class="text-danger">
          <strong>逾期天数：</strong>{{ getOverdueDays(currentBorrow.due_date) }}天
        </p>
        <el-form :model="returnForm" label-width="80px">
          <el-form-item v-if="!isReader" label="罚金">
            <el-input-number
              v-model="returnForm.fine_amount"
              :min="0"
              :precision="2"
              placeholder="罚金金额"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item v-if="!isReader" label="备注">
            <el-input
              v-model="returnForm.return_remarks"
              type="textarea"
              :rows="2"
              placeholder="归还备注"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="returnDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleReturnSubmit" :loading="submitting">
            确认归还
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="借阅详情" width="500px">
      <div v-if="currentBorrow" class="borrow-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="借阅ID">{{ currentBorrow.borrow_id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentBorrow.status)" size="small">
              {{ currentBorrow.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="读者姓名">{{ currentBorrow.reader_name }}</el-descriptions-item>
          <el-descriptions-item label="读者卡号">{{ currentBorrow.reader_card_number }}</el-descriptions-item>
          <el-descriptions-item label="图书名称" :span="2">{{ currentBorrow.book_title }}</el-descriptions-item>
          <el-descriptions-item label="图书ISBN">{{ currentBorrow.book_isbn }}</el-descriptions-item>
          <el-descriptions-item label="图书作者">{{ currentBorrow.book_author }}</el-descriptions-item>
          <el-descriptions-item label="借阅日期">{{ currentBorrow.borrow_date }}</el-descriptions-item>
          <el-descriptions-item label="应还日期">{{ currentBorrow.due_date }}</el-descriptions-item>
          <el-descriptions-item label="归还日期">{{ currentBorrow.return_date || '未归还' }}</el-descriptions-item>
          <el-descriptions-item label="罚金">{{ currentBorrow.fine_amount ? `¥${currentBorrow.fine_amount}` : '无' }}</el-descriptions-item>
          <el-descriptions-item label="续借次数">{{ currentBorrow.renew_count || 0 }}次</el-descriptions-item>
          <el-descriptions-item label="操作员">{{ currentBorrow.operator_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentBorrow.remarks || '无' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Reading, Document, Warning, Check } from '@element-plus/icons-vue'
import { getBorrowRecords, addBorrowRecord, returnBook, renewBook, getBorrowStats } from '@/api/borrow'
import { getReaders } from '@/api/readers'
import { getBooks } from '@/api/books'

const store = useStore()
const route = useRoute()

// 用户信息
const userInfo = computed(() => store.getters.userInfo || {})
const isReader = computed(() => userInfo.value.role === 'reader')

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const borrowDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const detailVisible = ref(false)
const readerSearchLoading = ref(false)
const bookSearchLoading = ref(false)

const borrowList = ref([])
const selectedBorrows = ref([])
const currentBorrow = ref(null)
const borrowFormRef = ref(null)
const dateRange = ref([])

const readerOptions = ref([])
const bookOptions = ref([])

// 统计数据
const stats = ref({
  total_borrowed: 0,
  current_borrowed: 0,
  overdue_count: 0,
  returned_today: 0
})

// 搜索表单
const searchForm = reactive({
  reader_name: '',
  book_title: '',
  status: '',
  start_date: '',
  end_date: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 借阅表单
const borrowForm = reactive({
  reader_id: '',
  book_id: '',
  borrow_days: 30,
  remarks: ''
})

// 归还表单
const returnForm = reactive({
  fine_amount: 0,
  return_remarks: ''
})

// 表单验证规则
const borrowRules = {
  reader_id: [{ required: true, message: '请选择读者', trigger: 'change' }],
  book_id: [{ required: true, message: '请选择图书', trigger: 'change' }],
  borrow_days: [{ required: true, message: '请输入借阅天数', trigger: 'blur' }]
}

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    '借出': 'primary',
    '已还': 'success',
    '逾期': 'danger',
    '续借': 'warning'
  }
  return statusMap[status] || 'info'
}

// 检查是否逾期
const isOverdue = (dueDate, status) => {
  if (status === '已还') return false
  const due = new Date(dueDate)
  const now = new Date()
  return now > due
}

// 获取逾期天数
const getOverdueDays = (dueDate) => {
  const due = new Date(dueDate)
  const now = new Date()
  const diffTime = now - due
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// 检查是否可以续借
const canRenew = (row) => {
  return (row.renew_count || 0) < 2 && !isOverdue(row.due_date, row.status)
}

// 获取借阅统计
const fetchBorrowStats = async () => {
  try {
    const response = await getBorrowStats()
    console.log('借阅管理页面统计API响应:', response)
    
    if (response.success) {
      const data = response.data
      console.log('统计数据:', data)
      
      // 处理不同格式的统计数据
      if (isReader.value) {
        // 读者个人统计格式
        stats.value = {
          total_borrowed: data.total_borrowed || 0,
          current_borrowed: data.current_borrowed || 0,
          overdue_count: data.overdue_count || 0,
          today_returns: data.today_returns || data.today_borrows || 0
        }
        console.log('读者统计数据设置:', stats.value)
        console.log('stats.value.total_borrowed:', stats.value.total_borrowed)
        console.log('stats响应式对象:', stats)
      } else {
        // 管理员统计格式
        const { today, overall } = data
        console.log('管理员today数据:', today)
        console.log('管理员overall数据:', overall)
        console.log('overall.total_records:', overall?.total_records)
        console.log('overall字段列表:', overall ? Object.keys(overall) : 'overall为空')
        
        stats.value = {
          total_borrowed: overall?.total_borrowed || 0,
          current_borrowed: overall?.current_borrowed || 0,
          overdue_count: overall?.overdue_count || 0,
          today_returns: today?.today_returns || 0
        }
        console.log('管理员统计数据设置:', stats.value)
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    // 设置默认值
    stats.value = {
      total_borrowed: 0,
      current_borrowed: 0,
      overdue_count: 0,
      returned_today: 0
    }
  }
}

// 获取借阅记录列表
const fetchBorrowRecords = async () => {
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
    
    const response = await getBorrowRecords(params)
    if (response.success) {
      borrowList.value = response.data.records || []
      pagination.total = response.data.pagination?.total || response.data.total || 0
    }
  } catch (error) {
    ElMessage.error('获取借阅记录失败')
  } finally {
    loading.value = false
  }
}

// 搜索读者
const searchReaders = async (query) => {
  if (!query) {
    readerOptions.value = []
    return
  }
  
  readerSearchLoading.value = true
  try {
    const response = await getReaders({ 
      search: query, 
      status: '激活',
      role: 'reader',
      limit: 10 // 限制搜索结果数量
    })
    if (response.success) {
      // 统一用户管理API返回的是users数组，需要转换为读者格式
      const users = response.data.users || []
      readerOptions.value = users.map(user => ({
        reader_id: user.user_id,
        name: user.real_name,
        card_number: user.reader_profile?.card_number || '',
        user_id: user.user_id
      }))
    }
  } catch (error) {
    console.error('搜索读者失败:', error)
    ElMessage.error('搜索读者失败')
  } finally {
    readerSearchLoading.value = false
  }
}

// 搜索图书
const searchBooks = async (query) => {
  if (!query) {
    bookOptions.value = []
    return
  }
  
  bookSearchLoading.value = true
  try {
    const response = await getBooks({ title: query, status: '在库' })
    if (response.success) {
      bookOptions.value = response.data.books || []
    }
  } catch (error) {
    console.error('搜索图书失败:', error)
  } finally {
    bookSearchLoading.value = false
  }
}

// 日期范围改变
const handleDateChange = (dates) => {
  if (dates && dates.length === 2) {
    searchForm.start_date = dates[0]
    searchForm.end_date = dates[1]
  } else {
    searchForm.start_date = ''
    searchForm.end_date = ''
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchBorrowRecords()
}

// 重置搜索
const handleReset = () => {
  Object.keys(searchForm).forEach(key => {
    searchForm[key] = ''
  })
  dateRange.value = []
  pagination.page = 1
  fetchBorrowRecords()
}

// 分页大小改变
const handleSizeChange = (size) => {
  pagination.size = size
  pagination.page = 1
  fetchBorrowRecords()
}

// 当前页改变
const handleCurrentChange = (page) => {
  pagination.page = page
  fetchBorrowRecords()
}

// 选择改变
const handleSelectionChange = (selection) => {
  selectedBorrows.value = selection
}

// 新增借阅
const handleBorrow = () => {
  resetBorrowForm()
  borrowDialogVisible.value = true
}

// 归还图书
const handleReturn = (row) => {
  currentBorrow.value = row
  returnForm.fine_amount = 0
  returnForm.return_remarks = ''
  
  // 如果逾期，计算罚金
  if (isOverdue(row.due_date, row.status)) {
    const overdueDays = getOverdueDays(row.due_date)
    returnForm.fine_amount = overdueDays * 0.5 // 每天0.5元罚金
  }
  
  returnDialogVisible.value = true
}

// 续借图书
const handleRenew = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要为"${row.book_title}"续借30天吗？`,
      '确认续借',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const response = await renewBook(row.record_id, { renew_days: 30 })
    if (response.success) {
      ElMessage.success('续借成功')
      fetchBorrowRecords()
      fetchBorrowStats()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('续借失败')
    }
  }
}

// 查看详情
const handleView = (row) => {
  currentBorrow.value = row
  detailVisible.value = true
}

// 提交借阅
const handleBorrowSubmit = async () => {
  if (!borrowFormRef.value) return
  
  try {
    await borrowFormRef.value.validate()
    submitting.value = true
    
    const response = await addBorrowRecord(borrowForm)
    if (response.success) {
      ElMessage.success('借阅成功')
      borrowDialogVisible.value = false
      fetchBorrowRecords()
      fetchBorrowStats()
    }
  } catch (error) {
    ElMessage.error('借阅失败')
  } finally {
    submitting.value = false
  }
}

// 提交归还
const handleReturnSubmit = async () => {
  try {
    submitting.value = true
    
    // 读者归还时不传递罚金和备注
    const returnData = isReader.value ? {} : returnForm
    const response = await returnBook(currentBorrow.value.record_id, returnData)
    if (response.success) {
      ElMessage.success('归还成功')
      returnDialogVisible.value = false
      fetchBorrowRecords()
      fetchBorrowStats()
    }
  } catch (error) {
    ElMessage.error('归还失败')
  } finally {
    submitting.value = false
  }
}

// 关闭借阅对话框
const handleBorrowDialogClose = () => {
  resetBorrowForm()
}

// 重置借阅表单
const resetBorrowForm = () => {
  borrowForm.reader_id = ''
  borrowForm.book_id = ''
  borrowForm.borrow_days = 30
  borrowForm.remarks = ''
  
  readerOptions.value = []
  bookOptions.value = []
  
  if (borrowFormRef.value) {
    borrowFormRef.value.clearValidate()
  }
}

// 生命周期
onMounted(() => {
  fetchBorrowRecords()
  fetchBorrowStats()
  
  // 检查是否需要自动打开添加对话框
  if (route.query.action === 'add') {
    handleBorrow()
  }
})
</script>

<style scoped>
.borrow-container {
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

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  position: relative;
  overflow: hidden;
}

.stats-content {
  position: relative;
  z-index: 2;
}

.stats-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stats-label {
  font-size: 14px;
  color: #909399;
}

.stats-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 32px;
  opacity: 0.3;
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

.borrow-detail {
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

:deep(.stats-card .el-card__body) {
  padding: 20px;
  height: 80px;
  display: flex;
  align-items: center;
}
</style>
