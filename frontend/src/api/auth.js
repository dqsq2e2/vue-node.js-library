import request from '@/utils/request'

// 用户登录
export function login(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

// 用户登出
export function logout() {
  return request({
    url: '/auth/logout',
    method: 'post'
  })
}

// 获取用户信息
export function getUserInfo() {
  return request({
    url: '/auth/profile',
    method: 'get'
  })
}

// 更新用户信息
export function updateProfile(data) {
  return request({
    url: '/auth/profile',
    method: 'put',
    data
  })
}

// 修改密码
export function changePassword(data) {
  return request({
    url: '/auth/change-password',
    method: 'post',
    data
  })
}

/**
 * 发送注册验证码
 */
export function sendVerificationCode(data) {
  return request({
    url: '/auth/send-verification-code',
    method: 'post',
    data
  })
}

/**
 * 发送修改邮箱验证码
 */
export function sendEmailChangeCode(data) {
  return request({
    url: '/auth/send-email-change-code',
    method: 'post',
    data
  })
}
