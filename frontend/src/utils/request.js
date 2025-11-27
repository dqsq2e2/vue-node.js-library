import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import store from '@/store'
import router from '@/router'

// 创建axios实例
const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API || '/api',
  timeout: 15000
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 添加token
    const token = store.getters.token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 防止重复请求
let isRefreshing = false
let failedQueue = []

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data

    // 如果返回的状态码不是2xx，说明接口有问题
    if (response.status < 200 || response.status >= 300) {
      ElMessage({
        message: res?.message || '请求失败',
        type: 'error',
        duration: 5 * 1000
      })
      return Promise.reject(new Error(res?.message || '请求失败'))
    }

    // 如果业务状态码不是success，说明业务有问题
    if (res && res.success === false) {
      ElMessage({
        message: res.message || '操作失败',
        type: 'error',
        duration: 5 * 1000
      })
      return Promise.reject(new Error(res.message || '操作失败'))
    }

    return res
  },
  error => {
    console.error('响应错误:', error)
    
    let message = '网络错误'
    
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          // 防止重复处理401错误
          if (!isRefreshing) {
            isRefreshing = true
            message = '登录已过期，请重新登录'
            
            // 显示错误消息
            ElMessage({
              message: message,
              type: 'error',
              duration: 3000
            })
            
            // 清除token并跳转到登录页
            store.dispatch('user/logout').then(() => {
              router.push('/login')
              isRefreshing = false
            }).catch(() => {
              isRefreshing = false
            })
          }
          return Promise.reject(error)
        case 403:
          message = '没有权限访问'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 429:
          message = '请求过于频繁，请稍后再试'
          break
        case 500:
          message = '服务器内部错误'
          break
        default:
          message = data?.message || `请求失败 (${status})`
      }
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时'
    } else if (error.message.includes('Network Error')) {
      message = '网络连接失败'
    }

    // 只在非401错误时显示消息
    if (error.response?.status !== 401) {
      ElMessage({
        message,
        type: 'error',
        duration: 5 * 1000
      })
    }

    return Promise.reject(error)
  }
)

export default service
