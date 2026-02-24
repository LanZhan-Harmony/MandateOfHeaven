<script setup lang="ts">
import ImageButton from "../components/ImageButton.vue";
import router from "../router";
import { useMediaStore } from "../stores/media";

const mediaStore = useMediaStore();

const creators = [
  { role: "导演", names: ["帝皇今"] },
  { role: "出品人", names: ["赵枳程", "黄金笛", "丁盛豪"] },
  { role: "工作室", names: ["木焱工作室"] },
];

const companies = [
  "欢瑞世纪(北京)信息科技有限公司",
  "FLEXVISION PTE.LTD.",
  "上海木焱网络科技有限公司",
  "上海柚衣科技有限公司",
];

const cast = [
  { role: "司空耀", name: "孙睿" },
  { role: "谢若兰", name: "潘铭允" },
  { role: "陈婉儿", name: "刘昕念" },
  { role: "祖月", name: "杨宁" },
  { role: "刘念", name: "向薇静" },
  { role: "司空景", name: "闫艺泷" },
  { role: "司空正", name: "欧阳卫熹" },
  { role: "司空盛", name: "鲁昊" },
  { role: "司空旭", name: "鲍李宁" },
  { role: "司空钰", name: "杨晓婷" },
  { role: "皇后李氏", name: "许诺" },
  { role: "祖坤", name: "高文炯" },
  { role: "谢玄", name: "柯博伦" },
  { role: "朱元之", name: "李龙" },
  { role: "陈应", name: "苏翊" },
  { role: "陈导", name: "丛林一" },
  { role: "曹表之", name: "付思液" },
  { role: "石狼", name: "尤景达" },
  { role: "柳才人", name: "李纯洱" },
  { role: "楚桓", name: "杜梵" },
  { role: "慕容崔", name: "齐美仁真" },
];

async function handleBack() {
  await mediaStore.setEffectAudioAsync("音效7");
  router.back();
}
</script>
<template>
  <div class="container">
    <div class="nav">
      <h1>{{ $t("bottomBar.credits") }}</h1>
      <div class="separator"></div>
      <ImageButton
        default-icon="/common/images/关闭.webp"
        highlight-icon="/common/images/关闭高亮.webp"
        :side-length="40"
        :mobile-side-length="24"
        @click="handleBack" />
    </div>
    <div class="content">
      <div class="scroll-container">
        <div class="scroll-content">
          <section class="section">
            <h2>主创</h2>
            <div v-for="(item, index) in creators" :key="'creator-' + index" class="credit-item">
              <span class="role">{{ item.role }}</span>
              <span class="names">{{ item.names.join(" / ") }}</span>
            </div>
          </section>

          <section class="section">
            <h2>出品单位</h2>
            <div v-for="(company, index) in companies" :key="'company-' + index" class="company-item">
              {{ company }}
            </div>
          </section>

          <section class="section">
            <h2>演员表</h2>
            <div class="cast-grid">
              <div v-for="(actor, index) in cast" :key="'actor-' + index" class="cast-item">
                <span class="role">{{ actor.role }}</span>
                <span class="connector">.....</span>
                <span class="name">{{ actor.name }}</span>
              </div>
            </div>
          </section>

          <section class="section developer">
            <h2>网页端及移动端制作</h2>
            <div class="credit-item">
              <span class="names">LanZhan-Harmony</span>
            </div>
            <a
              href="https://github.com/LanZhan-Harmony/MandateOfHeaven"
              target="_blank"
              class="project-link"
              title="查看开源项目">
              <span>查看开源项目</span>
            </a>
          </section>
        </div>
        <!-- Duplicate content for seamless scrolling -->
        <div class="scroll-content" aria-hidden="true">
          <section class="section">
            <h2>主创</h2>
            <div v-for="(item, index) in creators" :key="'creator-dup-' + index" class="credit-item">
              <span class="role">{{ item.role }}</span>
              <span class="names">{{ item.names.join(" / ") }}</span>
            </div>
          </section>

          <section class="section">
            <h2>出品单位</h2>
            <div v-for="(company, index) in companies" :key="'company-dup-' + index" class="company-item">
              {{ company }}
            </div>
          </section>

          <section class="section">
            <h2>演员表</h2>
            <div class="cast-grid">
              <div v-for="(actor, index) in cast" :key="'actor-dup-' + index" class="cast-item">
                <span class="role">{{ actor.role }}</span>
                <span class="connector">.....</span>
                <span class="name">{{ actor.name }}</span>
              </div>
            </div>
          </section>

          <section class="section developer">
            <h2>网页端及移动端制作</h2>
            <div class="credit-item">
              <span class="names">LanZhan-Harmony</span>
            </div>
            <a href="https://github.com/LanZhan-Harmony/MandateOfHeaven" target="_blank" class="project-link">
              <span>查看开源项目</span>
            </a>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.container {
  position: absolute;
  background-image: url(/common/images/关于.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: 100%;
  height: 100%;
  padding: 3% 6%;
  display: flex;
  flex-direction: column;
}
.nav {
  width: 100%;
  margin-bottom: 24px;
  position: relative;
  display: flex;
  align-items: center;
}
.separator {
  flex-grow: 1;
}

.content {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
}

.scroll-container {
  /* Starts the animation */
  animation: scroll 40s linear infinite;
}

@keyframes scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-50%);
  }
}

.scroll-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 150px; /* Space between original and duplicate */
  padding-top: 100px; /* Space at the top for better visual */
}

.section {
  margin-bottom: 40px;
  width: 100%;
  max-width: 600px;
  text-align: center;
}

h2 {
  font-size: 35px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 10px;
  color: #ffe9d0;
  font-weight: bold;
}

.credit-item {
  display: flex;
  justify-content: center;
  align-items: baseline;
  margin-bottom: 10px;
  font-size: 25px;
  gap: 15px;
}

.credit-item .role {
  color: #ccc;
}

.credit-item .names {
  text-align: left;
}

.company-item {
  margin-bottom: 8px;
  font-size: 25px;
}

.cast-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cast-item {
  display: flex;
  justify-content: space-between;
  width: 300px;
  margin-bottom: 8px;
  font-size: 25px;
}

.cast-item .role {
  text-align: right;
  width: 100px;
  color: #ccc;
}

.cast-item .connector {
  flex-grow: 1;
  text-align: center;
  opacity: 0.3;
  margin: 0 10px;
}

.cast-item .name {
  text-align: left;
  width: 100px;
}

.project-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #ccc;
  text-decoration: none;
  font-size: 25px;
  margin-top: 10px;
  transition: opacity 0.2s;
}

.project-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.github-icon {
  width: 24px;
  height: 24px;
  filter: invert(1); /* 假设图标是黑色的，反转为白色以适应深色背景 */
}

@media (max-height: 500px) {
  h1 {
    font-size: 24px;
  }
  h2 {
    font-size: 24px;
  }
  .credit-item {
    font-size: 18px;
  }
  .company-item {
    font-size: 18px;
  }
  .cast-item {
    font-size: 18px;
  }
  .project-link {
    font-size: 18px;
  }
}
</style>
