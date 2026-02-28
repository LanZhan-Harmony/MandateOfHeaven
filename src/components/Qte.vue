<!--
  Qte.vue - QTE 调度组件
  根据 videoId 硬编码匹配对应的具体 QTE 子组件及其参数，
  并将子组件的 success / failure / slideSuccess 事件统一向上转发为
  click (循环视频QTE) 或 selectOption(index) (分支QTE)。

  每个视频的 QTE 类型和参数都是预设的：
    - QteClick:      点击指定位置
    - QteHoldCharge: 长按蓄力
    - QteSlider:     沿贝塞尔曲线滑动
    - QteTimedClick: 限时点击
    - QteShilang:    石狼特殊QTE（10 连滑动）
-->
<script setup lang="ts">
import { ref } from "vue";
import QteClick from "./QteClick.vue";
import QteHoldCharge from "./QteHoldCharge.vue";
import QteShilang from "./QteShilang.vue";
import QteSlider from "./QteSlider.vue";
import QteTimedClick from "./QteTimedClick.vue";

const props = defineProps<{
  videoId: string;
  elapsedMs: number;
  disabled?: boolean;
}>();

const emit = defineEmits(["click", "selectOption"]);

/** 防止重复触发（一次QTE只处理一次结果） */
const hasHandled = ref(false);

/** 循环视频QTE完成（如点击、滑动成功后直接推进） */
const handleClick = () => {
  if (hasHandled.value || props.disabled) return;
  hasHandled.value = true;
  emit("click");
};

/** 分支QTE选项选择（成功/失败对应不同选项索引） */
const handleSelectOption = (optionIndex: number) => {
  if (hasHandled.value || props.disabled) return;
  hasHandled.value = true;
  emit("selectOption", optionIndex);
};
</script>

