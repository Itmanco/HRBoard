<template>
  <div class="applicant-list-page">
    <div class="table-controls">
      <button
        @click="showAddApplicantModal = true"
        :disabled="filteredPositions.length === 0"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300"
        v-if="filteredPositions.length > 0 && centerStore.isSpecificCenterSelected">
        新規応募者追加
      </button>
    </div>

    <section class="applicant-list-section">
      <h2>応募者一覧</h2>
      <table v-if="applicants.length > 0">
        <thead>
          <tr>
            <th>面接日</th>
            <th>氏名</th>
            <th class="responsive-hide">メールアドレス</th>
            <th>役職</th>
            <th>センター</th>
            <th>ステータス</th>
            <th class="responsive-hide">提出者</th>
            <th class="responsive-hide">提出日</th>
            <th class="responsive-hide">履歴書</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="applicant in applicants" :key="applicant.id">
            <td>{{ formatTimestamp(applicant.interviewDate) }}</td>
            <td>{{ applicant.fullName || applicant.name }}</td>
            <td class="responsive-hide">{{ applicant.email }}</td>
            <td>{{ applicant.positionName }}</td>
            <td>{{ centerStore.getCenterName(applicant.centerId) }}</td>
            <td>{{ applicant.status }}</td>
            <td class="responsive-hide">{{ applicant.addedbyUserId }}</td>
            <td class="responsive-hide">{{ formatTimestamp(applicant.timestamp) }}</td>
            <td class="responsive-hide">
              <a
                v-if="applicant.cvUrl"
                :href="applicant.cvUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="cv-link"
                >履歴書を表示</a
              >
              <span v-else>N/A</span>
            </td>
            <td>
              <button
                @click="openInterviewModal(applicant)"
                class="icon-button interview-btn"
              >
                <img :src="InterviewIcon" alt="Interview" class="icon" />
              </button>
              <button
                v-if="filteredPositions.length > 0 && centerStore.isSpecificCenterSelected"
                @click="openEditModal(applicant)"
                class="icon-button edit-btn"
              >
                <img :src="EditIcon" alt="Edit" class="icon" />
              </button>
              <button
                @click="deleteApplicant(applicant.id)"
                class="icon-button delete-btn"
                style="margin-left: 0px"
              >
                <img :src="DeleteIcon" alt="Delete" class="icon" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="no-applicants-message">
        まだ応募者がいません。「新規応募者を追加」をクリックして開始してください。
      </p>
    </section>

    <AddApplicantModal
      v-if="loggedInUser && showAddApplicantModal"
      :is-visible="showAddApplicantModal"
      :logged-in-user="loggedInUser"
      :available-positions="filteredPositions"
      :selected-center-id="selectedCenterId"
      @close="showAddApplicantModal = false"
      @applicant-added="fetchApplicants"
    />

    <EditApplicantModal
      :key="modalKey" v-if="loggedInUser && showEditModal && selectedApplicant"
      :is-visible="showEditModal"
      :applicant="selectedApplicant"
      :available-positions="filteredPositions"
      :all-centers-map="centerStore.allCentersMap"
      @close="closeEditModal"
      @save-success="fetchApplicants"
    />

    <InterviewModal
      v-if="loggedInUser && showInterviewModal && selectedApplicantForInterview"
      :isVisible="showInterviewModal"
      :applicant="selectedApplicantForInterview"
      :availablePositions="filteredPositions"
      :loggedIn-user="loggedInUser"
      :all-centers-map="centerStore.allCentersMap"
      @close="showInterviewModal = false; selectedApplicantForInterview = null"
      @interview-saved="fetchApplicants"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';
import { formatTimestamp } from '@/utils/sanitizers.js'; // <-- NEW IMPORT

// Import your modal components
import AddApplicantModal from '@/components/AddApplicantModal.vue';
import EditApplicantModal from '@/components/EditApplicantModal.vue';
import InterviewModal from '@/components/InterviewModal.vue';

// Import icons
import EditIcon from '@/assets/icons/edit.svg';
import DeleteIcon from '@/assets/icons/delete.svg';
import InterviewIcon from '@/assets/icons/interview.svg';

// --- Props ---
const props = defineProps({
  loggedInUser: Object,
  filteredPositions: {
    type: Array,
    default: () => []
  },
  filteredQuestions: {
    type: Array,
    default: () => []
  }
});

// --- Pinia Store ---
const centerStore = useCenterStore();
const { selectedCenterId, isSpecificCenterSelected } = storeToRefs(centerStore);

// --- State ---
const applicants = ref([]);
const showEditModal = ref(false);
const selectedApplicant = ref(null);
const showAddApplicantModal = ref(false);
const showInterviewModal = ref(false);
const selectedApplicantForInterview = ref(null);
const unsubscribeApplicantListener = ref(null);

const modalKey = ref(0); // Add this new ref
// --- Computed Properties ---
const isSuperAdmin = computed(() => props.loggedInUser && props.loggedInUser.customClaims && props.loggedInUser.customClaims.role === 'superadmin');

// --- Watchers ---
watch(selectedCenterId, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    fetchApplicants();
  }
});

// --- Methods ---

