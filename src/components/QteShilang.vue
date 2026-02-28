<!--
  QteShilang.vue - 石狼特殊QTE
  10 个在不同时间点出现的连续滑动QTE，完成至少 6 个算成功。

  时序（ms）：
    #0  64000–66000   #1  70000–72000   #2  73000–75000
    #3  90000–92000   #4  94000–96500   #5  97000–99000
    #6  99500–102000  #7  103000–105000 #8  126000–128000
    #9  132000–135000

  判定时间：elapsedMs ≥ 140360 时统计完成数
-->

<script setup lang="ts">
import { ref, watch } from "vue";
import { useMediaStore } from "../stores/media";
import QteSlider from "./QteSlider.vue";

const props = defineProps<{
  videoId: string;
  elapsedMs: number;
}>();

const emit = defineEmits<{
  (e: "success"): void;
  (e: "failure"): void;
}>();

const mediaStore = useMediaStore();

/** 每个 QTE 的完成状态 */
const completed = ref(Array(10).fill(false));

/** 防止重复统计结果 */
const hasEmitted = ref(false);

/** 各阶段的触发时间窗口与贝塞尔曲线路径 */
const qteConfigs = [
  { startMs: 64000, endMs: 66000, path: [895, 730, 896, 731, 1567, 732, 1567, 732] },
  { startMs: 70000, endMs: 72000, path: [537, 869, 760, 649, 987, 566, 1322, 654] },
  { startMs: 73000, endMs: 75000, path: [477, 866, 477, 866, 1207, 526, 1207, 526] },
  { startMs: 90000, endMs: 92000, path: [914, 661, 914, 661, 1645, 664, 1645, 664] },
  { startMs: 94000, endMs: 96500, path: [451, 896, 390, 615, 567, 269, 949, 224] },
  { startMs: 97000, endMs: 99000, path: [1267, 524, 1538, 615, 1398, 906, 1110, 839] },
  { startMs: 99500, endMs: 102000, path: [1444, 306, 1699, 589, 1431, 999, 1082, 919] },
  { startMs: 103000, endMs: 105000, path: [1136, 852, 1136, 852, 523, 774, 523, 774] },
  { startMs: 126000, endMs: 128000, path: [684, 642, 684, 642, 1351, 641, 1351, 641] },
  { startMs: 132000, endMs: 135000, path: [833, 741, 833, 741, 1413, 407, 1413, 407] },
];

async function handleSlideSuccess(index: number) {
  await mediaStore.setEffectAudioAsync("音效12");
  completed.value = completed.value.map((v, i) => (i === index ? true : v));
}

/** 到达判定时刻后统计结果（提前到 139500ms，预留同步缓冲） */
watch(
  () => props.elapsedMs,
  (ms) => {
    if (ms >= 139500 && !hasEmitted.value) {
      hasEmitted.value = true;
      const doneCount = completed.value.filter(Boolean).length;
      if (doneCount >= 6) {
        emit("success");
      } else {
        emit("failure");
      }
    }
  },
);
</script>

<template>
  <div class="qte-container">
    <template v-for="(config, index) in qteConfigs" :key="index">
      <QteSlider
        v-if="elapsedMs >= config.startMs && elapsedMs < config.endMs && !completed[index]"
        :bezier-path="config.path"
        @slide-success="handleSlideSuccess(index)" />
    </template>
  </div>
</template>

<style scoped>
.qte-container {
  width: 100%;
  height: 100%;
}
</style>
