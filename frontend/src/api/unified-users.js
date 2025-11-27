import request from '@/utils/request'

/**
 * 获取统一用户列表
 * @param {Object} params - 查询参数
 * @returns {Promise}
 */
export function getUnifiedUsers(params) {
  return request({
    url: '/unified-users',
    method: 'get',
    params
  })
}

/**
 * 获取单个用户详情
 * @param {number} id - 用户ID
 * @returns {Promise}
 */
export function getUnifiedUser(id) {
  return request({
    url: `/unified-users/${id}`,
    method: 'get'
  })
}

/**
 * 创建新用户
 * @param {Object} data - 用户数据
 * @returns {Promise}
 */
export function createUnifiedUser(data) {
  return request({
    url: '/unified-users',
    method: 'post',
    data
  })
}

/**
 * 更新用户信息
 * @param {number} id - 用户ID
 * @param {Object} data - 更新数据
 * @returns {Promise}
 */
export function updateUnifiedUser(id, data) {
  return request({
    url: `/unified-users/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除用户
 * @param {number} id - 用户ID
 * @returns {Promise}
 */
export function deleteUnifiedUser(id) {
  return request({
    url: `/unified-users/${id}`,
    method: 'delete'
  })
}

/**
 * 重置用户密码
 * @param {number} id - 用户ID
 * @param {string} newPassword - 新密码
 * @returns {Promise}
 */
export function resetUserPassword(id, newPassword) {
  return request({
    url: `/unified-users/${id}/reset-password`,
    method: 'post',
    data: {
      new_password: newPassword
    }
  })
}
