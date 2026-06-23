<script setup>
import { useRoute } from 'vue-router'
import {
    House,
    Calendar,
    Reading,
    User,
    ChatDotRound
} from '@element-plus/icons-vue'

const route = useRoute()

const tabs = [
    {
        name: '首页',
        path: '/home',
        icon: House
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
        name: 'AI助手',
        path: '/assistant',
        icon: ChatDotRound
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
                <RouterView v-slot="{ Component }">
                    <Transition name="fade-slide" mode="out-in">
                        <component :is="Component" />
                    </Transition>
                </RouterView>
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
    padding: 0 0;
}

.mobile-shell {
    width: min(100%, 430px);
    min-height: 100dvh;
    position: relative;
    overflow: hidden;
    background: var(--page-bg);
    box-shadow: 0 0 36px rgba(36, 74, 113, 0.16);
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
    padding: 7px 8px calc(7px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(222, 234, 245, 0.9);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -10px 24px rgba(36, 74, 113, 0.08);
    transform: translateX(-50%);
    backdrop-filter: blur(16px);
}

.nav-item {
    min-width: 58px;
    min-height: 62px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: 16px;
    color: var(--ink-500);
    font-size: 11px;
    font-weight: 800;
    transition: 0.2s ease;
}

.nav-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 20px;
    transition: 0.2s ease;
}

.nav-item.active {
    color: var(--primary-blue);
    background: #eef6ff;
}

.nav-item.active .nav-icon {
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 8px 14px rgba(33, 103, 243, 0.22);
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
