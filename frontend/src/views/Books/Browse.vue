<template>
  <div class="books-browse-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>图书浏览</h2>
        <p>浏览和借阅图书馆藏书</p>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="图书名称">
          <el-input 
            v-model="searchForm.title" 
            placeholder="请输入图书名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="作者">
          <el-input 
            v-model="searchForm.author" 
            placeholder="请输入作者"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="ISBN">
          <el-input 
            v-model="searchForm.isbn" 
            placeholder="请输入ISBN"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="出版社">
          <el-input 
            v-model="searchForm.publisher" 
            placeholder="请输入出版社"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select 
            v-model="searchForm.category_id" 
            placeholder="请选择分类"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="category in categories"
              :key="category.category_id"
              :label="category.category_name"
              :value="category.category_id"
            />
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

    <!-- 图书列表 -->
    <el-card class="books-card" shadow="never">
      <div class="books-grid" v-loading="loading">
        <div 
          v-for="book in bookList" 
          :key="book.book_id" 
          class="book-item"
        >
          <div class="book-cover">
            <el-image 
              :src="getImageUrl(book.cover_image)" 
              fit="cover"
              class="cover-image"
              lazy
            >
              <template #error>
                <el-image 
                  src="https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png" 
                  fit="cover"
                  class="cover-image"
                />
              </template>
            </el-image>
          </div>
          
          <div class="book-info">
            <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
            <p class="book-author">作者：{{ book.author }}</p>
            <p class="book-isbn">ISBN：{{ book.isbn }}</p>
            <p class="book-category">分类：{{ book.category_name || '未分类' }}</p>
            <p class="book-publisher">出版社：{{ book.publisher }}</p>
            
            <div class="book-status">
              <div class="availability">
                <span class="label">库存：</span>
                <span :class="['count', { 'available': book.available_copies > 0, 'unavailable': book.available_copies === 0 }]">
                  {{ book.available_copies }}/{{ book.total_copies }}
                </span>
              </div>
              
              <div class="actions">
                <el-button 
                  v-if="book.available_copies > 0"
                  type="primary" 
                  size="small" 
                  @click="handleBorrow(book)"
                  :loading="borrowing === book.book_id"
                >
                  借阅
                </el-button>
                <el-button 
                  v-else
                  type="info" 
                  size="small" 
                  disabled
                >
                  无库存
                </el-button>
                <el-button 
                  type="info" 
                  size="small" 
                  @click="handleViewDetail(book)"
                >
                  详情
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[12, 24, 48, 96]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 图书详情对话框 -->
    <el-dialog v-model="detailVisible" title="图书详情" :width="isMobile ? '95%' : '600px'">
      <div v-if="currentBook" class="book-detail">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="8">
            <el-image 
              :src="getImageUrl(currentBook.cover_image)" 
              fit="cover"
              class="detail-cover"
            >
              <template #error>
                <el-image 
                  src="https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png" 
                  fit="cover"
                  class="detail-cover"
                />
              </template>
            </el-image>
          </el-col>
          <el-col :xs="24" :sm="16">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="图书名称">{{ currentBook.title }}</el-descriptions-item>
              <el-descriptions-item label="作者">{{ currentBook.author }}</el-descriptions-item>
              <el-descriptions-item label="ISBN">{{ currentBook.isbn }}</el-descriptions-item>
              <el-descriptions-item label="出版社">{{ currentBook.publisher }}</el-descriptions-item>
              <el-descriptions-item label="出版日期">{{ currentBook.publish_date }}</el-descriptions-item>
              <el-descriptions-item label="分类">{{ currentBook.category_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="价格">¥{{ currentBook.price }}</el-descriptions-item>
              <el-descriptions-item label="库存">
                <span :class="{ 'text-success': currentBook.available_copies > 0, 'text-danger': currentBook.available_copies === 0 }">
                  {{ currentBook.available_copies }}/{{ currentBook.total_copies }}
                </span>
              </el-descriptions-item>
            </el-descriptions>
          </el-col>
        </el-row>
        
        <div class="book-description" v-if="currentBook.description">
          <h4>图书简介</h4>
          <p>{{ currentBook.description }}</p>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button 
            v-if="currentBook && currentBook.available_copies > 0"
            type="primary" 
            @click="handleBorrow(currentBook)"
            :loading="borrowing === currentBook.book_id"
          >
            借阅此书
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 借阅确认对话框 -->
    <el-dialog v-model="borrowDialogVisible" title="借阅确认" :width="isMobile ? '95%' : '400px'">
      <div v-if="selectedBook">
        <p>确定要借阅以下图书吗？</p>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="图书名称">{{ selectedBook.title }}</el-descriptions-item>
          <el-descriptions-item label="作者">{{ selectedBook.author }}</el-descriptions-item>
          <el-descriptions-item label="ISBN">{{ selectedBook.isbn }}</el-descriptions-item>
          <el-descriptions-item label="借阅期限">30天</el-descriptions-item>
        </el-descriptions>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="borrowDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="confirmBorrow"
            :loading="!!borrowing"
          >
            确认借阅
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Picture } from '@element-plus/icons-vue'
import { getBooks } from '@/api/books'
import { addBorrowRecord } from '@/api/borrow'
import request from '@/utils/request'

const store = useStore()
const router = useRouter()

// 移动端检测
const isMobile = ref(window.innerWidth <= 768)
const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

// 响应式数据
const loading = ref(false)
const borrowing = ref(null)
const detailVisible = ref(false)
const borrowDialogVisible = ref(false)

const bookList = ref([])
const categories = ref([])
const currentBook = ref(null)
const selectedBook = ref(null)

// 搜索表单
const searchForm = reactive({
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  category_id: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 12,
  total: 0
})

// 获取分类列表
const fetchCategories = async () => {
  try {
    console.log('获取分类列表...')
    const response = await request.get('/books/categories')
    console.log('分类API响应:', response)
    
    // 根据日志，响应格式是 {success: true, data: Array(16)}
    if (response.success) {
      categories.value = response.data || []
      console.log('分类列表设置成功:', categories.value)
    } else {
      console.warn('获取分类列表失败:', response.message)
      ElMessage.warning('获取分类列表失败')
    }
  } catch (error) {
    console.error('获取分类列表错误:', error)
    ElMessage.error('获取分类列表失败')
  }
}

// 获取图书列表
const fetchBooks = async () => {
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
    
    console.log('图书API请求参数:', params)
    const response = await getBooks(params)
    console.log('图书API响应:', response)
    
    if (response.success) {
      // 处理不同的响应格式
      const data = response.data
      if (data.books) {
        // 后端返回 books 字段
        bookList.value = data.books || []
        pagination.total = data.pagination?.total || 0
      } else if (data.records) {
        // 后端返回 records 字段
        bookList.value = data.records || []
        pagination.total = data.total || 0
      } else {
        console.warn('未知的图书API响应格式:', data)
        bookList.value = []
        pagination.total = 0
      }
      console.log('图书列表设置成功:', bookList.value.length, '条记录')
      console.log('总记录数:', pagination.total)
    } else {
      console.warn('图书API返回失败:', response)
    }
  } catch (error) {
    console.error('图书API调用失败:', error)
    ElMessage.error('获取图书列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchBooks()
}

// 重置搜索
const handleReset = () => {
  Object.assign(searchForm, {
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    category_id: ''
  })
  pagination.page = 1
  fetchBooks()
}

// 分页大小改变
const handleSizeChange = (size) => {
  pagination.size = size
  pagination.page = 1
  fetchBooks()
}

// 当前页改变
const handleCurrentChange = (page) => {
  pagination.page = page
  fetchBooks()
}

// 查看详情
const handleViewDetail = (book) => {
  currentBook.value = book
  detailVisible.value = true
}

// 借阅图书
const handleBorrow = (book) => {
  selectedBook.value = book
  borrowDialogVisible.value = true
}

// 确认借阅
const confirmBorrow = async () => {
  if (!selectedBook.value) return
  
  try {
    borrowing.value = selectedBook.value.book_id
    
    // 获取当前用户信息
    const userInfo = store.getters.userInfo
    if (!userInfo || userInfo.role !== 'reader') {
      ElMessage.error('只有读者可以借阅图书')
      borrowing.value = null
      return
    }
    
    // 调用借阅API（读者借书不需要传reader_id，后端会自动使用当前用户ID）
    const response = await addBorrowRecord({
      book_id: selectedBook.value.book_id,
      due_days: 30
    })
    
    if (response.success) {
      ElMessage.success('借阅成功！请到"我的借阅"查看详情')
      borrowDialogVisible.value = false
      
      // 刷新图书列表（更新库存）
      fetchBooks()
      
      // 可选：跳转到我的借阅页面
      setTimeout(() => {
        router.push('/borrow')
      }, 1500)
    }
  } catch (error) {
    console.error('借阅失败:', error)
    ElMessage.error('借阅失败，请重试')
  } finally {
    borrowing.value = null
  }
}

// 图片URL处理函数
const getImageUrl = (imagePath) => {
  // 如果没有图片，返回国内CDN默认图片
  if (!imagePath) {
    return 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png'
  }
  if (imagePath.startsWith('http')) return imagePath
  // 使用相对路径，在生产环境通过 Nginx 代理，开发环境通过 vue.config.js 代理
  return imagePath
}

// 生命周期
onMounted(() => {
  fetchCategories()
  fetchBooks()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.books-browse-container {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left h2 {
  margin: 0;
  color: #303133;
}

.header-left p {
  margin: 5px 0 0 0;
  color: #909399;
}

.search-card {
  margin-bottom: 20px;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  min-height: 400px;
}

.book-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s;
  background: #fff;
}

.book-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.book-cover {
  text-align: center;
  margin-bottom: 15px;
}

.cover-image {
  width: 120px;
  height: 160px;
  border-radius: 4px;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 160px;
  background: #f5f7fa;
  color: #909399;
  font-size: 30px;
  border-radius: 4px;
}

.book-info {
  text-align: left;
}

.book-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 10px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-author,
.book-isbn,
.book-category,
.book-publisher {
  font-size: 14px;
  color: #606266;
  margin: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-status {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
}

.availability {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.availability .label {
  font-size: 14px;
  color: #606266;
}

.availability .count {
  font-weight: 600;
  margin-left: 5px;
}

.availability .count.available {
  color: #67c23a;
}

.availability .count.unavailable {
  color: #f56c6c;
}

.actions {
  display: flex;
  gap: 8px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.detail-cover {
  width: 100%;
  height: 300px;
}

.book-description {
  margin-top: 20px;
}

.book-description h4 {
  margin: 0 0 10px 0;
  color: #303133;
}

.book-description p {
  line-height: 1.6;
  color: #606266;
}

.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .books-browse-container {
    padding: 10px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .books-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .book-detail .detail-cover {
    height: auto;
    max-height: 400px;
    margin-bottom: 15px;
  }

  .pagination-container {
    margin-top: 20px;
  }

  .pagination-container :deep(.el-pagination) {
    justify-content: center;
  }

  .pagination-container :deep(.el-pagination__sizes),
  .pagination-container :deep(.el-pagination__jump) {
    display: none;
  }
}
</style>
