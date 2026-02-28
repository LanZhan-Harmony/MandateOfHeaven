<!--
  Ending.vue - 结局画面组件
  
  显示结局视频（webm）、结局描述文字和操作按钮。
  
  功能：
  1. 结局成就激活：根据 endingId 映射到对应的成就名称（如"宣舞帝"、"宣明帝"等）
  2. 千帆过尽成就：当所有帝号结局都已访问时激活
  3. 帮助按钮：部分结局提供攻略提示（先弹出剧透警告，确认后显示攻略）
  4. 入场动画：3.5秒延迟后显示描述和按钮
  5. 背景视频：自动播放、静音、循环的 webm 结局动画
  -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { emperorEndingStoryletIds } from "../assets/data/emperorEndings";
import { helpEndingStoryletIds } from "../assets/data/helpEndings";
import router from "../router";
import { useAchievementStore } from "../stores/achievement";
import { useDialogStore } from "../stores/dialog";
import { useMediaStore } from "../stores/media";
import { useSaveStore } from "../stores/save";
import type { endingType } from "../types/endingType";
import ArrowButton from "./ArrowButton.vue";

const { t, tm } = useI18n();
const achievementStore = useAchievementStore();
const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const dialogStore = useDialogStore();

const props = defineProps<{
  title: string;
  description: string;
  type: "gold" | "silver" | "bronze" | null;
  chapterId: number;
  videoUrl: string;
  endingId: string;
}>();

const endings = computed(() => tm("endings") as endingType[]);

/** 入场内容延迟显示（3.5秒后） */
const showContent = ref(false);

/** 结局ID → 成就名称映射 */
const ENDING_ACHIEVEMENTS: Record<string, string> = {
  a01_a032_a032033034035036_ahe001: "destined_by_heaven",
  a01_a070_a015c_abe006: "courage_to_speak_frankly",
  a02_a052_a038_abe001: "decency",
  a03_a088_a044_abe004: "emperor_wu_of_xuan",
  a04_a015_a014015016_abe005: "fickle_hearts",
  a05_a071_a016a050051052053054: "between_north_and_south",
  a05_a095_a021b_abe001: "emperor_yang_of_xuan",
  a06_a032_a007a_abe001: "emperor_you_of_xuan",
  a06_a033_a007b_abe002: "emperor_zong_of_xuan",
  a06_a083_a055_abe003: "emperor_fei_of_xuan",
  a06_a086_a018a_abe004: "emperor_shang_of_xuan",
  a07_a004_a001a: "emperor_huai_of_xuan",
  a07_a005_a001b: "emperor_ai_of_xuan",
  a07_a010_a002a: "emperor_kang_of_xuan",
  a07_a034_a008bbe005: "emperor_zhuang_of_xuan",
  a07_a016_a030031: "emperor_ming_of_xuan",
  a07_a053_a071072073074: "emperor_jing_of_xuan",
  a07_a054_a075075_a1075_a2075_a3075_a4075_a5075_a6: "emperor_cheng_of_xuan",
  a07_a055_a076077: "emperor_wen_of_xuan",
  a07_a056_a078079080081: "emperor_guang_wu_of_xuan",
  a07_a057_a082_abe_83_abe_84_abe_85: "emperor_zhao_of_xuan",
};

/** 当前结局是否有攻略帮助 */
const hasHelp = computed(() => typeof props.endingId === "string" && helpEndingStoryletIds.includes(props.endingId));

/** 显示攻略帮助对话框（先警告剧透，确认后显示内容） */
const showHelpDialog = async () => {
  const confirmed = await dialogStore.showAlert({
    message: t("dialog.helpSpoilerWarning"),
    cancelText: t("dialog.letMeTryAgain"),
    confirmText: t("dialog.viewGuide"),
    showCancel: true,
  });
  if (confirmed) {
    dialogStore.showAlert({
      message: endings.value.find((e) => e.id === props.endingId)?.help || "",
      confirmText: t("dialog.closeTip"),
    });
  }
};

/** 导航到故事线页面 */
const navigateToStoryline = async () => {
  await mediaStore.setEffectAudioAsync("音效3");
  await router.push("/storylines");
};

// 结局成就触发
watch(
  () => props.endingId,
  () => {
    // 激活当前结局对应的成就
    if (props.endingId) {
      const achievement = ENDING_ACHIEVEMENTS[props.endingId];
      if (achievement) {
        achievementStore.activateAchievement(achievement);
      }
    }

    // 检查"千帆过尽"成就：所有帝号结局是否都已被访问
    const visitedStorylets = saveStore.currentSave?.visited_storylets || [];
    if (emperorEndingStoryletIds.every((id) => visitedStorylets.includes(id))) {
      achievementStore.activateAchievement("when_the_last_sail_vanishes");
    }
  },
  { immediate: true },
);

// 入场：播放音效 + 3.5秒后显示内容
onMounted(async () => {
  await mediaStore.setEffectAudioAsync("BE界面音效");
  setTimeout(() => {
    showContent.value = true;
  }, 3500);
});
</script>

<template>
  <div class="ending vertical">
    <!-- 帮助攻略按钮（部分结局可用） -->
    <button v-if="hasHelp" v-show="showContent" class="help-btn" @click="showHelpDialog">
      {{ $t("storyline.storylineHelp") }}
    </button>

    <!-- 结局视频背景 -->
    <div class="video">
      <video autoplay muted playsinline preload="auto">
        <source :src="videoUrl" type="video/webm" />
      </video>
    </div>

    <!-- 结局描述 -->
    <Transition name="fade" mode="out-in">
      <div v-show="showContent" class="description">
        <p>{{ description }}</p>
      </div>
    </Transition>

    <!-- 底部操作栏 -->
    <Transition name="fade" mode="out-in">
      <ArrowButton
        v-show="showContent"
        class="navigate-btn"
        :text="$t('player.storyline')"
        direction="right"
        @click="navigateToStoryline"
        @pointerenter="mediaStore.setEffectAudioAsync('音效4')" />
    </Transition>
  </div>
</template>

<style scoped>
.ending {
  opacity: 1;
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: cover;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 5%;
  transition: opacity 0.3s;
  position: absolute;
  top: 0;
  left: 0;
}

.ending > * {
  text-align: center;
  justify-content: space-between;
  align-items: center;
}

.help-btn {
  z-index: 2;
  color: #918375;
  cursor: pointer;
  background: #1e17108f;
  border: 2px solid #2e2012c9;
  padding: 9px;
  font-size: 25px;
  font-weight: 400;
  position: absolute;
  top: 5%;
  right: 5%;
  font-family: inherit;
}

.description {
  text-align: left;
  z-index: 0;
  color: #ffe9d0;
  width: 17%;
  font-size: 30px;
  font-weight: 500;
  line-height: 1.7;
  position: absolute;
  left: 10%;
  top: 50%;
  transform: translateY(-50%);
}

.navigate-btn {
  position: absolute;
  right: 10%;
  bottom: 10%;
  scale: 1.3;
  z-index: 2;
}

.video {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.video video {
  width: 100%;
  height: 100%;
}

/* 淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
