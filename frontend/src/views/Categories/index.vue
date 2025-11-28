<template>
  <div class="categories-container">
    <div class="page-header">
      <h2>分类管理</h2>
      <p>管理图书分类信息，支持层级分类结构</p>
    </div>

    <!-- 搜索和操作栏 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.search"
            placeholder="搜索分类名称或描述"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="父分类">
          <el-select
            v-model="searchForm.parent_id"
            placeholder="选择父分类"
            clearable
            style="width: 200px"
          >
            <el-option label="顶级分类" :value="0" />
            <el-option
              v-for="category in parentOptions"
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
          <el-button @click="resetSearch">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加分类
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 分类表格 -->
    <el-card class="table-card" shadow="never">
      <div class="table-container">
        <el-table
          v-loading="loading"
          :data="categoryList"
          style="width: 100%;"
          row-key="category_id"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          default-expand-all
          stripe
          border
          @selection-change="handleSelectionChange"
        >
        <el-table-column v-if="!isMobile" type="selection" width="55" />
        <el-table-column v-if="!isMobile" type="index" label="序号" width="60" />
        <el-table-column prop="category_name" label="分类名称">
          <template #default="{ row }">
            <span class="category-name">{{ row.category_name }}</span>
          </template>
        </el-table-column>
        
        <el-table-column v-if="!isMobile" prop="parent_name" label="父分类" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.parent_id === 0" type="info" size="small">顶级分类</el-tag>
            <span v-else>{{ row.parent_name || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column v-if="!isMobile" prop="description" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column v-if="!isMobile" prop="sort_order" label="排序" width="80" align="center">
          <template #default="{ row }">
            {{ row.sort_order || 0 }}
          </template>
        </el-table-column>
        
        <el-table-column prop="book_count" label="图书数量" :width="isMobile ? '' : 80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.book_count > 0 ? 'success' : 'info'" size="small">
              {{ row.book_count || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column v-if="!isMobile" prop="created_time" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_time) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" :width="isMobile ? '' : 100">
          <template #default="{ row }">
            <div class="action-buttons">
              <!-- 桌面端显示 -->
              <div class="desktop-actions" @click.stop>
                <el-dropdown @command="(command) => handleActionCommand(command, row)">
                  <el-button type="primary" size="small">
                    操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item command="addChild">添加子分类</el-dropdown-item>
                      <el-dropdown-item 
                        command="delete" 
                        :disabled="row.book_count > 0"
                        divided
                      >
                        删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <!-- 移动端显示 -->
              <div class="mobile-actions" @click.stop>
                <el-dropdown @command="(command) => handleActionCommand(command, row)">
                  <el-button type="primary" size="small">
                    操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item command="addChild">添加子分类</el-dropdown-item>
                      <el-dropdown-item command="delete" :disabled="row.book_count > 0" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-table-column>
        </el-table>
      </div>

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

    <!-- 添加/编辑分类对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="resetForm"
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="分类名称" prop="category_name">
          <el-input
            v-model="categoryForm.category_name"
            placeholder="请输入分类名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="父分类" prop="parent_id">
          <el-select
            v-model="categoryForm.parent_id"
            placeholder="选择父分类"
            style="width: 100%"
            clearable
          >
            <el-option label="顶级分类" :value="0" />
            <el-option
              v-for="category in availableParents"
              :key="category.category_id"
              :label="category.category_name"
              :value="category.category_id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="排序序号" prop="sort_order">
          <el-input-number
            v-model="categoryForm.sort_order"
            :min="0"
            :max="9999"
            placeholder="排序序号"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="categoryForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入分类描述"
            maxlength="500"
            show-word-limit
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, ArrowDown, Refresh } from '@element-plus/icons-vue'
import {
  getCategoryList,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory
} from '@/api/categories'

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
const categoryFormRef = ref()

// 搜索表单
const searchForm = reactive({
  search: '',
  parent_id: undefined
})

// 分页信息
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 分类列表
const categoryList = ref([])
const allCategories = ref([])
const selectedCategories = ref([])

// 表单数据
const categoryForm = reactive({
  category_id: null,
  category_name: '',
  parent_id: 0,
  description: '',
  sort_order: 0
})

// 表单验证规则
const formRules = {
  category_name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 50, message: '分类名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  parent_id: [
    { required: true, message: '请选择父分类', trigger: 'change' }
  ],
  sort_order: [
    { type: 'number', message: '排序序号必须是数字', trigger: 'blur' }
  ]
}

// 计算属性
const dialogTitle = computed(() => {
  return categoryForm.category_id ? '编辑分类' : '添加分类'
})

const parentOptions = computed(() => {
  return allCategories.value.filter(cat => cat.parent_id === 0)
})

const availableParents = computed(() => {
  // 编辑时，排除自己和自己的子分类
  if (categoryForm.category_id) {
    return allCategories.value.filter(cat => 
      cat.category_id !== categoryForm.category_id && 
      cat.parent_id !== categoryForm.category_id
    )
  }
  return allCategories.value
})

// 方法
const fetchCategories = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      limit: pagination.limit
    }
    
    const response = await getCategoryList(params)
    if (response.success) {
      categoryList.value = response.data.categories
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    ElMessage.error('获取分类列表失败')
    console.error('获取分类列表失败:', error)
  } finally {
    loading.value = false
  }
}

