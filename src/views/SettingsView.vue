<script setup lang="ts">
import { storeToRefs } from "pinia";
import PageNavButton from "../components/PageNavButton.vue";
import VolumeSlider from "../components/VolumeSlider.vue";
import { useMediaStore } from "../stores/media";
import { useUIStore } from "../stores/ui";

const mediaStore = useMediaStore();
const { mainVolume, playerVolume, bgmVolume, effectVolume } = storeToRefs(mediaStore);

const uiStore = useUIStore();
const { locale } = storeToRefs(uiStore);
</script>

<template>
  <div class="container">
    <img class="background" src="/common/images/设置背景.webp" />
    <PageNavButton />

    <div class="settings">
      <table>
        <tbody>
          <!-- 主音量 -->
          <tr>
            <td>
              <label class="volume-label">{{ $t("setting.mainVolume") }}</label>
            </td>
            <td>
              <VolumeSlider v-model="mainVolume" />
            </td>
          </tr>

          <!-- 视频音量 -->
          <tr>
            <td>
              <label class="volume-label">{{ $t("setting.videoVolume") }}</label>
            </td>
            <td>
              <VolumeSlider v-model="playerVolume" />
            </td>
          </tr>

          <!-- 背景音乐音量 -->
          <tr>
            <td>
              <label class="volume-label">{{ $t("setting.bgmVolume") }}</label>
            </td>
            <td>
              <VolumeSlider v-model="bgmVolume" />
            </td>
          </tr>

          <!-- 音效音量 -->
          <tr>
            <td>
              <label class="volume-label">{{ $t("setting.effectsVolume") }}</label>
            </td>
            <td>
              <VolumeSlider v-model="effectVolume" />
            </td>
          </tr>

          <!-- 界面语言 -->
          <tr>
            <td>
              <label class="locale">{{ $t("setting.language") }}</label>
            </td>
            <td>
              <select v-model="locale">
                <option value="zh-CN">简体中文</option>
                <option value="zh-HK">繁體中文</option>
                <option value="en-US">English</option>
                <option value="ja-JP">日本語</option>
                <option value="ko-KR">한국어</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<style scoped>
.background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
.settings {
  width: 60%;
  margin: 5% auto 0;
}
table {
  width: 100%;
  border-collapse: separate;
}
td:first-child {
  width: 25%;
  font-size: 30px;
  white-space: nowrap;
}
td:last-child {
  width: 75%;
}
select {
  display: block;
  width: 99%;
  margin: 0 auto;
  padding: 6px 20px 6px 12px;
  background-color: rgba(20, 20, 20, 0.8);
  border: 1px solid var(--color-text);
  border-radius: 8px;
  color: #d1c4b9;
  font-size: 20px;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23918375' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  transition: all 0.2s;
}
select:focus {
  outline: none;
  border-color: #ffc98e;
}
select option {
  background-color: #2a221b;
  color: #d1c4b9;
}

@media (max-width: 1024px) {
  .settings {
    width: 90%;
    margin: 6% auto 0;
  }
  td:first-child {
    font-size: 20px;
  }
  select {
    font-size: 16px;
    padding: 4px 18px 4px 12px;
  }
}
</style>
