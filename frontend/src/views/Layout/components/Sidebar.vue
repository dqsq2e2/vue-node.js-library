<template>
  <div class="sidebar">
    <!-- Logo区域 -->
    <div class="sidebar-logo" :class="{ collapsed: !sidebar.opened }">
      <img src="https://cdn-icons-png.flaticon.com/512/2232/2232688.png" alt="Logo" class="logo-img" v-if="sidebar.opened" />
      <img src="https://cdn-icons-png.flaticon.com/512/2232/2232688.png" alt="Logo" class="logo-img-mini" v-else />
      <span class="logo-text" v-if="sidebar.opened">图书管理系统</span>
    </div>
    
    <!-- 菜单区域 -->
    <el-menu
      :default-active="activeMenu"
      :collapse="!sidebar.opened"
      :unique-opened="true"
      :collapse-transition="false"
      mode="vertical"
      class="sidebar-menu"
      router
    >
      <sidebar-item
        v-for="route in routes"
        :key="route.path"
        :item="route"
        :base-path="route.path"
      />
    </el-menu>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import SidebarItem from './SidebarItem.vue'

export default {
  name: 'Sidebar',
  components: {
    SidebarItem
  },
  setup() {
    const store = useStore()
    const route = useRoute()
    
    // 计算属性
    const sidebar = computed(() => store.state.app.sidebar)
    const routes = computed(() => {
      // 获取用户角色
      const userInfo = store.getters.userInfo
      const userRole = userInfo?.role || 'reader'
      
      // 基础菜单
      const baseRoutes = []
      
      // 根据角色添加菜单
      if (userRole === 'admin' || userRole === 'librarian') {
        // 管理员和图书管理员可以看到仪表盘
        baseRoutes.push({
          path: '/',
          meta: { title: '仪表盘', icon: 'House' },
          children: [{
            path: 'dashboard',
            name: 'Dashboard',
            meta: { title: '仪表盘', icon: 'House' }
          }]
        })
        // 管理员和图书管理员可以看到所有菜单
        baseRoutes.push(
          {
            path: '/books',
            meta: { title: '图书管理', icon: 'Reading' },
            children: [{
              path: 'index',
              name: 'Books',
              meta: { title: '图书管理', icon: 'Reading' }
            }]
          },
          {
            path: '/categories',
            meta: { title: '分类管理', icon: 'Menu' },
            children: [{
              path: 'index',
              name: 'Categories',
              meta: { title: '分类管理', icon: 'Menu' }
            }]
          },
          {
            path: '/users',
            meta: { 
              title: userRole === 'librarian' ? '读者管理' : '用户管理', 
              icon: 'User' 
            },
            children: [{
              path: 'unified',
              name: 'UnifiedUsers',
              meta: { 
                title: userRole === 'librarian' ? '读者管理' : '用户管理', 
                icon: 'User' 
              }
            }]
          },
          {
            path: '/borrow',
            meta: { title: '借阅管理', icon: 'Document' },
            children: [{
              path: 'index',
              name: 'Borrow',
              meta: { title: '借阅管理', icon: 'Document' }
            }]
          }
        )
        
        // 只有管理员可以看到数据库管理
        if (userRole === 'admin') {
          baseRoutes.push(
            {
              path: '/database',
              meta: { title: '数据库管理', icon: 'DataBoard' },
              children: [{
                path: 'management',
                name: 'DatabaseManagement',
                meta: { title: '数据库管理', icon: 'DataBoard' }
              }]
            }
          )
        }
      } else if (userRole === 'reader') {
        // 普通读者可以看到图书浏览和我的借阅
        baseRoutes.push(
          {
            path: '/books-browse',
            meta: { title: '图书浏览', icon: 'Reading' },
            children: [{
              path: 'index',
              name: 'BooksBrowse',
              meta: { title: '图书浏览', icon: 'Reading' }
            }]
          },
          {
            path: '/borrow',
            meta: { title: '我的借阅', icon: 'Document' },
            children: [{
              path: 'index',
              name: 'Borrow',
              meta: { title: '我的借阅', icon: 'Document' }
            }]
          }
        )
      }
      
      return baseRoutes
    })
    
    const activeMenu = computed(() => {
      const { meta, path } = route
      if (meta.activeMenu) {
        return meta.activeMenu
      }
      return path
    })
    
    // 默认路由（如果没有权限路由）
    const getDefaultRoutes = () => {
      return [
        {
          path: '/',
          meta: { title: '仪表盘', icon: 'House' },
          children: [
            {
              path: 'dashboard',
              name: 'Dashboard',
              meta: { title: '仪表盘', icon: 'House' }
            }
          ]
        }
        // 其他菜单项将在对应页面创建后添加
      ]
    }
    
    return {
      sidebar,
      routes,
      activeMenu
    }
  }
}
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  transition: all 0.3s;
}

.sidebar-logo.collapsed {
  padding: 0 12px;
}

.logo-img {
  height: 32px;
  width: auto;
  margin-right: 12px;
}

.logo-img-mini {
  height: 32px;
  width: 32px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #409eff;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  border: none;
  overflow-y: auto;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 滚动条样式 */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>
