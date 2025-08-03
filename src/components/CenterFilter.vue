<template>
  <div v-if="centerStore.showCenterFilter" class="center-filter-group">
    <label for="center-select">センターでフィルタ:</label>
    <select id="center-select" :value="centerStore.selectedCenterId" @change="centerStore.setSelectedCenterId($event.target.value)">
      <option value="all" v-if="isSuperAdmin">全てのセンター</option>
      <option v-for="center in centerStore.userAccessibleCenters" :key="center.id" :value="center.id">
        {{ center.name }}
      </option>
    </select>
  </div>
</template>

<script>
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';

export default {
  name: 'CenterFilter',
  props: {
    isSuperAdmin: Boolean, // Pass this prop from App.vue
  },
  setup() {
    const centerStore = useCenterStore();
    return {
      centerStore
    };
  },
  // The Pinia store handles the reactivity and state, so no data or watch handlers are needed here.
};
</script>

<style scoped>
.center-filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
}
.center-filter-group label {
    font-weight: bold;
    color: white; /* Match the header text color */
}
.center-filter-group select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    cursor: pointer;
    font-size: 1em;
}
</style>