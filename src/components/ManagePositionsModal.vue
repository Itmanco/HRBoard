<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2>Manage Positions</h2>

      <div class="add-position-section">
        <h3>Add New Position</h3>
        <form @submit.prevent="addPosition" class="add-position-form">
          <input
            type="text"
            v-model="newPositionName"
            placeholder="e.g., Software Engineer, HR Manager"
            required
          />
          <button type="submit" class="save-btn">Add Position</button>
        </form>
        <p v-if="addError" class="error-message">{{ addError }}</p>
      </div>

      <div class="current-positions-section">
        <h3>Current Available Positions</h3>
        <p v-if="availablePositions.length === 0" class="no-positions-message">
          No positions defined yet.
        </p>
        <ul v-else class="position-list">
          <li v-for="position in availablePositions" :key="position.id">
            <span>{{ position.name }}</span>
            <button
              @click="deletePosition(position.id)"
              class="icon-button delete-btn"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="delete-icon"
              >
                <path
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button type="button" @click="closeModal" class="cancel-btn">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { collection, addDoc, deleteDoc, doc, query,orderBy,onSnapshot, where, getDocs,} from "firebase/firestore";
import { db } from "../firebaseConfig"; // Ensure db is imported

export default {
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    // This prop will be passed from App.vue and kept updated via onSnapshot
    availablePositions: {
      type: Array,
      default: () => [],
    },
    loggedInUser: {
      // Optional: if you want to restrict who can manage positions
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      newPositionName: "",
      addError: null,
    };
  },
  methods: {
    closeModal() {
      this.newPositionName = "";
      this.addError = null;
      this.$emit("close");
    },
    async addPosition() {
      this.addError = null;
      if (!this.newPositionName.trim()) {
        this.addError = "Position name cannot be empty.";
        return;
      }
      // Optional: Check for duplicates before adding
      if (
        this.availablePositions.some(
          (p) =>
            p.name.toLowerCase() === this.newPositionName.trim().toLowerCase()
        )
      ) {
        this.addError = "This position already exists.";
        return;
      }

      try {
        await addDoc(collection(db, "positions"), {
          name: this.newPositionName.trim(),
          createdAt: new Date(), // Or serverTimestamp() if imported
        });
        this.newPositionName = ""; // Clear input on success
        console.log("Position added!");
      } catch (error) {
        console.error("Error adding position:", error);
        this.addError = "Failed to add position. Please try again.";
      }
    },
    async deletePosition(positionId) {
      if (!confirm("Are you sure you want to delete this position? This action cannot be undone.")) {
        return; // User cancelled
      }

      try {
        // Step 1: Check if any applicants are associated with this position
        const applicantsRef = collection(db, "applicants");
        const q = query(applicantsRef, where("positionId", "==", positionId)); // Assuming 'position' field in applicant is the position's ID or name
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          alert("Cannot delete this position. There are applicants currently assigned to it.");
          return; // Stop deletion if applicants are found
        }

        // Step 2: If no applicants are found, proceed with deletion
        const positionRef = doc(db, "positions", positionId);
        console.error("Error deleting position:", positionId);
        await deleteDoc(positionRef);
        alert("Position deleted successfully!");
        this.$emit("close"); // Close the modal or refresh the list
        // You might want to emit an event to the parent (App.vue) to re-fetch positions if it's not real-time
        // Or ensure App.vue's listener for positions is correctly updating.
      } catch (error) {
        console.error("Error deleting position:", error);
        alert("Failed to delete position. Please try again.");
      }
    },
  },
};
</script>

<style scoped>
/* Modal Overlay - Reuse from AddApplicantModal/EditApplicantModal if global */
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

/* Modal Content - Reuse if global */
.modal-content {
  background: #fff;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.add-position-section,
.current-positions-section {
  margin-bottom: 25px;
  border: 1px solid #eee;
  padding: 15px;
  border-radius: 6px;
}

.add-position-section h3,
.current-positions-section h3 {
  margin-top: 0;
  color: #555;
  font-size: 1.1em;
  margin-bottom: 15px;
}

.add-position-form {
  display: flex;
  gap: 10px;
}

.add-position-form input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.add-position-form button {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
}

.add-position-form button:hover {
  background-color: #0056b3;
}

.position-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.position-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.position-list li:last-child {
  border-bottom: none;
}

.position-list li span {
  font-size: 1em;
  color: #333;
}

.no-positions-message {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 10px;
}

/* Re-using button styles from other modals if defined globally */
.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.delete-icon {
  width: 20px;
  height: 20px;
  fill: #dc3545; /* Red color */
}
.delete-btn:hover .delete-icon {
  fill: #c82333;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.cancel-btn:hover {
  background-color: #5a6268;
}

.error-message {
  color: #dc3545;
  font-size: 0.9em;
  margin-top: 10px;
  text-align: center;
}
</style>
