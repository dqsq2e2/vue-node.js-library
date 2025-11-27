import request from '@/utils/request'

// 获取同步状态
export function getSyncStatus() {
  return request({
    url: '/sync/status',
    method: 'get'
  })
}

// 获取同步日志
export function getSyncLogs(params) {
  return request({
    url: '/sync/logs',
    method: 'get',
    params
  })
}

// 获取冲突记录
export function getConflicts(params) {
  return request({
    url: '/sync/conflicts',
    method: 'get',
    params
  })
}

// 手动触发同步
export function triggerSync() {
  return request({
    url: '/sync/trigger',
    method: 'post'
  })
}

// 解决冲突
export function resolveConflict(id, data) {
  return request({
    url: `/sync/conflicts/${id}/resolve`,
    method: 'post',
    data
  })
}

// 获取同步配置
export function getSyncConfig() {
  return request({
    url: '/sync/config',
    method: 'get'
  })
}

// 更新同步配置
export function updateSyncConfig(data) {
  return request({
    url: '/sync/config',
    method: 'put',
    data
  })
}

// 获取数据库状态
export function getDatabaseStatus() {
  return request({
    url: '/sync/databases/status',
    method: 'get'
  })
}

// 清理同步日志
export function cleanupSyncLogs(data) {
  return request({
    url: '/sync/logs/cleanup',
    method: 'delete',
    data
  })
}
