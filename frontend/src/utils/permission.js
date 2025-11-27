import store from '@/store'

/**
 * 角色权限配置
 */
const rolePermissions = {
  admin: {
    // 管理员拥有所有权限
    pages: ['dashboard', 'books', 'readers', 'borrow', 'users', 'reports', 'system'],
    actions: ['create', 'read', 'update', 'delete', 'export', 'import']
  },
  librarian: {
    // 图书管理员权限
    pages: ['dashboard', 'books', 'readers', 'borrow', 'reports'],
    actions: ['create', 'read', 'update', 'delete']
  },
  reader: {
    // 读者权限（仅查看）
    pages: ['dashboard'],
    actions: ['read']
  }
}

/**
 * 检查用户是否有访问页面的权限
 * @param {string} page - 页面名称
 * @returns {boolean}
 */
export function hasPagePermission(page) {
  const userInfo = store.getters.userInfo
  if (!userInfo || !userInfo.role) {
    return false
  }
  
  const permissions = rolePermissions[userInfo.role]
  if (!permissions) {
    return false
  }
  
  return permissions.pages.includes(page)
}

/**
 * 检查用户是否有执行操作的权限
 * @param {string} action - 操作名称
 * @returns {boolean}
 */
export function hasActionPermission(action) {
  const userInfo = store.getters.userInfo
  if (!userInfo || !userInfo.role) {
    return false
  }
  
  const permissions = rolePermissions[userInfo.role]
  if (!permissions) {
    return false
  }
  
  return permissions.actions.includes(action)
}

/**
 * 检查用户角色
 * @param {string|Array} roles - 角色名称或角色数组
 * @returns {boolean}
 */
export function hasRole(roles) {
  const userInfo = store.getters.userInfo
  if (!userInfo || !userInfo.role) {
    return false
  }
  
  if (Array.isArray(roles)) {
    return roles.includes(userInfo.role)
  }
  
  return userInfo.role === roles
}

/**
 * 获取用户可访问的菜单
 * @returns {Array}
 */
export function getAccessibleMenus() {
  const userInfo = store.getters.userInfo
  if (!userInfo || !userInfo.role) {
    return []
  }
  
  const permissions = rolePermissions[userInfo.role]
  if (!permissions) {
    return []
  }
  
  const allMenus = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      title: '仪表盘',
      icon: 'House',
      permission: 'dashboard'
    },
    {
      path: '/books',
      name: 'Books',
      title: '图书管理',
      icon: 'Reading',
      permission: 'books'
    },
    {
      path: '/readers',
      name: 'Readers',
      title: '读者管理',
      icon: 'User',
      permission: 'readers'
    },
    {
      path: '/borrow',
      name: 'Borrow',
      title: '借阅管理',
      icon: 'Document',
      permission: 'borrow'
    },
    {
      path: '/reports',
      name: 'Reports',
      title: '统计报表',
      icon: 'DataAnalysis',
      permission: 'reports'
    },
    {
      path: '/users',
      name: 'Users',
      title: '用户管理',
      icon: 'UserFilled',
      permission: 'users'
    },
    {
      path: '/system',
      name: 'System',
      title: '系统管理',
      icon: 'Setting',
      permission: 'system'
    }
  ]
  
  return allMenus.filter(menu => permissions.pages.includes(menu.permission))
}

/**
 * 权限指令
 */
export const permissionDirective = {
  mounted(el, binding) {
    const { value } = binding
    
    if (value) {
      let hasPermission = false
      
      if (typeof value === 'string') {
        // 检查页面权限
        hasPermission = hasPagePermission(value)
      } else if (typeof value === 'object') {
        const { page, action, role } = value
        
        if (role) {
          hasPermission = hasRole(role)
        } else if (page) {
          hasPermission = hasPagePermission(page)
        } else if (action) {
          hasPermission = hasActionPermission(action)
        }
      }
      
      if (!hasPermission) {
        el.parentNode && el.parentNode.removeChild(el)
      }
    }
  }
}

export default {
  hasPagePermission,
  hasActionPermission,
  hasRole,
  getAccessibleMenus,
  permissionDirective
}
