import request from '@/utils/request'

// 获取借阅记录列表
export function getBorrowList(params) {
  return request({
    url: '/borrow',
    method: 'get',
    params
  })
}

// 获取借阅记录列表（别名）
export function getBorrowRecords(params) {
  return getBorrowList(params)
}

// 获取借阅记录详情
export function getBorrowDetail(id) {
  return request({
    url: `/borrow/${id}`,
    method: 'get'
  })
}

// 借书
export function borrowBook(data) {
  return request({
    url: '/borrow',
    method: 'post',
    data
  })
}

// 添加借阅记录（别名）
export function addBorrowRecord(data) {
  return borrowBook(data)
}

// 还书
export function returnBook(id, data) {
  return request({
    url: `/borrow/${id}/return`,
    method: 'post',
    data
  })
}

// 续借
export function renewBook(id, data) {
  return request({
    url: `/borrow/${id}/renew`,
    method: 'post',
    data
  })
}

// 获取逾期记录
export function getOverdueList(params) {
  return request({
    url: '/borrow/overdue',
    method: 'get',
    params
  })
}

// 获取借阅统计
export function getBorrowStatistics(params) {
  return request({
    url: '/borrow/statistics',
    method: 'get',
    params
  })
}

// 获取借阅统计（别名）
export function getBorrowStats(params) {
  return getBorrowStatistics(params)
}

// 通知逾期
export function notifyOverdue(recordId) {
  return request({
    url: `/borrow/${recordId}/notify`,
    method: 'post'
  })
}

// 处理逾期
export function processOverdue(recordId, data) {
  return request({
    url: `/borrow/${recordId}/process`,
    method: 'post',
    data
  })
}
