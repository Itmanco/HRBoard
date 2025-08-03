<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>ユーザー管理</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>

      <div class="user-management-container">
        <!-- Form for Creating/Editing Users -->
        <div class="form-section">
          <h4>{{ editingUser ? 'ユーザーを編集' : '新しいユーザーを作成' }}</h4>
          <form @submit.prevent="saveUser">
            <div class="form-group">
              <label for="email">メールアドレス:</label>
              <input type="email" id="email" v-model="email" :disabled="editingUser" required />
            </div>

            <div v-if="!editingUser" class="form-group">
              <label for="password">パスワード:</label>
              <input type="password" id="password" v-model="password" required />
            </div>

            <div class="form-group">
              <label for="displayName">表示名:</label>
              <input type="text" id="displayName" v-model="displayName" required />
            </div>

            <div class="form-group">
              <label for="role">役割:</label>
              <select id="role" v-model="role" required>
                <option value="superadmin">スーパー管理者</option>
                <option value="center_admin">センター管理者</option>
                <option value="interviewer">面接官</option>
                <option value="applicant">応募者</option>
              </select>
            </div>
            
            <div class="form-group">
                <label>割り当てるセンター:</label>
                <div class="position-buttons">
                  <span
                    v-for="center in allCenters"
                    :key="center.id"
                    class="position-button"
                    :class="{ 'is-selected': isCenterSelected(center.id) }"
                    @click="toggleCenter(center.id)"
                  >
                    {{ center.name }}
                  </span>
                </div>
            </div>

            <p v-if="userError" class="error-message">{{ userError }}</p>

            <div class="form-actions">
              <button type="submit" class="submit-btn">{{ editingUser ? '更新' : '作成' }}</button>
              <button v-if="editingUser" type="button" @click="cancelEdit" class="cancel-btn">キャンセル</button>
            </div>
          </form>
        </div>

        <!-- User List -->
        <div class="user-list-section">
          <h4>既存のユーザー</h4>
          <input type="text" v-model="searchQuery" placeholder="メールまたは名前で検索..." class="search-input" />
          <table>
            <thead>
              <tr>
                <th>メール</th>
                <th>名前</th>
                <th>役割</th>
                <th>センター</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>{{ user.email }}</td>
                <td>{{ user.displayName }}</td>
                <td>{{ getRoleName(user.role) }}</td>
                <td>{{ getCenterNames(user.centerIds) }}</td>
                <td>
                  <button @click="editUser(user)" class="edit-btn">編集</button>
                  <button @click="confirmDeleteUser(user.id)" class="delete-btn">削除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { collection, query, orderBy, onSnapshot, doc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';
import Swal from 'sweetalert2';

// --- Props & Emits ---
const props = defineProps({
  isVisible: Boolean,
  loggedInUser: Object,
});
const emit = defineEmits(['close']);

// --- Pinia Store ---
const centerStore = useCenterStore();

// --- State ---
const users = ref([]);
const allCenters = ref([]);
const searchQuery = ref('');

const editingUser = ref(false);
const userToEditId = ref(null);
const email = ref('');
const password = ref('');
const displayName = ref('');
const role = ref('applicant');
const centerIds = ref([]);
const userError = ref(null);

const unsubscribeUsers = ref(null);
const unsubscribeCenters = ref(null);

// --- Computed Properties ---
const filteredUsers = computed(() => {
    if (!searchQuery.value) {
        return users.value;
    }
    const searchLower = searchQuery.value.toLowerCase();
    return users.value.filter(user =>
        user.email.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower)
    );
});

const getRoleName = (role) => {
    switch(role) {
        case 'superadmin': return 'スーパー管理者';
        case 'center_admin': return 'センター管理者';
        case 'interviewer': return '面接官';
        case 'applicant': return '応募者';
        default: return '不明';
    }
};

const getCenterName = (centerId) => {
    const center = allCenters.value.find(c => c.id === centerId);
    return center ? center.name : '不明なセンター';
};

const getCenterNames = (centerIds) => {
    if (!centerIds || centerIds.length === 0) return 'なし';
    return centerIds.map(id => getCenterName(id)).join(', ');
};

const isCenterSelected = (centerId) => {
    return centerIds.value.includes(centerId);
};

