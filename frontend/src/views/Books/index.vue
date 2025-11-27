<template>
  <div class="books-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>图书管理</h2>
        <p>管理图书信息、分类和库存</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加图书
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="书名">
          <el-input 
            v-model="searchForm.title" 
            placeholder="请输入书名"
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
        <el-form-item label="分类">
          <el-select v-model="searchForm.category_id" placeholder="选择分类" clearable style="width: 150px;">
            <el-option
              v-for="category in categories"
              :key="category.category_id"
              :label="category.category_name"
              :value="category.category_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出版社">
          <el-input 
            v-model="searchForm.publisher" 
            placeholder="请输入出版社"
            clearable
            style="width: 150px;"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="选择状态" clearable style="width: 120px;">
            <el-option label="在库" value="在库" />
            <el-option label="下架" value="下架" />
            <el-option label="维修" value="维修" />
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
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading"
        :data="bookList" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.size + index + 1" />
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <div class="table-cover">
              <img 
                :src="getImageUrl(row.cover_image)" 
                alt="封面" 
                class="cover-thumbnail"
                @error="handleImageError"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="书名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
        <el-table-column prop="isbn" label="ISBN" width="150" />
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column prop="publisher" label="出版社" width="150" show-overflow-tooltip />
        <el-table-column prop="price" label="价格" width="80">
          <template #default="{ row }">
            ¥{{ row.price }}
          </template>
        </el-table-column>
        <el-table-column prop="total_copies" label="总数" width="80" />
        <el-table-column prop="available_copies" label="可借" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="info" size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              删除
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

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      @close="handleDialogClose"
    >
      <el-form
        ref="bookFormRef"
        :model="bookForm"
        :rules="bookRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="书名" prop="title">
              <el-input v-model="bookForm.title" placeholder="请输入书名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="作者" prop="author">
              <el-input v-model="bookForm.author" placeholder="请输入作者" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="ISBN" prop="isbn">
              <el-input v-model="bookForm.isbn" placeholder="请输入ISBN" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category_id">
              <el-select v-model="bookForm.category_id" placeholder="选择分类" style="width: 100%">
                <el-option
                  v-for="category in categories"
                  :key="category.category_id"
                  :label="category.category_name"
                  :value="category.category_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="出版社" prop="publisher">
              <el-input v-model="bookForm.publisher" placeholder="请输入出版社" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出版日期" prop="publish_date">
              <el-date-picker
                v-model="bookForm.publish_date"
                type="date"
                placeholder="选择出版日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="价格" prop="price">
              <el-input-number
                v-model="bookForm.price"
                :min="0"
                :precision="2"
                placeholder="价格"
                style="width: 100%; min-width: 120px;"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="总数量" prop="total_copies">
              <el-input-number
                v-model="bookForm.total_copies"
                :min="1"
                placeholder="总数量"
                style="width: 100%; min-width: 120px;"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="可借数量" prop="available_copies">
              <el-input-number
                v-model="bookForm.available_copies"
                :min="0"
                :max="bookForm.total_copies"
                placeholder="可借数量"
                style="width: 100%; min-width: 120px;"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="存放位置" prop="location">
          <el-input v-model="bookForm.location" placeholder="请输入存放位置" />
        </el-form-item>
        <el-form-item label="封面图片">
          <el-upload
            ref="uploadRef"
            class="cover-uploader"
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeUpload"
            :disabled="uploading"
            name="cover"
          >
            <div v-if="bookForm.cover_image" class="cover-preview">
              <img :src="getImageUrl(bookForm.cover_image)" alt="封面预览" />
              <div class="cover-overlay">
                <el-icon class="cover-icon"><Picture /></el-icon>
                <span>点击更换</span>
              </div>
            </div>
            <div v-else class="cover-placeholder">
              <el-icon class="cover-icon"><Plus /></el-icon>
              <span>上传封面</span>
            </div>
          </el-upload>
          <div class="upload-tips">
            <p>支持 JPG、PNG、GIF 格式，文件大小不超过 5MB</p>
            <el-button 
              v-if="bookForm.cover_image" 
              type="danger" 
              size="small" 
              text 
              @click="removeCover"
            >
              删除封面
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="bookForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入图书描述"
          />
        </el-form-item>
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
    <el-dialog v-model="detailVisible" title="图书详情" width="600px">
      <div v-if="currentBook" class="book-detail">
        <div class="detail-content">
          <div class="detail-cover">
            <img 
              :src="getImageUrl(currentBook.cover_image)" 
              alt="封面图片" 
              @error="handleImageError"
            />
          </div>
          <div class="detail-info">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="书名">{{ currentBook.title }}</el-descriptions-item>
              <el-descriptions-item label="作者">{{ currentBook.author }}</el-descriptions-item>
              <el-descriptions-item label="ISBN">{{ currentBook.isbn }}</el-descriptions-item>
              <el-descriptions-item label="分类">{{ currentBook.category_name }}</el-descriptions-item>
              <el-descriptions-item label="出版社">{{ currentBook.publisher }}</el-descriptions-item>
              <el-descriptions-item label="出版日期">{{ currentBook.publish_date }}</el-descriptions-item>
              <el-descriptions-item label="价格">¥{{ currentBook.price }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(currentBook.status)">
                  {{ currentBook.status }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="总数量">{{ currentBook.total_copies }}</el-descriptions-item>
              <el-descriptions-item label="可借数量">{{ currentBook.available_copies }}</el-descriptions-item>
              <el-descriptions-item label="存放位置" :span="2">{{ currentBook.location }}</el-descriptions-item>
              <el-descriptions-item label="描述" :span="2">{{ currentBook.description || '暂无描述' }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Picture } from '@element-plus/icons-vue'
import { getBooks, addBook, updateBook, deleteBook, getCategories } from '@/api/books'
import { getToken } from '@/utils/auth'

// 路由
const route = useRoute()

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const bookList = ref([])
const categories = ref([])
const selectedBooks = ref([])
const currentBook = ref(null)
const bookFormRef = ref(null)

// 搜索表单
const searchForm = reactive({
  title: '',
  author: '',
  isbn: '',
  category_id: '',
  publisher: '',
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 图书表单
const bookForm = reactive({
  book_id: null,
  title: '',
  author: '',
  isbn: '',
  category_id: '',
  publisher: '',
  publish_date: '',
  price: 0,
  total_copies: 1,
  available_copies: 1,
  location: '',
  description: '',
  cover_image: '',
  tempImageId: null  // 临时图片ID，用于取消时清理
})

// 记录编辑前的原始图片路径
const originalCoverImage = ref('')

// 图片上传相关
const uploading = ref(false)
const uploadRef = ref(null)

// 表单验证规则
const bookRules = {
  title: [{ required: true, message: '请输入书名', trigger: 'blur' }],
  author: [{ required: true, message: '请输入作者', trigger: 'blur' }],
  isbn: [{ required: true, message: '请输入ISBN', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
  publisher: [{ required: true, message: '请输入出版社', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  total_copies: [{ required: true, message: '请输入总数量', trigger: 'blur' }],
  available_copies: [{ required: true, message: '请输入可借数量', trigger: 'blur' }]
}

// 计算属性
const dialogTitle = computed(() => {
  return bookForm.book_id ? '编辑图书' : '添加图书'
})

// 图片上传相关计算属性
const uploadAction = computed(() => {
  return `${process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000'}/api/upload/book-cover`
})

const uploadHeaders = computed(() => {
  return {
    'Authorization': `Bearer ${getToken()}`
  }
})

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    '在库': 'success',
    '借出': 'warning',
    '维修': 'info',
    '丢失': 'danger'
  }
  return statusMap[status] || 'info'
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
    
    const response = await getBooks(params)
    if (response.success) {
      bookList.value = response.data.books || []
      pagination.total = response.data.pagination?.total || response.data.total || 0
    }
  } catch (error) {
    ElMessage.error('获取图书列表失败')
  } finally {
    loading.value = false
  }
}

// 获取分类列表
const fetchCategories = async () => {
  try {
    const response = await getCategories()
    if (response.success) {
      categories.value = response.data || []
    }
  } catch (error) {
    ElMessage.error('获取分类列表失败')
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchBooks()
}

// 重置搜索
const handleReset = () => {
  Object.keys(searchForm).forEach(key => {
    searchForm[key] = ''
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

// 选择改变
const handleSelectionChange = (selection) => {
  selectedBooks.value = selection
}

// 添加图书
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑图书
const handleEdit = (row) => {
  // 记录原始图片路径
  originalCoverImage.value = row.cover_image || ''
  
  Object.keys(bookForm).forEach(key => {
    if (key === 'price') {
      bookForm[key] = parseFloat(row[key]) || 0
    } else if (key === 'total_copies' || key === 'available_copies') {
      bookForm[key] = parseInt(row[key]) || 1
    } else if (key === 'category_id') {
      bookForm[key] = parseInt(row[key]) || ''
    } else if (key === 'tempImageId') {
      bookForm[key] = null  // 重置临时图片ID
    } else {
      bookForm[key] = row[key] || ''
    }
  })
  dialogVisible.value = true
}

// 查看详情
const handleView = (row) => {
  currentBook.value = row
  detailVisible.value = true
}

// 删除图书
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除图书"${row.title}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await deleteBook(row.book_id)
    if (response.success) {
      ElMessage.success('删除成功')
      fetchBooks()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!bookFormRef.value) return
  
  try {
    await bookFormRef.value.validate()
    submitting.value = true
    
    const formData = { ...bookForm }
    
    // 数据格式化处理
    if (formData.publish_date) {
      // 确保日期格式正确
      const date = new Date(formData.publish_date)
      formData.publish_date = date.toISOString().split('T')[0] // YYYY-MM-DD格式
    }
    
    // 确保数字类型正确
    if (formData.price !== undefined && formData.price !== null) {
      formData.price = parseFloat(formData.price)
    }
    if (formData.total_copies !== undefined && formData.total_copies !== null) {
      formData.total_copies = parseInt(formData.total_copies)
    }
    if (formData.available_copies !== undefined && formData.available_copies !== null) {
      formData.available_copies = parseInt(formData.available_copies)
    }
    if (formData.category_id !== undefined && formData.category_id !== null) {
      formData.category_id = parseInt(formData.category_id)
    }
    
    let response
    let isEdit = false
    
    if (formData.book_id) {
      // 更新时，从数据中移除book_id，只发送需要更新的字段
      const { book_id, ...updateData } = formData
      response = await updateBook(book_id, updateData)
      isEdit = true
    } else {
      // 添加时，移除book_id字段
      delete formData.book_id
      response = await addBook(formData)
      isEdit = false
    }
    
    if (response.success) {
      // 保存成功，清空临时图片ID（后端已处理）
      bookForm.tempImageId = null
      ElMessage.success(isEdit ? '更新成功' : '添加成功')
      dialogVisible.value = false
      fetchBooks()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleDialogClose = async () => {
  // 如果有临时图片且未保存，取消它
  if (bookForm.tempImageId) {
    try {
      const { cancelTempImage } = await import('@/api/upload')
      await cancelTempImage(bookForm.tempImageId)
      console.log('临时图片已取消:', bookForm.tempImageId)
    } catch (error) {
      console.warn('取消临时图片失败:', error)
    }
  }
  resetForm()
}

// 重置表单
const resetForm = () => {
  Object.keys(bookForm).forEach(key => {
    if (key === 'total_copies' || key === 'available_copies') {
      bookForm[key] = 1
    } else if (key === 'price') {
      bookForm[key] = 0
    } else if (key === 'tempImageId') {
      bookForm[key] = null
    } else {
      bookForm[key] = key === 'book_id' ? null : ''
    }
  })
  
  // 重置原始图片记录
  originalCoverImage.value = ''
  
  if (bookFormRef.value) {
    bookFormRef.value.clearValidate()
  }
}

// 图片上传相关方法
const getImageUrl = (imagePath) => {
  // 如果没有图片，返回国内CDN默认图片
  if (!imagePath) {
    return 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png'
  }
  if (imagePath.startsWith('http')) return imagePath
  // 在开发环境下使用代理路径，避免跨域问题
  if (process.env.NODE_ENV === 'development') {
    return imagePath // 直接使用相对路径，通过代理访问
  }
  return `${process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000'}${imagePath}`
}

// 图片加载失败处理
const handleImageError = (e) => {
  e.target.src = 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png'
}

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  
  uploading.value = true
  return true
}

const handleUploadSuccess = async (response) => {
  uploading.value = false
  if (response.success) {
    // 不要在这里删除旧图片！等用户确认保存后由后端处理
    // 保存临时图片ID，用于取消时清理
    bookForm.tempImageId = response.data.tempId
    bookForm.cover_image = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.message || '图片上传失败')
  }
}

const handleUploadError = (error) => {
  uploading.value = false
  console.error('图片上传失败:', error)
  ElMessage.error('图片上传失败，请重试')
}

// 删除旧图片文件
const deleteOldImage = async (imagePath) => {
  if (!imagePath || imagePath.startsWith('http')) return
  
  try {
    // 从路径中提取文件名
    const filename = imagePath.split('/').pop()
    if (filename) {
      const { deleteBookCover } = await import('@/api/upload')
      await deleteBookCover(filename)
    }
  } catch (error) {
    console.warn('删除旧图片失败:', error)
    // 不阻断流程，只是警告
  }
}

const removeCover = async () => {
  ElMessageBox.confirm('确定要删除封面图片吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    // 如果有临时图片，取消它
    if (bookForm.tempImageId) {
      try {
        const { cancelTempImage } = await import('@/api/upload')
        await cancelTempImage(bookForm.tempImageId)
        bookForm.tempImageId = null
      } catch (error) {
        console.warn('取消临时图片失败:', error)
      }
    }
    
    // 清空表单中的图片（不删除服务器上的原图，等保存时由后端处理）
    bookForm.cover_image = ''
    ElMessage.success('封面图片已删除')
  }).catch(() => {
    // 用户取消
  })
}

// 生命周期
onMounted(() => {
  fetchBooks()
  fetchCategories()
  
  // 检查是否需要自动打开添加对话框
  if (route.query.action === 'add') {
    handleAdd()
  }
})
</script>

<style scoped>
.books-container {
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

.book-detail {
  padding: 10px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-card__body) {
  padding: 16px;
}

/* 图片上传样式 */
.cover-uploader {
  display: inline-block;
}

.cover-preview {
  position: relative;
  width: 120px;
  height: 160px;
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s;
}

.cover-preview:hover {
  border-color: #409eff;
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.cover-preview:hover .cover-overlay {
  opacity: 1;
}

.cover-placeholder {
  width: 120px;
  height: 160px;
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8c939d;
  transition: all 0.3s;
}

.cover-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}

.cover-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.upload-tips {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.upload-tips p {
  margin: 0 0 4px 0;
}

/* 详情页面样式 */
.detail-content {
  display: flex;
  gap: 20px;
}

.detail-cover {
  flex-shrink: 0;
}

.detail-cover img {
  width: 120px;
  height: 160px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.detail-info {
  flex: 1;
}

/* 表格封面样式 */
.table-cover {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
}

.cover-thumbnail {
  width: 35px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.no-cover {
  width: 35px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  color: #c0c4cc;
  font-size: 16px;
}

@media (max-width: 768px) {
  .detail-content {
    flex-direction: column;
    align-items: center;
  }
  
  .detail-cover {
    margin-bottom: 16px;
  }
}
</style>
