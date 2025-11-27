<template>
  <div class="overdue-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>逾期管理</h2>
        <p>管理逾期图书和罚金处理</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="handleBatchProcess">
          <el-icon><Tools /></el-icon>
          批量处理
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.total_overdue }}</div>
            <div class="stats-label">逾期总数</div>
          </div>
          <el-icon class="stats-icon" color="#F56C6C"><Warning /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.total_fine }}</div>
            <div class="stats-label">总罚金(元)</div>
          </div>
          <el-icon class="stats-icon" color="#E6A23C"><Money /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.avg_overdue_days }}</div>
            <div class="stats-label">平均逾期天数</div>
          </div>
          <el-icon class="stats-icon" color="#909399"><Calendar /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-number">{{ stats.processed_today }}</div>
            <div class="stats-label">今日处理</div>
          </div>
          <el-icon class="stats-icon" color="#67C23A"><Check /></el-icon>
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
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="图书名称">
          <el-input 
            v-model="searchForm.book_title" 
            placeholder="请输入图书名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="逾期天数">
          <el-select v-model="searchForm.overdue_range" placeholder="选择逾期范围" clearable>
            <el-option label="1-7天" value="1-7" />
            <el-option label="8-30天" value="8-30" />
            <el-option label="31-90天" value="31-90" />
            <el-option label="90天以上" value="90+" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="searchForm.process_status" placeholder="选择处理状态" clearable>
            <el-option label="未处理" value="pending" />
            <el-option label="已通知" value="notified" />
            <el-option label="已处理" value="processed" />
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

    <!-- 逾期记录列表 -->
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading"
        :data="overdueList" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="record_id" label="借阅ID" width="100" />
        <el-table-column prop="reader_name" label="读者姓名" width="120" />
        <el-table-column prop="reader_card_number" label="卡号" width="120" />
        <el-table-column prop="reader_phone" label="联系电话" width="130" />
        <el-table-column prop="book_title" label="图书名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="book_isbn" label="ISBN" width="130" />
        <el-table-column prop="borrow_date" label="借阅日期" width="110" />
        <el-table-column prop="due_date" label="应还日期" width="110">
          <template #default="{ row }">
            <span class="text-danger">{{ row.due_date }}</span>
          </template>
        </el-table-column>
        <el-table-column label="逾期天数" width="100">
          <template #default="{ row }">
            <el-tag type="danger" size="small">
              {{ getOverdueDays(row.due_date) }}天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fine_amount" label="应付罚金" width="100">
          <template #default="{ row }">
            <span class="text-danger">¥{{ calculateFine(row.due_date) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="process_status" label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getProcessStatusType(row.process_status)" size="small">
              {{ getProcessStatusText(row.process_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              @click="handleNotify(row)"
              :disabled="row.process_status === 'notified'"
            >
              通知
            </el-button>
            <el-button 
              type="success" 
              size="small" 
              @click="handleProcess(row)"
            >
              处理
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

    <!-- 处理对话框 -->
    <el-dialog
      v-model="processDialogVisible"
      title="处理逾期记录"
      width="500px"
    >
      <el-form :model="processForm" label-width="100px">
        <el-form-item label="读者姓名">
          <span>{{ currentOverdue?.reader_name }}</span>
        </el-form-item>
        <el-form-item label="图书名称">
          <span>{{ currentOverdue?.book_title }}</span>
        </el-form-item>
        <el-form-item label="逾期天数">
          <span class="text-danger">{{ getOverdueDays(currentOverdue?.due_date) }}天</span>
        </el-form-item>
        <el-form-item label="应付罚金">
          <el-input-number 
            v-model="processForm.fine_amount" 
            :min="0" 
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="处理方式">
          <el-radio-group v-model="processForm.process_type">
            <el-radio label="return">归还处理</el-radio>
            <el-radio label="fine_only">仅收罚金</el-radio>
            <el-radio label="waive">免除罚金</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="processForm.remarks" 
            type="textarea" 
            :rows="3"
            placeholder="请输入处理备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmProcess" :loading="processLoading">
          确认处理
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOverdueList, processOverdue, notifyOverdue } from '@/api/borrow'

export default {
  name: 'Overdue',
  setup() {
    // 响应式数据
    const loading = ref(false)
    const processLoading = ref(false)
    const overdueList = ref([])
    const selectedOverdues = ref([])
    const processDialogVisible = ref(false)
    const currentOverdue = ref(null)

    // 统计数据
    const stats = ref({
      total_overdue: 0,
      total_fine: 0,
      avg_overdue_days: 0,
      processed_today: 0
    })

    // 搜索表单
    const searchForm = reactive({
      reader_name: '',
      book_title: '',
      overdue_range: '',
      process_status: ''
    })

    // 分页
    const pagination = reactive({
      page: 1,
      size: 20,
      total: 0
    })

    // 处理表单
    const processForm = reactive({
      fine_amount: 0,
      process_type: 'return',
      remarks: ''
    })

    // 获取逾期记录列表
    const fetchOverdueList = async () => {
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

        const response = await getOverdueList(params)
        if (response.success && response.data) {
          overdueList.value = response.data.records || response.data.overdueBooks || []
          pagination.total = response.data.pagination?.total || response.data.total || 0
          
          // 更新统计数据
          if (response.data.stats) {
            stats.value = {
              total_overdue: response.data.stats.total_overdue || 0,
              total_fine: parseFloat(response.data.stats.total_fine || 0).toFixed(2),
              avg_overdue_days: Math.round(response.data.stats.avg_overdue_days || 0),
              processed_today: response.data.stats.processed_today || 0
            }
          }
        }
      } catch (error) {
        ElMessage.error('获取逾期记录失败')
      } finally {
        loading.value = false
      }
    }

    // 计算逾期天数
    const getOverdueDays = (dueDate) => {
      if (!dueDate) return 0
      const due = new Date(dueDate)
      const now = new Date()
      const diffTime = now - due
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays > 0 ? diffDays : 0
    }

    // 计算罚金
    const calculateFine = (dueDate) => {
      const overdueDays = getOverdueDays(dueDate)
      return (overdueDays * 0.5).toFixed(2) // 每天0.5元
    }

    // 获取处理状态类型
    const getProcessStatusType = (status) => {
      const statusMap = {
        'pending': 'danger',
        'notified': 'warning',
        'processed': 'success'
      }
      return statusMap[status] || 'info'
    }

    // 获取处理状态文本
    const getProcessStatusText = (status) => {
      const statusMap = {
        'pending': '未处理',
        'notified': '已通知',
        'processed': '已处理'
      }
      return statusMap[status] || '未知'
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchOverdueList()
    }

    // 重置搜索
    const handleReset = () => {
      Object.keys(searchForm).forEach(key => {
        searchForm[key] = ''
      })
      pagination.page = 1
      fetchOverdueList()
    }

    // 选择变化
    const handleSelectionChange = (selection) => {
      selectedOverdues.value = selection
    }

    // 分页处理
    const handleSizeChange = (size) => {
      pagination.size = size
      fetchOverdueList()
    }

    const handleCurrentChange = (page) => {
      pagination.page = page
      fetchOverdueList()
    }

    // 通知逾期
    const handleNotify = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定要通知读者 ${row.reader_name} 归还逾期图书吗？`,
          '通知确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )

        const response = await notifyOverdue(row.record_id)
        if (response.success) {
          ElMessage.success('通知发送成功')
          fetchOverdueList()
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('通知发送失败')
        }
      }
    }

    // 处理逾期
    const handleProcess = (row) => {
      currentOverdue.value = row
      processForm.fine_amount = parseFloat(calculateFine(row.due_date))
      processForm.process_type = 'return'
      processForm.remarks = ''
      processDialogVisible.value = true
    }

    // 确认处理
    const confirmProcess = async () => {
      processLoading.value = true
      try {
        const response = await processOverdue(currentOverdue.value.record_id, processForm)
        if (response.success) {
          ElMessage.success('处理成功')
          processDialogVisible.value = false
          fetchOverdueList()
        }
      } catch (error) {
        ElMessage.error('处理失败')
      } finally {
        processLoading.value = false
      }
    }

    // 批量处理
    const handleBatchProcess = () => {
      if (selectedOverdues.value.length === 0) {
        ElMessage.warning('请选择要处理的记录')
        return
      }
      ElMessage.info('批量处理功能开发中...')
    }

    // 生命周期
    onMounted(() => {
      fetchOverdueList()
    })

    return {
      loading,
      processLoading,
      overdueList,
      selectedOverdues,
      processDialogVisible,
      currentOverdue,
      stats,
      searchForm,
      pagination,
      processForm,
      fetchOverdueList,
      getOverdueDays,
      calculateFine,
      getProcessStatusType,
      getProcessStatusText,
      handleSearch,
      handleReset,
      handleSelectionChange,
      handleSizeChange,
      handleCurrentChange,
      handleNotify,
      handleProcess,
      confirmProcess,
      handleBatchProcess
    }
  }
}
</script>

<style scoped>
.overdue-container {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-left h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.header-left p {
  margin: 0;
  color: #909399;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stats-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
}

.stats-content {
  flex: 1;
}

.stats-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stats-label {
  font-size: 14px;
  color: #909399;
}

.stats-icon {
  font-size: 32px;
  opacity: 0.8;
}

.search-card,
.table-card {
  margin-bottom: 20px;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.text-danger {
  color: #f56c6c;
}
</style>
