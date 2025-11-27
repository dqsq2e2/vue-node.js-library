<template>
  <div class="error-page">
    <div class="error-content">
      <div class="error-image">
        <img src="/404.svg" alt="404" />
      </div>
      <div class="error-text">
        <h1>404</h1>
        <h2>页面不存在</h2>
        <p>抱歉，您访问的页面不存在或已被删除</p>
        <div class="error-actions">
          <el-button type="primary" @click="goHome">
            <el-icon><House /></el-icon>
            返回首页
          </el-button>
          <el-button @click="goBack">
            <el-icon><Back /></el-icon>
            返回上页
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'Error404',
  setup() {
    const router = useRouter()
    
    const goHome = () => {
      router.push('/')
    }
    
    const goBack = () => {
      router.go(-1)
    }
    
    return {
      goHome,
      goBack
    }
  }
}
</script>

<style scoped>
.error-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.error-content {
  display: flex;
  align-items: center;
  gap: 60px;
  max-width: 800px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.error-image {
  flex-shrink: 0;
}

.error-image img {
  width: 300px;
  height: auto;
}

.error-text {
  text-align: center;
}

.error-text h1 {
  font-size: 120px;
  font-weight: 700;
  color: #409eff;
  margin: 0;
  line-height: 1;
}

.error-text h2 {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  margin: 20px 0 16px 0;
}

.error-text p {
  font-size: 16px;
  color: #606266;
  margin: 0 0 40px 0;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

@media (max-width: 768px) {
  .error-content {
    flex-direction: column;
    gap: 30px;
    padding: 30px 20px;
    text-align: center;
  }
  
  .error-image img {
    width: 200px;
  }
  
  .error-text h1 {
    font-size: 80px;
  }
  
  .error-text h2 {
    font-size: 24px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
