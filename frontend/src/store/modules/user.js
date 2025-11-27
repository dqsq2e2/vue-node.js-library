import { login, logout, getUserInfo } from '@/api/auth'
import { getToken, setToken, removeToken, setUser, removeUser, getUser } from '@/utils/auth'

const state = {
  token: getToken(),
  userInfo: getUser(),
  roles: [],
  permissions: []
}

const mutations = {
  SET_TOKEN: (state, token) => {
    state.token = token
  },
  SET_USER_INFO: (state, userInfo) => {
    state.userInfo = userInfo
  },
  SET_ROLES: (state, roles) => {
    state.roles = roles
  },
  SET_PERMISSIONS: (state, permissions) => {
    state.permissions = permissions
  }
}

const actions = {
  // 用户登录
  login({ commit }, userInfo) {
    const { username, password } = userInfo
    return new Promise((resolve, reject) => {
      login({ username: username.trim(), password: password })
        .then(response => {
          const { data } = response
          // 根据实际后端响应格式调整
          commit('SET_TOKEN', data.token)
          commit('SET_USER_INFO', data.user || data)
          setToken(data.token)
          setUser(data.user || data)
          resolve()
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  // 获取用户信息
  getInfo({ commit, state }) {
    return new Promise((resolve, reject) => {
      getUserInfo()
        .then(response => {
          const { data } = response
          
          if (!data) {
            reject('验证失败，请重新登录。')
          }

          const { user, roles, permissions } = data
          
          // 设置用户信息
          commit('SET_USER_INFO', user)
          commit('SET_ROLES', roles || [])
          commit('SET_PERMISSIONS', permissions || [])
          
          setUser(user)
          
          resolve(data)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  // 用户登出
  logout({ commit, state }) {
    return new Promise((resolve, reject) => {
      // 如果有token，尝试调用后端登出接口
      if (state.token) {
        logout()
          .then(() => {
            // 清除本地状态
            commit('SET_TOKEN', '')
            commit('SET_USER_INFO', null)
            commit('SET_ROLES', [])
            commit('SET_PERMISSIONS', [])
            removeToken()
            removeUser()
            resolve()
          })
          .catch(error => {
            // 即使后端登出失败，也要清除本地状态
            console.warn('后端登出失败，但仍清除本地状态:', error)
            commit('SET_TOKEN', '')
            commit('SET_USER_INFO', null)
            commit('SET_ROLES', [])
            commit('SET_PERMISSIONS', [])
            removeToken()
            removeUser()
            resolve()
          })
      } else {
        // 没有token，直接清除本地状态
        commit('SET_TOKEN', '')
        commit('SET_USER_INFO', null)
        commit('SET_ROLES', [])
        commit('SET_PERMISSIONS', [])
        removeToken()
        removeUser()
        resolve()
      }
    })
  },

  // 移除token
  resetToken({ commit }) {
    return new Promise(resolve => {
      commit('SET_TOKEN', '')
      commit('SET_USER_INFO', null)
      commit('SET_ROLES', [])
      commit('SET_PERMISSIONS', [])
      removeToken()
      removeUser()
      resolve()
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
