import request from '@/utils/request'

// 获取系统概览统计
export function getOverviewStats() {
  return request({
    url: '/reports/overview',
    method: 'get'
  })
}

// 获取借阅趋势统计
export function getBorrowTrend(params) {
  return request({
    url: '/reports/borrow-trend',
    method: 'get',
    params
  })
}

// 获取图书分类统计
export function getCategoryStats() {
  return request({
    url: '/reports/category-stats',
    method: 'get'
  })
}

// 获取热门图书排行
export function getPopularBooks(params) {
  return request({
    url: '/reports/popular-books',
    method: 'get',
    params
  })
}

// 获取活跃读者排行
export function getActiveReaders(params) {
  return request({
    url: '/reports/active-readers',
    method: 'get',
    params
  })
}

// 获取逾期统计报告
export function getOverdueReport() {
  return request({
    url: '/reports/overdue-report',
    method: 'get'
  })
}

// 获取同步统计报告
export function getSyncReport(params) {
  return request({
    url: '/reports/sync-report',
    method: 'get',
    params
  })
}

// 导出报表数据
export function exportReport(type, params) {
  return request({
    url: `/reports/export/${type}`,
    method: 'get',
    params,
    responseType: 'blob'
  })
}
