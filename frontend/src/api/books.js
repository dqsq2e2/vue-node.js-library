import request from '@/utils/request'

// 获取图书列表
export function getBookList(params) {
  return request({
    url: '/books',
    method: 'get',
    params
  })
}

// 获取图书列表（别名）
export function getBooks(params) {
  return getBookList(params)
}

// 获取图书详情
export function getBookDetail(id) {
  return request({
    url: `/books/${id}`,
    method: 'get'
  })
}

// 添加图书
export function addBook(data) {
  return request({
    url: '/books',
    method: 'post',
    data
  })
}

// 更新图书
export function updateBook(id, data) {
  return request({
    url: `/books/${id}`,
    method: 'put',
    data
  })
}

// 删除图书
export function deleteBook(id) {
  return request({
    url: `/books/${id}`,
    method: 'delete'
  })
}

// 获取图书分类列表
export function getCategoryList() {
  return request({
    url: '/books/categories',
    method: 'get'
  })
}

// 获取分类列表（详细）
export function getCategoryListDetail() {
  return request({
    url: '/books/categories',
    method: 'get'
  })
}

// 获取分类列表（别名）
export function getCategories() {
  return getCategoryListDetail()
}

// 添加图书分类
export function addCategory(data) {
  return request({
    url: '/books/categories',
    method: 'post',
    data
  })
}

// 更新图书分类
export function updateCategory(id, data) {
  return request({
    url: `/books/categories/${id}`,
    method: 'put',
    data
  })
}

// 删除图书分类
export function deleteCategory(id) {
  return request({
    url: `/books/categories/${id}`,
    method: 'delete'
  })
}
