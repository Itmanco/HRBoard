<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2 class="text-2xl font-bold mb-6 text-center text-blue-700">
        {{ applicant ? `${applicant.name} さんの面接` : '面接' }}
      </h2>

      <div v-if="applicant" class="mb-6 p-4 border rounded-md bg-gray-50">
        <h3 class="font-semibold text-lg mb-2">応募者情報</h3>
        <p><strong>氏名:</strong> {{ applicant.name }}</p>
        <p><strong>メール:</strong> {{ applicant.email }}</p>
        <p><strong>応募職種:</strong>
          <span v-if="applicant.positionId">
            {{ getPositionName(applicant.positionId) }}
          </span>
          <span v-else>未定</span>
        </p>
        <p><strong>電話番号:</strong> {{ applicant.phoneNumber || 'N/A' }}</p>
        <p><strong>ステータス:</strong> {{ applicant.status || 'N/A' }}</p>
        <p><a
                    v-if="applicant.cvUrl"
                    :href="applicant.cvUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cv-link"
                    >履歴書を表示</a>
        </p>
      </div>

      <h3 class="font-semibold text-lg mb-4">質問と回答メモ</h3>

      <div v-if="isLoading" class="text-center py-8 text-gray-500">
        質問を読み込み中...
      </div>
      <div v-else-if="interviewQuestions.length > 0" class="space-y-6 max-h-80 overflow-y-auto pr-2">
        <div v-for="(q, index) in interviewQuestions" :key="q.id" class="p-4 border border-gray-200 rounded-md bg-white shadow-sm">
          <p class="font-medium text-gray-800 mb-2">Q{{ index + 1 }}. {{ q.text }}</p>
          <div class="form-group">
            <label :for="`notes-${q.id}`" class="block text-gray-600 text-sm font-bold mb-1">メモ:</label>
            <textarea
              :id="`notes-${q.id}`"
              v-model="q.notes"
              rows="3"
              class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="応募者の回答や評価を記入してください"
            ></textarea>
          </div>
          </div>
      </div>
      <p v-else class="text-center text-gray-500 py-8">この応募者に関連する質問はありません。</p>

      <div class="mt-6 border-t pt-4">
        <h3 class="font-semibold text-lg mb-4">概要</h3>
        <div class="form-group mb-4">
          <label for="overallNotes" class="block text-gray-700 text-sm font-bold mb-2">総合メモ:</label>
          <textarea
            id="overallNotes"
            v-model="overallNotes"
            rows="4"
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="面接全体の評価や所感を記入してください"
          ></textarea>
        </div>
        </div>

      <div class="modal-actions mt-6">
        <button
          @click="saveInterviewNotes"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          :disabled="isLoading"
        >
          メモを保存
        </button>
        <button
          @click="closeModal"
          class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ml-2"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default {
  name: "InterviewModal",
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    applicant: { // The full applicant object from applicants collection
      type: Object,
      default: null,
    },
    availablePositions: { // For looking up position names
      type: Array,
      default: () => [],
    },
    loggedInUser: { // Needed if storing who conducted the interview
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      interviewQuestions: [], // Questions with associated notes
      isLoading: false,
      overallNotes: '',
    };
  },
  watch: {
    isVisible(newVal) {
      if (newVal && this.applicant) {
        this.fetchQuestionsForApplicant();
      } else if (!newVal) {
        this.resetState(); // Reset data when closing
      }
    },
    // Watch applicant prop to refetch if a different applicant is selected while modal is open
    applicant(newVal, oldVal) {
      if (newVal && this.isVisible && (newVal.id !== (oldVal ? oldVal.id : null))) {
        this.fetchQuestionsForApplicant();
      } else if (!newVal) {
        this.resetState();
      }
    }
  },
  methods: {
    resetState() {
      this.interviewQuestions = [];
      this.isLoading = false;
      this.overallNotes = '';
    },
    closeModal() {
      this.$emit("close");
    },
    async fetchQuestionsForApplicant() {
      if (!this.applicant) {
        this.interviewQuestions = [];
        return;
      }

      this.isLoading = true;
      try {
        const applicantPositionId = this.applicant.positionId || null;
        let questionsFromDb = [];

        // 1. Fetch general questions (where positionIds array is empty)
        const generalQuestionsQuery = query(
          collection(db, "questions"),
          where("positionIds", "==", [])
        );
        const generalSnapshot = await getDocs(generalQuestionsQuery);
        generalSnapshot.docs.forEach(doc => {
            questionsFromDb.push({ id: doc.id, ...doc.data() });
        });

        // 2. Fetch questions linked to the applicant's specific position
        if (applicantPositionId) {
            const positionSpecificQuestionsQuery = query(
                collection(db, "questions"),
                where("positionIds", "array-contains", applicantPositionId)
            );
            const positionSnapshot = await getDocs(positionSpecificQuestionsQuery);
            positionSnapshot.docs.forEach(doc => {
                // Add only if not already fetched as a general question
                if (!questionsFromDb.some(q => q.id === doc.id)) {
                    questionsFromDb.push({ id: doc.id, ...doc.data() });
                }
            });
        }

        // Initialize notes property for each question
        this.interviewQuestions = questionsFromDb.map(q => ({
          ...q,
          notes: '', // Initialize empty notes for text area
          // score: null // Uncomment if you add score input
        }));

        // Load any existing interview notes for this applicant and interviewer
        await this.loadExistingInterviewNotes();

      } catch (error) {
        console.error("Error fetching questions for applicant:", error);
        alert("質問の読み込み中にエラーが発生しました。");
      } finally {
        this.isLoading = false;
      }
    },

    async loadExistingInterviewNotes() {
        if (!this.applicant || !this.loggedInUser) return;

        try {
            // Query for existing interview notes for this specific applicant and logged-in interviewer
            const interviewNotesQuery = query(
                collection(db, "interviewNotes"),
                where("applicantId", "==", this.applicant.id),
                where("interviewerId", "==", this.loggedInUser.uid)
            );
            const notesSnapshot = await getDocs(interviewNotesQuery);

            if (!notesSnapshot.empty) {
                // Assuming you'll have only one notes document per applicant/interviewer pair
                const existingNotesDoc = notesSnapshot.docs[0];
                const existingNotesData = existingNotesDoc.data();
                const existingQuestionsNotes = existingNotesData.questions || []; // Array of {questionId, answerText, score}

                // Map existing notes back to the questions currently displayed
                this.interviewQuestions = this.interviewQuestions.map(q => {
                    const foundNote = existingQuestionsNotes.find(note => note.questionId === q.id);
                    return {
                        ...q,
                        notes: foundNote ? foundNote.answerText : q.notes,
                        // score: foundNote ? foundNote.score : q.score
                    };
                });
                this.overallNotes = existingNotesData.overallNotes || '';
            }
        } catch (error) {
            console.error("Error loading existing interview notes:", error);
            // In a real app, you might show a subtle toast here, but not a blocking alert.
        }
    },

    async saveInterviewNotes() {
      if (!this.applicant || !this.loggedInUser) {
        alert("応募者情報またはログイン情報が不足しています。");
        return;
      }

      this.isLoading = true;
      try {
        const interviewDataToSave = {
          applicantId: this.applicant.id,
          interviewerId: this.loggedInUser.uid,
          interviewDate: serverTimestamp(),
          questions: this.interviewQuestions.map(q => ({
            questionId: q.id,
            questionText: q.text, // Store question text for easier viewing/reporting later
            answerText: q.notes,
            // score: q.score, // Uncomment if you add score input
            isMandatory: q.isMandatory // Keep this info if relevant
          })),
          overallNotes: this.overallNotes,
        };

        // Check if notes already exist for this applicant/interviewer pair
        const existingNotesQuery = query(
            collection(db, "interviewNotes"),
            where("applicantId", "==", this.applicant.id),
            where("interviewerId", "==", this.loggedInUser.uid)
        );
        const existingNotesSnapshot = await getDocs(existingNotesQuery);

        if (!existingNotesSnapshot.empty) {
            // Update the existing document
            const docRef = doc(db, "interviewNotes", existingNotesSnapshot.docs[0].id);
            await updateDoc(docRef, interviewDataToSave);
            alert("面接メモが更新されました！");
        } else {
            // Add a new document
            await addDoc(collection(db, "interviewNotes"), interviewDataToSave);
            alert("面接メモが保存されました！");
        }

        this.$emit("interview-saved"); // Notify parent (e.g., to refresh applicant list status)
        this.closeModal(); // Close the modal after saving

      } catch (error) {
        console.error("Error saving interview notes:", error);
        alert("メモの保存に失敗しました。再度お試しください。");
      } finally {
        this.isLoading = false;
      }
    },
    getPositionName(positionId) {
      const position = this.availablePositions.find(p => p.id === positionId);
      return position ? position.name : 'Unknown Position';
    },
  },
};
</script>

