<template>
  <div class="database-management">
    <div class="page-header">
      <h1>数据库管理</h1>
      <p class="page-description">管理多数据库同步、主数据库切换和冲突记录处理</p>
    </div>

    <!-- 数据库状态概览 -->
    <div class="status-overview">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon primary">
                <i class="el-icon-database"></i>
              </div>
              <div class="status-content">
                <h3>当前主数据库</h3>
                <p class="status-value">{{ currentMasterDb.toUpperCase() }}</p>
                <p class="status-desc">{{ masterDbStatus }}</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon warning">
                <i class="el-icon-warning"></i>
              </div>
              <div class="status-content">
                <h3>待处理冲突</h3>
                <p class="status-value">{{ conflictCount }}</p>
                <p class="status-desc">需要管理员处理</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon success">
                <i class="el-icon-circle-check"></i>
              </div>
              <div class="status-content">
                <h3>同步状态</h3>
                <p class="status-value">{{ syncStatus }}</p>
                <p class="status-desc">{{ syncStatusDesc }}</p>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 数据库连接状态 -->
    <el-card class="section-card" header="数据库连接状态">
      <el-table :data="databaseList" style="width: 100%">
        <el-table-column prop="name" label="数据库" width="180">
          <template #default="{ row }">
            <el-tag :type="row.name === currentMasterDb ? 'primary' : 'info'" class="db-name-tag">
              {{ row.name.toUpperCase() }}
              <span v-if="row.name === currentMasterDb" class="master-badge">主库</span>
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="host" label="主机地址" width="200" />
        <el-table-column prop="status" label="连接状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'connected' ? 'success' : 'danger'">
              {{ row.status === 'connected' ? '已连接' : '连接失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录数" width="100" />
        <el-table-column prop="lastSync" label="最后同步" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="info" 
              @click="testConnection(row.name)"
            >
              测试连接
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 主数据库切换 -->
    <el-card class="section-card" header="主数据库切换">
      <el-alert
        title="注意事项"
        type="warning"
        :closable="false"
        show-icon
      >
        <p>切换主数据库前请确保：</p>
        <ul>
          <li>目标数据库连接正常且数据完整</li>
          <li>所有冲突记录已处理完毕</li>
          <li>当前没有正在进行的同步任务</li>
        </ul>
      </el-alert>
      
      <div class="switch-controls">
        <el-form :model="switchForm" label-width="120px">
          <el-form-item label="目标数据库">
            <el-select v-model="switchForm.targetDb" placeholder="选择要切换的数据库">
              <el-option
                v-for="db in availableDatabases"
                :key="db.name"
                :label="db.name.toUpperCase()"
                :value="db.name"
                :disabled="db.status !== 'connected'"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button 
              type="primary" 
              :loading="switchLoading"
              :disabled="!switchForm.targetDb"
              @click="confirmSwitchMaster"
            >
              切换主数据库
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 冲突记录处理 -->
    <el-card class="section-card" header="冲突记录处理">
      <div class="conflict-controls">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-select v-model="conflictFilter.table" placeholder="筛选表" clearable>
              <el-option label="全部表" value="" />
              <el-option label="用户表" value="system_users" />
              <el-option label="读者档案" value="reader_profiles" />
              <el-option label="图书信息" value="books" />
              <el-option label="借阅记录" value="borrow_records" />
              <el-option label="分类信息" value="categories" />
            </el-select>
          </el-col>
          <el-col :span="12">
            <el-select v-model="conflictFilter.status" placeholder="筛选状态" clearable>
              <el-option label="待处理" value="待处理" />
              <el-option label="已解决" value="已解决" />
              <el-option label="已忽略" value="忽略" />
              <el-option label="全部状态" value="all" />
            </el-select>
          </el-col>
        </el-row>
        <div class="conflict-actions">
          <el-button type="primary" @click="loadConflicts" :class="{ 'mobile-action-btn': isMobile }">刷新冲突记录</el-button>
          <el-button type="success" @click="batchResolveConflicts" :disabled="selectedConflicts.length === 0" :class="{ 'mobile-action-btn': isMobile }">
            批量解决 ({{ selectedConflicts.length }})
          </el-button>
        </div>
      </div>

      <el-table 
        :data="conflictList" 
        style="width: 100%"
        @selection-change="handleConflictSelection"
        @row-click="handleRowClick"
        @row-dblclick="handleRowDblClick"
        v-loading="conflictLoading"
        class="clickable-table"
        stripe
        border
      >
        <el-table-column type="selection" width="55" :selectable="isRowSelectable" />
        <el-table-column v-if="!isMobile" prop="conflict_id" label="冲突ID" width="80" />
        <el-table-column prop="table_name" label="表名" width="120" />
        <el-table-column v-if="!isMobile" prop="record_id" label="记录ID" width="80" />
        <el-table-column v-if="!isMobile" prop="source_db" label="源数据库" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.source_db.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" prop="target_db" label="目标数据库" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.target_db.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" label="冲突时间" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDateTime(row.conflict_time) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" :width="isMobile ? '' : 100">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusType(row.resolve_status)"
              size="small"
            >
              {{ row.resolve_status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="isMobile ? '' : 100">
          <template #default="{ row }">
            <div class="action-buttons">
              <!-- 桌面端显示 -->
              <div v-if="!isMobile" class="desktop-actions" @click.stop>
                <el-button 
                  size="small" 
                  type="primary" 
                  @click="showConflictDetail(row)"
                >
                  查看详情
                </el-button>
                <el-button 
                  v-if="row.resolve_status === '待处理'"
                  size="small" 
                  type="success" 
                  @click="resolveConflict(row)"
                >
                  解决
                </el-button>
              </div>
              
              <!-- 移动端下拉菜单 -->
              <div v-else class="mobile-actions" @click.stop>
                <el-dropdown @command="(cmd) => handleConflictCommand(cmd, row)">
                  <el-button type="primary" size="small">
                    操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item 
                        v-if="row.resolve_status === '待处理'"
                        command="resolve"
                      >
                        解决冲突
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="conflictTotal > 0"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="conflictPagination.page"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="conflictPagination.size"
        layout="total, sizes, prev, pager, next, jumper"
        :total="conflictTotal"
        class="pagination"
      />
    </el-card>

    <!-- 冲突详情对话框 -->
    <el-dialog
      title="冲突记录详情"
      v-model="conflictDetailVisible"
      :width="isMobile ? '95%' : '80%'"
      :close-on-click-modal="false"
    >
      <div v-if="currentConflict">
        <el-descriptions title="冲突基本信息" :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="冲突ID">{{ currentConflict.conflict_id }}</el-descriptions-item>
          <el-descriptions-item label="表名">{{ currentConflict.table_name }}</el-descriptions-item>
          <el-descriptions-item label="记录ID">{{ currentConflict.record_id }}</el-descriptions-item>
          <el-descriptions-item label="冲突时间">{{ formatDateTime(currentConflict.conflict_time) }}</el-descriptions-item>
          <el-descriptions-item label="源数据库">{{ currentConflict.source_db.toUpperCase() }}</el-descriptions-item>
          <el-descriptions-item label="目标数据库">{{ currentConflict.target_db.toUpperCase() }}</el-descriptions-item>
        </el-descriptions>

        <div class="conflict-data-comparison">
          <h3>数据对比</h3>
          <el-row :gutter="20">
            <el-col :span="isMobile ? 24 : 12">
              <h4>源数据库数据</h4>
              <el-card class="data-card">
                <pre>{{ formatJson(currentConflict.source_data) }}</pre>
              </el-card>
            </el-col>
            <el-col :span="isMobile ? 24 : 12" :style="isMobile ? 'margin-top: 12px;' : ''">
              <h4>目标数据库数据</h4>
              <el-card class="data-card">
                <pre>{{ formatJson(currentConflict.target_data) }}</pre>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <!-- 已解决冲突的处理信息 -->
        <div v-if="currentConflict && currentConflict.resolve_status !== '待处理'" class="conflict-resolved">
          <h3>处理信息</h3>
          <el-descriptions :column="isMobile ? 1 : 2" border>
            <el-descriptions-item label="处理状态">
              <el-tag :type="getStatusType(currentConflict.resolve_status)">
                {{ currentConflict.resolve_status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="处理时间">
              {{ currentConflict.resolve_time ? new Date(currentConflict.resolve_time).toLocaleString() : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="处理说明" :span="isMobile ? 1 : 2">
              {{ currentConflict.resolve_note || '无' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 待处理冲突的解决方案 -->
        <div v-else class="conflict-resolution">
          <h3>解决方案</h3>
          <el-radio-group v-model="resolutionChoice" :class="{ 'mobile-radio-group': isMobile }">
            <el-radio label="source">使用源数据库数据</el-radio>
            <el-radio label="target">使用目标数据库数据</el-radio>
            <el-radio label="manual">手动合并数据</el-radio>
            <el-radio label="ignore">忽略此冲突</el-radio>
          </el-radio-group>

          <div v-if="resolutionChoice === 'manual'" class="manual-merge">
            <h4>手动合并数据</h4>
            <el-input
              v-model="manualData"
              type="textarea"
              :rows="10"
              placeholder="请输入合并后的JSON数据"
            />
          </div>

          <div class="resolution-note">
            <el-input
              v-model="resolutionNote"
              type="textarea"
              :rows="3"
              placeholder="请输入处理说明"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="conflictDetailVisible = false">
            {{ currentConflict && currentConflict.resolve_status !== '待处理' ? '关闭' : '取消' }}
          </el-button>
          <el-button 
            v-if="currentConflict && currentConflict.resolve_status === '待处理'"
            type="primary" 
            :loading="resolveLoading"
            :disabled="!resolutionChoice"
            @click="confirmResolveConflict"
          >
            确认解决
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 批量解决对话框 -->
    <el-dialog
      title="批量解决冲突"
      v-model="batchResolveDialogVisible"
      :width="isMobile ? '95%' : '500px'"
      :close-on-click-modal="false"
    >
      <div class="batch-resolve-content">
        <p class="batch-info">已选择 <strong>{{ selectedConflicts.length }}</strong> 条冲突记录</p>
        
        <el-form :model="batchResolveForm" :label-width="isMobile ? '80px' : '100px'">
          <el-form-item label="解决方案" required>
            <el-radio-group v-model="batchResolveForm.resolution" :class="{ 'mobile-radio-group': isMobile }">
              <el-radio label="source">
                <span class="resolution-option">
                  <i class="el-icon-upload2"></i>
                  使用源数据库
                </span>
              </el-radio>
              <el-radio label="target">
                <span class="resolution-option">
                  <i class="el-icon-download"></i>
                  使用目标数据库
                </span>
              </el-radio>
              <el-radio label="ignore">
                <span class="resolution-option">
                  <i class="el-icon-close"></i>
                  忽略冲突
                </span>
              </el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item label="处理说明">
            <el-input
              v-model="batchResolveForm.note"
              type="textarea"
              :rows="3"
              placeholder="请输入批量处理说明（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>

        <el-alert
          v-if="batchResolveForm.resolution === 'source'"
          title="使用源数据库数据覆盖目标数据库"
          type="info"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else-if="batchResolveForm.resolution === 'target'"
          title="保留目标数据库数据，放弃源数据库更新"
          type="warning"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else-if="batchResolveForm.resolution === 'ignore'"
          title="忽略这些冲突，不做任何数据变更"
          type="error"
          :closable="false"
          show-icon
        />
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="batchResolveDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="batchResolveLoading"
            :disabled="!batchResolveForm.resolution"
            @click="confirmBatchResolve"
          >
            确认批量解决
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import api from '@/utils/api'
import { formatDate } from '@/utils'

export default {
  name: 'DatabaseManagement',
  setup() {
    // 移动端检测
    const isMobile = ref(window.innerWidth <= 768)
    const handleResize = () => {
      isMobile.value = window.innerWidth <= 768
    }

    // 响应式数据
    const currentMasterDb = ref('mysql')
    const masterDbStatus = ref('正常运行')
    const conflictCount = ref(0)
    const syncStatus = ref('正常')
    const syncStatusDesc = ref('所有数据库同步正常')
    
    const databaseList = ref([])
    const conflictList = ref([])
    const conflictTotal = ref(0)
    const conflictLoading = ref(false)
    const switchLoading = ref(false)
    const resolveLoading = ref(false)
    
    
    const conflictDetailVisible = ref(false)
    const currentConflict = ref(null)
    const selectedConflicts = ref([])
    
    const resolutionChoice = ref('')
    const manualData = ref('')
    const resolutionNote = ref('')
    
    // 批量解决相关
    const batchResolveDialogVisible = ref(false)
    const batchResolveLoading = ref(false)
    const batchResolveForm = reactive({
      resolution: 'source',
      note: ''
    })

    // 表单数据
    const switchForm = reactive({
      targetDb: ''
    })

    const conflictFilter = reactive({
      table: '',
      status: '待处理'  // 默认显示待处理的冲突
    })

    const conflictPagination = reactive({
      page: 1,
      size: 20
    })

    // 计算属性
    const availableDatabases = computed(() => {
      return databaseList.value.filter(db => db.name !== currentMasterDb.value)
    })

    // 方法
    const loadDatabaseStatus = async () => {
      try {
        const response = await api.get('/admin/database-status')
        if (response.success) {
          const data = response.data
          currentMasterDb.value = data.currentMaster
          databaseList.value = data.databases
          conflictCount.value = data.conflictCount
          syncStatus.value = data.syncStatus
          syncStatusDesc.value = data.syncStatusDesc
          masterDbStatus.value = data.masterDbStatus
        }
      } catch (error) {
        ElMessage.error('获取数据库状态失败')
        console.error('Load database status error:', error)
      }
    }

    const loadConflicts = async () => {
      conflictLoading.value = true
      try {
        const params = {
          page: conflictPagination.page,
          size: conflictPagination.size,
          table: conflictFilter.table,
          status: conflictFilter.status
        }
        
        const response = await api.get('/admin/conflicts', { params })
        if (response.success) {
          conflictList.value = response.data.conflicts
          conflictTotal.value = response.data.total
        }
      } catch (error) {
        ElMessage.error('获取冲突记录失败')
        console.error('Load conflicts error:', error)
      } finally {
        conflictLoading.value = false
      }
    }

    const testConnection = async (dbName) => {
      try {
        const response = await api.post('/admin/test-connection', { database: dbName })
        if (response.success) {
          ElMessage.success(`${dbName.toUpperCase()} 连接测试成功`)
          loadDatabaseStatus() // 刷新状态
        } else {
          ElMessage.error(`${dbName.toUpperCase()} 连接测试失败: ${response.message}`)
        }
      } catch (error) {
        ElMessage.error('连接测试失败')
        console.error('Test connection error:', error)
      }
    }


    const confirmSwitchMaster = async () => {
      try {
        await ElMessageBox.confirm(
          `确定要将主数据库切换到 ${switchForm.targetDb.toUpperCase()} 吗？此操作会影响所有数据写入。`,
          '确认切换',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
          }
        )

        switchLoading.value = true
        const response = await api.post('/admin/switch-master-db', {
          targetDb: switchForm.targetDb,
          reason: `管理员切换到${switchForm.targetDb.toUpperCase()}`
        })

        if (response.success) {
          ElMessage.success('主数据库切换成功')
          switchForm.targetDb = ''
          loadDatabaseStatus()
        } else {
          ElMessage.error(`切换失败: ${response.message}`)
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('切换主数据库失败')
          console.error('Switch master database error:', error)
        }
      } finally {
        switchLoading.value = false
      }
    }

    const showConflictDetail = async (conflict) => {
      try {
        const response = await api.get(`/admin/conflicts/${conflict.conflict_id}`)
        if (response.success) {
          currentConflict.value = response.data
          conflictDetailVisible.value = true
          // 只有待处理的冲突才清空解决方案选择
          if (response.data.resolve_status === '待处理') {
            resolutionChoice.value = ''
            manualData.value = ''
            resolutionNote.value = ''
          }
        }
      } catch (error) {
        ElMessage.error('获取冲突详情失败')
        console.error('Get conflict detail error:', error)
      }
    }

    const resolveConflict = async (conflict) => {
      showConflictDetail(conflict)
    }

    const handleConflictCommand = (command, row) => {
      switch (command) {
        case 'view':
          showConflictDetail(row)
          break
        case 'resolve':
          resolveConflict(row)
          break
      }
    }

    const handleView = (row) => {
      showConflictDetail(row)
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

    const confirmResolveConflict = async () => {
      try {
        resolveLoading.value = true
        
        let resolveData = {}
        if (resolutionChoice.value === 'manual') {
          try {
            resolveData = JSON.parse(manualData.value)
          } catch (error) {
            ElMessage.error('手动合并数据格式错误')
            return
          }
        }

        const response = await api.post(`/admin/conflicts/${currentConflict.value.conflict_id}/resolve`, {
          resolution: resolutionChoice.value,
          data: resolveData,
          note: resolutionNote.value
        })

        if (response.success) {
          ElMessage.success('冲突解决成功')
          conflictDetailVisible.value = false
          loadConflicts()
          loadDatabaseStatus()
        } else {
          ElMessage.error(`解决失败: ${response.message}`)
        }
      } catch (error) {
        ElMessage.error('解决冲突失败')
        console.error('Resolve conflict error:', error)
      } finally {
        resolveLoading.value = false
      }
    }

    const handleConflictSelection = (selection) => {
      selectedConflicts.value = selection
    }

    const isRowSelectable = (row) => {
      // 只有待处理的冲突才能被选择
      return row.resolve_status === '待处理'
    }

    const batchResolveConflicts = () => {
      // 打开批量解决对话框
      batchResolveForm.resolution = 'source'
      batchResolveForm.note = ''
      batchResolveDialogVisible.value = true
    }

    const confirmBatchResolve = async () => {
      try {
        batchResolveLoading.value = true
        
        const resolutionLabels = {
          source: '使用源数据库数据',
          target: '使用目标数据库数据',
          ignore: '忽略冲突'
        }
        
        const conflictIds = selectedConflicts.value.map(item => item.conflict_id)
        const response = await api.post('/admin/conflicts/batch-resolve', {
          conflictIds,
          resolution: batchResolveForm.resolution,
          note: batchResolveForm.note || `批量解决 - ${resolutionLabels[batchResolveForm.resolution]}`
        })

        if (response.success) {
          ElMessage.success(response.message || '批量解决成功')
          batchResolveDialogVisible.value = false
          selectedConflicts.value = []
          loadConflicts()
          loadDatabaseStatus()
        } else {
          ElMessage.error(`批量解决失败: ${response.message}`)
        }
      } catch (error) {
        ElMessage.error('批量解决失败')
        console.error('Batch resolve error:', error)
      } finally {
        batchResolveLoading.value = false
      }
    }

    const handleSizeChange = (size) => {
      conflictPagination.size = size
      conflictPagination.page = 1
      loadConflicts()
    }

    const handleCurrentChange = (page) => {
      conflictPagination.page = page
      loadConflicts()
    }

    const formatDateTime = (dateTime) => {
      return formatDate(dateTime) || '-'
    }

    const formatJson = (jsonStr) => {
      try {
        const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
        return JSON.stringify(obj, null, 2)
      } catch (error) {
        return jsonStr
      }
    }

    const getStatusType = (status) => {
      const statusMap = {
        '待处理': 'warning',
        '已解决': 'success',
        '忽略': 'info'
      }
      return statusMap[status] || 'info'
    }

    // 监听筛选条件变化
    watch(() => conflictFilter.status, () => {
      conflictPagination.page = 1  // 重置到第一页
      loadConflicts()
    })

    watch(() => conflictFilter.table, () => {
      conflictPagination.page = 1  // 重置到第一页
      loadConflicts()
    })

    // 生命周期
    onMounted(() => {
      window.addEventListener('resize', handleResize)
      loadDatabaseStatus()
      loadConflicts()
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })

    return {
      // 数据
      isMobile,
      currentMasterDb,
      masterDbStatus,
      conflictCount,
      syncStatus,
      syncStatusDesc,
      databaseList,
      conflictList,
      conflictTotal,
      conflictLoading,
      switchLoading,
      resolveLoading,
      conflictDetailVisible,
      currentConflict,
      selectedConflicts,
      resolutionChoice,
      manualData,
      resolutionNote,
      batchResolveDialogVisible,
      batchResolveLoading,
      batchResolveForm,
      switchForm,
      conflictFilter,
      conflictPagination,
      
      // 计算属性
      availableDatabases,
      
      // 方法
      loadDatabaseStatus,
      loadConflicts,
      testConnection,
      confirmSwitchMaster,
      showConflictDetail,
      resolveConflict,
      handleConflictCommand,
      handleView,
      handleRowClick,
      handleRowDblClick,
      confirmResolveConflict,
      handleConflictSelection,
      isRowSelectable,
      batchResolveConflicts,
      confirmBatchResolve,
      handleSizeChange,
      handleCurrentChange,
      formatDateTime,
      formatJson,
      getStatusType,
      
      // 图标
      ArrowDown
    }
  }
}
</script>

<style scoped>
.database-management {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.page-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.status-overview {
  margin-bottom: 24px;
}

.status-card {
  height: 120px;
}

.status-item {
  display: flex;
  align-items: center;
  height: 100%;
}

.status-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
  margin-right: 16px;
}

.status-icon.primary {
  background: #409EFF;
}

.status-icon.warning {
  background: #E6A23C;
}

.status-icon.success {
  background: #67C23A;
}

.status-content h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #606266;
  font-weight: normal;
}

.status-value {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.status-desc {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.section-card {
  margin-bottom: 24px;
}

.master-badge {
  margin-left: 4px;
  font-size: 10px;
}

.db-name-tag {
  min-width: 120px;
  white-space: nowrap;
  overflow: visible;
}

.switch-controls {
  margin-top: 16px;
}

.conflict-controls {
  margin-bottom: 16px;
}

.conflict-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.pagination {
  margin-top: 16px;
  text-align: right;
}


.conflict-data-comparison {
  margin: 20px 0;
}

.conflict-data-comparison h3,
.conflict-resolution h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.conflict-data-comparison h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #606266;
}

.data-card {
  max-height: 300px;
  overflow-y: auto;
}

.data-card pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #303133;
}

.conflict-resolution {
  margin-top: 20px;
}

.manual-merge {
  margin: 16px 0;
}

.manual-merge h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #606266;
}

.resolution-note {
  margin-top: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 批量解决对话框样式 */
.batch-resolve-content {
  padding: 0 20px;
}

.batch-info {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #606266;
}

.batch-info strong {
  color: #409EFF;
  font-size: 18px;
}

.batch-resolve-content .el-radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.batch-resolve-content .el-radio {
  margin-right: 0;
  padding: 12px 16px;
  border: 1px solid #DCDFE6;
  border-radius: 4px;
  transition: all 0.3s;
}

.batch-resolve-content .el-radio:hover {
  border-color: #409EFF;
}

.batch-resolve-content .el-radio.is-checked {
  border-color: #409EFF;
  background-color: #ECF5FF;
}

.resolution-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-option i {
  font-size: 16px;
}

.batch-resolve-content .el-alert {
  margin-top: 16px;
}

.conflict-resolved {
  margin-top: 20px;
}

.conflict-resolved h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .database-management {
    padding: 10px;
  }
  
  /* 状态卡片移动端适配 */
  .status-overview {
    margin-bottom: 15px;
  }
  
  .status-card {
    margin-bottom: 15px;
  }
  
  .status-item {
    flex-direction: row;
    align-items: center;
  }
  
  .status-icon {
    width: 50px;
    height: 50px;
    font-size: 24px;
    margin-right: 15px;
    margin-bottom: 0;
  }
  
  .status-content h3 {
    font-size: 14px;
    margin-bottom: 5px;
  }
  
  .status-content .status-value {
    font-size: 20px;
  }
  
  .status-content .status-desc {
    font-size: 12px;
  }
  
  /* 页面头部适配 */
  .page-header h1 {
    font-size: 20px;
  }
  
  .page-header .page-description {
    font-size: 13px;
  }
  
  /* 卡片间距调整 */
  .section-card {
    margin-bottom: 15px;
  }
  
  /* 容器优化 */
  .database-management {
    padding: 0 !important;
  }
  
  .section-card {
    margin: 0 0 8px 0 !important;
    border-radius: 0 !important;
  }
  
  .section-card :deep(.el-card__body) {
    padding: 8px !important;
  }
  
  /* 表格优化 - 强制占满宽度 */
  :deep(.el-table__header-wrapper table),
  :deep(.el-table__body-wrapper table) {
    width: 100% !important;
  }
  
  /* 冲突控制区域适配 */
  .conflict-controls {
    margin-bottom: 12px;
  }
  
  .conflict-controls .el-select,
  .conflict-controls .el-input {
    width: 100% !important;
  }
  
  .conflict-actions {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .conflict-actions .el-button {
    width: 100%;
    margin: 0 !important;
  }
  
  /* 冲突详情对话框适配 */
  .mobile-radio-group {
    display: flex;
    flex-direction: column;
  }
  
  .mobile-radio-group .el-radio {
    margin-bottom: 12px;
    margin-right: 0;
  }
  
  .conflict-data-comparison h3,
  .conflict-resolved h3,
  .conflict-resolution h3 {
    font-size: 16px;
    margin-bottom: 12px;
  }
  
  .conflict-data-comparison h4 {
    font-size: 14px;
    margin-bottom: 8px;
  }
  
  .data-card {
    margin-bottom: 12px;
  }
  
  .data-card pre {
    font-size: 12px;
    line-height: 1.4;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .manual-merge,
  .resolution-note {
    margin-top: 12px;
  }
  
  .manual-merge h4 {
    font-size: 14px;
    margin-bottom: 8px;
  }
  
  /* 操作按钮适配 */
  .action-buttons .desktop-actions {
    display: none;
  }
  
  .action-buttons .mobile-actions {
    display: block;
  }
}

/* 桌面端操作按钮样式 */
@media (min-width: 769px) {
  .action-buttons .desktop-actions {
    display: flex;
    gap: 8px;
  }
  
  .action-buttons .mobile-actions {
    display: none;
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
