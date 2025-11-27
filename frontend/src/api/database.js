import request from '@/utils/request'

// 获取数据库状态概览
export function getDatabaseOverview() {
  return request({
    url: '/database-switch/overview',
    method: 'get'
  })
}

// 获取当前主数据库
export function getCurrentDatabase() {
  return request({
    url: '/database-switch/current',
    method: 'get'
  })
}

// 检查数据库健康状态
export function checkDatabaseHealth(params) {
  return request({
    url: '/database-switch/health',
    method: 'get',
    params
  })
}

// 验证数据一致性
export function validateDataConsistency(data) {
  return request({
    url: '/database-switch/validate-consistency',
    method: 'post',
    data
  })
}

// 触发数据同步
export function triggerDataSync() {
  return request({
    url: '/database-switch/trigger-sync',
    method: 'post'
  })
}

// 切换主数据库
export function switchDatabase(data) {
  return request({
    url: '/database-switch/switch',
    method: 'post',
    data
  })
}

// 回滚到上一个数据库
export function rollbackDatabase() {
  return request({
    url: '/database-switch/rollback',
    method: 'post'
  })
}

// 获取切换历史
export function getSwitchHistory(params) {
  return request({
    url: '/database-switch/history',
    method: 'get',
    params
  })
}

// 切换预检查
export function preCheckSwitch(data) {
  return request({
    url: '/database-switch/pre-check',
    method: 'post',
    data
  })
}
