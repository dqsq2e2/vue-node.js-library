<template>
  <div class="layout-container">
    <!-- 顶部导航栏 -->
    <div class="layout-header">
      <Navbar />
    </div>
    
    <!-- 主体内容 -->
    <div class="layout-content">
      <!-- 侧边栏 -->
      <div class="layout-sidebar" :class="{ collapsed: !sidebar.opened }">
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
import { computed } from 'vue'
import { useStore } from 'vuex'
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
    
    const sidebar = computed(() => store.state.app.sidebar)
    
    return {
      sidebar
    }
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 1000;
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
  transition: width 0.3s;
}

.layout-sidebar.collapsed {
  width: 64px;
}

.layout-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
}

@media (max-width: 768px) {
  .layout-sidebar {
    width: 64px;
  }
  
  .layout-main {
    padding: 12px;
  }
}
</style>
