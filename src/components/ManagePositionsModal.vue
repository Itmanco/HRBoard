<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>募集職管理</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <p>現在編集中のセンター: <strong>{{ centerName }}</strong></p>
      <hr />

      <form @submit.prevent="addPosition" class="position-form">
        <div class="form-group">
          <label for="newPositionName">役職名:</label>
          <input type="text" id="newPositionName" v-model="newPositionName" required />
        </div>
        
        <p v-if="positionError" class="error-message">{{ positionError }}</p>
        <button type="submit">追加</button>
      </form>
      
      <hr />

      <div class="existing-positions">
        <h4>既存の役職 ({{ availablePositions.length }})</h4>
        <table>
          <thead>
            <tr>
              <th>役職名</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="position in availablePositions" :key="position.id">
              <td>
                <span v-if="editingPositionId !== position.id">
                  {{ position.name }}
                </span>
                <input
                  v-else
                  type="text"
                  v-model="editingPositionName"
                  @keyup.enter="saveEditedPosition"
                  @keyup.esc="cancelEdit"
                />
              </td>
              <td>
                <button v-if="editingPositionId !== position.id" @click="editPosition(position)" class="edit-btn">編集</button>
                <button v-else @click="saveEditedPosition" class="save-btn">保存</button>
                <button @click="deletePosition(position.id)" class="delete-btn">削除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { collection, addDoc, query,where,getDocs, orderBy, onSnapshot, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
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
});

const emit = defineEmits(['close']);

// --- Pinia Store ---
const centerStore = useCenterStore();
const { selectedCenterId, allCentersMap } = storeToRefs(centerStore);

// --- State ---
const newPositionName = ref('');
const positionError = ref(null);
const editingPositionId = ref(null);
const editingPositionName = ref('');

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
        newPositionName.value = '';
        positionError.value = null;
    }
});


// --- Methods ---
const closeModal = () => {
  emit('close');
};

const addPosition = async () => {
    positionError.value = null;
    if (!newPositionName.value.trim()) {
        positionError.value = "役職名を入力してください。";
        return;
    }

    if (!selectedCenterId.value || selectedCenterId.value === 'all') {
        positionError.value = "役職を追加するには、センターを選択する必要があります。";
        return;
    }

    const newPosition = {
        name: newPositionName.value.trim(),
        centerId: selectedCenterId.value,
        createdAt: Timestamp.now(),
    };

    try {
        await addDoc(collection(db, "positions"), newPosition);
        newPositionName.value = '';
        positionError.value = null;
    } catch (error) {
        console.error("Error adding position:", error);
        positionError.value = "役職の追加に失敗しました。権限が不足している可能性があります。";
    }
};

const deletePosition = async (id) => {
  // 1. Check for associated applicants first
  const applicantsWithPositionQuery = query(
    collection(db, 'applicants'),
    where('positionId', '==', id)
  );
  
  try {
    const querySnapshot = await getDocs(applicantsWithPositionQuery);
    
    // 2. If any applicants are found, block the deletion
    if (!querySnapshot.empty) {
      alert("この役職は、応募者に割り当てられているため削除できません。");
      return;
    }
    
    // 3. If no applicants are found, proceed with deletion
    if (confirm("この役職を削除しますか？")) {
      await deleteDoc(doc(db, "positions", id));
      positionError.value = null;
    }
  } catch (error) {
    console.error("Error checking or deleting position:", error);
    positionError.value = "役職の削除に失敗しました。";
  }
};

const editPosition = (position) => {
  editingPositionId.value = position.id;
  editingPositionName.value = position.name;
};

const saveEditedPosition = async () => {
  if (!editingPositionName.value.trim()) {
    positionError.value = "役職名を入力してください。";
    return;
  }
  
  try {
    const positionRef = doc(db, "positions", editingPositionId.value);
    await updateDoc(positionRef, {
      name: editingPositionName.value.trim(),
    });
    editingPositionId.value = null;
    editingPositionName.value = '';
    positionError.value = null;
  } catch (error) {
    console.error("Error updating position:", error);
    positionError.value = "役職の更新に失敗しました。権限が不足している可能性があります。";
  }
};

const cancelEdit = () => {
  editingPositionId.value = null;
  editingPositionName.value = '';
  positionError.value = null;
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
.position-form, .existing-positions {
    margin-bottom: 20px;
}
.position-form .form-group {
    margin-bottom: 15px;
}
.position-form input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
}
.position-form button {
    background-color: #28a745;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
}
.existing-positions table {
    width: 100%;
    border-collapse: collapse;
}
.existing-positions th, .existing-positions td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
}
.existing-positions th {
    background-color: #f2f2f2;
}
.existing-positions tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* Corrected button styles to target specific buttons */
.existing-positions .edit-btn {
    background-color: #007bff;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 5px;
}
.existing-positions .edit-btn:hover {
    background-color: #0056b3;
}
.existing-positions .delete-btn {
    background-color: #dc3545;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.existing-positions .delete-btn:hover {
    background-color: #c82333;
}
.existing-positions .save-btn {
    background-color: #28a745;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.existing-positions .save-btn:hover {
    background-color: #218838;
}
</style>