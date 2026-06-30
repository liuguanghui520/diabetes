import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/auth/LoginView.vue'
import HealthJourneyView from '../views/journey/HealthJourneyView.vue'
import HealthView from '../views/health/HealthView.vue'
import HealthArchiveView from '../views/health/HealthArchiveView.vue'
import PlanView from '../views/plan/PlanView.vue'
import PlanTaskCreateView from '../views/plan/PlanTaskCreateView.vue'
import NewsView from '../views/news/NewsView.vue'
import AssistantView from '../views/assistant/AssistantView.vue'
import UserCenterView from '../views/profile/UserCenterView.vue'
import PersonalInfoView from '../views/profile/PersonalInfoView.vue'
import DoctorConsultView from '../views/doctor/DoctorConsultView.vue'
import DoctorProfileView from '../views/doctor/DoctorProfileView.vue'
import MessagesView from '../views/messages/MessagesView.vue'
import FavoritesView from '../views/favorites/FavoritesView.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import { getStoredUser, hasAuthSession } from '../api/request'

const publicRouteNames = new Set(['journey', 'login'])

const routes = [
    {
        path: '/',
        redirect: '/home',
    },
    {
        path: '/journey',
        name: 'journey',
        component: HealthJourneyView,
    },
    {
        path: '/health',
        name: 'health',
        component: HealthView,
    },
    {
        path: '/health/archive',
        name: 'healthArchive',
        component: HealthArchiveView,
    },
    {
        path: '/plan',
        name: 'plan',
        component: PlanView,
    },
    {
        path: '/plan/tasks/new',
        name: 'planTaskCreate',
        component: PlanTaskCreateView,
    },
    {
        path: '/news',
        name: 'news',
        component: NewsView,
    },
    {
        path: '/assistant',
        name: 'assistant',
        component: AssistantView,
    },
    {
        path: '/profile',
        name: 'profile',
        component: UserCenterView,
    },
    {
        path: '/profile/info',
        name: 'personalInfo',
        component: PersonalInfoView,
    },
    {
        path: '/messages',
        name: 'messages',
        component: MessagesView,
    },
    {
        path: '/favorites',
        name: 'favorites',
        component: FavoritesView,
    },
    {
        path: '/doctor',
        name: 'doctorConsult',
        component: DoctorConsultView,
    },
    {
        path: '/doctor/:id/profile',
        name: 'doctorProfile',
        component: DoctorProfileView,
    },
    {
        path: '/home',
        name: 'home',
        component: HomeView,
    },
    {
        path: '/login',
        name: 'login',
        component: LoginView,
    },
    {
        path: '/admin',
        redirect: '/admin/dashboard',
    },
    {
        path: '/admin/dashboard',
        name: 'adminDashboard',
        component: AdminDashboardView,
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/journey',
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to) => {
    const hasSession = hasAuthSession()
    const currentUser = getStoredUser()
    const isAdmin = ['admin', 'super_admin'].includes(currentUser?.role)

    if (to.path === '/' && hasSession && isAdmin) {
        return {
            name: 'adminDashboard',
            replace: true,
        }
    }

    if (publicRouteNames.has(to.name)) {
        if (to.name === 'login' && hasSession) {
            return {
                name: isAdmin ? 'adminDashboard' : 'home',
                replace: true,
            }
        }
        return true
    }

    if (hasSession) {
        if (to.name === 'adminDashboard' && !isAdmin) {
            return {
                name: 'home',
                replace: true,
            }
        }
        return true
    }

    return {
        name: 'login',
        query: {
            redirect: to.fullPath,
        },
        replace: true,
    }
})

export default router
