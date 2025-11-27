<template>
  <div v-if="!item.hidden">
    <!-- 单个菜单项 -->
    <template v-if="hasOneShowingChild(item.children, item) && (!onlyOneChild.children || onlyOneChild.noShowingChildren) && !item.alwaysShow">
      <el-menu-item
        :index="resolvePath(onlyOneChild.path)"
        :class="{ 'submenu-title-noDropdown': !isNest }"
      >
        <el-icon v-if="onlyOneChild.meta && onlyOneChild.meta.icon">
          <component :is="onlyOneChild.meta.icon" />
        </el-icon>
        <template #title>
          <span>{{ onlyOneChild.meta?.title }}</span>
        </template>
      </el-menu-item>
    </template>
    
    <!-- 子菜单 -->
    <el-sub-menu v-else :index="resolvePath(item.path)" popper-append-to-body>
      <template #title>
        <el-icon v-if="item.meta && item.meta.icon">
          <component :is="item.meta.icon" />
        </el-icon>
        <span>{{ item.meta?.title }}</span>
      </template>
      
      <sidebar-item
        v-for="child in item.children"
        :key="child.path"
        :is-nest="true"
        :item="child"
        :base-path="resolvePath(child.path)"
        class="nest-menu"
      />
    </el-sub-menu>
  </div>
</template>

<script>
import { ref } from 'vue'
import path from 'path-browserify'

export default {
  name: 'SidebarItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    isNest: {
      type: Boolean,
      default: false
    },
    basePath: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const onlyOneChild = ref(null)
    
    const hasOneShowingChild = (children = [], parent) => {
      const showingChildren = children.filter(item => {
        if (item.hidden) {
          return false
        } else {
          // 临时设置（如果只有一个显示的子项，则将使用）
          onlyOneChild.value = item
          return true
        }
      })
      
      // 当只有一个子路由器时，默认情况下会显示子路由器
      if (showingChildren.length === 1) {
        return true
      }
      
      // 如果没有子路由器要显示，则显示父路由器
      if (showingChildren.length === 0) {
        onlyOneChild.value = { ...parent, path: '', noShowingChildren: true }
        return true
      }
      
      return false
    }
    
    const resolvePath = (routePath) => {
      if (isExternal(routePath)) {
        return routePath
      }
      if (isExternal(props.basePath)) {
        return props.basePath
      }
      return path.resolve(props.basePath, routePath)
    }
    
    const isExternal = (path) => {
      return /^(https?:|mailto:|tel:)/.test(path)
    }
    
    return {
      onlyOneChild,
      hasOneShowingChild,
      resolvePath
    }
  }
}
</script>

<style scoped>
.nest-menu .el-menu-item {
  min-height: 40px !important;
  height: 40px !important;
  line-height: 40px !important;
}

.submenu-title-noDropdown {
  padding-left: 20px !important;
}
</style>
