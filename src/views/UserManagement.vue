<template>
  <div class="user-management">
    <h2>Manage Users</h2>

    <div class="form-section">
      <h3>{{ editingUser ? 'Edit User' : 'Create New User' }}</h3>
      <form @submit.prevent="saveUser">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="userForm.email" :disabled="editingUser" required />

        <label for="password" v-if="!editingUser">Password:</label>
        <input type="password" id="password" v-model="userForm.password" v-if="!editingUser" required />

        <label for="displayName">Display Name:</label>
        <input type="text" id="displayName" v-model="userForm.displayName" required />

        <label for="role">Role:</label>
        <select id="role" v-model="userForm.role" required>
          <option value="superadmin">Super Admin</option>
          <option value="center_admin">Center Admin</option>
          <option value="interviewer">Interviewer</option>
          <option value="applicant">Applicant</option>
        </select>

        <label>Assigned Centers:</label>
        <div class="position-buttons">
            <span
                v-for="center in centers"
                :key="center.id"
                class="position-button"
                :class="{ 'is-selected': isCenterSelected(center.id) }"
                @click="toggleCenter(center.id)"
            >
                {{ center.name }}
            </span>
        </div>

        <button type="submit">{{ editingUser ? 'Update User' : 'Create User' }}</button>
        <button type="button" @click="cancelEdit" v-if="editingUser">Cancel</button>
        <p v-if="message" class="message">{{ message }}</p>
      </form>
    </div>

    <div class="user-list-section">
      <h3>Existing Users</h3>
      <input type="text" v-model="searchQuery" placeholder="Search by email or name..." class="search-input" />
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Centers</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.email }}</td>
            <td>{{ user.displayName }}</td>
            <td>{{ user.role }}</td>
            <td>{{ getCenterNames(user.centerIds) }}</td>
            <td>
              <button @click="editUser(user)">Edit</button>
              <button @click="confirmDeleteUser(user.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { getFirestore, collection, onSnapshot, doc, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Swal from 'sweetalert2'; // For nice confirmation dialogs

export default {
  name: 'UserManagement',
  setup() {
    const db = getFirestore();
    const functions = getFunctions();

    const users = ref([]);
    const centers = ref([]);
    const userForm = ref({
      uid: null,
      email: '',
      password: '',
      displayName: '',
      role: 'applicant',
      centerIds: [],
    });
    const editingUser = ref(false);
    const message = ref('');
    const searchQuery = ref('');

    // Callable Cloud Functions references
    const createUserAndSetClaims = httpsCallable(functions, 'createUserAndSetClaims');
    const updateUserRoleAndCenter = httpsCallable(functions, 'updateUserRoleAndCenter');
    const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');

    onMounted(() => {
      // Fetch users
      const usersQuery = query(collection(db, 'users'));
      onSnapshot(usersQuery, (snapshot) => {
        users.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });

      // Fetch centers (needed for center selection in form)
      const centersQuery = query(collection(db, 'centers'));
      onSnapshot(centersQuery, (snapshot) => {
        centers.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    });

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

    const getCenterNames = (centerIds) => {
        if (!centerIds || centerIds.length === 0) return 'None';
        return centerIds.map(id => {
            const center = centers.value.find(c => c.id === id);
            return center ? center.name : 'Unknown Center';
        }).join(', ');
    };

    const resetForm = () => {
      userForm.value = {
        uid: null,
        email: '',
        password: '',
        displayName: '',
        role: 'applicant',
        centerIds: [],
      };
      editingUser.value = false;
      message.value = '';
    };

    const saveUser = async () => {
      try {
        message.value = '';
        if (editingUser.value) {
          await updateUserRoleAndCenter(userForm.value);
          message.value = 'User updated successfully!';
        } else {
          await createUserAndSetClaims(userForm.value);
          message.value = 'User created successfully!';
        }
        resetForm();
      } catch (error) {
        console.error('Error saving user:', error.message);
        message.value = `Error: ${error.message}`;
      }
    };

    const editUser = (user) => {
      editingUser.value = true;
      userForm.value = { ...user, uid: user.id }; // Copy user data to form, ensure uid is set
      userForm.value.password = ''; // Clear password field for security
    };

    const cancelEdit = () => {
      resetForm();
    };

    const confirmDeleteUser = async (userId) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteUserAccount({ uid: userId });
                    Swal.fire(
                        'Deleted!',
                        'The user has been deleted.',
                        'success'
                    );
                } catch (error) {
                    console.error('Error deleting user:', error);
                    Swal.fire(
                        'Error!',
                        `Failed to delete user: ${error.message}`,
                        'error'
                    );
                }
            }
        });      
    };

    const isCenterSelected = (centerId) => {
          return userForm.value.centerIds.includes(centerId);
      };

      const toggleCenter = (centerId) => {
          const centerIdsArray = userForm.value.centerIds;
          const index = centerIdsArray.indexOf(centerId);
          if (index > -1) {
              // Remove the center if it's already selected
              centerIdsArray.splice(index, 1);
          } else {
              // Add the center if it's not selected
              centerIdsArray.push(centerId);
          }
      };

    return {
      users,
      centers,
      userForm,
      editingUser,
      message,
      searchQuery,
      filteredUsers,
      getCenterNames,
      saveUser,
      editUser,
      cancelEdit,
      confirmDeleteUser,
      isCenterSelected, // <-- ADD THIS
      toggleCenter,     // <-- ADD THIS
    };
  },
};
</script>

<style scoped>
.user-management {
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}
.form-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
form label {
  font-weight: bold;
  margin-bottom: 5px;
}
form input[type="email"],
form input[type="password"],
form input[type="text"],
form select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
form button {
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}
form button[type="button"] {
  background-color: #6c757d;
}
.message {
  grid-column: span 2;
  color: green;
  font-weight: bold;
}
.error-message {
  color: red;
}
.user-list-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.search-input {
    width: 100%;
    padding: 8px;
    margin-bottom: 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
table th, table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
table th {
  background-color: #f2f2f2;
}
table button {
  padding: 5px 10px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 5px;
}
table button:last-child {
  background-color: #dc3545;
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
</style>