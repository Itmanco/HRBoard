<template>
  <div v-if="isVisible && applicant" class="modal-overlay">
    <div v-if="localApplicant" class="modal-content">
      <div class="modal-header">
        <h3>応募者の編集</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>

      <p>応募者: <strong>{{ localApplicant.name }}</strong></p>
      <p>所属センター: <strong>{{ getCenterName(localApplicant.centerId) }}</strong></p>
      <hr />

      <form @submit.prevent="saveChanges" class="edit-applicant-form">
        <div class="form-group">
          <label for="editEmail">メールアドレス:</label>
          <input type="email" id="editEmail" v-model="localApplicant.email" />
        </div>

        <div class="form-group">
          <label for="editPosition">役職:</label>
          <select id="editPosition" v-model="localApplicant.positionId">
            <option v-for="position in availablePositions" :key="position.id" :value="position.id">
              {{ position.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="editStatus">ステータス:</label>
          <select id="editStatus" v-model="localApplicant.status">
            <option value="新規">新規</option>
            <option value="面接済み">面接済み</option>
            <option value="採用">採用</option>
            <option value="不採用">不採用</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="editInterviewDate">面接日:</label>
          <input type="datetime-local" id="editInterviewDate" v-model="interviewDateRef" /> </div>
        
        <div class="form-group">
          <label for="newCvFile">新しい履歴書をアップロード (PDF, 最大5MB):</label>
          <input type="file" id="newCvFile" @change="handleCvFileChange" accept=".pdf" />
          <p v-if="localApplicant.cvUrl">
            現在の履歴書: <a :href="localApplicant.cvUrl" target="_blank">表示</a>
          </p>
          <p v-if="cvUploadProgress > 0 && cvUploadProgress < 100">アップロード中: {{ cvUploadProgress }}%</p>
        </div>

        <p v-if="editError" class="error-message">{{ editError }}</p>

        <div class="form-actions">
          <button type="submit">変更を保存</button>
          <button type="button" @click="closeModal" class="cancel-btn">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '@/firebaseConfig';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';

// --- Props & Emits ---
const props = defineProps({
  isVisible: Boolean,
  applicant: Object,
  availablePositions: {
    type: Array,
    default: () => []
  },
  allCentersMap: Map,
});

const emit = defineEmits(['close', 'save-success']);

// --- Pinia Store ---
const centerStore = useCenterStore();
const { allCentersMap } = storeToRefs(centerStore);

// --- State ---
const localApplicant = ref(null);
const newCvFile = ref(null);
const cvUploadProgress = ref(0); // FIX: cvUploadProgress is now a ref
const interviewDateRef = ref(''); // FIX: interviewDate is now a simple ref
const editError = ref(null);

// --- Computed Properties ---
const getCenterName = (centerId) => {
  if (props.allCentersMap instanceof Map) {
    const center = props.allCentersMap.get(centerId);
    return center ? center.name : '不明なセンター';
  }
  return 'N/A';
};

// --- Watchers ---
watch(() => props.isVisible, (newVal) => {
  if (newVal && props.applicant) {
    localApplicant.value = { ...props.applicant };
    const selectedPosition = props.availablePositions.find(p => p.id === localApplicant.value.positionId);
    if (selectedPosition) {
        localApplicant.value.positionName = selectedPosition.name;
    }
    // FIX: Set the new simple ref from the prop's value
    if (localApplicant.value.interviewDate && localApplicant.value.interviewDate.toDate) {
        interviewDateRef.value = localApplicant.value.interviewDate.toDate().toISOString().slice(0, 16);
    } else {
        interviewDateRef.value = '';
    }
  } else {
    localApplicant.value = null;
    newCvFile.value = null;
    cvUploadProgress.value = 0;
    editError.value = null;
    interviewDateRef.value = ''; // FIX: Reset the ref on close
  }
}, { immediate: true });

// --- Methods ---
const closeModal = () => {
  emit('close');
};

const handleCvFileChange = (event) => {
  const file = event.target.files[0];
  if (file && file.size > 5 * 1024 * 1024) { // Max 5MB
    editError.value = 'ファイルサイズが5MBを超えています。';
    newCvFile.value = null;
  } else {
    newCvFile.value = file;
    editError.value = null;
  }
};

const saveChanges = async () => {
  editError.value = null;
  if (!localApplicant.value) return;

  try {
    const applicantRef = doc(db, "applicants", localApplicant.value.id);
    const updatedData = {
      email: localApplicant.value.email,
      positionId: localApplicant.value.positionId,
      positionName: props.availablePositions.find(p => p.id === localApplicant.value.positionId)?.name || localApplicant.value.positionName,
      status: localApplicant.value.status,
      // FIX: Use the new ref's value here
      interviewDate: interviewDateRef.value ? Timestamp.fromDate(new Date(interviewDateRef.value)) : null,
    };

    if (newCvFile.value) {
      if (localApplicant.value.cvUrl) {
        const deleteOldCvCallable = httpsCallable(functions, 'deleteOldCv');
        await deleteOldCvCallable({ cvUrl: localApplicant.value.cvUrl });
      }

      const cvPath = `cvs/${localApplicant.value.id}/${newCvFile.value.name}`;
      const cvRef = storageRef(storage, cvPath);
      const uploadTask = uploadBytesResumable(cvRef, newCvFile.value);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed', 
          (snapshot) => {
            cvUploadProgress.value = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          },
          (error) => {
            console.error('CV upload error:', error);
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            updatedData.cvUrl = downloadURL;
            await updateDoc(applicantRef, updatedData);
            console.log('New CV uploaded successfully!');
            resolve();
          }
        );
      });
      alert('変更が保存されました！新しい履歴書がアップロードされました。');
      emit('save-success');
      emit('close');
    } else {
      await updateDoc(applicantRef, updatedData);
      alert('変更が保存されました！');
      emit('save-success');
      emit('close');
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    editError.value = "変更の保存に失敗しました。";
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
.edit-applicant-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
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