// --- Watchers ---
watch(() => props.isVisible, (newVal) => {
    if (newVal) {
        fetchUsers();
        fetchCenters();
    } else {
        resetForm();
        if (unsubscribeUsers.value) unsubscribeUsers.value();
        if (unsubscribeCenters.value) unsubscribeCenters.value();
    }
});

// --- Methods ---
const closeModal = () => {
    emit('close');
};

const resetForm = () => {
    editingUser.value = false;
    userToEditId.value = null;
    email.value = '';
    password.value = '';
    displayName.value = '';
    role.value = 'applicant';
    centerIds.value = [];
    userError.value = null;
};

const toggleCenter = (centerId) => {
    if (centerIds.value.includes(centerId)) {
        centerIds.value = centerIds.value.filter(id => id !== centerId);
    } else {
        centerIds.value.push(centerId);
    }
};

const fetchUsers = () => {
    if (unsubscribeUsers.value) unsubscribeUsers.value();
    const q = query(collection(db, 'users'), orderBy('email'));
    unsubscribeUsers.value = onSnapshot(q, (snapshot) => {
        users.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
};

const fetchCenters = () => {
    if (unsubscribeCenters.value) unsubscribeCenters.value();
    const q = query(collection(db, 'centers'), orderBy('name'));
    unsubscribeCenters.value = onSnapshot(q, (snapshot) => {
        allCenters.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
};

const editUser = (user) => {
    editingUser.value = true;
    userToEditId.value = user.id;
    email.value = user.email;
    displayName.value = user.displayName;
    role.value = user.role;
    centerIds.value = user.centerIds || [];
};

const saveUser = async () => {
    userError.value = null;
    try {
        if (editingUser.value) {
            const updateUserCallable = httpsCallable(functions, 'updateUserRoleAndCenter');
            await updateUserCallable({
                uid: userToEditId.value,
                email: email.value,
                displayName: displayName.value,
                role: role.value,
                centerIds: centerIds.value,
            });
            Swal.fire('更新されました！', 'ユーザー情報が更新されました。', 'success');
        } else {
            const createUserCallable = httpsCallable(functions, 'createUserAndSetClaims');
            await createUserCallable({
                email: email.value,
                password: password.value,
                displayName: displayName.value,
                role: role.value,
                centerIds: centerIds.value,
            });
            Swal.fire('作成されました！', '新しいユーザーが作成されました。', 'success');
        }
        resetForm();
    } catch (error) {
        console.error('Error saving user:', error);
        userError.value = `エラー: ${error.message}`;
        Swal.fire('エラー', `ユーザーの保存に失敗しました。: ${error.message}`, 'error');
    }
};

const cancelEdit = () => {
    resetForm();
};

const confirmDeleteUser = async (userId) => {
    Swal.fire({
        title: '本当に削除しますか？',
        text: "この操作は元に戻せません。",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'はい、削除します',
        cancelButtonText: 'キャンセル'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const deleteUserCallable = httpsCallable(functions, 'deleteUserAccount');
                await deleteUserCallable({ uid: userId });
                Swal.fire('削除されました！', 'ユーザーは正常に削除されました。', 'success');
            } catch (error) {
                console.error('Error deleting user:', error);
                Swal.fire('エラー', `ユーザーの削除に失敗しました: ${error.message}`, 'error');
            }
        }
    });
};
</script>

<style scoped>
/* Scoped styles for the modal content */
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
  max-width: 900px; /* Wider for user management table */
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
.user-management-container {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 30px;
}
.form-section {
    background-color: #f9f9f9;
    padding: 20px;
    border-radius: 8px;
}
.form-section h4, .user-list-section h4 {
    margin-top: 0;
    margin-bottom: 20px;
}
.form-group {
    margin-bottom: 15px;
}
.form-group label {
    font-weight: bold;
    display: block;
    margin-bottom: 5px;
}
.form-group input,
.form-group select {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
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
.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}
.submit-btn {
    background-color: #007bff;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
}
.cancel-btn {
    background-color: #6c757d;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
}
.search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    margin-bottom: 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
table th, table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}
table th {
    background-color: #f2f2f2;
}
table tr:nth-child(even) {
    background-color: #f9f9f9;
}
.edit-btn, .delete-btn {
    padding: 5px 10px;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.edit-btn { background-color: #007bff; margin-right: 5px; }
.delete-btn { background-color: #dc3545; }
</style>