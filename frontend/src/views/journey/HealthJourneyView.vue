<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentIndex = ref(0)
const dragging = ref(false)
const startX = ref(0)
const dragX = ref(0)

const pages = [
  {
    id: 'profile',
    name: '健康画像',
    title: '先让身体\n被看见',
    description: '不需要马上得到答案。先留下真实的身高、体重、家族史和生活习惯。',
    action: '继续，看看健康档案',
    theme: 'blue',
  },
  {
    id: 'assessment',
    name: '健康档案',
    title: '用完整信息\n看清风险',
    description: '补充腰围和血压后，完成正式风险筛查，避免用不完整资料下结论。',
    action: '继续，看看生活方案',
    theme: 'violet',
  },
  {
    id: 'plan',
    name: '生活方案',
    title: '把建议变成\n今天能做到的事',
    description: '从饮食、运动、睡眠和监测中，选择一件你愿意开始的小事。',
    action: '开始我的健康旅程',
    theme: 'mint',
  },
]

const trackStyle = computed(() => {
  const pageWidth = 100 / pages.length
  const baseOffset = -(currentIndex.value * pageWidth)
  const extraOffset = dragging.value ? dragX.value : 0

  return {
    transform: `translate3d(calc(${baseOffset}% + ${extraOffset}px), 0, 0)`,
    transition: dragging.value
      ? 'none'
      : 'transform 0.55s cubic-bezier(0.22, 0.75, 0.22, 1)',
  }
})

function goTo(index) {
  currentIndex.value = Math.max(0, Math.min(index, pages.length - 1))
  dragX.value = 0
}

function handlePointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  dragging.value = true
  startX.value = event.clientX
  dragX.value = 0

  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function handlePointerMove(event) {
  if (!dragging.value) {
    return
  }

  dragX.value = event.clientX - startX.value
}

function handlePointerEnd() {
  if (!dragging.value) {
    return
  }

  const threshold = 58

  if (dragX.value <= -threshold && currentIndex.value < pages.length - 1) {
    currentIndex.value += 1
  }

  if (dragX.value >= threshold && currentIndex.value > 0) {
    currentIndex.value -= 1
  }

  dragging.value = false
  dragX.value = 0
}

function handleAction(index) {
  if (index < pages.length - 1) {
    goTo(index + 1)
    return
  }

  localStorage.setItem('hasSeenHealthJourney', 'true')
  router.push('/login')
}
</script>

<template>
  <main class="journey-page">
    <section class="journey-phone">
      <section
        class="journey-viewport"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
      >
        <div class="journey-track" :style="trackStyle">
          <article
            v-for="(page, index) in pages"
            :key="page.id"
            class="journey-screen"
            :class="[
              `screen-${page.id}`,
              `theme-${page.theme}`,
              { 'screen-long-title': page.id === 'plan' },
            ]"
          >
            <header class="screen-copy">
              <p class="screen-step">第 {{ index + 1 }} 步</p>
              <h1>{{ page.title }}</h1>
            </header>

            <section class="route-stage">
              <div class="route-orbit orbit-large"></div>
              <div class="route-orbit orbit-small"></div>

              <svg
                class="journey-route"
                viewBox="0 0 390 390"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  class="route-shadow"
                  pathLength="100"
                  d="M32 286C69 213 99 210 132 231C170 256 165 142 202 129C237 117 241 211 276 231C309 250 332 236 360 164"
                  stroke="currentColor"
                  stroke-width="17"
                  stroke-linecap="round"
                />

                <path
                  class="route-base"
                  pathLength="100"
                  d="M32 286C69 213 99 210 132 231C170 256 165 142 202 129C237 117 241 211 276 231C309 250 332 236 360 164"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />

                <path
                  class="route-active"
                  pathLength="100"
                  d="M32 286C69 213 99 210 132 231C170 256 165 142 202 129C237 117 241 211 276 231C309 250 332 236 360 164"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                />

                <path
                  class="route-dash"
                  d="M58 334C148 366 257 362 332 323"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-dasharray="5 9"
                />
              </svg>

              <button
                class="route-node node-profile"
                :class="{ current: index === 0 }"
                type="button"
                @pointerdown.stop
                @click.stop="goTo(0)"
              >
                <small>01</small>
                <strong>画像</strong>
              </button>

              <button
                class="route-node node-assessment"
                :class="{ current: index === 1 }"
                type="button"
                @pointerdown.stop
                @click.stop="goTo(1)"
              >
                <small>02</small>
                <strong>评估</strong>
              </button>

              <button
                class="route-node node-plan"
                :class="{ current: index === 2 }"
                type="button"
                @pointerdown.stop
                @click.stop="goTo(2)"
              >
                <small>03</small>
                <strong>方案</strong>
              </button>

              <div class="focus-orb">
                <span class="orb-ring ring-one"></span>
                <span class="orb-ring ring-two"></span>
                <span class="orb-light"></span>

                <div class="orb-core">
                  <small>当前节点</small>
                  <strong>{{ page.name }}</strong>
                </div>
              </div>
            </section>

            <footer class="screen-footer">
              <div class="swipe-tip">
                <span></span>
                <p>左右滑动，继续健康旅程</p>
                <span></span>
              </div>

              <div class="step-indicator">
                <button
                  v-for="(_, pointIndex) in pages"
                  :key="pointIndex"
                  type="button"
                  :class="{ active: pointIndex === index }"
                  @pointerdown.stop
                  @click.stop="goTo(pointIndex)"
                ></button>
              </div>

              <p class="screen-description">
                {{ page.description }}
              </p>

              <button
                class="journey-action"
                :class="{ primary: index === pages.length - 1 }"
                type="button"
                @pointerdown.stop
                @click.stop="handleAction(index)"
              >
                <span>{{ page.action }}</span>
                <i>→</i>
              </button>
            </footer>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.journey-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.72), transparent 26%),
    radial-gradient(circle at 82% 84%, rgba(201, 220, 255, 0.82), transparent 29%),
    linear-gradient(135deg, #dce8f8 0%, #c7daf4 100%);
}

