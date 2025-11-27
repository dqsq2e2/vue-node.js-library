import request from '@/utils/request'

/**
 * 上传图书封面
 * @param {File} file - 图片文件
 * @returns {Promise}
 */
export function uploadBookCover(file) {
  const formData = new FormData()
  formData.append('cover', file)
  
  return request({
    url: '/upload/book-cover',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 删除图书封面
 * @param {string} filename - 文件名
 * @returns {Promise}
 */
export function deleteBookCover(filename) {
  return request({
    url: `/upload/book-cover/${filename}`,
    method: 'delete'
  })
}

/**
 * 取消临时图片
 * @param {string} tempId - 临时图片ID
 * @returns {Promise}
 */
export function cancelTempImage(tempId) {
  return request({
    url: `/upload/book-cover/temp/${tempId}`,
    method: 'delete'
  })
}

/**
 * 确认保存临时图片
 * @param {string} tempId - 临时图片ID
 * @param {string} finalFilename - 最终文件名（可选）
 * @returns {Promise}
 */
export function confirmTempImage(tempId, finalFilename = null) {
  return request({
    url: '/upload/book-cover/confirm',
    method: 'post',
    data: { tempId, finalFilename }
  })
}
