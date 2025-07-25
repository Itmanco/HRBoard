<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2>
        応募者を編集: {{ editedApplicant.fullName || editedApplicant.name }}
      </h2>
      <form @submit.prevent="saveChanges">
        <!-- Keep these fields -->
        <div class="form-group">
          <label for="editName">氏名:</label>
          <input
            type="text"
            id="editName"
            v-model="editedApplicant.name"
            required
          />
        </div>
        <div class="form-group">
          <label for="editEmail">メール:</label>
          <input
            type="email"
            id="editEmail"
            v-model="editedApplicant.email"
            required
          />
        </div>
        <div class="form-group">
          <label for="editPosition">応募職種:</label>
          <select id="editPosition" v-model="editedApplicant.positionId" required>
            <option value="" disabled>Select a position</option>
            <option v-for="pos in availablePositions" :key="pos.id" :value="pos.id">
              {{ pos.name }}
            </option>
          </select>
          <p v-if="availablePositions.length === 0" class="form-help">
            募集職種がありません。メインメニューの「職種管理」から追加してください。
          </p>
        </div>
        <div class="form-group">
          <label for="editStatus">状態:</label>
          <select id="editStatus" v-model="editedApplicant.status">
             <option value="新規">新規</option>
            <option value="選考">選考</option>
            <option value="面接予定">面接予定</option>
            <option value="面接済">面接済</option>
            <option value="内定通知">内定通知</option>
            <option value="採用">採用</option>
            <option value="不採用">不採用</option>
          </select>
        </div>
        <!-- Keep Phone Number field -->
        <div class="form-group">
          <label for="editPhone">電話番号:</label>
          <input
            type="tel"
            id="editPhone"
            v-model="editedApplicant.phoneNumber"
          />
        </div>

        <div class="form-group">
          <label for="editCv">履歴書をアップロード（画像またはPDF）:</label>
          <input
            type="file"
            id="editCv"
            @change="handleEditCvFileUpload"
            accept="image/*,application/pdf"
          />
          <p v-if="editedApplicant.cvUrl">
            現在の履歴書:
            <a
              :href="editedApplicant.cvUrl"
              target="_blank"
              rel="noopener noreferrer"
              >現在の履歴書を表示</a
            >
          </p>
          <p v-if="newCvFile">
            新しいファイルを選択: <strong>{{ newCvFile.name }}</strong>
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
          <label for="editInterviewDate">面接日:</label>
          <VueDatePicker
            v-model="editedApplicant.interviewDate"
            :teleport="true"
            :enable-time-picker="true"
            :month-change-on-scroll="false"
            :format="dpFormat"
            class="form-input"
            uid="editInterviewDate"
          ></VueDatePicker>
          <small>日時を選択</small>
        </div>
        <div class="modal-actions">
          <button type="submit" class="save-btn">変更を保存</button>
          <button type="button" @click="closeModal" class="cancel-btn">
            取消
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db, storage } from "./../firebaseConfig"; // Ensure `storage` is imported
import { ref, uploadBytes, getDownloadURL, deleteObject, } from "firebase/storage"; // 👈 Add `deleteObject`