<style scoped>
/* Reusing modal styles for consistency */
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
  max-width: 700px; /* Adjust as needed */
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;
}

/* Specific styles for form elements */
.form-group label {
  font-size: 0.9em;
  color: #4a5568;
}

.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
.appearance-none { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
.border { border-width: 1px; }
.rounded { border-radius: 0.25rem; }
.w-full { width: 100%; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.text-gray-700 { color: #4a5568; }
.leading-tight { line-height: 1.25; }
.focus\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
.focus\:shadow-outline:focus { box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5); }
.text-center { text-align: center; }
.text-blue-700 { color: #2b6cb0; }
.font-bold { font-weight: 700; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-6 { margin-top: 1.5rem; }
.p-4 { padding: 1rem; }
.border { border-width: 1px; }
.rounded-md { border-radius: 0.375rem; }
.bg-gray-50 { background-color: #f9fafb; }
.font-semibold { font-weight: 600; }
.text-lg { font-size: 1.125rem; }
.text-gray-500 { color: #a0aec0; }
.py-8 { padding-top: 2rem; padding-bottom: 2rem; }
.space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.5rem; }
.max-h-80 { max-height: 20rem; }
.overflow-y-auto { overflow-y: auto; }
.pr-2 { padding-right: 0.5rem; }
.bg-white { background-color: #fff; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.text-gray-800 { color: #2d3748; }
.text-gray-600 { color: #718096; }
.text-sm { font-size: 0.875rem; }
.bg-blue-500 { background-color: #4299e1; }
.hover\:bg-blue-700:hover { background-color: #2b6cb0; }
.text-white { color: #fff; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.ml-2 { margin-left: 0.5rem; }
.bg-gray-500 { background-color: #a0aec0; }
.hover\:bg-gray-700:hover { background-color: #718096; }

</style>