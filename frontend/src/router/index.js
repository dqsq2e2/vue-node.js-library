import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'
import { getToken } from '@/utils/auth'

// 布局组件
import Layout from '@/views/Layout/index.vue'

// 路由配置
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login/index.vue'),
    hidden: true
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register/index.vue'),
    hidden: true
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'House' }
      }
    ]
  },
  {
    path: '/books',
    component: Layout,
    redirect: '/books/index',
    meta: { title: '图书管理', icon: 'Reading' },
    children: [
      {
        path: 'index',
        name: 'Books',
        component: () => import('@/views/Books/index.vue'),
        meta: { title: '图书管理', icon: 'Reading' }
      }
    ]
  },
  {
    path: '/categories',
    component: Layout,
    redirect: '/categories/index',
    meta: { 
      title: '分类管理', 
      icon: 'Menu',
      roles: ['admin', 'librarian'] // 只有管理员和图书管理员可以访问
    },
    children: [
      {
        path: 'index',
        name: 'Categories',
        component: () => import('@/views/Categories/index.vue'),
        meta: { 
          title: '分类管理', 
          icon: 'Menu',
          roles: ['admin', 'librarian']
        }
      }
    ]
  },
  {
    path: '/users',
    component: Layout,
    redirect: '/users/unified',
    meta: { 
      title: '用户管理', 
      icon: 'User',
      // 动态标题将在组件中处理
    },
    children: [
      {
        path: 'unified',
        name: 'UnifiedUsers',
        component: () => import('@/views/UnifiedUsers/index.vue'),
        meta: { 
          title: '用户管理', 
          icon: 'User',
          // 图书管理员看到的是"读者管理"
        }
      },
      {
        path: 'readers',
        name: 'Readers',
        component: () => import('@/views/Readers/index.vue'),
        meta: { title: '读者管理(旧)', icon: 'User', hidden: true }
      }
    ]
  },
  {
    path: '/books-browse',
    component: Layout,
    redirect: '/books-browse/index',
    meta: { title: '图书浏览', icon: 'Reading' },
    children: [
      {
        path: 'index',
        name: 'BooksBrowse',
        component: () => import('@/views/Books/Browse.vue'),
        meta: { title: '图书浏览', icon: 'Reading' }
      }
    ]
  },
  {
    path: '/profile',
    component: Layout,
    redirect: '/profile/index',
    meta: { title: '个人中心', icon: 'User' },
    children: [
      {
        path: 'index',
        name: 'Profile',
        component: () => import('@/views/Profile/index.vue'),
        meta: { title: '个人中心', icon: 'User' }
      }
    ]
  },
  {
    path: '/borrow',
    component: Layout,
    redirect: '/borrow/index',
    meta: { title: '借阅管理', icon: 'Document' },
    children: [
      {
        path: 'index',
        name: 'Borrow',
        component: () => import('@/views/Borrow/index.vue'),
        meta: { title: '借阅管理', icon: 'Document' }
      }
    ]
  },
  {
    path: '/database',
    component: Layout,
    redirect: '/database/management',
    meta: { 
      title: '数据库管理', 
      icon: 'DataBoard',
      roles: ['admin'] // 只有管理员可以访问
    },
    children: [
      {
        path: 'management',
        name: 'DatabaseManagement',
        component: () => import('@/views/DatabaseManagement/index.vue'),
        meta: { 
          title: '数据库管理', 
          icon: 'DataBoard',
          roles: ['admin']
        }
      }
    ]
  },
  {
    path: '/test',
    component: Layout,
    redirect: '/test/index',
    hidden: true,
    children: [
      {
        path: 'index',
        name: 'Test',
        component: () => import('@/views/Test.vue'),
        meta: { title: 'API测试', icon: 'Tools' }
      }
    ]
  },
  {
    path: '/404',
    component: () => import('@/views/Error/404.vue'),
    hidden: true
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
    hidden: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 白名单路由
const whiteList = ['/login', '/register', '/404']

// 路由守卫 - 简化版本，只处理登录状态
router.beforeEach(async (to, from, next) => {
  // 获取token
  const hasToken = getToken()

  if (hasToken) {
    if (to.path === '/login' || to.path === '/register') {
      // 如果已登录，重定向到首页
      next({ path: '/' })
    } else {
      // 检查用户信息是否存在
      const hasUserInfo = store.getters.userInfo && store.getters.userInfo.user_id
      
      if (hasUserInfo) {
        // 根据用户角色进行权限控制
        const userRole = store.getters.userInfo.role
        
        // 读者权限控制
        if (userRole === 'reader') {
          const readerAllowedPaths = ['/books-browse', '/borrow', '/profile']
          const isAllowed = readerAllowedPaths.some(path => to.path.startsWith(path))
          
          if (to.path === '/') {
            // 读者访问根路径时重定向到图书浏览
            next('/books-browse')
          } else if (!isAllowed) {
            // 读者访问不被允许的路径时重定向到图书浏览
            next('/books-browse')
          } else {
            next()
          }
        } else if (userRole === 'librarian') {
          // 图书管理员权限控制
          const librarianAllowedPaths = ['/dashboard', '/books', '/categories', '/users', '/borrow', '/profile']
          const isAllowed = librarianAllowedPaths.some(path => to.path.startsWith(path))
          
          if (!isAllowed) {
            // 图书管理员访问不被允许的路径时重定向到仪表盘
            next('/dashboard')
          } else {
            next()
          }
        } else {
          // 管理员可以访问所有路径
          next()
        }
      } else {
        try {
          // 获取用户信息
          await store.dispatch('user/getInfo')
          
          // 获取用户信息后，检查是否需要重定向
          const userRole = store.getters.userInfo.role
          if (to.path === '/' && userRole === 'reader') {
            // 读者访问根路径时重定向到图书浏览
            next('/books-browse')
          } else {
            next()
          }
        } catch (error) {
          // 移除token并重定向到登录页
          await store.dispatch('user/resetToken')
          next(`/login?redirect=${to.path}`)
        }
      }
    }
  } else {
    // 没有token
    if (whiteList.indexOf(to.path) !== -1) {
      // 在白名单中，直接进入
      next()
    } else {
      // 其他没有访问权限的页面将重定向到登录页面
      next(`/login?redirect=${to.path}`)
    }
  }
})

export default router
