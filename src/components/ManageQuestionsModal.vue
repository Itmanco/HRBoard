<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>設問管理</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>

      <p>現在編集中のセンター: <strong>{{ centerName }}</strong></p>
      <hr />

      <form @submit.prevent="addQuestion" class="question-form">
        <div class="form-group">
          <label for="newQuestionText">質問内容:</label>
          <textarea id="newQuestionText" v-model="newQuestionText" rows="3" required></textarea>
        </div>
        
        <div class="form-group">
          <label>割り当てる役職:</label>
          <div class="position-buttons">
            <span
              v-for="position in availablePositions"
              :key="position.id"
              class="position-button"
              :class="{ 'is-selected': isPositionSelected(position.id) }"
              @click="togglePosition(position.id)"
            >
              {{ position.name }}
            </span>
          </div>
        </div>

        <div class="form-group-inline">
            <input type="checkbox" id="isMandatory" v-model="isMandatory" />
            <label for="isMandatory">必須質問として設定</label>
        </div>

        <p v-if="questionError" class="error-message">{{ questionError }}</p>
        <button type="submit">質問を追加</button>
      </form>
      
      <hr />

      <div class="existing-questions">
        <h4>既存の設問 ({{ availableQuestions.length }})</h4>
        <table>
          <thead>
            <tr>
              <th>質問内容</th>
              <th>割り当てられた役職</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="question in availableQuestions" :key="question.id">
              <td>{{ question.text }}</td>
              <td>
                <span v-for="posId in question.positionIds" :key="posId" class="position-tag">
                  {{ getPositionName(posId) }}
                </span>
              </td>
              <td>
                <button @click="deleteQuestion(question.id)">削除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';

// --- Props & Emits ---
const props = defineProps({
  isVisible: Boolean,
  loggedInUser: Object,
  availablePositions: {
    type: Array,
    default: () => []
  },
  availableQuestions: {
    type: Array,
    default: () => []
  },
});

const emit = defineEmits(['close']);

// --- Pinia Store ---
const centerStore = useCenterStore();
const { selectedCenterId, allCentersMap } = storeToRefs(centerStore);

// --- State ---
const newQuestionText = ref('');
const positionIds = ref([]);
const questionError = ref(null);
const isMandatory = ref(false); // <--- NEW STATE

// --- Computed Properties ---
const centerName = computed(() => {
    if (selectedCenterId.value && allCentersMap.value.has(selectedCenterId.value)) {
        return allCentersMap.value.get(selectedCenterId.value).name;
    }
    return '不明なセンター';
});

// --- Watchers ---
watch(() => props.isVisible, (newVal) => {
    if (newVal) {
        newQuestionText.value = '';
        positionIds.value = [];
        questionError.value = null;
        isMandatory.value = false; // <--- RESET NEW STATE
    }
});


// --- Methods ---
const closeModal = () => {
  emit('close');
};

const getPositionName = (posId) => {
    const position = props.availablePositions.find(p => p.id === posId);
    return position ? position.name : '不明';
};

const isPositionSelected = (positionId) => {
  return positionIds.value.includes(positionId);
};

const togglePosition = (positionId) => {
  if (positionIds.value.includes(positionId)) {
    positionIds.value = positionIds.value.filter(id => id !== positionId);
  } else {
    positionIds.value.push(positionId);
  }
};


const addQuestion = async () => {
    questionError.value = null;
    if (!newQuestionText.value.trim() || positionIds.value.length === 0) {
        questionError.value = "質問内容と割り当てる役職を選択してください。";
        return;
    }

    if (!selectedCenterId.value || selectedCenterId.value === 'all') {
        questionError.value = "質問を追加するには、センターを選択する必要があります。";
        return;
    }

    const newQuestion = {
        text: newQuestionText.value.trim(),
        positionIds: positionIds.value,
        centerId: selectedCenterId.value,
        isMandatory: isMandatory.value, // <--- ADD NEW FIELD
        createdAt: Timestamp.now(),
    };

    try {
        await addDoc(collection(db, "questions"), newQuestion);
        newQuestionText.value = '';
        positionIds.value = [];
        questionError.value = null;
        isMandatory.value = false; // <--- RESET NEW STATE
    } catch (error) {
        console.error("Error adding question:", error);
        questionError.value = "質問の追加に失敗しました。権限が不足している可能性があります。";
    }
};

const deleteQuestion = async (id) => {
    if (confirm("この質問を削除しますか？")) {
        try {
            await deleteDoc(doc(db, "questions", id));
            questionError.value = null;
        } catch (error) {
            console.error("Error deleting question:", error);
            questionError.value = "質問の削除に失敗しました。権限が不足している可能性があります。";
        }
    }
};

</script>

<style scoped>
/* Your styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.modal-header h3 {
  margin: 0;
  color: #333;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #888;
}
p {
  margin: 5px 0;
}
h4 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #333;
}
hr {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid #eee;
}
.question-form, .existing-questions {
    margin-bottom: 20px;
}
.question-form .form-group {
    margin-bottom: 15px;
}
.question-form label {
    font-weight: bold;
    display: block;
    margin-bottom: 5px;
}
.question-form textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
}
.question-form button[type="submit"] {
    background-color: #28a745;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
}
.position-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 5px;
}
.position-button {
    display: inline-block;
    padding: 8px 15px;
    border: 1px solid #ccc;
    border-radius: 5px;
    background-color: #f9f9f9;
    color: #333;
    font-size: 0.9em;
    cursor: pointer;
    transition: background-color 0.3s ease, border-color 0.3s ease;
}
.position-button:hover {
    background-color: #eee;
    border-color: #bbb;
}
.position-button.is-selected {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
}
.position-button.is-selected:hover {
    background-color: #0056b3;
    border-color: #0056b3;
}
.existing-questions table {
    width: 100%;
    border-collapse: collapse;
}
.existing-questions th, .existing-questions td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
}
.existing-questions th {
    background-color: #f2f2f2;
}
.existing-questions tr:nth-child(even) {
    background-color: #f9f9f9;
}
.existing-questions button {
    background-color: #dc3545;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.form-group-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
}
</style>