const getCenterName = (centerId) => {
  return centerStore.getCenterName(centerId);
};

const fetchApplicants = () => {
  if (!props.loggedInUser || !props.loggedInUser.customClaims) {
    applicants.value = [];
    return;
  }
  if (unsubscribeApplicantListener.value) {
    unsubscribeApplicantListener.value();
  }
  const applicantsCollectionRef = collection(db, 'applicants');
  let q;
  const userCenterIdsInClaims = props.loggedInUser.customClaims.centerIds || [];
  
  if (isSuperAdmin.value && selectedCenterId.value === 'all') {
    q = query(applicantsCollectionRef, orderBy('timestamp', 'desc'));
  } else if (selectedCenterId.value && selectedCenterId.value !== 'all') {
    q = query(applicantsCollectionRef, where('centerId', '==', selectedCenterId.value), orderBy('timestamp', 'desc'));
  } else if (userCenterIdsInClaims.length > 0 && !isSuperAdmin.value && selectedCenterId.value === 'all') {
    q = query(applicantsCollectionRef, where('centerId', 'in', userCenterIdsInClaims), orderBy('timestamp', 'desc'));
  } else {
    applicants.value = [];
    return;
  }

  unsubscribeApplicantListener.value = onSnapshot(
    q,
    (snapshot) => {
      applicants.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('ApplicantList.vue: Applicants fetched (filtered by center):', applicants.value.length);
    },
    (error) => {
      console.error('Error fetching applicants: ', error);
    }
  );
};

const openEditModal = (applicant) => {
  //TODO
  console.log('ApplicantList.vue: openEditModal called for:', applicant.id); // <-- ADD THIS
  // END TODO
  selectedApplicant.value = { ...applicant };
  showEditModal.value = true;
  modalKey.value++; // ADDED: Increment key to force re-render
  // TODO
  console.log('ApplicantList.vue: showEditModal is now:', showEditModal.value); // <-- ADD THIS
  console.log('ApplicantList.vue: selectedApplicant is now:', selectedApplicant.value); // <-- ADD THIS
  // END TODO
};
const closeEditModal = () => {
  showEditModal.value = false;
  selectedApplicant.value = null;
};
const openInterviewModal = (applicant) => {
  selectedApplicantForInterview.value = applicant;
  showInterviewModal.value = true;
};

const deleteApplicant = async (id) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    alert('ログインしてください。');
    return;
  }

  const idTokenResult = await currentUser.getIdTokenResult(true);
  const userRole = idTokenResult.claims.role;
  const userCenterIds = idTokenResult.claims.centerIds || [];
  const applicantToDelete = applicants.value.find((a) => a.id === id);

  if (!applicantToDelete) {
    console.error('Applicant to delete not found locally.');
    return;
  }

  const applicantCenterId = applicantToDelete.centerId;

  if (!isSuperAdmin.value && (!applicantCenterId || !userCenterIds.includes(applicantCenterId))) {
    alert('この応募者を削除する権限がありません。');
    return;
  }

  if (confirm('この応募者を削除しますか？関連する履歴書ファイルも削除されます。')) {
    try {
      const deleteApplicantCallable = httpsCallable(functions, 'deleteApplicantAndCV');
      await deleteApplicantCallable({ applicantId: id });
      alert('応募者を削除しました！');
    } catch (error) {
      console.error('Error deleting applicant:', error);
      alert('応募者または関連CVの削除に失敗しました。再度お試しください。');
    }
  }
};

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchApplicants();
});

onBeforeUnmount(() => {
  if (unsubscribeApplicantListener.value) {
    unsubscribeApplicantListener.value();
  }
});
</script>

<style scoped>
.applicant-list-page {
  padding: 20px;
}
.table-controls {
  margin-bottom: 20px;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  align-items: center;
}
section {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  padding: 20px;
}
h2 {
  color: #333;
  margin-bottom: 20px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  color: #333;
}
table th, table td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
}
table th {
  background-color: #f2f2f2;
  color: #333;
}
table tr:nth-child(even) {
  background-color: #f9f9f9;
}
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 40px;
  border-radius: 5px;
  cursor: pointer;
  border: none;
  box-sizing: border-box;
  transition: background-color 0.3s ease;
}
.icon-button .icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  filter: invert(1);
}
.interview-btn { background-color: #3f8d87; }
.interview-btn:hover { background-color: #224d49; }
.edit-btn { background-color: #007bff; }
.edit-btn:hover { background-color: #0056b3; }
.delete-btn { background-color: #dc3545; margin-left: 5px; }
.delete-btn:hover { background-color: #c82333; }
.cv-link {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.cv-link:hover {
  text-decoration: underline;
}
.no-applicants-message {
  padding: 20px;
  text-align: center;
  color: #666;
}
@media (max-width: 1000px) {
  .responsive-hide {
    display: none;
  }
  table th, table td {
    padding: 8px;
    font-size: 0.9em;
  }
  .icon-button { width: 28px; height: 28px; padding: 5px; }
  .icon-button .icon { width: 16px; height: 16px; }
}
@media (max-width: 600px) {
  table th:nth-child(1),
  table td:nth-child(1) {
    display: none;
  }
}
</style>