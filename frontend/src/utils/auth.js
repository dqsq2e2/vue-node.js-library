const TokenKey = 'library_token'
const UserKey = 'library_user'

export function getToken() {
  const token = localStorage.getItem(TokenKey)
  if (!token || token === 'undefined' || token === 'null') {
    return null
  }
  return token
}

export function setToken(token) {
  return localStorage.setItem(TokenKey, token)
}

export function removeToken() {
  return localStorage.removeItem(TokenKey)
}

export function getUser() {
  try {
    const user = localStorage.getItem(UserKey)
    if (!user || user === 'undefined' || user === 'null') {
      return null
    }
    return JSON.parse(user)
  } catch (error) {
    console.warn('解析用户信息失败，清除无效数据:', error)
    localStorage.removeItem(UserKey)
    return null
  }
}

export function setUser(user) {
  return localStorage.setItem(UserKey, JSON.stringify(user))
}

export function removeUser() {
  return localStorage.removeItem(UserKey)
}

export function clearAuth() {
  removeToken()
  removeUser()
}

// 清理无效的localStorage数据
export function cleanupInvalidAuth() {
  try {
    // 检查并清理无效的token
    const token = localStorage.getItem(TokenKey)
    if (token === 'undefined' || token === 'null') {
      localStorage.removeItem(TokenKey)
    }
    
    // 检查并清理无效的用户数据
    const user = localStorage.getItem(UserKey)
    if (user === 'undefined' || user === 'null') {
      localStorage.removeItem(UserKey)
    } else if (user) {
      try {
        JSON.parse(user)
      } catch (error) {
        console.warn('清理无效的用户数据:', user)
        localStorage.removeItem(UserKey)
      }
    }
  } catch (error) {
    console.warn('清理localStorage时出错:', error)
  }
}