<template>
  <div class="qte-container">
    <!-- 01_077_QTE2LOOP: 点击类 (循环) -->
    <QteClick v-if="videoId === '01_077_QTE2LOOP'" :video-id="videoId" :x="888" :y="832" @success="handleClick" />

    <!-- 02_034_QTE1LOOP: 滑动类 (循环) -->
    <QteSlider
      v-if="videoId === '02_034_QTE1LOOP'"
      :bezier-path="[1380, 201, 1817, 234, 1860, 824, 1524, 968]"
      @slide-success="handleClick" />

    <!-- 02_036_QTE2: 左右双滑动 (分支) -->
    <div v-if="videoId === '02_036_QTE2'" class="qte-left-right">
      <QteSlider
        class="qte-left"
        :bezier-path="[1800, 600, 1800, 600, 220, 599, 200, 600]"
        @slide-success="handleSelectOption(0)" />
      <QteSlider
        class="qte-right"
        :bezier-path="[200, 600, 220, 600, 1780, 601, 1800, 600]"
        @slide-success="handleSelectOption(2)" />
    </div>

    <!-- 02_041_027QTE3: 滑动类 (分支) -->
    <QteSlider
      v-if="videoId === '02_041_027QTE3'"
      :bezier-path="[903, 886, 1143, 886, 1358, 801, 1533, 243]"
      @slide-success="handleSelectOption(0)" />

    <!-- 02_044_030QTE4: 限时点击 (分支) -->
    <QteTimedClick
      v-if="videoId === '02_044_030QTE4'"
      :video-id="videoId"
      :elapsed-ms="elapsedMs"
      :duration="3120"
      :accept-range="2000"
      :x="910"
      :y="861"
      @success="handleSelectOption(0)"
      @failure="handleSelectOption(1)" />

    <!-- 02_047_QTE5: 长按蓄力 (分支) -->
    <QteHoldCharge
      v-if="videoId === '02_047_QTE5'"
      :video-id="videoId"
      :hold-required="1000"
      :x="1000"
      :y="700"
      @success="handleSelectOption(0)" />

    <!-- 03_002_QTE1LOOP: 点击类 (循环) -->
    <QteClick v-if="videoId === '03_002_QTE1LOOP'" :video-id="videoId" :x="565" :y="747" @success="handleClick" />

    <!-- 03_024_QTE2: 限时点击 (分支) -->
    <QteTimedClick
      v-if="videoId === '03_024_QTE2'"
      :video-id="videoId"
      :elapsed-ms="elapsedMs"
      :duration="3520"
      :accept-range="1000"
      :x="1070"
      :y="468"
      @success="handleSelectOption(0)"
      @failure="handleSelectOption(1)" />

    <!-- 03_090_QTE3LOOP: 点击类 (循环) -->
    <QteClick v-if="videoId === '03_090_QTE3LOOP'" :video-id="videoId" :x="1176" :y="617" @success="handleClick" />

    <!-- 04_025_005B032033034035: 石狼舞剑 (分支) -->
    <QteShilang
      v-if="videoId === '04_025_005B032033034035'"
      :video-id="videoId"
      :elapsed-ms="elapsedMs"
      @success="handleSelectOption(0)"
      @failure="handleSelectOption(1)" />

    <!-- 04_027_QTE1: 限时点击 (分支) -->
    <QteTimedClick
      v-if="videoId === '04_027_QTE1'"
      :video-id="videoId"
      :elapsed-ms="elapsedMs"
      :duration="2000"
      :accept-range="1000"
      :x="705"
      :y="500"
      @success="handleSelectOption(0)"
      @failure="handleSelectOption(1)" />

    <!-- 04_030_QTE2: 限时点击 (分支) -->
    <QteTimedClick
      v-if="videoId === '04_030_QTE2'"
      :video-id="videoId"
      :elapsed-ms="elapsedMs"
      :duration="3040"
      :accept-range="1000"
      :x="757"
      :y="521"
      @success="handleSelectOption(0)"
      @failure="handleSelectOption(1)" />

    <!-- 04_033_QTE3: 长按蓄力 (分支) -->
    <QteHoldCharge
      v-if="videoId === '04_033_QTE3'"
      :video-id="videoId"
      :hold-required="1000"
      :x="1275"
      :y="570"
      @success="handleSelectOption(0)" />

    <!-- 04_039_QTE5LOOP: 长按蓄力 (循环) -->
    <QteHoldCharge
      v-if="videoId === '04_039_QTE5LOOP'"
      :video-id="videoId"
      :hold-required="1000"
      :x="750"
      :y="800"
      @success="handleClick" />

    <!-- 04_041_QTE3: 长按蓄力 (分支) -->
    <QteHoldCharge
      v-if="videoId === '04_041_QTE3'"
      :video-id="videoId"
      :hold-required="1000"
      :x="1107"
      :y="838"
      @success="handleSelectOption(0)" />

    <!-- 05_014_QTE5LOOP: 长按蓄力 (循环) -->
    <QteHoldCharge
      v-if="videoId === '05_014_QTE5LOOP'"
      :video-id="videoId"
      :hold-required="2000"
      :x="1050"
      :y="735"
      @success="handleClick" />

    <!-- 05_054_QTE2: 点击类 (分支) -->
    <QteClick
      v-if="videoId === '05_054_QTE2'"
      :video-id="videoId"
      :x="1152"
      :y="659"
      @success="handleSelectOption(0)" />

    <!-- 07_017_QTE1LOOP: 长按蓄力 (循环) -->
    <QteHoldCharge
      v-if="videoId === '07_017_QTE1LOOP'"
      :video-id="videoId"
      :hold-required="1000"
      :x="974"
      :y="730"
      @success="handleClick" />

    <!-- 07_037_QTE2LOOP: 长按蓄力 (循环) -->
    <QteHoldCharge
      v-if="videoId === '07_037_QTE2LOOP'"
      :video-id="videoId"
      :hold-required="1000"
      :x="552"
      :y="660"
      @success="handleClick" />

    <!-- 07_070_QTE3LOOP: 点击类 (循环) -->
    <QteClick v-if="videoId === '07_070_QTE3LOOP'" :video-id="videoId" :x="960" :y="960" @success="handleClick" />
  </div>
</template>

<style scoped>
.qte-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

/* 左右双滑动布局 */
.qte-left-right {
  flex-direction: row;
  width: 100%;
  height: 50%;
  display: flex;
  position: absolute;
  top: 50%;
  left: 0;
}

.qte-left,
.qte-right {
  width: 50%;
  height: 100%;
  position: relative;
}
</style>
