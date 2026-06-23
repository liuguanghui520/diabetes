<script setup>
import { useRoute } from 'vue-router'
import {
    House,
    DataAnalysis,
    Calendar,
    Reading,
    User
} from '@element-plus/icons-vue'

const route = useRoute()

const tabs = [
    {
        name: '首页',
        path: '/home',
        icon: House
    },
    {
        name: '健康',
        path: '/health',
        icon: DataAnalysis
    },
    {
        name: '方案',
        path: '/plan',
        icon: Calendar
    },
    {
        name: '资讯',
        path: '/news',
        icon: Reading
    },
    {
        name: '我的',
        path: '/user',
        icon: User
    }
]

function isActive(path) {
    return route.path === path
}
</script>

<template>
    <div class="desktop-stage">
        <section class="mobile-shell">
            <main class="mobile-content">
                <RouterView />
            </main>

            <nav class="bottom-nav">
                <RouterLink
                    v-for="tab in tabs"
                    :key="tab.path"
                    :to="tab.path"
                    class="nav-item"
                    :class="{ active: isActive(tab.path) }"
                >
                    <span class="nav-icon">
                        <el-icon>
                            <component :is="tab.icon" />
                        </el-icon>
                    </span>
                    <span class="nav-name">{{ tab.name }}</span>
                </RouterLink>
            </nav>
        </section>
    </div>
</template>

<style scoped>
.desktop-stage {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
}

.mobile-shell {
    width: min(100%, 430px);
    min-height: 100dvh;
    position: relative;
    background: #f4f8ff;
    box-shadow: 0 0 34px rgba(43, 100, 176, 0.16);
}

.mobile-content {
    min-height: 100dvh;
    padding-bottom: 88px;
}

.bottom-nav {
    width: min(100vw, 430px);
    height: 82px;
    position: fixed;
    z-index: 30;
    bottom: 0;
    left: 50%;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(230, 237, 247, 0.85);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -8px 24px rgba(39, 95, 165, 0.06);
    transform: translateX(-50%);
    backdrop-filter: blur(16px);
}

.nav-item {
    min-width: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #91a1bb;
    font-size: 11px;
    font-weight: 700;
    transition: 0.2s ease;
}

.nav-icon {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    font-size: 21px;
    transition: 0.2s ease;
}

.nav-item.active {
    color: #1687ff;
}

.nav-item.active .nav-icon {
    color: #ffffff;
    background: linear-gradient(135deg, #1687ff 0%, #00cf85 100%);
    box-shadow: 0 8px 16px rgba(17, 142, 237, 0.26);
}

.nav-name {
    line-height: 1;
}

@media (max-width: 430px) {
    .mobile-shell {
        box-shadow: none;
    }
}
</style>