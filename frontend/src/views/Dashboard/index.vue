<template>
  <div class="dashboard">
    <!-- 欢迎信息 -->
    <div class="welcome-card content-card">
      <div class="welcome-content">
        <div class="welcome-text">
          <h2>欢迎回来，{{ userInfo?.real_name || userInfo?.username }}！</h2>
          <p>今天是 {{ currentDate }}，祝您工作愉快！</p>
        </div>
        <div class="welcome-avatar">
          <el-avatar :size="80" :src="userInfo?.avatar">
            <el-icon><User /></el-icon>
          </el-avatar>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-container">
      <div class="stats-card" v-for="stat in stats" :key="stat.key">
        <div class="stats-icon" :style="{ backgroundColor: stat.color }">
          <el-icon><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stats-content">
          <div class="stats-title">{{ stat.title }}</div>
          <div class="stats-value">{{ formatNumber(stat.value) }}</div>
          <div class="stats-trend" :class="stat.trend > 0 ? 'up' : 'down'" v-if="stat.trend !== undefined">
            <el-icon><component :is="stat.trend > 0 ? 'TrendCharts' : 'Bottom'" /></el-icon>
            {{ Math.abs(stat.trend) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 图表和快捷操作 -->
    <div class="dashboard-content">
      <div class="dashboard-left">
        <!-- 借阅趋势图表 -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">借阅趋势</h3>
            <el-radio-group v-model="trendPeriod" size="small" @change="fetchBorrowTrend">
              <el-radio-button label="7">最近7天</el-radio-button>
              <el-radio-button label="30">最近30天</el-radio-button>
              <el-radio-button label="90">最近90天</el-radio-button>
            </el-radio-group>
          </div>
          <div class="chart-container">
            <v-chart class="chart" :option="borrowTrendOption" v-loading="trendLoading" />
          </div>
        </div>

        <!-- 热门图书 -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">{{ isShowingLatestBooks ? '最新图书' : '热门图书' }}</h3>
            <el-button type="text" @click="$router.push('/books')" v-if="popularBooks.length > 0">
              查看更多 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
          <div class="popular-books">
            <div class="book-item" v-for="(book, index) in popularBooks" :key="book.book_id">
              <div class="book-rank">{{ index + 1 }}</div>
              <div class="book-info">
                <div class="book-title">{{ book.title }}</div>
                <div class="book-author">{{ book.author }}</div>
              </div>
              <div class="book-count">{{ book.borrow_count }}次</div>
            </div>
            <!-- 空状态显示 -->
            <div v-if="popularBooks.length === 0" class="empty-state">
              <el-empty description="暂无热门图书数据">
                <template #image>
                  <el-icon size="60" color="#c0c4cc"><Reading /></el-icon>
                </template>
                <el-button type="primary" @click="$router.push('/books')">
                  浏览图书
                </el-button>
              </el-empty>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-right">
        <!-- 快捷操作 -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">快捷操作</h3>
          </div>
          <div class="quick-actions">
            <div class="action-item" @click="goToAddBook" v-if="canManage">
              <el-icon><Plus /></el-icon>
              <span>添加图书</span>
            </div>
            <!-- 管理员显示"添加用户" -->
            <div class="action-item" @click="goToAddUser" v-if="isAdmin">
              <el-icon><UserFilled /></el-icon>
              <span>添加用户</span>
            </div>
            <!-- 图书管理员显示"添加读者" -->
            <div class="action-item" @click="goToAddReader" v-if="isLibrarian">
              <el-icon><UserFilled /></el-icon>
              <span>添加读者</span>
            </div>
            <div class="action-item" @click="goToAddBorrow">
              <el-icon><DocumentAdd /></el-icon>
              <span>添加借阅</span>
            </div>
            <div class="action-item" @click="goToAddCategory" v-if="canManage">
              <el-icon><FolderAdd /></el-icon>
              <span>添加分类</span>
            </div>
          </div>
        </div>

        <!-- 系统状态 -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">系统状态</h3>
          </div>
          <div class="system-status">
            <div class="status-item">
              <span class="status-label">当前数据库</span>
              <el-tag :type="getDatabaseTagType(currentDatabase)" size="small">
                {{ currentDatabase?.toUpperCase() || '未知' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">同步状态</span>
              <el-tag :type="syncStatus?.status === 'normal' ? 'success' : 'warning'" size="small">
                {{ syncStatus?.status === 'normal' ? '正常' : '异常' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">待同步记录</span>
              <span class="status-value">{{ syncStatus?.pendingCount || 0 }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">冲突记录</span>
              <span class="status-value">{{ syncStatus?.conflictCount || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 最近活动 -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">最近活动</h3>
          </div>
          <div class="recent-activities">
            <div class="activity-item" v-for="activity in recentActivities" :key="activity.id">
              <div class="activity-icon" :class="activity.type">
                <el-icon><component :is="activity.icon" /></el-icon>
              </div>
              <div class="activity-content">
                <div class="activity-text">{{ activity.text }}</div>
                <div class="activity-time">{{ formatDate(activity.time, 'MM-DD HH:mm') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { getOverviewStats } from '@/api/reports'
import { getCurrentDatabase } from '@/api/database'
import { getSyncStatus } from '@/api/sync'
import { formatDate, formatNumber } from '@/utils'
import request from '@/utils/request'

// 注册ECharts组件
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

export default {
  name: 'Dashboard',
  components: {
    VChart
  },
  setup() {
    const store = useStore()
    const router = useRouter()
    
    // 响应式数据
    const stats = ref([])
    const popularBooks = ref([])
    const isShowingLatestBooks = ref(false) // 标记是否显示最新图书而不是热门图书
    const currentDatabase = ref('')
    const syncStatus = ref({})
    const recentActivities = ref([])
    const trendPeriod = ref('30')
    const trendLoading = ref(false)
    const borrowTrendOption = ref({})
    
    // 计算属性
    const userInfo = computed(() => store.getters.userInfo)
    const currentDate = computed(() => {
      return new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    })
    
    // 方法
    const fetchOverviewStats = async () => {
      try {
        console.log('获取仪表盘统计数据...')
        const response = await request.get('/reports/overview')
        console.log('统计API响应:', response)
        
        if (response.success && response.data) {
          const data = response.data
          stats.value = [
            {
              key: 'books',
              title: '图书总数',
              value: data.total_books || 0,
              icon: 'Reading',
              color: '#409eff'
            },
            {
              key: 'readers',
              title: '读者总数',
              value: data.total_readers || 0,
              icon: 'User',
              color: '#67c23a'
            },
            {
              key: 'borrowed',
              title: '在借图书',
              value: data.current_borrows || 0,
              icon: 'DocumentCopy',
              color: '#e6a23c'
            },
            {
              key: 'overdue',
              title: '逾期图书',
              value: data.overdue_borrows || 0,
              icon: 'Warning',
              color: '#f56c6c'
            }
          ]
          console.log('统计数据设置成功:', stats.value)
        } else {
          console.warn('统计API响应格式异常:', response)
          throw new Error('API响应格式异常')
        }
      } catch (error) {
        console.error('获取统计数据失败:', error)
        // 降级使用默认数据
        stats.value = [
          {
            key: 'books',
            title: '图书总数',
            value: 0,
            icon: 'Reading',
            color: '#409eff'
          },
          {
            key: 'readers',
            title: '读者总数',
            value: 0,
            icon: 'User',
            color: '#67c23a'
          },
          {
            key: 'borrowed',
            title: '在借图书',
            value: 0,
            icon: 'DocumentCopy',
            color: '#e6a23c'
          },
          {
            key: 'overdue',
            title: '逾期图书',
            value: 0,
            icon: 'Warning',
            color: '#f56c6c'
          }
        ]
      }
    }
    
    const fetchBorrowTrend = async () => {
      trendLoading.value = true
      try {
        console.log('获取借阅趋势数据...')
        // 获取最近的借阅记录来生成趋势图
        const days = parseInt(trendPeriod.value) || 7
        const response = await request.get(`/borrow?page=1&size=1000&sortBy=created_time&sortOrder=desc`)
        console.log('借阅趋势API响应:', response)
        
        let trendData = {
          dates: [],
          borrowData: [],
          returnData: []
        }
        
        if (response.success && response.data) {
          const records = response.data.records || response.data.books || []
          
          // 生成最近N天的日期
          const today = new Date()
          const dates = []
          for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(date.getDate() - i)
            dates.push(date)
          }
          
          // 统计每天的借阅和归还数量
          const borrowCounts = new Array(days).fill(0)
          const returnCounts = new Array(days).fill(0)
          
          records.forEach(record => {
            const borrowDate = new Date(record.borrow_date)
            const returnDate = record.return_date ? new Date(record.return_date) : null
            
            // 统计借阅
            dates.forEach((date, index) => {
              if (borrowDate.toDateString() === date.toDateString()) {
                borrowCounts[index]++
              }
              if (returnDate && returnDate.toDateString() === date.toDateString()) {
                returnCounts[index]++
              }
            })
          })
          
          trendData = {
            dates: dates.map(date => `${date.getMonth() + 1}-${date.getDate()}`),
            borrowData: borrowCounts,
            returnData: returnCounts
          }
          console.log('趋势数据生成成功:', trendData)
        } else {
          // 降级使用模拟数据
          trendData = {
            dates: ['11-15', '11-16', '11-17', '11-18', '11-19', '11-20', '11-21'],
            borrowData: [0, 0, 0, 0, 0, 0, 0],
            returnData: [0, 0, 0, 0, 0, 0, 0]
          }
        }
        
        borrowTrendOption.value = {
          title: {
            text: '借阅趋势',
            left: 'center',
            textStyle: {
              fontSize: 16,
              fontWeight: 'normal'
            }
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'cross'
            }
          },
          legend: {
            data: ['借书', '还书'],
            bottom: 0
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: trendData.dates
          },
          yAxis: {
            type: 'value'
          },
          series: [
            {
              name: '借书',
              type: 'line',
              data: trendData.borrowData,
              smooth: true,
              itemStyle: {
                color: '#409eff'
              }
            },
            {
              name: '还书',
              type: 'line',
              data: trendData.returnData,
              smooth: true,
              itemStyle: {
                color: '#67c23a'
              }
            }
          ]
        }
      } catch (error) {
        console.error('获取借阅趋势失败:', error)
      } finally {
        trendLoading.value = false
      }
    }
    
    const fetchPopularBooks = async () => {
      try {
        console.log('获取热门图书数据...')
        // 先尝试获取30天内的热门图书
        let response = await request.get('/reports/popular-books?limit=5&days=30')
        console.log('热门图书API响应(30天):', response)
        
        // 如果30天内没有数据，尝试获取所有时间的热门图书
        if (response.success && response.data && response.data.length === 0) {
          console.log('30天内无热门图书，尝试获取所有时间的热门图书...')
          response = await request.get('/reports/popular-books?limit=5')
          console.log('热门图书API响应(所有时间):', response)
        }
        
        // 如果还是没有数据，降级显示最新的图书
        if (response.success && response.data && response.data.length === 0) {
          console.log('无热门图书数据，降级显示最新图书...')
          const booksResponse = await request.get('/books?page=1&size=5&sortBy=created_time&sortOrder=desc')
          console.log('最新图书API响应:', booksResponse)
          
          if (booksResponse.success && booksResponse.data) {
            const books = booksResponse.data.books || booksResponse.data.records || []
            popularBooks.value = books.map(book => ({
              book_id: book.book_id,
              title: book.title,
              author: book.author,
              borrow_count: 0, // 显示为0次借阅
              category_name: book.category_name,
              popularity_rate: 0
            }))
            isShowingLatestBooks.value = true // 标记显示的是最新图书
            console.log('最新图书数据设置成功:', popularBooks.value)
            return
          }
        }
        
        if (response.success && response.data) {
          popularBooks.value = response.data.map(book => ({
            book_id: book.book_id,
            title: book.title,
            author: book.author,
            borrow_count: book.borrow_count,
            category_name: book.category_name,
            popularity_rate: book.popularity_rate
          }))
          isShowingLatestBooks.value = false // 显示的是真正的热门图书
          console.log('热门图书数据设置成功:', popularBooks.value)
        } else {
          console.warn('热门图书API响应格式异常:', response)
          popularBooks.value = []
        }
      } catch (error) {
        console.error('获取热门图书失败:', error)
        popularBooks.value = []
      }
    }
    
    const fetchSystemStatus = async () => {
      try {
        console.log('获取系统状态...')
        // 获取数据库状态
        const dbResponse = await getCurrentDatabase()
        currentDatabase.value = dbResponse.data?.currentPrimaryDB || 'mysql'
        console.log('当前数据库:', currentDatabase.value)
        
        // 获取同步状态
        try {
          const syncResponse = await getSyncStatus()
          console.log('同步状态响应:', syncResponse)
          
          if (syncResponse.success && syncResponse.data) {
            const pendingCount = syncResponse.data.pendingCount || 0
            const conflictCount = syncResponse.data.conflictCount || 0
            
            // 根据冲突记录数判断同步状态（待同步记录是正常状态，不应标记为异常）
            const status = (conflictCount > 0) ? 'warning' : 'normal'
            
            syncStatus.value = {
              status: status,
              pendingCount: pendingCount,
              conflictCount: conflictCount
            }
          } else {
            // 降级使用默认状态
            syncStatus.value = {
              status: 'normal',
              pendingCount: 0,
              conflictCount: 0
            }
          }
        } catch (syncError) {
          console.warn('获取同步状态失败，使用默认状态:', syncError)
          syncStatus.value = {
            status: 'normal',
            pendingCount: 0,
            conflictCount: 0
          }
        }
        
        console.log('系统状态设置成功:', { currentDatabase: currentDatabase.value, syncStatus: syncStatus.value })
      } catch (error) {
        console.error('获取系统状态失败:', error)
        // 如果API调用失败，使用默认值
        currentDatabase.value = 'mysql'
        syncStatus.value = {
          status: 'normal',
          pendingCount: 0,
          conflictCount: 0
        }
      }
    }
    
    const getDatabaseTagType = (database) => {
      const typeMap = {
        mysql: 'primary',
        mariadb: 'success',
        greatsql: 'warning'
      }
      return typeMap[database] || 'info'
    }
    
    const initRecentActivities = async () => {
      try {
        console.log('获取最近活动数据...')
        // 获取最近的借阅记录
        const response = await request.get('/borrow?page=1&size=5&sortBy=created_time&sortOrder=desc')
        console.log('最近活动API响应:', response)
        
        if (response.success && response.data) {
          const records = response.data.records || response.data.books || []
          recentActivities.value = records.map((record, index) => {
            // 处理时间数据
            let activityTime = new Date()
            if (record.return_date && record.status === '已还') {
              activityTime = new Date(record.return_date)
            } else if (record.borrow_date) {
              activityTime = new Date(record.borrow_date)
            } else if (record.created_time) {
              activityTime = new Date(record.created_time)
            }
            
            // 如果时间无效，使用当前时间
            if (isNaN(activityTime.getTime())) {
              activityTime = new Date()
            }
            
            return {
              id: record.record_id || index + 1,
              type: record.status === '已还' ? 'return' : 'borrow',
              icon: record.status === '已还' ? 'DocumentChecked' : 'DocumentAdd',
              text: `${record.reader_name || '读者'}${record.status === '已还' ? '归还了' : '借阅了'}《${record.book_title || '图书'}》`,
              time: activityTime
            }
          }).slice(0, 4) // 只显示最近4条
          console.log('最近活动数据设置成功:', recentActivities.value)
        } else {
          console.warn('最近活动API响应格式异常:', response)
          recentActivities.value = []
        }
      } catch (error) {
        console.error('获取最近活动失败:', error)
        // 降级使用空数据
        recentActivities.value = []
      }
    }
    
    const showComingSoon = () => {
      ElMessage.info('该功能正在开发中，敬请期待！')
    }
    
    // 权限检查
    const canManage = computed(() => {
      const role = store.getters.userInfo?.role
      return role === 'admin' || role === 'librarian'
    })
    
    const isAdmin = computed(() => {
      return store.getters.userInfo?.role === 'admin'
    })
    
    const isLibrarian = computed(() => {
      return store.getters.userInfo?.role === 'librarian'
    })
    
    // 快捷操作方法
    const goToAddBook = () => {
      router.push({ path: '/books', query: { action: 'add' } })
    }
    
    const goToAddUser = () => {
      // 管理员跳转到统一用户管理页面，不指定角色（可以添加任何角色）
      router.push({ path: '/users/unified', query: { action: 'add' } })
    }
    
    const goToAddReader = () => {
      // 图书管理员跳转到统一用户管理页面，并指定添加读者
      router.push({ path: '/users/unified', query: { action: 'add', role: 'reader' } })
    }
    
    const goToAddBorrow = () => {
      router.push({ path: '/borrow', query: { action: 'add' } })
    }
    
    const goToAddCategory = () => {
      router.push({ path: '/categories', query: { action: 'add' } })
    }
    
    
    // 生命周期
    onMounted(async () => {
      await fetchOverviewStats()
      await fetchBorrowTrend()
      await fetchPopularBooks()
      await fetchSystemStatus()
      await initRecentActivities()
    })
    
    return {
      userInfo,
      currentDate,
      stats,
      popularBooks,
      isShowingLatestBooks,
      currentDatabase,
      syncStatus,
      recentActivities,
      trendPeriod,
      trendLoading,
      borrowTrendOption,
      fetchBorrowTrend,
      getDatabaseTagType,
      formatDate,
      formatNumber,
      showComingSoon,
      canManage,
      isAdmin,
      isLibrarian,
      goToAddBook,
      goToAddUser,
      goToAddReader,
      goToAddBorrow,
      goToAddCategory
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.welcome-card {
  margin-bottom: 20px;
}

.welcome-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.welcome-text h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.welcome-text p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.dashboard-left,
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chart-container {
  height: 300px;
}

.chart {
  height: 100%;
  width: 100%;
}

.popular-books {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.book-item:hover {
  background: #e9ecef;
}

.book-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  margin-right: 12px;
}

.book-info {
  flex: 1;
}

.book-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.book-author {
  font-size: 12px;
  color: #909399;
}

.book-count {
  font-size: 12px;
  color: #409eff;
  font-weight: 500;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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

.system-status {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.status-label {
  font-size: 14px;
  color: #606266;
}

.status-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.recent-activities {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: white;
}

.activity-icon.borrow {
  background: #409eff;
}

.activity-icon.return {
  background: #67c23a;
}

.activity-icon.add {
  background: #e6a23c;
}

.activity-icon.reader {
  background: #909399;
}

.activity-content {
  flex: 1;
}

.activity-text {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.activity-time {
  font-size: 12px;
  color: #909399;
}

@media (max-width: 1200px) {
  .dashboard-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .welcome-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .welcome-text h2 {
    font-size: 20px;
  }
  
  .stats-container {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .action-item {
    padding: 16px 12px;
  }
  
  .action-item span {
    font-size: 13px;
  }
  
  .content-card {
    padding: 16px;
    margin-bottom: 16px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .stats-container {
    grid-template-columns: 1fr;
  }
  
  .quick-actions {
    grid-template-columns: 1fr;
  }
  
  .welcome-text h2 {
    font-size: 18px;
  }
  
  .welcome-text p {
    font-size: 13px;
  }
  
  .activity-text {
    font-size: 13px;
  }
}
</style>
