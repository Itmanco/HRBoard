<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2>Add New Applicant</h2>
      <form @submit.prevent="handleAddApplicant">
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" v-model="applicantName" required />
        </div>
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" v-model="applicantEmail" required />
        </div>
        <div class="form-group">
        <label for="position">Position Applied For:</label>
        <select id="position" v-model="positionApplied" required>
          <option value="" disabled selected>Select a position</option>
          <option v-for="pos in localAvailablePositions" :key="pos.id"  :value="pos.id">
            {{ pos.name }}
          </option>
        </select>
        <p v-if="availablePositions.length === 0" class="form-help">
          No positions available. Please add some via "Manage Positions" in the main menu.
        </p>
      </div>
        <div class="form-group">
          <label for="status">Status:</label>
          <select id="status" v-model="status">
            <option value="New">New</option>
            <option value="Screening">Screening</option>
            <option value="Interview Scheduled">Interview Scheduled</option>
            <option value="Interviewed">Interviewed</option>
            <option value="Offer Extended">Offer Extended</option>
            <option value="Hired">Hired</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div class="form-group">
          <label for="applicantPhone">Phone Number:</label>
          <input type="tel" id="applicantPhone" v-model="applicantPhone" />
        </div>

        <div class="form-group">
          <label for="applicantCv">Upload CV (Image or PDF):</label>
          <input
            type="file"
            id="applicantCv"
            @change="handleCvFileUpload"
            accept="image/*,application/pdf"
          />
          <p v-if="cvFile">
            Selected file: <strong>{{ cvFile.name }}</strong>
          </p>
          <p
            v-if="cvUploadProgress > 0 && cvUploadProgress < 100"
            class="upload-progress"
          >
            Uploading: {{ cvUploadProgress.toFixed(0) }}%
          </p>
          <p v-if="cvUploadError" class="error-message">{{ cvUploadError }}</p>
        </div>

        <div class="form-group">
          <label for="interviewDate">Interview Date:</label>
          <VueDatePicker
            v-model="interviewDate"
            :teleport="true"
            :enable-time-picker="true"
            :month-change-on-scroll="false"
            :format="dpFormat"
            class="form-input"
            uid="addInterviewDate"
          ></VueDatePicker>
          <small>Select date and time.</small>
        </div>

        <div class="form-group">
          <label>Simulated Submitting User:</label>
          <p>{{ simulatedSubmitter }}</p>
          <p class="form-help">
            This field is for simulating submissions by a predefined user.
          </p>
        </div>

        <div class="modal-actions">
          <button type="submit" class="save-btn">Add Applicant</button>
          <button type="button" @click="closeModal" class="cancel-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, storage } from "../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 5 MB in bytes

