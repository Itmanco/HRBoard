<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2 class="text-2xl font-bold mb-6 text-center text-blue-700">
        {{ mode === 'add' ? '新規設問追加' : '設問編集' }}
      </h2>

      <form @submit.prevent="handleSubmit">
        <div class="form-group mb-4">
          <label for="questionText" class="block text-gray-700 text-sm font-bold mb-2">設問内容:</label>
          <textarea
            id="questionText"
            v-model="localQuestionText"
            rows="4"
            class="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          ></textarea>
        </div>

        <div class="form-group mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2">適用職:</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-3 rounded-md bg-gray-50">
            <div
              v-for="position in availablePositions"
              :key="position.id"
              class="flex items-center"
            >
              <input
                type="checkbox"
                :id="`position-${position.id}`"
                :value="position.id"
                v-model="localSelectedPositionIds"
                class="form-checkbox h-4 w-4 text-blue-600 rounded-md"
              />
              <label :for="`position-${position.id}`" class="ml-2 text-gray-700 text-sm">{{ position.name }}</label>
            </div>
            <div v-if="availablePositions.length === 0" class="text-gray-500 text-sm">
              募集職がありません。先に募集職を登録してください。
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">※ 選択しない場合、全ての職種に適用されます。</p>
        </div>

        <div class="form-group mb-6 flex items-center">
          <input
            type="checkbox"
            id="isMandatory"
            v-model="localIsMandatory"
            class="form-checkbox h-4 w-4 text-blue-600 rounded-md"
          />
          <label for="isMandatory" class="ml-2 text-gray-700 text-sm font-bold">必須設問</label>
        </div>
        
        <div class="modal-actions flex space-x-8 mt-6">
          <button
            type="submit"
            class="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {{ mode === 'add' ? '設問追加' : '設問を更新' }}
          </button>
          <button
            type="button"
            @click="closeModal"
            class="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            キャンセル
          </button>`
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig"; // Ensure this path is correct

export default {
  name: "AddEditQuestionModal",
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    mode: {
      type: String, // 'add' or 'edit'
      required: true,
      validator: (value) => ['add', 'edit'].includes(value),
    },
    questionToEdit: {
      type: Object,
      default: null,
    },
    availablePositions: {
      type: Array,
      default: () => [],
    },
    selectedCenterId: String, // Add this prop
  },
  data() {
    return {
      localQuestionText: "",
      localSelectedPositionIds: [],
      localIsMandatory: false,
    };
  },
  watch: {
    // Watch for changes in isVisible or questionToEdit to populate/reset the form
    isVisible(newVal) {
      if (newVal) {
        this.populateForm();
      }
    },
    questionToEdit: {
      immediate: true, // Run handler immediately on component creation
      handler() {
        if (this.isVisible) { // Only populate if modal is already visible or becoming visible
          this.populateForm();
        }
      },
    },
    mode(newMode) {
      if (this.isVisible) { // Repopulate if mode changes while visible
        this.populateForm();
      }
    }
  },
  methods: {
    populateForm() {
      if (this.mode === 'edit' && this.questionToEdit) {
        this.localQuestionText = this.questionToEdit.text || "";
        this.localSelectedPositionIds = Array.isArray(this.questionToEdit.positionIds) ? [...this.questionToEdit.positionIds] : [];
        this.localIsMandatory = this.questionToEdit.isMandatory || false;
      } else { // mode is 'add' or no questionToEdit for 'edit' mode
        this.resetForm();
      }
    },
    resetForm() {
      this.localQuestionText = "";
      this.localSelectedPositionIds = [];
      this.localIsMandatory = false;
    },
    closeModal() {
      this.resetForm(); // Reset form state when closing
      this.$emit("close");
    },
    async handleSubmit() {
      if (!this.localQuestionText.trim()) {
        alert("Question text cannot be empty.");
        return;
      }

      const questionData = {
        text: this.localQuestionText.trim(),
        centerId: this.selectedCenterId, // <--- Use the prop here!
        isMandatory: this.localIsMandatory,
        positionIds: this.localSelectedPositionIds.length > 0 ? this.localSelectedPositionIds : [],
      };

      try {
        if (this.mode === 'add') {
          // Add createdAt timestamp only for new questions
          questionData.createdAt = serverTimestamp();
          await addDoc(collection(db, "questions"), questionData);
          alert("Question added successfully!");
          this.$emit("question-saved"); // Notify parent
        } else if (this.mode === 'edit' && this.questionToEdit && this.questionToEdit.id) {
          const questionRef = doc(db, "questions", this.questionToEdit.id);
          await updateDoc(questionRef, questionData);
          alert("Question updated successfully!");
          this.$emit("question-saved"); // Notify parent
        } else {
          console.error("Invalid mode or missing question ID for update.");
          return;
        }
        this.closeModal();
      } catch (error) {
        console.error(`Error ${this.mode}ing question:`, error);
      }
    },
  },
};
</script>

<style scoped>
.modal-content textarea {
  width: 100%;
}

.modal-actions > button:first-of-type {
  margin-right: 1rem;
}

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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-actions button:last-of-type {
  background-color: #A0AEC0 !important; /* Tailwind's gray-400 */
}

.modal-actions button:last-of-type:hover {
  background-color: #718096 !important; /* Tailwind's gray-500 */
}
</style>
