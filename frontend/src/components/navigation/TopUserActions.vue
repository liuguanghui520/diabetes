<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { apiGet, hasAuthSession } from '../../api/request'

const props = defineProps({
  light: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const unreadCount = ref(0)

async function refreshUnreadCount() {
  if (!hasAuthSession()) {
    unreadCount.value = 0
    return
  }

  try {
    const response = await apiGet('/api/messages')
    const list = response.data?.list || response.data?.items || []

    unreadCount.value = list.filter((item) => !item.read).length
  } catch {
    unreadCount.value = 0
  }
}

function handleAuthChanged() {
  refreshUnreadCount()
}

function handleMessagesUpdated(event) {
  const count = Number(event.detail?.unread)

  unreadCount.value = Number.isFinite(count)
    ? Math.max(count, 0)
    : 0
}

function openMessages() {
  router.push({
    name: 'messages',
  })
}

function openProfile() {
  router.push({
    name: 'profile',
  })
}

onMounted(() => {
  window.addEventListener('diabetes:auth-changed', handleAuthChanged)
  window.addEventListener('diafit:messages-updated', handleMessagesUpdated)

  refreshUnreadCount()
})

onBeforeUnmount(() => {
  window.removeEventListener('diabetes:auth-changed', handleAuthChanged)
  window.removeEventListener('diafit:messages-updated', handleMessagesUpdated)
})
</script>

<template>
  <div class="top-user-actions" :class="{ light: props.light }">
    <button
      class="top-message"
      type="button"
      aria-label="查看消息"
      @click="openMessages"
    >
      <BellOutlined />
      <i v-if="unreadCount"></i>
    </button>

    <button
      class="top-profile"
      type="button"
      aria-label="进入个人中心"
      @click="openProfile"
    >
      <UserOutlined />
    </button>
  </div>
</template>

<style scoped>
.top-user-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.top-user-actions button {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.top-message,
.top-profile {
  color: #31557d;
  background: transparent;
  font-size: 21px;
}

.top-message i {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border: 1px solid #ffffff;
  border-radius: 50%;
  background: #ff3b30;
}

.light .top-message,
.light .top-profile {
  color: #ffffff;
}

.light .top-message i {
  border-color: #1685ff;
}

.top-user-actions button:active {
  background: #eaf2fc;
  transform: scale(0.94);
}

.light .top-user-actions button:active {
  background: rgba(255, 255, 255, 0.16);
}
</style>