export default {
  components: {
    VueDatePicker,
  },
  props: {
    isVisible: { type: Boolean, required: true },
    loggedInUser: { type: Object, default: null },
    availablePositions: { type: Array, default: () => []},
  },
  data() {
    return {
      applicantName: "",
      applicantEmail: "",
      positionApplied: "",
      status: "New",
      applicantPhone: "",
      cvFile: null,
      cvUploadProgress: 0,
      cvUploadError: null,
      simulatedSubmitter: "HR_Manager_A",
      interviewDate: null,
      localAvailablePositions: [],
    };
  },
  watch: {
    availablePositions: {
      handler(newVal) {
        console.log("AddApplicantModal: Prop 'availablePositions' updated:", newVal);
        this.localAvailablePositions = [...newVal];
        console.log("AddApplicantModal: 'localAvailablePositions' updated to:", this.localAvailablePositions);
      },
      deep: true,
      immediate: true,
    },
    isVisible(newVal) {
      if (newVal) {
        this.localAvailablePositions = [...this.availablePositions];
        console.log("AddApplicantModal: Modal opened, 'localAvailablePositions' re-synced:", this.localAvailablePositions);
        this.resetForm();
      }
    }
  },
  mounted() {
    console.log("AddApplicantModal: Mounted!");
    // Log the prop value immediately on mount
    console.log("AddApplicantModal: availablePositions on mount:", this.availablePositions);
  },
  unmounted() {
    console.log("AddApplicantModal: Unmounted!");
  },
  methods: {
    resetForm() {
       this.applicantName = "";
      this.applicantEmail = "";
      this.positionApplied = "";
      this.status = "New";
      this.applicantPhone = "";
      this.cvFile = null;
      this.cvUploadProgress = 0;
      this.cvUploadError = null;
      this.simulatedSubmitter = "HR_Manager_A";
      this.interviewDate = null;
      this.localAvailablePositions = []; // Clear local data on close
    },
    closeModal() {
      // Reset form fields
      this.resetForm();
      this.$emit("close");
    },
    
    // The dpFormat method will be used by the date picker to display the date
    dpFormat(date) {
      if (!date) return ''; // Handle case where no date is selected
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}/${day}/${year}, ${hours}:${minutes}`;
    },
    handleCvFileUpload(event) {
      this.cvFile = event.target.files[0];
      this.cvUploadError = null;
      this.cvUploadProgress = 0;

      if (this.cvFile) {
        // File Type Validation
        if (
          !this.cvFile.type.match("image.*") &&
          !this.cvFile.type.match("application/pdf")
        ) {
          this.cvUploadError =
            "Only image (JPG, PNG, etc.) or PDF files are allowed.";
          this.cvFile = null;
          event.target.value = "";
          return;
        }
        // File Size Validation
        if (this.cvFile.size > MAX_FILE_SIZE_BYTES) {
          this.cvUploadError = `File size exceeds the ${MAX_FILE_SIZE_MB}MB limit.`;
          this.cvFile = null;
          event.target.value = "";
          return;
        }
      }
    },
    async handleAddApplicant() {
      if (
        !this.applicantName ||
        !this.applicantEmail ||
        !this.positionApplied
      ) {
        alert("Please fill in all required fields (Name, Email, Position).");
        return;
      }

      if (!this.loggedInUser) {
        alert("You must be logged in to add applicants.");
        return;
      }

      let cvUrl = null;
      this.cvUploadError = null;
      this.cvUploadProgress = 0;

      if (this.cvFile) {
        try {
          const fileName = `cv_uploads/${this.applicantName.replace(
            /\s/g,
            "_"
          )}_CV_${Date.now()}_${this.cvFile.name}`;
          const storageRef = ref(storage, fileName);

          await uploadBytes(storageRef, this.cvFile);
          cvUrl = await getDownloadURL(storageRef);
          console.log("CV Download URL:", cvUrl);
        } catch (error) {
          console.error("Error uploading CV:", error);
          this.cvUploadError = "Failed to upload CV. Please try again.";
          alert("Failed to upload CV. Please try again.");
          return;
        }
      }

      // Find the selected position object to get its name
      const selectedPosition = this.availablePositions.find(
        (p) => p.id === this.positionApplied
      );

      if (!selectedPosition) {
        alert("Please select a valid position.");
        return;
      }

      // MODIFIED: Convert JavaScript Date object (from datepicker) to Firestore Timestamp
        if (this.interviewDate instanceof Date && !isNaN(this.interviewDate.getTime())) {
          this.interviewDate = Timestamp.fromDate(this.interviewDate);
        } else {
          this.interviewDate = null; // Save as null if no date selected
        }

      try {
        await addDoc(collection(db, "applicants"), {
          name: this.applicantName,
          email: this.applicantEmail,
          positionId: this.positionApplied,
          positionName: selectedPosition.name,
          status: this.status,
          phoneNumber: this.applicantPhone,
          cvUrl: cvUrl,
          submittedBy: this.simulatedSubmitter,
          addedByAuthUser: this.loggedInUser.email,
          timestamp: serverTimestamp(),
          interviewDate: this.interviewDate,
        });

        this.$emit("applicant-added"); // Emit event to parent
        this.closeModal(); // Close modal after successful add
        console.log("Applicant added successfully with CV!");
      } catch (error) {
        console.error("Error adding applicant: ", error);
        alert("Failed to add applicant. Please try again.");
      }
    },
  },
};
</script>

<style scoped>
/* Modal Overlay */
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
  z-index: 1000; /* Ensure it's on top of other content */
}

/* Modal Content */
.modal-content {
  background: #fff;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 500px;
  max-height: 90vh; /* Limit height to prevent overflow on small screens */
  overflow-y: auto; /* Enable scrolling if content is too long */
  position: relative;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

/* Form Group */
.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="tel"],
.form-group select {
  width: calc(100% - 20px);
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  box-sizing: border-box; /* Include padding in width */
}

.form-group p {
  font-size: 0.9em;
  color: #777;
  margin-top: 5px;
}

.form-help {
  font-size: 0.8em;
  color: #888;
  margin-top: 5px;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease;
}

.save-btn {
  background-color: #007bff;
  color: white;
}

.save-btn:hover {
  background-color: #0056b3;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background-color: #5a6268;
}

.upload-progress {
  font-size: 0.8em;
  color: #007bff;
  margin-top: 5px;
}

.error-message {
  font-size: 0.8em;
  color: #dc3545; /* Red color for error messages */
  margin-top: 5px;
}
</style>
