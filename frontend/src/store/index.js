import { createStore } from 'vuex'
import user from './modules/user'
import app from './modules/app'

const store = createStore({
  modules: {
    user,
    app
  },
  getters: {
    token: state => state.user.token,
    userInfo: state => state.user.userInfo,
    roles: state => state.user.roles,
    permissions: state => state.user.permissions,
    sidebar: state => state.app.sidebar,
    device: state => state.app.device
  }
})

export default store