.journey-phone {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 76% 12%, rgba(230, 238, 255, 0.78), transparent 18%),
    linear-gradient(180deg, #fcfdff 0%, #f7faff 100%);
  box-shadow: 0 0 52px rgba(43, 73, 132, 0.16);
}

.journey-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: pan-y;
}

.journey-track {
  display: flex;
  width: 300%;
  height: 100%;
  min-height: 0;
}

.journey-screen {
  position: relative;
  display: grid;
  width: calc(100% / 3);
  height: 100%;
  min-height: 0;
  flex: 0 0 calc(100% / 3);
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  padding: clamp(36px, 7vh, 58px) 28px 22px;
}

.theme-blue {
  --accent: #0b2efe;
  --accent-rgb: 11, 46, 254;
  --accent-shadow: rgba(11, 46, 254, 0.18);
}

.theme-violet {
  --accent: #724af6;
  --accent-rgb: 114, 74, 246;
  --accent-shadow: rgba(114, 74, 246, 0.18);
}

.theme-mint {
  --accent: #139d88;
  --accent-rgb: 19, 157, 136;
  --accent-shadow: rgba(19, 157, 136, 0.17);
}

.screen-copy {
  position: relative;
  z-index: 4;
}

.screen-step {
  margin: 0;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.1px;
}

.screen-copy h1 {
  margin: 12px 0 0;
  color: #101936;
  font-size: clamp(40px, 10.8vw, 54px);
  line-height: 1.07;
  letter-spacing: 0;
  white-space: pre-line;
}

.screen-long-title .screen-copy h1 {
  font-size: clamp(34px, 9.3vw, 42px);
  line-height: 1.13;
  letter-spacing: 0;
}

.route-stage {
  position: relative;
  min-height: 0;
  margin-top: 16px;
  overflow: visible;
}

.route-stage::before {
  position: absolute;
  top: 7%;
  right: -29px;
  left: -17px;
  height: 83%;
  border: 1px solid rgba(101, 133, 197, 0.16);
  border-radius: 50%;
  background:
    radial-gradient(
      ellipse at 50% 50%,
      rgba(255, 255, 255, 0.92) 0%,
      rgba(242, 247, 255, 0.55) 48%,
      rgba(233, 240, 255, 0.16) 73%,
      transparent 74%
    );
  content: "";
  transform: scaleX(1.08);
}

.route-stage::after {
  position: absolute;
  top: 22%;
  left: 50%;
  width: min(74vw, 280px);
  height: min(74vw, 280px);
  border: 1px solid rgba(92, 124, 191, 0.1);
  border-radius: 50%;
  content: "";
  transform: translateX(-50%);
}

.route-orbit {
  position: absolute;
  z-index: 1;
  border: 1px solid rgba(var(--accent-rgb), 0.13);
  border-radius: 50%;
}

.orbit-large {
  top: 18%;
  left: 0;
  width: min(62vw, 237px);
  height: min(62vw, 237px);
}

.orbit-small {
  right: -29px;
  bottom: 0;
  width: min(44vw, 164px);
  height: min(44vw, 164px);
  border-style: dashed;
}

.journey-route {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  color: var(--accent);
}

.route-shadow {
  opacity: 0.12;
}

.route-base {
  opacity: 0.28;
}

.route-active {
  stroke-dasharray: 33 100;
  opacity: 1;
  transition: stroke-dasharray 0.45s ease;
}

.route-dash {
  opacity: 0.38;
}

.screen-assessment .route-active {
  stroke-dasharray: 65 100;
}

.screen-plan .route-active {
  stroke-dasharray: 100 100;
}

