<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BellOutlined } from '@ant-design/icons-vue'
import { apiGet, getStoredUser, hasAuthSession } from '../../api/request'

const props = defineProps({
  light: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const user = ref(getStoredUser())
const unreadCount = ref(0)

const displayName = computed(() => user.value?.nickname || user.value?.username || '我')
const avatarText = computed(() => displayName.value.slice(0, 1) || '我')

async function refreshUnreadCount() {
  if (!hasAuthSession()) {
    unreadCount.value = 0
    return
  }

  try {
    const response = await apiGet('/api/messages')
    const list = response.data?.list || []
    unreadCount.value = list.filter((item) => !item.read).length
  } catch {
    unreadCount.value = 0
  }
}

function handleAuthChanged(event) {
  user.value = event.detail?.user ?? getStoredUser()
  refreshUnreadCount()
}

function handleMessagesUpdated(event) {
  const count = Number(event.detail?.unread)
  unreadCount.value = Number.isFinite(count) ? Math.max(count, 0) : 0
}

function openMessages() {
  router.push({ name: 'messages' })
}

function openProfile() {
  router.push({ name: 'profile' })
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
    <button class="top-message" type="button" aria-label="查看消息" @click="openMessages">
      <BellOutlined />
      <i v-if="unreadCount"></i>
    </button>

    <button class="top-profile" type="button" aria-label="进入个人中心" @click="openProfile">
      <span>{{ avatarText }}</span>
      我的
    </button>
  </div>
</template>

<style scoped>
.top-user-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.top-user-actions button {
  position: relative;
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.top-message {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(22, 119, 255, 0.18);
  border-radius: 12px;
  color: #18253d;
  background: rgba(241, 246, 255, 0.92);
  font-size: 16px;
}

.top-message i {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border: 1px solid #ffffff;
  border-radius: 50%;
  background: #ff3b30;
}

.top-profile {
  height: 34px;
  min-width: 50px;
  border: 1px solid rgba(22, 119, 255, 0.18);
  border-radius: 12px;
  padding: 0 12px;
  color: #1677ff;
  background: rgba(241, 246, 255, 0.92);
  font-size: 12px;
  font-weight: 900;
}

.top-profile span {
  display: none;
}

.light .top-message {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.14);
}

.light .top-message i {
  border-color: #1685ff;
}

.light .top-profile {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.56);
  background: rgba(255, 255, 255, 0.16);
}

.top-user-actions button:active {
  transform: scale(0.96);
}
</style>
