<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <h3>新規応募者追加</h3>
      <p>現在編集中のセンター: <strong>{{ centerName }}</strong></p>
      <hr />

      <form @submit.prevent="addApplicant" class="applicant-form">
        <div class="form-group">
          <label for="applicantName">氏名:</label>
          <input type="text" id="applicantName" v-model="applicantName" required />
        </div>
        
        <div class="form-group">
          <label for="applicantEmail">メールアドレス:</label>
          <input type="email" id="applicantEmail" v-model="applicantEmail" required />
        </div>

        <div class="form-group">
          <label for="positionApplied">役職:</label>
          <select id="positionApplied" v-model="positionApplied" required>
            <option disabled value="">役職を選択してください</option>
            <option v-for="position in filteredPositions" :key="position.id" :value="position.id">
              {{ position.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="interviewDate">面接日と時間:</label>
          <input type="datetime-local" id="interviewDate" v-model="interviewDate" />
        </div>
        
        <div class="form-group">
          <label for="status">ステータス:</label>
          <select id="status" v-model="status">
            <option value="新規">新規</option>
            <option value="面接済み">面接済み</option>
            <option value="採用">採用</option>
            <option value="不採用">不採用</option>
          </select>
        </div>

        <div class="form-group">
          <label for="cvFile">履歴書ファイル (PDF, 最大5MB):</label>
          <input type="file" id="cvFile" @change="handleCvFileChange" accept=".pdf" />
          <p v-if="cvUploadProgress > 0 && cvUploadProgress < 100">アップロード中: {{ cvUploadProgress }}%</p>
          <p v-if="cvUploadError" class="error-message">{{ cvUploadError }}</p>
        </div>

        <p v-if="applicantError" class="error-message">{{ applicantError }}</p>

        <div class="form-actions">
          <button type="submit" :disabled="!isFormValid">登録</button>
          <button type="button" @click="closeModal" class="cancel-btn">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore'; // updateDoc is needed here
import { getAuth } from 'firebase/auth';
import { db, storage } from '@/firebaseConfig';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  selectedCenterId: String,
});

const emit = defineEmits(['close', 'applicant-added']);

// --- Pinia Store ---
const centerStore = useCenterStore();
const { allCentersMap } = storeToRefs(centerStore);

// --- State ---
const applicantName = ref('');
const applicantEmail = ref('');
const positionApplied = ref('');
const cvFile = ref(null);
const cvUploadProgress = ref(0);
const cvUploadError = ref(null);
const applicantError = ref(null);
const positionNameForApplicant = ref('');
const interviewDate = ref(''); // <--- NEW STATE
const status = ref('新規'); // <--- NEW STATE

// --- Computed Properties ---
const isFormValid = computed(() => {
  return applicantName.value.trim() !== '' && applicantEmail.value.trim() !== '' && positionApplied.value !== '';
});

const filteredPositions = computed(() => {
  const selectedCenterId = props.selectedCenterId;
  return props.availablePositions.filter(pos => pos.centerId === selectedCenterId);
});

const centerName = computed(() => {
    if (props.selectedCenterId && allCentersMap.value.has(props.selectedCenterId)) {
        return allCentersMap.value.get(props.selectedCenterId).name;
    }
    return '不明なセンター';
});

// --- Watchers ---
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    resetForm();
  }
});

watch(positionApplied, (newPositionId) => {
    const position = props.availablePositions.find(p => p.id === newPositionId);
    positionNameForApplicant.value = position ? position.name : '不明';
});

// --- Methods ---
const resetForm = () => {
  applicantName.value = '';
  applicantEmail.value = '';
  positionApplied.value = '';
  cvFile.value = null;
  cvUploadProgress.value = 0;
  cvUploadError.value = null;
  applicantError.value = null;
  interviewDate.value = ''; // <--- RESET NEW FIELD
  status.value = '新規';    // <--- RESET NEW FIELD
};

const closeModal = () => {
  emit('close');
};

const handleCvFileChange = (event) => {
  cvFile.value = event.target.files[0];
};

const addApplicant = async () => {
  applicantError.value = null;
  if (!isFormValid.value) {
    applicantError.value = '全ての必須項目を入力してください。';
    return;
  }
  
  const centerId = props.selectedCenterId;
  if (!centerId || centerId === 'all') {
    applicantError.value = '応募者を割り当てるセンターが選択されていません。';
    return;
  }

  try {
    const applicantData = {
      name: applicantName.value,
      email: applicantEmail.value,
      positionId: positionApplied.value,
      positionName: positionNameForApplicant.value,
      status: status.value, 
      centerId: centerId,
      addedbyUserId: props.loggedInUser.email,
      timestamp: Timestamp.now(),
      interviewDate: interviewDate.value ? new Date(interviewDate.value + ':00Z') : null,
      cvUrl: '',
    };

    const docRef = await addDoc(collection(db, 'applicants'), applicantData);
    const applicantId = docRef.id;

    if (cvFile.value) {
      const cvPath = `cvs/${applicantId}/${cvFile.value.name}`;
      const cvRef = storageRef(storage, cvPath); // Changed from db to storage
      const uploadTask = uploadBytesResumable(cvRef, cvFile.value);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          cvUploadProgress.value = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        },
        (error) => {
          console.error('CVアップロードエラー:', error);
          cvUploadError.value = '履歴書のアップロードに失敗しました。';
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(docRef, { cvUrl: downloadURL });
          console.log('CVアップロードが完了しました！');
          alert('応募者が追加されました！');
          emit('applicant-added');
          closeModal();
        }
      );
    } else {
      alert('応募者が追加されました！');
      emit('applicant-added');
      closeModal();
    }
  } catch (error) {
    console.error('Error adding applicant:', error);
    applicantError.value = '応募者の追加に失敗しました。';
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
.modal-content h3 {
  margin-top: 0;
  color: #333;
}
.applicant-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start; /* Explicitly align items to the left */
}
.form-group label {
  font-weight: bold;
}
.form-group input,
.form-group select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  width: 100%; /* Ensure inputs take up full width for consistent layout */
  box-sizing: border-box; /* Include padding and border in the element's total width and height */
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.form-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
}
.form-actions button[type="submit"] {
  background-color: #007bff;
  color: white;
}
.form-actions button[type="submit"]:hover {
  background-color: #0056b3;
}
.cancel-btn {
  background-color: #6c757d;
  color: white;
}
.cancel-btn:hover {
  background-color: #5a6268;
}
.error-message {
  color: red;
  font-size: 0.9em;
}
</style>