.route-node {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  color: #8f9ab0;
  background: transparent;
  cursor: pointer;
  transition:
    color 0.25s ease,
    transform 0.25s ease,
    opacity 0.2s ease;
}

.route-node small {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid currentcolor;
  border-radius: 50%;
  font-size: 8px;
  font-weight: 800;
}

.route-node strong {
  font-size: 11px;
  white-space: nowrap;
}

.route-node.current {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.node-profile {
  top: 68%;
  left: -1px;
}

.node-assessment {
  top: 20%;
  left: calc(50% - 26px);
}

.node-plan {
  top: 31%;
  right: 7px;
}

.focus-orb {
  position: absolute;
  z-index: 8;
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  transform: translate(-50%, -50%);
}

.screen-profile .focus-orb {
  top: 70%;
  left: 18%;
}

.screen-assessment .focus-orb {
  top: 23%;
  left: 52%;
}

.screen-plan .focus-orb {
  top: 34%;
  left: 79%;
}

.orb-ring {
  position: absolute;
  border: 1px solid rgba(var(--accent-rgb), 0.37);
  border-radius: 50%;
}

.ring-one {
  inset: -13px;
}

.ring-two {
  inset: -29px;
  border-style: dashed;
  opacity: 0.7;
  animation: ring-rotate 18s linear infinite;
}

.orb-light {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: 18px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.1);
}

.orb-core {
  position: relative;
  z-index: 3;
  display: flex;
  width: 86px;
  height: 86px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
  color: #ffffff;
  background:
    radial-gradient(circle at 32% 25%, rgba(255, 255, 255, 0.58), transparent 14%),
    var(--accent);
  box-shadow:
    0 15px 26px var(--accent-shadow),
    inset 0 0 18px rgba(255, 255, 255, 0.19);
}

.orb-core small {
  color: rgba(255, 255, 255, 0.73);
  font-size: 8px;
  line-height: 1;
}

.orb-core strong {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.screen-footer {
  position: relative;
  z-index: 4;
}

.swipe-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca8ba;
}

.swipe-tip span {
  display: block;
  width: 100%;
  border-top: 1px solid #dce4f1;
}

.swipe-tip p {
  flex: 0 0 auto;
  margin: 0;
  font-size: 9px;
}

.step-indicator {
  display: flex;
  gap: 7px;
  margin-top: 13px;
}

.step-indicator button {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d8dfeb;
  cursor: pointer;
  transition:
    width 0.24s ease,
    background 0.24s ease;
}

.step-indicator button.active {
  width: 25px;
  border-radius: 99px;
  background: var(--accent);
}

.screen-description {
  width: 88%;
  margin: 13px 0 0;
  color: #76849b;
  font-size: 11px;
  line-height: 1.65;
}

.journey-action {
  display: inline-flex;
  align-items: center;
  gap: 13px;
  margin-top: 13px;
  border-bottom: 2px solid var(--accent);
  padding: 0 0 6px;
  color: #17203c;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.journey-action i {
  color: var(--accent);
  font-size: 16px;
  font-style: normal;
}

.journey-action.primary {
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 10px 12px 10px 15px;
  color: #ffffff;
  background: var(--accent);
  box-shadow: 0 12px 20px var(--accent-shadow);
}

.journey-action.primary i {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  color: var(--accent);
  background: #ffffff;
  font-size: 13px;
}

.route-node:active,
.step-indicator button:active,
.journey-action:active {
  transform: scale(0.95);
}

@keyframes ring-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-height: 760px) {
  .journey-screen {
    padding-top: 28px;
    padding-bottom: 15px;
  }

  .screen-copy h1 {
    margin-top: 9px;
    font-size: clamp(36px, 10vw, 45px);
  }

  .screen-long-title .screen-copy h1 {
    font-size: clamp(31px, 8.9vw, 39px);
  }

  .focus-orb,
  .orb-core {
    width: 74px;
    height: 74px;
  }

  .ring-one {
    inset: -10px;
  }

  .ring-two {
    inset: -22px;
  }

  .orb-light {
    top: 14px;
    left: 15px;
  }

  .orb-core small {
    font-size: 7px;
  }

  .orb-core strong {
    font-size: 11px;
  }

  .screen-description {
    margin-top: 10px;
    font-size: 10px;
    line-height: 1.52;
  }

  .step-indicator {
    margin-top: 10px;
  }

  .journey-action {
    margin-top: 10px;
  }
}

@media (max-width: 430px) {
  .journey-phone {
    box-shadow: none;
  }
}

@media (max-width: 360px) {
  .journey-screen {
    padding-right: 20px;
    padding-left: 20px;
  }

  .screen-copy h1 {
    font-size: 40px;
  }

  .screen-long-title .screen-copy h1 {
    font-size: 35px;
  }

  .screen-plan .focus-orb {
    left: 76%;
  }
}
</style>
