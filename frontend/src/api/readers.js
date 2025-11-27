import request from '@/utils/request'

// 获取读者列表
export function getReaderList(params) {
  // 转换为统一用户管理API的参数格式
  const unifiedParams = {
    ...params,
    role: 'reader' // 只获取读者角色的用户
  };
  
  return request({
    url: '/unified-users',
    method: 'get',
    params: unifiedParams
  })
}

// 获取读者列表（别名）
export function getReaders(params) {
  return getReaderList(params)
}

// 获取读者详情
export function getReaderDetail(id) {
  return request({
    url: `/readers/${id}`,
    method: 'get'
  })
}

// 添加读者
export function addReader(data) {
  return request({
    url: '/readers',
    method: 'post',
    data
  })
}

// 更新读者
export function updateReader(id, data) {
  return request({
    url: `/readers/${id}`,
    method: 'put',
    data
  })
}

// 删除读者
export function deleteReader(id) {
  return request({
    url: `/readers/${id}`,
    method: 'delete'
  })
}

// 获取部门列表
export function getDepartmentList() {
  return request({
    url: '/readers/departments',
    method: 'get'
  })
}

// 获取读者借阅历史
export function getReaderBorrowHistory(id, params) {
  return request({
    url: `/readers/${id}/borrow-history`,
    method: 'get',
    params
  })
}