const fetchAllCategories = async () => {
  try {
    const response = await getCategoryTree()
    if (response.success) {
      // 扁平化树形结构
      const flattenTree = (nodes) => {
        let result = []
        nodes.forEach(node => {
          result.push(node)
          if (node.children && node.children.length > 0) {
            result = result.concat(flattenTree(node.children))
          }
        })
        return result
      }
      allCategories.value = flattenTree(response.data)
    }
  } catch (error) {
    console.error('获取所有分类失败:', error)
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchCategories()
}

const resetSearch = () => {
  searchForm.search = ''
  searchForm.parent_id = undefined
  pagination.page = 1
  fetchCategories()
}

const handleSizeChange = (size) => {
  pagination.limit = size
  pagination.page = 1
  fetchCategories()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  fetchCategories()
}

const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

const handleAddChild = (row) => {
  resetForm()
  categoryForm.parent_id = row.category_id
  dialogVisible.value = true
}

const handleEdit = (row) => {
  resetForm()
  Object.assign(categoryForm, {
    category_id: row.category_id,
    category_name: row.category_name,
    parent_id: row.parent_id,
    description: row.description || '',
    sort_order: row.sort_order || 0
  })
  dialogVisible.value = true
}

// 处理桌面端下拉菜单操作
const handleDropdownCommand = (command, row) => {
  switch (command) {
    case 'addChild':
      handleAddChild(row)
      break
    case 'delete':
      if (row.book_count === 0) {
        handleDelete(row)
      }
      break
  }
}

// 处理移动端下拉菜单操作
const handleActionCommand = (command, row) => {
  switch (command) {
    case 'view':
      handleEdit(row)
      break
    case 'edit':
      handleEdit(row)
      break
    case 'addChild':
      handleAddChild(row)
      break
    case 'delete':
      if (row.book_count === 0) {
        handleDelete(row)
      }
      break
  }
}

const handleDelete = async (row) => {
  if (row.book_count > 0) {
    ElMessage.warning('该分类下还有图书，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除分类"${row.category_name}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await deleteCategory(row.category_id)
    if (response.success) {
      ElMessage.success('删除成功')
      fetchCategories()
      fetchAllCategories()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
      console.error('删除分类失败:', error)
    }
  }
}

// 选择变化处理
const handleSelectionChange = (selection) => {
  selectedCategories.value = selection
}

const handleSubmit = async () => {
  try {
    await categoryFormRef.value.validate()
    
    submitting.value = true
    
    const data = { ...categoryForm }
    delete data.category_id
    
    let response
    if (categoryForm.category_id) {
      response = await updateCategory(categoryForm.category_id, data)
    } else {
      response = await createCategory(data)
    }
    
    if (response.success) {
      ElMessage.success(categoryForm.category_id ? '更新成功' : '创建成功')
      dialogVisible.value = false
      fetchCategories()
      fetchAllCategories()
    }
  } catch (error) {
    console.error('提交失败:', error)
    
    // 如果是401错误，不需要额外处理，request.js已经处理了
    if (error.response?.status === 401) {
      return
    }
    
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('操作失败')
    }
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  Object.assign(categoryForm, {
    category_id: null,
    category_name: '',
    parent_id: 0,
    description: '',
    sort_order: 0
  })
  categoryFormRef.value?.clearValidate()
}

const formatDateTime = (dateTime) => {
  if (!dateTime) return '-'
  return new Date(dateTime).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  window.addEventListener('resize', handleResize)
  fetchCategories()
  fetchAllCategories()
  
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
.categories-container {
  padding: 20px;
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
  color: #606266;
  font-size: 14px;
}

.search-bar {
  background: #fff;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.table-container {
  overflow-x: auto;
  min-height: 400px;
}

.table-card {
  margin-bottom: 20px;
}

.category-name {
  font-weight: 500;
}

.pagination-container {
  padding: 20px;
  text-align: right;
  border-top: 1px solid #ebeef5;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
}

.action-buttons .el-button {
  margin: 0;
  min-width: 70px;
  font-size: 12px;
  padding: 5px 8px;
}

.action-buttons .el-button--small {
  height: 28px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .action-buttons {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .action-buttons .el-button {
    min-width: 60px;
    font-size: 11px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-table) {
  border: none;
  table-layout: auto;
}

:deep(.el-table__header) {
  background-color: #fafafa;
}

:deep(.el-table th),
:deep(.el-table td) {
  padding: 8px 5px;
}

:deep(.el-table td) {
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-table tr:hover > td) {
  background-color: #f5f7fa;
}

/* 操作按钮默认样式 */
.action-buttons .desktop-actions {
  display: block;
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
  
  /* 页面头部 */
  .page-header {
    text-align: center;
  }
  
  .page-header h2 {
    font-size: 20px;
  }
  
  .page-header p {
    font-size: 14px;
  }
  
  /* 搜索表单适配 */
  .search-card .search-form {
    flex-direction: column;
  }
  
  .search-card .el-form-item {
    margin-bottom: 16px;
    width: 100%;
  }
  
  .search-card .el-input,
  .search-card .el-select {
    width: 100% !important;
  }
  
  /* 移动端表格优化 */
  .categories-container {
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
  
  /* 表格优化 - 强制占满宽度 */
  :deep(.el-table__header-wrapper table),
  :deep(.el-table__body-wrapper table) {
    width: 100% !important;
  }
  
  /* 操作按钮适配 */
  .action-buttons .desktop-actions {
    display: none;
  }
  
  .action-buttons .mobile-actions {
    display: block;
  }
  
  /* 分页适配 */
  .pagination-container {
    padding: 16px 0;
    text-align: center;
  }
  
  .el-pagination {
    justify-content: center;
  }
  
  /* 隐藏分页的部分功能 */
  .el-pagination .el-pagination__sizes,
  .el-pagination .el-pagination__jump {
    display: none;
  }
}
</style>
