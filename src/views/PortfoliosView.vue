<script setup lang="ts">
import CommentButton from "@/components/CommentButton.vue";
import PageNavButton from "@/components/PageNavButton.vue";
import { useMediaStore } from "@/stores/media";
import type { characterType } from "@/types/characterType";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { tm } = useI18n();
const mediaStore = useMediaStore();

const characters = computed<characterType[]>(() => tm("characters") as characterType[]);
const selectedIndex = ref(0);

const ANGLE_STEP = 5.5;

const currentCharacter = computed<characterType>(() => characters.value[selectedIndex.value]!);

onMounted(async () => {
  await mediaStore.setBGMAudioAsync("character_bgm", 3);
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

function selectItem(index: number) {
  selectedIndex.value = index;
}

function navigate(direction: 1 | -1) {
  if (direction === 1) {
    if (selectedIndex.value < characters.value.length - 1) {
      selectedIndex.value++;
    }
  } else {
    if (selectedIndex.value > 0) {
      selectedIndex.value--;
    }
  }
}

function handleWheel(event: WheelEvent) {
  navigate(event.deltaY > 0 ? 1 : -1);
}

const touchStartY = ref(0);

function handleTouchStart(event: TouchEvent) {
  touchStartY.value = event.touches[0]!.clientY;
}

function handleTouchEnd(event: TouchEvent) {
  const touchEndY = event.changedTouches[0]!.clientY;
  const deltaY = touchStartY.value - touchEndY;
  if (Math.abs(deltaY) > 50) {
    navigate(deltaY > 0 ? 1 : -1);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    navigate(1);
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    navigate(-1);
  }
}

function getItemStyle(index: number) {
  const diff = index - selectedIndex.value;
  const angle = -diff * ANGLE_STEP;

  return {
    wrapper: {
      transform: `rotate(${angle}deg)`,
      zIndex: characters.value.length - Math.abs(diff),
      opacity: Math.abs(diff) > 15 ? 0 : 1,
      pointerEvents: Math.abs(diff) > 15 ? "none" : "auto",
    } as any,
    inner: {
      transform: `rotate(${-angle}deg)`,
    },
  };
}

async function playHoverSound() {
  await mediaStore.setEffectAudioAsync("音效11");
}
</script>
<template>
  <div class="container">
    <img class="background" src="/common/images/人物档案背景.webp" />
    <PageNavButton class="back-btn" />

    <!-- 左侧扇形角色选择 -->
    <div class="selector-panel" @wheel="handleWheel" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
      <div
        v-for="(item, index) in characters"
        :key="item.id"
        class="list-item"
        :class="{ active: index === selectedIndex }"
        :style="getItemStyle(index).wrapper"
        @pointerenter="playHoverSound"
        @click="selectItem(index)">
        <div class="item-inner" :style="getItemStyle(index).inner">
          <div class="item-bg"></div>
          <span class="item-text">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 中间人物图片 -->
    <div class="image-panel" @wheel="handleWheel">
      <img class="moon" src="/common/images/月亮底纹.webp" />
      <img
        class="character-image"
        :src="`/characters/${currentCharacter.id}.png`"
        :alt="currentCharacter.name"
        loading="lazy" />
      <div class="comment">
        <CommentButton type="like" text="114514" />
        <CommentButton type="dislike" text="114514" />
      </div>
    </div>

    <!-- 右侧人物信息 -->
    <div class="info-panel">
      <div class="info-header">
        <img class="title-icon" src="/common/images/名字图标.webp" alt="icon" />
        <h1 class="character-name">{{ currentCharacter.name }}</h1>
      </div>
      <div class="info-content">
        <h3 class="character-title">{{ $t("character.characterIntroduction") }}</h3>
        <p class="character-introduction">{{ currentCharacter.description }}</p>

        <template v-if="currentCharacter.stories && currentCharacter.stories.length > 0">
          <span class="divider"></span>
          <h3 class="character-title">{{ $t("character.characterStories") }}</h3>
          <div v-for="(story, idx) in currentCharacter.stories" :key="idx" class="character-story">
            <h4 class="story-title">{{ story.title }}</h4>
            <p class="story-content">{{ story.content }}</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
<style scoped>
.container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
.selector-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 30%;
  display: flex;
  align-items: center;
}
.list-item {
  position: absolute;
  left: 20%;
  top: 50%;
  width: 250px;
  height: 60px;
  margin-top: -30px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transform-origin: 1100px 50%;
  transition:
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.4s;
}
.item-inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}
.item-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url("/common/images/单选框.webp") no-repeat center center;
  background-size: contain;
  transition: background-image 0.3s;
}
.list-item:hover .item-bg,
.list-item.active .item-bg {
  background-image: url("/common/images/单选框高亮.webp");
}
.item-text {
  position: relative;
  color: inherit;
  font-size: 25px;
  font-family: inherit;
  z-index: 1;
}
.list-item.active .item-text {
  color: #fff;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}
.image-panel {
  position: absolute;
  left: 28%;
  top: 0;
  bottom: 0;
  width: 40%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.moon {
  position: absolute;
  width: 120%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  z-index: -1;
  top: 50%;
  transform: translateY(-50%);
}
.character-image {
  height: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: bottom center;
}
.comment {
  position: absolute;
  display: flex;
  flex-direction: column;
  bottom: 30px;
  left: 0;
  gap: 20px;
  margin-top: 0;
  z-index: 100;
}
.info-panel {
  position: absolute;
  right: 5%;
  top: 10%;
  height: 80%;
  width: 30%;
  display: flex;
  flex-direction: column;
}
.info-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.title-icon {
  width: 40px;
  height: 40px;
}
.character-name {
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-size: 40px;
  margin: 0;
}
.info-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent);
}
.info-content::-webkit-scrollbar {
  display: none;
}

.character-title {
  font-size: 26px;
  margin: 20px 0 10px 0;
  color: #f0e6d2;
}
.character-introduction {
  font-size: 18px;
  line-height: 1.5;
  color: #f0e6d2;
  white-space: pre-wrap;
}
.divider {
  display: block;
  width: 100%;
  height: 1px;
  background-color: #918375;
  margin: 20px 0;
}
.character-story {
  margin-bottom: 15px;
}
.story-title {
  font-size: 22px;
  margin: 5px 0;
  color: #f0e6d2;
}
.story-content {
  font-size: 18px;
  line-height: 1.5;
  color: #f0e6d2;
  white-space: pre-wrap;
}

/* 移动端适配 */
@media (max-width: 1024px) {
  .list-item {
    width: 150px;
    height: 36px;
    margin-top: -18px;
    transform-origin: 660px 50%;
  }
  .item-text {
    font-size: 15px;
  }
  .character-name {
    font-size: 24px;
  }
  .title-icon {
    width: 24px;
    height: 24px;
  }
  .character-title {
    font-size: 18px;
  }
  .character-introduction,
  .story-content {
    font-size: 14px;
  }
  .story-title {
    font-size: 16px;
  }
}
</style>
