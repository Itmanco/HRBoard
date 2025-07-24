<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2 class="text-center text-blue-600 mb-6">面接の質問を管理</h2>

      <!-- Add New Question Button -->
      <div class="flex justify-end mb-4">
        <button
          @click="openAddEditQuestionModal(null, 'add')"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300"
        >
          新しい質問を追加
        </button>
      </div>

      <!-- Questions List Table -->
      <div v-if="questions.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Question</th>
              <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Linked Positions</th>
              <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="question in questions" :key="question.id" class="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
              <td class="py-3 px-4 text-sm text-gray-700">{{ question.text }}</td>
              <td class="py-3 px-4 text-sm text-gray-700">
                <span v-if="question.positionIds && question.positionIds.length > 0">
                  {{ question.positionIds.map(id => getPositionName(id)).join(', ') }}
                </span>
                <span v-else class="text-gray-500">None</span>
              </td>
              <td class="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                <button @click="openAddEditQuestionModal(question,'edit')" class="text-blue-600 hover:text-blue-800 font-medium mr-2">Edit</button>
                <button @click="deleteQuestion(question.id)" class="text-red-600 hover:text-red-800 font-medium">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-center text-gray-500 py-8">まだ質問は追加されていません。</p>

      <!-- Close Button for Manage Questions Modal -->
      <div class="modal-actions mt-6">
        <button type="button" @click="closeModal" class="cancel-btn">閉じる</button>
      </div>
    </div>

    <!-- Add/Edit Question Modal (nested) -->
    <AddEditQuestionModal
      :isVisible="showAddEditQuestionSubModal"
      :availablePositions="availablePositions"
      :loggedInUser="loggedInUser"
      :questionToEdit="selectedQuestionForSubModal"
      :mode="mode"
      @close="closeAddEditQuestionSubModal"
      @question-saved="handleQuestionSaved"
    />
  </div>
</template>

<script>
import { collection, query, orderBy, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import AddEditQuestionModal from "./AddEditQuestionModal.vue"; 

export default {
  components: {
    AddEditQuestionModal,
  },
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    loggedInUser: {
      type: Object,
      default: null,
    },
    availablePositions: { // Pass positions to display names and for linking
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      questions: [], // Local state for questions in this modal
      showAddEditQuestionSubModal: false, // Controls visibility of the nested modal
      selectedQuestionForSubModal: null, // Question object for the nested modal
      mode: 'add', 
    };
  },
  watch: {
    isVisible(newVal) {
      if (newVal && this.loggedInUser) {
        this.fetchQuestions(); // Fetch questions when this modal becomes visible
      }
    },
    loggedInUser(newVal) {
      if (newVal) {
        this.fetchQuestions();
      } else {
        this.questions = []; // Clear questions if user logs out
      }
    }
  },
  methods: {
    closeModal() {
      this.$emit("close"); // Emit to parent (App.vue) to close this modal
    },
    async fetchQuestions() {
      if (!this.loggedInUser) {
        this.questions = [];
        return;
      }
      try {
        const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        this.questions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("ManageQuestionsModal: Questions fetched:", this.questions.length);
      } catch (error) {
        console.error("ManageQuestionsModal: Error fetching questions:", error);
      }
    },
    getPositionName(positionId) {
      const position = this.availablePositions.find(p => p.id === positionId);
      return position ? position.name : 'Unknown Position';
    },
    openAddEditQuestionModal(question = null, mode) {
      this.selectedQuestionForSubModal = question; // Pass null for add, object for edit
      this.showAddEditQuestionSubModal = true;
      this.mode = mode;
    },
    closeAddEditQuestionSubModal() {
      this.showAddEditQuestionSubModal = false;
      this.selectedQuestionForSubModal = null; // Clear selection
    },
    async handleQuestionSaved() {
      // This is called when a question is added/edited in the sub-modal
      await this.fetchQuestions(); // Re-fetch questions for this modal's list
      this.closeAddEditQuestionSubModal(); // Close the sub-modal
    },
    async deleteQuestion(questionId) {
      if (!confirm("この質問を削除しますか？この操作は元に戻せません。")) {
        return;
      }
      if (!this.loggedInUser) {
        alert("質問を削除するにはログインが必要です。");
        return;
      }

      try {
        const questionRef = doc(db, "questions", questionId);
        await deleteDoc(questionRef);
        alert("Question deleted successfully!");
        await this.fetchQuestions(); // Re-fetch questions to update the list
      } catch (error) {
        console.error("Error deleting question:", error);
        alert("質問の削除に失敗しました。再度お試しください。");
      }
    },
  },
};
</script>

<style scoped>
/* Reusing modal styles from EditApplicantModal.vue for consistency */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 900px; /* Slightly wider for question management */
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #007bff;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease;
}

.save-btn { /* Used for Add New Question button */
  background-color: #007bff;
  color: white;
}

.save-btn:hover {
  background-color: #0056b3;
}

.cancel-btn { /* Used for Close button */
  background-color: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background-color: #5a6268;
}

/* Table specific styles */
table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #4a5568;
  text-transform: uppercase;
  font-size: 0.85em;
}

tbody tr:hover {
  background-color: #f0f4f8;
}

.text-blue-600 { color: #2563eb; }
.hover\:text-blue-800:hover { color: #1e40af; }
.text-red-600 { color: #dc2626; }
.hover\:text-red-800:hover { color: #b91c1c; }
.font-medium { font-weight: 500; }
.mr-2 { margin-right: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mt-6 { margin-top: 1.5rem; }
.flex { display: flex; }
.justify-end { justify-content: flex-end; }
.rounded { border-radius: 0.25rem; }
.rounded-lg { border-radius: 0.5rem; }
.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.py-8 { padding-top: 2rem; padding-bottom: 2rem; }
.whitespace-nowrap { white-space: nowrap; }
.last\:border-b-0:last-child { border-bottom: 0; }
</style>
