import request from '@/utils/request'

// 读者注册
export function readerRegister(data) {
  return request({
    url: '/reader/register',
    method: 'post',
    data
  })
}

// 检查用户名是否可用
export function checkUsername(username) {
  return request({
    url: `/reader/check-username/${username}`,
    method: 'get'
  })
}

// 获取注册配置
export function getRegisterConfig() {
  return request({
    url: '/reader/config',
    method: 'get'
  })
}
