<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>設問管理</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>

      <p>現在編集中のセンター: <strong>{{ centerName }}</strong></p>
      <hr />

      <!-- Add a ref to the form for scrolling -->
      <form @submit.prevent="saveQuestion" class="question-form" ref="editForm">
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
        <div class="form-actions">
          <button type="submit">{{ isEditing ? '更新' : '質問を追加' }}</button>
          <button v-if="isEditing" type="button" @click="cancelEdit">キャンセル</button>
        </div>
      </form>
      
      <hr />

      <div class="existing-questions">
        <h4>既存の設問 ({{ filteredQuestions.length }})</h4>
        
        <!-- Combined Filter & Search Controls -->
        <div class="filter-controls">
          <div>
            <label for="positionFilter">役職で絞り込み:</label>
            <select v-model="selectedPositionId" id="positionFilter">
              <option value="all">すべての役職</option>
              <option 
                v-for="position in availablePositions" 
                :key="position.id" 
                :value="position.id">
                {{ position.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="questionSearch">質問を検索:</label>
            <input type="text" v-model="searchText" id="questionSearch" placeholder="質問テキストを入力..." />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>質問内容</th>
              <th>割り当てられた役職</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="question in filteredQuestions" :key="question.id">
              <td>
                <!-- In-place editing functionality -->
                <span v-if="inPlaceEditingQuestionId !== question.id" @dblclick="startInPlaceEdit(question)">
                  {{ question.text }}
                </span>
                <textarea 
                  v-else
                  v-model="inPlaceEditText"
                  @blur="saveInPlaceEdit(question.id)"
                  @keydown.enter.prevent="saveInPlaceEdit(question.id)"
                  rows="3"
                  class="in-place-edit-input"
                ></textarea>
              </td>
              <td>
                <span v-for="posId in question.positionIds" :key="posId" class="position-tag">
                  {{ getPositionName(posId) }}
                </span>
              </td>
              <td>
                <button 
                  v-if="inPlaceEditingQuestionId === question.id"
                  @click="saveInPlaceEdit(question.id)">保存</button>
                <button 
                  v-if="inPlaceEditingQuestionId === question.id"
                  @click="cancelInPlaceEdit()">キャンセル</button>
                <button 
                  v-if="inPlaceEditingQuestionId !== question.id"
                  @click="editQuestion(question)">編集</button>
                <button 
                  v-if="inPlaceEditingQuestionId !== question.id"
                  @click="deleteQuestion(question.id)">削除</button>
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
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, where, Timestamp, setDoc } from 'firebase/firestore';
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
const isMandatory = ref(false);
const selectedPositionId = ref('all');
const searchText = ref('');
const isEditing = ref(false); // Tracks if the form is in 'edit' mode
const editingQuestionId = ref(null); // Stores the ID of the question being edited

// New state for in-place editing
const inPlaceEditingQuestionId = ref(null);
const inPlaceEditText = ref('');

// Ref for the form element to allow programmatic scrolling
const editForm = ref(null);


// --- Computed Properties ---
const centerName = computed(() => {
    if (selectedCenterId.value && allCentersMap.value.has(selectedCenterId.value)) {
        return allCentersMap.value.get(selectedCenterId.value).name;
    }
    return '不明なセンター';
});

const filteredQuestions = computed(() => {
  let questions = props.availableQuestions;

  // Filter by position
  if (selectedPositionId.value !== 'all') {
    questions = questions.filter(question =>
      question.positionIds.includes(selectedPositionId.value)
    );
  }

  // Filter by search text (case-insensitive)
  if (searchText.value.trim() !== '') {
    const searchLower = searchText.value.trim().toLowerCase();
    questions = questions.filter(question =>
      question.text.toLowerCase().includes(searchLower)
    );
  }

  return questions;
});

// --- Watchers ---
watch(() => props.isVisible, (newVal) => {
    if (newVal) {
        newQuestionText.value = '';
        positionIds.value = [];
        questionError.value = null;
        isMandatory.value = false;
        selectedPositionId.value = 'all';
        searchText.value = '';
        isEditing.value = false; // Reset editing state on modal open
        editingQuestionId.value = null;
        inPlaceEditingQuestionId.value = null;
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

const saveQuestion = async () => {
  questionError.value = null;
  if (!newQuestionText.value.trim() || positionIds.value.length === 0) {
      questionError.value = "質問内容と割り当てる役職を選択してください。";
      return;
  }

  if (!selectedCenterId.value || selectedCenterId.value === 'all') {
      questionError.value = "質問を追加するには、センターを選択する必要があります。";
      return;
  }

  const questionData = {
      text: newQuestionText.value.trim(),
      positionIds: positionIds.value,
      centerId: selectedCenterId.value,
      isMandatory: isMandatory.value,
  };

  try {
    if (isEditing.value) {
      // Update existing question
      await setDoc(doc(db, "questions", editingQuestionId.value), questionData, { merge: true });
      questionError.value = "質問が更新されました！";
    } else {
      // Add new question
      questionData.createdAt = Timestamp.now();
      await addDoc(collection(db, "questions"), questionData);
      questionError.value = "質問が追加されました！";
    }
    
    // Clear the form after saving
    newQuestionText.value = '';
    positionIds.value = [];
    isMandatory.value = false;
    isEditing.value = false;
    editingQuestionId.value = null;
    
  } catch (error) {
    console.error("Error saving question:", error);
    questionError.value = "質問の保存に失敗しました。権限が不足している可能性があります。";
  }
};

const editQuestion = (question) => {
  isEditing.value = true;
  editingQuestionId.value = question.id;
  newQuestionText.value = question.text;
  positionIds.value = [...question.positionIds]; // Use spread to create a new array
  isMandatory.value = question.isMandatory || false;
  
  // New: Scroll the form into view
  if (editForm.value) {
    editForm.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const cancelEdit = () => {
  isEditing.value = false;
  editingQuestionId.value = null;
  newQuestionText.value = '';
  positionIds.value = [];
  isMandatory.value = false;
  questionError.value = null;
};

const startInPlaceEdit = (question) => {
  inPlaceEditingQuestionId.value = question.id;
  inPlaceEditText.value = question.text;
};

const saveInPlaceEdit = async (questionId) => {
  if (inPlaceEditText.value.trim() === '') {
    // If the text is empty, maybe just cancel the edit
    cancelInPlaceEdit();
    return;
  }
  try {
    const questionDocRef = doc(db, "questions", questionId);
    await setDoc(questionDocRef, { text: inPlaceEditText.value.trim() }, { merge: true });
    inPlaceEditingQuestionId.value = null;
    questionError.value = null;
  } catch (error) {
    console.error("Error updating question text:", error);
    questionError.value = "質問テキストの更新に失敗しました。";
  }
};

const cancelInPlaceEdit = () => {
  inPlaceEditingQuestionId.value = null;
  inPlaceEditText.value = '';
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
.in-place-edit-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  font-size: 0.9em;
  padding: 5px;
  border: 1px solid #007bff;
  border-radius: 4px;
}
.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions button[type="submit"] {
    background-color: #28a745;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
}
.form-actions button[type="button"] {
    background-color: #6c757d;
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
    background-color: #6c757d;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 5px;
}

.existing-questions button:nth-of-type(2) {
    background-color: #dc3545;
}

.filter-controls {
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}

.filter-controls > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-controls label {
  font-weight: bold;
  white-space: nowrap;
}

.filter-controls select, .filter-controls input {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  min-width: 150px;
}
</style>
