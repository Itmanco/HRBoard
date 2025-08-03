<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>面接詳細・メモ</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="applicant-details">
        <p>応募者: <strong>{{ applicant.fullName || applicant.name }}</strong></p>
        <p>面接日: {{ formatTimestamp(applicant.interviewDate) }}</p>
        <p>役職: {{ applicant.positionName }}</p>
        <p>センター: <strong>{{ applicantCenterName }}</strong></p>
      </div>
      <hr />
      
      <div class="interview-notes-form">
        <h4>面接質問と回答</h4>
        <div v-for="q in questions" :key="q.id" class="question-item">
          <label>{{ q.text }}</label>
          <textarea
            v-model="q.answerText"
            placeholder="回答を記入してください..."
            rows="3"
          ></textarea>
        </div>
        
        <div class="notes-section">
          <h4>面接の全体的なメモ</h4>
          <textarea
            v-model="overallNotes"
            placeholder="面接の全体的な感想や評価を記入してください..."
            rows="5"
          ></textarea>
        </div>

        <button @click="saveInterviewNotes">メモを保存</button>
      </div>

      <div class="existing-notes">
        <h4>既存のメモ</h4>
        <ul v-if="existingNotes.length > 0">
          <li v-for="note in existingNotes" :key="note.id">
            <p><strong>面接者:</strong> {{ note.interviewerName }}</p>
            <p><strong>日付:</strong> {{ formatTimestamp(note.createdAt) }}</p>
            <p v-if="note.overallNotes"><strong>全体メモ:</strong> {{ note.overallNotes }}</p>
            <div v-if="note.questions && note.questions.length > 0">
              <p><strong>質問と回答:</strong></p>
              <ul>
                <li v-for="(qa, index) in note.questions" :key="index">
                  <p><strong>Q:</strong> {{ qa.questionText }}</p>
                  <p><strong>A:</strong> {{ qa.answerText }}</p>
                </li>
              </ul>
            </div>
          </li>
        </ul>
        <p v-else>まだメモはありません。</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { collection, addDoc, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebaseConfig';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';

// --- Props & Emits ---
const props = defineProps({
  isVisible: Boolean,
  applicant: Object,
  loggedInUser: Object,
  allCentersMap: Map,
});

const emit = defineEmits(['close', 'interview-saved']);

// --- Pinia Store ---
const centerStore = useCenterStore();
const { allCentersMap } = storeToRefs(centerStore);

// --- State ---
const overallNotes = ref('');
const questions = ref([]);
const existingNotes = ref([]);
const unsubscribeNotes = ref(null);
const unsubscribeQuestions = ref(null);

// --- Computed Properties ---
const applicantCenterName = computed(() => {
  if (props.applicant && props.applicant.centerId && allCentersMap.value instanceof Map) {
    const center = allCentersMap.value.get(props.applicant.centerId);
    return center ? center.name : '不明なセンター';
  }
  return 'N/A';
});

// --- Methods (Defined first, so they are available for watchers and hooks) ---
const formatTimestamp = (timestamp) => {
  if (timestamp && timestamp.toDate) {
    const date = timestamp.toDate();
    const dateOptions = { year: '2-digit', month: '2-digit', day: '2-digit' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const formattedDate = date.toLocaleDateString('en-US', dateOptions);
    const formattedTime = date.toLocaleTimeString('ja-JP', timeOptions);
    return `${formattedDate}, ${formattedTime}`;
  }
  return 'N/A';
};

const closeModal = () => {
  emit('close');
};

const stopNotesListener = () => {
  if (unsubscribeNotes.value) {
    unsubscribeNotes.value();
    unsubscribeNotes.value = null;
  }
};

const stopQuestionsListener = () => {
  if (unsubscribeQuestions.value) {
    unsubscribeQuestions.value();
    unsubscribeQuestions.value = null;
  }
};

const fetchExistingNotes = (applicantId) => {
  stopNotesListener();
  
  if (!applicantId) return;

  const q = query(
    collection(db, 'interviewNotes'),
    where('applicantId', '==', applicantId),
    orderBy('createdAt', 'desc')
  );

  unsubscribeNotes.value = onSnapshot(q, (snapshot) => {
    existingNotes.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  });
};

const fetchQuestions = (positionId, centerId) => {
  stopQuestionsListener();

  if (!positionId || !centerId) {
      questions.value = [];
      return;
  }
  
  const q = query(
    collection(db, 'questions'),
    where('positionIds', 'array-contains', positionId),
    where('centerId', '==', centerId)
  );

  unsubscribeQuestions.value = onSnapshot(q, (snapshot) => {
    questions.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      text: doc.data().text,
      isMandatory: doc.data().isMandatory !== undefined ? doc.data().isMandatory : false,
      answerText: '',
    }));
  });
};

const saveInterviewNotes = async () => {
  if (!props.loggedInUser || !props.loggedInUser.uid) {
    alert('ログインユーザー情報がありません。');
    return;
  }
  
  const notesWithAnswers = questions.value.map(q => ({
      questionId: q.id,
      questionText: q.text,
      answerText: q.answerText,
      isMandatory: q.isMandatory,
  }));

  const newNote = {
    applicantId: props.applicant.id,
    interviewerId: props.loggedInUser.uid,
    interviewerName: props.loggedInUser.displayName || props.loggedInUser.email,
    overallNotes: overallNotes.value,
    questions: notesWithAnswers,
    createdAt: Timestamp.now(),
  };

   // --- ADD THIS LOG FOR DEBUGGING ---
    console.log("Saving new interview note with payload:", newNote);
    // --- END DEBUGGING LOG ---

  try {
    await addDoc(collection(db, 'interviewNotes'), newNote);
    alert('面接メモを保存しました。');
    overallNotes.value = '';
    emit('interview-saved');
  } catch (error) {
    console.error('Error saving interview notes:', error);
    alert('面接メモの保存に失敗しました。権限が不足している可能性があります。');
  }
};

// --- Watchers (Defined after methods) ---
watch(() => props.isVisible, (newVal) => {
  if (newVal && props.applicant) {
    fetchExistingNotes(props.applicant.id);
    fetchQuestions(props.applicant.positionId, props.applicant.centerId);
  } else {
    stopNotesListener();
    stopQuestionsListener();
    overallNotes.value = '';
  }
}, { immediate: true });


// --- Lifecycle Hooks (Defined after everything else) ---
onBeforeUnmount(() => {
  stopNotesListener();
  stopQuestionsListener();
});
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
.applicant-details p {
  margin: 5px 0;
}
.applicant-details p strong {
  color: #000;
}
.interview-notes-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}
.question-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 10px;
}
.question-item label {
    font-weight: bold;
}
.interview-notes-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.notes-section {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.notes-section h4 {
    margin: 0;
}
.interview-notes-form button {
  align-self: flex-end;
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.existing-notes ul {
  list-style: none;
  padding: 0;
}
.existing-notes li {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
}
.existing-notes p {
  margin: 0;
  color: #555;
}
.existing-notes li li {
    background-color: #e9e9e9;
    padding: 5px;
    margin-bottom: 5px;
}
</style>