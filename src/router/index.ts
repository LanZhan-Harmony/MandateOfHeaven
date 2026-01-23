import MainMenuView from "@/views/MainMenuView.vue";
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "main",
      component: MainMenuView,
    },
    {
      path: "/chapters",
      name: "chapters",
      component: () => import("../views/ChaptersView.vue"),
    },
    {
      path: "/storylines",
      name: "storylines",
      component: () => import("../views/StorylinesView.vue"),
    },
    {
      path: "/portfolios",
      name: "portfolios",
      component: () => import("../views/PortfoliosView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../views/SettingsView.vue"),
    },
    {
      path: "/announcements",
      name: "announcements",
      component: () => import("../views/AnnouncementsView.vue"),
    },
    {
      path: "/eula",
      name: "eula",
      component: () => import("../views/EULAView.vue"),
    },
    {
      path: "/achievements",
      name: "achievements",
      component: () => import("../views/AchievementsView.vue"),
    },
    {
      path: "/credits",
      name: "credits",
      component: () => import("../views/CreditsView.vue"),
    },
  ],
});

export default router;
