<script setup>
import { ref } from 'vue'
import {
  CalendarOutlined,
  BookOutlined,
  RobotOutlined,
  SolutionOutlined,
  HomeOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { Icon, addCollection } from '@iconify/vue'
import lineMdIcons from '@iconify-json/line-md/icons.json'

addCollection(lineMdIcons)

const props = defineProps({
  activeKey: {
    type: String,
    default: 'home',
  },
})

const emit = defineEmits(['change'])

const motionKey = ref(0)

const tabs = [
  {
    key: 'home',
    label: '首页',
    icon: HomeOutlined,
    animatedIcon: 'line-md:home-twotone-alt',
  },
  {
    key: 'plan',
    label: '方案定制',
    icon: SolutionOutlined,
    animatedIcon: 'line-md:calendar',
  },
  {
    key: 'news',
    label: '健康资讯',
    icon: BookOutlined,
    animatedIcon: 'line-md:document-list',
  },
  {
    key: 'assistant',
    label: 'AI助手',
    icon: RobotOutlined,
    animatedIcon: 'line-md:chat-round-dots',
  },
  {
    key: 'profile',
    label: '我的',
    icon: UserOutlined,
    animatedIcon: 'line-md:account',
  },
]

function selectTab(key) {
  motionKey.value += 1
  emit('change', key)
}
</script>

<template>
  <nav class="app-tabbar" aria-label="主导航">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: activeKey === tab.key }"
      type="button"
      :aria-current="activeKey === tab.key ? 'page' : undefined"
      @click="selectTab(tab.key)"
    >
      <span class="tab-icon">
        <Icon
          v-if="activeKey === tab.key"
          :key="`${tab.key}-${motionKey}`"
          :icon="tab.animatedIcon"
          class="line-md-icon"
        />

        <component
          v-else
          :is="tab.icon"
          class="static-icon"
        />
      </span>

      <small>{{ tab.label }}</small>
    </button>
  </nav>
</template>

<style scoped>
.app-tabbar {
  position: relative;
  z-index: 50;
  display: grid;
  height: calc(62px + env(safe-area-inset-bottom));
  flex: 0 0 calc(62px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid #edf0f4;
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -6px 18px rgba(30, 64, 120, 0.04);
}

.tab-item {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  border: 0;
  padding: 6px 0 5px;
  color: #7e90a8;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.18s ease;
}

.tab-item:active {
  background: #f7faff;
}

.tab-icon {
  display: grid;
  width: 30px;
  height: 27px;
  place-items: center;
  font-size: 24px;
}

.tab-icon :deep(svg) {
  display: block;
  width: 25px;
  height: 25px;
  color: currentColor;
}

.line-md-icon {
  overflow: visible;
}

.static-icon {
  color: currentColor;
}

.tab-item small {
  overflow: hidden;
  max-width: 100%;
  color: inherit;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    color 0.18s ease,
    font-weight 0.18s ease;
}

.tab-item.active {
  color: #1677ff;
}

.tab-item.active small {
  font-weight: 800;
}

@media (max-width: 360px) {
  .app-tabbar {
    height: calc(58px + env(safe-area-inset-bottom));
    flex-basis: calc(58px + env(safe-area-inset-bottom));
  }

  .tab-icon {
    font-size: 22px;
  }

  .tab-icon :deep(svg) {
    width: 23px;
    height: 23px;
  }

  .tab-item small {
    font-size: 9px;
  }
}
</style>
