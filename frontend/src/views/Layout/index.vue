<template>
  <div class="layout-container">
    <!-- 移动端遮罩层 -->
    <div 
      class="mobile-overlay" 
      v-if="isMobile && sidebar.opened" 
      @click="closeSidebar"
    ></div>
    
    <!-- 顶部导航栏 -->
    <div class="layout-header">
      <Navbar />
    </div>
    
    <!-- 主体内容 -->
    <div class="layout-content">
      <!-- 侧边栏 -->
      <div 
        class="layout-sidebar" 
        :class="{ 
          collapsed: !sidebar.opened,
          'mobile-open': isMobile && sidebar.opened,
          'mobile-closed': isMobile && !sidebar.opened
        }"
      >
        <Sidebar />
      </div>
      
      <!-- 主要内容区域 -->
      <div class="layout-main">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import Navbar from './components/Navbar.vue'
import Sidebar from './components/Sidebar.vue'

export default {
  name: 'Layout',
  components: {
    Navbar,
    Sidebar
  },
  setup() {
    const store = useStore()
    const route = useRoute()
    
    const sidebar = computed(() => store.state.app.sidebar)
    const isMobile = ref(false)
    
    // 检测屏幕尺寸
    const checkMobile = () => {
      isMobile.value = window.innerWidth < 768
      // 移动端默认关闭侧边栏
      if (isMobile.value && sidebar.value.opened) {
        store.dispatch('app/closeSideBar', { withoutAnimation: true })
      }
    }
    
    // 关闭侧边栏
    const closeSidebar = () => {
      store.dispatch('app/closeSideBar', { withoutAnimation: false })
    }
    
    onMounted(() => {
      checkMobile()
      window.addEventListener('resize', checkMobile)
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', checkMobile)
    })
    
    return {
      sidebar,
      isMobile,
      closeSidebar
    }
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 移动端遮罩层 */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

.layout-header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 1000;
  flex-shrink: 0;
}

.layout-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.layout-sidebar {
  width: 200px;
  background: #fff;
  box-shadow: 2px 0 6px rgba(0, 21, 41, 0.08);
  transition: all 0.3s;
  flex-shrink: 0;
}

.layout-sidebar.collapsed {
  width: 64px;
}

.layout-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
  min-width: 0;
}

/* 移动端样式 */
@media (max-width: 768px) {
  .layout-sidebar {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    z-index: 999;
    transform: translateX(-100%);
    width: 200px !important;
  }
  
  .layout-sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .layout-sidebar.mobile-closed {
    transform: translateX(-100%);
  }
  
  .layout-main {
    padding: 12px;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .layout-sidebar {
    top: 52px;
  }
}

/* 小屏幕进一步优化 */
@media (max-width: 480px) {
  .layout-main {
    padding: 8px;
  }
}
</style>
