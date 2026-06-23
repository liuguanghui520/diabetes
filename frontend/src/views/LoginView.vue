<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()

const account = ref('')
const password = ref('')

function login() {
    if (!account.value.trim() || !password.value.trim()) {
        ElMessage.warning('请输入账号和密码')
        return
    }

    ElMessage.success('登录成功')
    router.push('/home')
}

function guestVisit() {
    router.push('/home')
}
</script>

<template>
    <div class="login-stage">
        <section class="login-phone">
            <div class="login-content">
                <div class="brand-icon">+</div>

                <h1>糖尿病预治智能助手</h1>
                <p class="brand-desc">关注健康，从每一次科学记录开始</p>

                <div class="login-form">
                    <label>
                        <span>账号</span>
                        <div class="input-wrap">
                            <el-icon>
                                <User />
                            </el-icon>
                            <input
                                v-model="account"
                                type="text"
                                placeholder="请输入手机号或账号"
                            >
                        </div>
                    </label>

                    <label>
                        <span>密码</span>
                        <div class="input-wrap">
                            <el-icon>
                                <Lock />
                            </el-icon>
                            <input
                                v-model="password"
                                type="password"
                                placeholder="请输入密码"
                            >
                        </div>
                    </label>

                    <button class="login-button" @click="login">登录</button>

                    <div class="login-actions">
                        <button @click="guestVisit">游客浏览</button>
                        <button @click="guestVisit">注册账号</button>
                    </div>
                </div>

                <p class="privacy-text">
                    登录即表示您已阅读并同意隐私政策与健康数据使用说明
                </p>
            </div>
        </section>
    </div>
</template>

<style scoped>
.login-stage {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
}

.login-phone {
    width: min(100%, 430px);
    min-height: 100dvh;
    position: relative;
    display: flex;
    align-items: center;
    overflow: hidden;
    padding: 28px;
    background:
        radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.75), transparent 24%),
        linear-gradient(155deg, #e5f4ff 0%, #f8fcff 48%, #e8fff4 100%);
    box-shadow: 0 0 34px rgba(43, 100, 176, 0.16);
}

.login-phone::before,
.login-phone::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    filter: blur(3px);
}

.login-phone::before {
    width: 210px;
    height: 210px;
    top: -105px;
    right: -75px;
    background: rgba(22, 135, 255, 0.18);
}

.login-phone::after {
    width: 200px;
    height: 200px;
    bottom: -108px;
    left: -90px;
    background: rgba(0, 207, 133, 0.16);
}

.login-content {
    width: 100%;
    position: relative;
    z-index: 1;
    text-align: center;
}

.brand-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 21px;
    border-radius: 24px;
    color: #ffffff;
    font-size: 44px;
    font-weight: 300;
    background: var(--main-gradient);
    box-shadow: 0 16px 25px rgba(19, 150, 218, 0.22);
}

.login-content h1 {
    margin: 0;
    color: #1c3862;
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -0.7px;
}

.brand-desc {
    margin: 13px 0 34px;
    color: #7c90af;
    font-size: 14px;
}

.login-form {
    padding: 25px 20px 21px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 26px;
    text-align: left;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 18px 40px rgba(47, 104, 180, 0.13);
    backdrop-filter: blur(12px);
}

.login-form label {
    display: block;
    margin-bottom: 18px;
}

.login-form label > span {
    display: block;
    margin-bottom: 9px;
    color: #526b91;
    font-size: 13px;
    font-weight: 700;
}

.input-wrap {
    height: 50px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 15px;
    border-radius: 15px;
    color: #1687ff;
    background: #f2f7fd;
}

.input-wrap .el-icon {
    font-size: 18px;
}

.input-wrap input {
    width: 100%;
    border: 0;
    outline: 3px solid transparent;
    color: #304b72;
    font-size: 14px;
    background: transparent;
}

.input-wrap input::placeholder {
    color: #aab8ca;
}

.login-button {
    width: 100%;
    height: 50px;
    margin-top: 2px;
    border-radius: 15px;
    color: #ffffff;
    font-size: 16px;
    font-weight: 800;
    background: var(--main-gradient);
    box-shadow: 0 10px 18px rgba(16, 145, 222, 0.22);
}

.login-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 17px;
}

.login-actions button {
    padding: 0;
    color: #1687ff;
    font-size: 13px;
    background: transparent;
}

.privacy-text {
    margin: 21px auto 0;
    color: #9aa9be;
    font-size: 11px;
    line-height: 1.65;
}

@media (max-width: 430px) {
    .login-phone {
        box-shadow: none;
    }
}
</style>