// Import the VueDatePicker component and its CSS
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 5 MB in bytes
export default {
  components: {
    VueDatePicker,
  },
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    applicant: {
      type: Object,
      required: true,
    },
    availablePositions: { 
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      editedApplicant: { ...this.applicant }, 
      newCvFile: null, 
      cvUploadProgress: 0,
      cvUploadError: null,
      interviewDate: '',
    };
  },
  watch: {
    applicant: {
      handler(newVal) {
        if (newVal) {
          this.editedApplicant = { ...newVal }; // Copy all properties
          
         // MODIFIED: Convert Firestore Timestamp to JavaScript Date object for the datepicker
          if (
            this.editedApplicant.interviewDate &&
            typeof this.editedApplicant.interviewDate.toDate === "function"
          ) {
            this.editedApplicant.interviewDate = this.editedApplicant.interviewDate.toDate();
          } else {
            this.editedApplicant.interviewDate = null; // Set to null if no date or invalid
          }
        } else {
          // If newVal is null/undefined (e.g., modal is being reset)
          this.editedApplicant = {
            id: null,
            name: '',
            email: '',
            positionId: '',
            status: 'New',
            phoneNumber: '',
            cvUrl: null,
            interviewDate: null,
          };
        }
        this.newCvFile = null;
        this.cvUploadProgress = 0;
        this.cvUploadError = null;
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    closeModal() {
      this.$emit("close");
    },
    // The dpFormat method will be used by the date picker to display the date
    dpFormat(date) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2); // Get last two digits of year
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}/${day}/${year}, ${hours}:${minutes}`;
    },
    handleEditCvFileUpload(event) {
      this.newCvFile = event.target.files[0];
      this.cvUploadError = null; // Clear previous errors
      this.cvUploadProgress = 0; // Reset progress

      if (this.newCvFile) {
        // 1. File Type Validation
        if (
          !this.newCvFile.type.match("image.*") &&
          !this.newCvFile.type.match("application/pdf")
        ) {
          this.cvUploadError =
            "Only image (JPG, PNG, etc.) or PDF files are allowed.";
          this.newCvFile = null;
          event.target.value = ""; // Clear the file input display
          return; // Stop further processing
        }

        // 2. NEW: File Size Validation
        if (this.newCvFile.size > MAX_FILE_SIZE_BYTES) {
          this.cvUploadError = `ファイルサイズが ${MAX_FILE_SIZE_MB}MBを超過しています。`;
          this.newCvFile = null;
          event.target.value = ""; // Clear the file input display
          return; // Stop further processing
        }
      }
    },
    async saveChanges() {
      // Basic validation
      if (
        !this.editedApplicant.name ||
        !this.editedApplicant.email ||
        !this.editedApplicant.positionId
      ) {
        alert("必須項目をご入力ください。");
        return;
      }

      let updatedCvUrl = this.editedApplicant.cvUrl; // Start with the current (old) URL
      const oldCvUrl = this.editedApplicant.cvUrl; // Store the original CV URL to potentially delete

      this.cvUploadError = null;
      this.cvUploadProgress = 0;

      // Check if a NEW CV file has been selected for upload
      if (this.newCvFile) {
        try {
          // 1. Upload the new CV file
          const fileName = `cv_uploads/${this.editedApplicant.name.replace(
            /\s/g,
            "_"
          )}_${Date.now()}_${this.newCvFile.name}`;
          const storageRef = ref(storage, fileName);

          const uploadTask = uploadBytes(storageRef, this.newCvFile);
          await uploadTask; // Wait for the new CV to upload

          updatedCvUrl = await getDownloadURL(storageRef); // Get the URL for the newly uploaded CV
          console.log("New CV uploaded and URL obtained:", updatedCvUrl);

          // 2. If a new CV was successfully uploaded, attempt to delete the old one
          if (oldCvUrl) {
            try {
              // Extract the file path from the full Firebase Storage URL
              // Firebase URLs typically look like:
              // https://firebasestorage.googleapis.com/v0/b/YOUR_BUCKET.appspot.com/o/path%2Fto%2Ffile.pdf?alt=media...
              const url = new URL(oldCvUrl);
              // The file path is after '/o/' and before '?'
              // decodeURIComponent handles encoded characters like '%2F' for '/'
              let filePath = decodeURIComponent(
                url.pathname.split("/o/")[1].split("?")[0]
              );

              const oldFileRef = ref(storage, filePath);
              await deleteObject(oldFileRef); // Delete the old file from Storage
              console.log(
                "Old CV deleted successfully from Storage:",
                filePath
              );
            } catch (deleteError) {
              // Log the error but do not block the saving of the new CV if deletion fails.
              // This can happen if the old file doesn't exist, or due to permission issues.
              console.warn(
                "Could not delete old CV from Storage (it might not exist or permissions issue):",
                deleteError
              );
            }
          }
        } catch (error) {
          console.error("Error uploading new CV:", error);
          this.cvUploadError = "履歴書のアップロードに失敗しました。再度お試しください。";
          alert("履歴書のアップロードに失敗しました。再度お試しください。");
          return; // Stop execution if new CV upload fails
        }
      }

      if (!this.editedApplicant.positionId) {
        alert("有効な役職を選択してください。");
        return;
      }

      // 3. Update the Firestore document with the new (or existing) CV URL
      try {
        const selectedPosition = this.availablePositions.find(
          (p) => p.id === this.editedApplicant.positionId
        );
        if (!selectedPosition) {
          alert("有効な役職を選択してください。");
          return;
        }

        let interviewDateToSave = null;
        // MODIFIED: Convert JavaScript Date object (from datepicker) to Firestore Timestamp
        if (this.editedApplicant.interviewDate instanceof Date && !isNaN(this.editedApplicant.interviewDate.getTime())) {
          interviewDateToSave = Timestamp.fromDate(this.editedApplicant.interviewDate);
        } else {
          // If the date picker value is null or not a valid Date object, save as null
          interviewDateToSave = null; 
        }

        const applicantRef = doc(db, "applicants", this.editedApplicant.id);

        await updateDoc(applicantRef, {
          name: this.editedApplicant.name,
          email: this.editedApplicant.email,
          positionId: this.editedApplicant.positionId,
          positionName: selectedPosition.name,
          status: this.editedApplicant.status,
          phoneNumber: this.editedApplicant.phoneNumber,
          cvUrl: updatedCvUrl,
          interviewDate: interviewDateToSave,
        });

        this.$emit("save-success");
        this.closeModal();
      } catch (error) {
        console.error("Error updating document: ", error);
        alert("変更の保存に失敗しました。再度お試しください。");
      }
    },
  },
};
</script>

<style scoped>
/* Your existing styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Ensure it's above other content */
}

.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 700px; /* Adjust max-width as needed */
  max-height: 90vh; /* Make it scrollable if content is too long */
  overflow-y: auto; /* Enable scrolling for long forms */
  position: relative;
}

.modal-content h2 {
  text-align: center;
  color: #007bff;
  margin-bottom: 25px;
}

.modal-content h3 {
  color: #555;
  margin-top: 25px;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

/* Note: The date picker component will apply its own styles. 
   You might need to override them or integrate them into your design system if needed. */
.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="tel"],
.form-group input[type="url"],
.form-group select,
.form-group textarea,
/* Target the datepicker's input if you want shared styling */
.dp__main input { 
  width: calc(100% - 22px); 
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
}

.modal-actions {
  margin-top: 30px;
  text-align: right;
}

.modal-actions button {
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  margin-left: 10px;
  transition: background-color 0.3s ease;
}

.save-btn {
  background-color: #28a745;
  color: white;
  border: none;
}

.save-btn:hover {
  background-color: #218838;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  border: none;
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
  color: #dc3545;
  margin-top: 5px;
}
</style>