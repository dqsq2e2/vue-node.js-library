import request from './request'

/**
 * API 工具类
 * 基于 request.js 封装的 API 调用方法
 */
class API {
  /**
   * GET 请求
   * @param {string} url - 请求URL
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  get(url, config = {}) {
    return request({
      method: 'get',
      url,
      ...config
    })
  }

  /**
   * POST 请求
   * @param {string} url - 请求URL
   * @param {object} data - 请求数据
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  post(url, data = {}, config = {}) {
    return request({
      method: 'post',
      url,
      data,
      ...config
    })
  }

  /**
   * PUT 请求
   * @param {string} url - 请求URL
   * @param {object} data - 请求数据
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  put(url, data = {}, config = {}) {
    return request({
      method: 'put',
      url,
      data,
      ...config
    })
  }

  /**
   * DELETE 请求
   * @param {string} url - 请求URL
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  delete(url, config = {}) {
    return request({
      method: 'delete',
      url,
      ...config
    })
  }

  /**
   * PATCH 请求
   * @param {string} url - 请求URL
   * @param {object} data - 请求数据
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  patch(url, data = {}, config = {}) {
    return request({
      method: 'patch',
      url,
      data,
      ...config
    })
  }

  /**
   * 上传文件
   * @param {string} url - 上传URL
   * @param {FormData} formData - 文件数据
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  upload(url, formData, config = {}) {
    return request({
      method: 'post',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      ...config
    })
  }

  /**
   * 下载文件
   * @param {string} url - 下载URL
   * @param {object} config - axios配置
   * @returns {Promise}
   */
  download(url, config = {}) {
    return request({
      method: 'get',
      url,
      responseType: 'blob',
      ...config
    })
  }
}

// 创建API实例
const api = new API()

// 导出API实例
export default api

// 也可以导出类，供其他地方使用
export { API }
