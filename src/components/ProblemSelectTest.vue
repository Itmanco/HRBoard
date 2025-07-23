<template>
  <div>
    <h2>Problem Select Test</h2>
    <select v-model="selectedPosition">
      <option value="" disabled selected>Select a position (Test)</option>
      <option v-for="pos in testPositions" :key="pos.id" :value="pos.name">
        {{ pos.name }}
      </option>
    </select>
    <p>Selected Test Position: {{ selectedPosition }}</p>
    <button @click="addTestPosition">Add Another Test Position</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedPosition: '',
      testPositions: [
        { id: '1', name: 'Initial Position A' },
        { id: '2', name: 'Initial Position B' },
      ],
      nextId: 3,
    };
  },
  methods: {
    addTestPosition() {
      const newPos = { id: String(this.nextId++), name: `New Test Position ${this.nextId - 1}` };
      this.testPositions.push(newPos);
      console.log('Test positions updated:', this.testPositions);
    }
  },
  mounted() {
    console.log('ProblemSelectTest mounted, initial positions:', this.testPositions);
  },
  watch: {
    testPositions: {
      handler(newVal) {
        console.log('ProblemSelectTest: testPositions updated via watch:', newVal);
      },
      deep: true,
      immediate: true,
    }
  }
};
</script>