<template>
  <div class="center-management">
    <h2>Manage Centers</h2>

    <div class="form-section">
      <h3>{{ editingCenter ? 'Edit Center' : 'Create New Center' }}</h3>
      <form @submit.prevent="saveCenter">
        <label for="centerName">Center Name:</label>
        <input type="text" id="centerName" v-model="centerForm.name" required />

        <label for="centerDescription">Description:</label>
        <textarea id="centerDescription" v-model="centerForm.description"></textarea>

        <label for="isActive">Active:</label>
        <input type="checkbox" id="isActive" v-model="centerForm.isActive" />

        <button type="submit">{{ editingCenter ? 'Update Center' : 'Create Center' }}</button>
        <button type="button" @click="cancelEdit" v-if="editingCenter">Cancel</button>
        <p v-if="message" class="message">{{ message }}</p>
      </form>
    </div>

    <div class="center-list-section">
      <h3>Existing Centers</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Active</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="center in centers" :key="center.id">
            <td>{{ center.name }}</td>
            <td>{{ center.description || 'N/A' }}</td>
            <td>{{ center.isActive ? 'Yes' : 'No' }}</td>
            <td>{{ formatDate(center.createdAt) }}</td>
            <td>
              <button @click="editCenter(center)">Edit</button>
              <button @click="confirmDeleteCenter(center.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { getAuth } from 'firebase/auth'; // <--- Make sure to import getAuth
import { ref, onMounted } from 'vue';
import { getFirestore, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Swal from 'sweetalert2'; // For nice confirmation dialogs

export default {
  name: 'CenterManagement',
  setup() {
    const db = getFirestore();
    const functions = getFunctions();

    const centers = ref([]);
    const centerForm = ref({
      id: null,
      name: '',
      description: '',
      isActive: true,
    });
    const editingCenter = ref(false);
    const message = ref('');

    // Callable Cloud Functions references
    const createCenter = httpsCallable(functions, 'createCenter');
    const updateCenter = httpsCallable(functions, 'updateCenter');
    const deleteCenter = httpsCallable(functions, 'deleteCenter');

    onMounted(() => {
      // Fetch centers
      const centersQuery = query(collection(db, 'centers'), orderBy('name'));
      onSnapshot(centersQuery, (snapshot) => {
        centers.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    });

    const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A';
      // Firebase Timestamps have a toDate() method
      const date = timestamp.toDate();
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const resetForm = () => {
      centerForm.value = {
        id: null,
        name: '',
        description: '',
        isActive: true,
      };
      editingCenter.value = false;
      message.value = '';
    };

    const saveCenter = async () => {
      try {
        message.value = '';

        // --- NEW CODE HERE: Force refresh of the ID token ---
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
            this.message = 'Error: You must be logged in to perform this action.';
            return;
        }

        // This line forces the current user's ID token to refresh,
        // ensuring it contains the very latest custom claims.
        await currentUser.getIdTokenResult(true);
        // --- END NEW CODE ---

        if (editingCenter.value) {
          await updateCenter({
            centerId: centerForm.value.id,
            name: centerForm.value.name,
            description: centerForm.value.description,
            isActive: centerForm.value.isActive,
          });
          message.value = 'Center updated successfully!';
        } else {
          await createCenter({
            name: centerForm.value.name,
            description: centerForm.value.description,
          }); // isActive defaults to true in function
          message.value = 'Center created successfully!';
        }
        resetForm();
      } catch (error) {
        console.error('Error saving center:', error.message);
        message.value = `Error: ${error.message}`;
      }
    };

    const editCenter = (center) => {
      editingCenter.value = true;
      centerForm.value = { ...center, id: center.id }; // Copy center data to form
    };

    const cancelEdit = () => {
      resetForm();
    };

    const confirmDeleteCenter = async (centerId) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Deleting a center is irreversible and may orphan related data (applicants, positions, etc.) if not handled in Cloud Functions. Proceed with caution!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteCenter({ centerId: centerId });
                    Swal.fire(
                        'Deleted!',
                        'The center has been deleted.',
                        'success'
                    );
                } catch (error) {
                    console.error('Error deleting center:', error);
                    Swal.fire(
                        'Error!',
                        `Failed to delete center: ${error.message}`,
                        'error'
                    );
                }
            }
        });
    };

    return {
      centers,
      centerForm,
      editingCenter,
      message,
      formatDate,
      saveCenter,
      editCenter,
      cancelEdit,
      confirmDeleteCenter,
    };
  },
};
</script>

<style scoped>
/* Re-use styles from UserManagement.vue or define common admin styles */
.center-management {
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
form input[type="text"],
form textarea {
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
.center-list-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
</style>