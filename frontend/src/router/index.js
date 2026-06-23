import { createRouter, createWebHistory } from 'vue-router'
import MobileLayout from '../layouts/MobileLayout.vue'
import HomeView from '../views/HomeView.vue'
import HealthView from '../views/HealthView.vue'
import RiskPredictView from '../views/RiskPredictView.vue'
import HealthArchiveView from '../views/HealthArchiveView.vue'
import PlanView from '../views/PlanView.vue'
import NewsView from '../views/NewsView.vue'
import UserCenterView from '../views/UserCenterView.vue'
import AssistantView from '../views/AssistantView.vue'
import LoginView from '../views/LoginView.vue'

const routes = [
    {
        path: '/',
        redirect: '/home'
    },
    {
        path: '/login',
        name: 'Login',
        component: LoginView
    },
    {
        path: '/',
        component: MobileLayout,
        children: [
            {
                path: 'home',
                name: 'Home',
                component: HomeView
            },
            {
                path: 'health',
                name: 'Health',
                component: HealthView
            },
            {
                path: 'risk-predict',
                name: 'RiskPredict',
                component: RiskPredictView
            },
            {
                path: 'health-archive',
                name: 'HealthArchive',
                component: HealthArchiveView
            },
            {
                path: 'plan',
                name: 'Plan',
                component: PlanView
            },
            {
                path: 'news',
                name: 'News',
                component: NewsView
            },
            {
                path: 'assistant',
                name: 'Assistant',
                component: AssistantView
            },
            {
                path: 'user',
                name: 'UserCenter',
                component: UserCenterView
            }
        ]
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/home'
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes: routes
})

export default router