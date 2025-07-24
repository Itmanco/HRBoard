<template>
  <div id="app" >
    <header class="app-header">
      <img :src="Logo" alt="Logo" class="logo" style="width: 100px" />
      <div v-if="loggedInUser" class="auth-info">
        <span>ログインユーザー：
          <br />
          <strong>{{ sanitizeDisplayValue(loggedInUser.displayName) || sanitizeDisplayValue(loggedInUser.email) }}</strong></span>
        <button @click="logoutUser" class="logout-btn">ログアウト</button>
      </div>
      <div v-else class="auth-info">
        <span>応募者管理のため、ログインをお願いいたします。</span>
      </div>
      <button v-if="loggedInUser" @click="toggleMenu" class="menu-toggle-btn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="menu-icon">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>
    </header>

    <div v-if="showMenu" class="menu-overlay" @click="toggleMenu"></div>

    <nav :class="['side-menu', { 'is-open': showMenu }]">
      <div class="menu-header">
        <h3>メニュー</h3>
        <button @click="toggleMenu" class="close-menu-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="close-icon">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <ul class="menu-list">
        <li><a href="#" @click.prevent="showAddApplicantModal = true; toggleMenu()" v-if="availablePositions.length > 0">新規応募者追加</a></li>
        <li><a href="#" @click.prevent="toggleMenu()">応募者一覧表示</a></li>
        <li><a href="#" @click.prevent="openManagePositionsModal()">募集職管理</a></li>
        <li><a href="#" @click.prevent="openManageQuestionsModal()">設問管理</a></li>
        <li v-if="loggedInUser"><a href="#" @click.prevent="logoutUser">ログアウト</a></li>
      </ul>
    </nav>
    <div class="container">    
      <template v-if="loggedInUser">
        <div class="table-controls">
          <button 
            @click="showAddApplicantModal = true"
            :disabled="availablePositions.length === 0"  
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300"
            v-if="availablePositions.length > 0"
          >
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
                <th>ステータス</th>
                <th class="responsive-hide">提出者</th>
                <th class="responsive-hide">提出日</th>
                <th class="responsive-hide">履歴書</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="applicant in applicants" :key="applicant.id">
                <td>{{ formatTimestamp(applicant.interviewDate) }}</td>
                <td>{{ applicant.fullName || applicant.name }}</td>
                <td class="responsive-hide">{{ applicant.email }}</td>
                <td>{{ applicant.positionName }}</td>
                <td>{{ applicant.status }}</td>
                <td class="responsive-hide">{{ applicant.submittedBy }}</td>
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
                    @click="openEditModal(applicant)"
                    class="icon-button interview-btn"
                  >
                    <img :src="InterviewIcon" alt="Interview" class="icon" />
                  </button>
                  <button
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
          <p v-else class="no-applicants-message" width="300px">
            まだ応募者がいません。「新規応募者を追加」をクリックして開始してください。
          </p>
        </section>
      </template>
    </div>

    <AddApplicantModal
      v-if="loggedInUser && showAddApplicantModal"
      :is-visible="showAddApplicantModal" :logged-in-user="loggedInUser"
      :available-positions="availablePositions"
      @close="showAddApplicantModal = false"
      @applicant-added="fetchApplicants"
    />

    <EditApplicantModal
      v-if="loggedInUser && showEditModal && selectedApplicant"
      :is-visible="showEditModal"
      :applicant="selectedApplicant"
      :available-positions="availablePositions"
      @close="closeEditModal"
      @save-success="handleSaveSuccess"
    />

    <ManagePositionsModal
      v-if="loggedInUser && showManagePositionsModal"
      :is-visible="showManagePositionsModal"
      :available-positions="availablePositions"
      :logged-in-user="loggedInUser"
      @close="closeManagePositionsModal"
    />

    <ManageQuestionsModal
      :isVisible="showManageQuestionsModal"
      :loggedInUser="loggedInUser"
      :availablePositions="availablePositions"
      @close="closeManageQuestionsModal"
    />

    <LoginModal 
      :isVisible="showLoginModal" 
      @close="showLoginModal = false" 
      @login-success="handleLoginSuccess" />

  </div>
</template>

<script>
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  signInAnonymously,
} from "firebase/auth";
import { db, auth, serverTimestamp, storage } from "./firebaseConfig";
import {
  ref,
  deleteObject,
} from "firebase/storage";
import EditApplicantModal from "./components/EditApplicantModal.vue";
import AddApplicantModal from "./components/AddApplicantModal.vue";
import ManagePositionsModal from "./components/ManagePositionsModal.vue";
import ManageQuestionsModal from "./components/ManageQuestionsModal.vue";
import LoginModal from "./components/LoginModal.vue";
import ProblemSelectTest from './components/ProblemSelectTest.vue'; // Import it
import EditIcon from "./assets/icons/edit.svg";
import DeleteIcon from "./assets/icons/delete.svg";
import InterviewIcon from "./assets/icons/interview.svg";
import Logo from "./assets/logo2.png";


const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 5 MB in bytes
export default {
  name: "App",
  components: {
    EditApplicantModal,
    AddApplicantModal,
    ManagePositionsModal,
    ManageQuestionsModal,
    LoginModal,
    ProblemSelectTest,
  },
  data() {
    return {
      // Authentication state
      loggedInUser: null,
      showLoginModal: false,
      
      // Applicant form state (only required fields)
      applicantName: "",
      applicantEmail: "",
      positionApplied: "",
      status: "New",
      applicantPhone: "", // RE-ADDED: Phone Number data property

      // New properties for CV upload
      cvFile: null, // Holds the selected File object
      cvUploadProgress: 0, // For showing upload progress (0-100)
      cvUploadError: null, // For displaying upload errors

      applicants: [],
      simulatedSubmitter: "HR_Manager_A",

      // --- MODAL RELATED DATA ---
      showEditModal: false,
      selectedApplicant: null,
      showAddApplicantModal: false,
      showMenu: false,
      showManagePositionsModal: false, // 👈 NEW: State for the new modal
      availablePositions: [],
      unsubscribePositions: null, // To store the unsubscribe function
      showManageQuestionsModal: false,
      // --- END MODAL RELATED DATA ---
      InterviewIcon,
      EditIcon,
      DeleteIcon,
      Logo,
    };
  },
  mounted() {
    this.setupAuthListener();
  },
  beforeUnmount() {
    if (this.unsubscribeApplicantListener) {
      this.unsubscribeApplicantListener();
    }
    if (this.unsubscribePositions) {
      this.unsubscribePositions();
    }
    if (this.unsubscribeQuestions) {
      this.unsubscribeQuestions();
    }
  },
  methods: {
    // Add the sanitize methods at the beginning of the methods object
    sanitizeDisplayValue(value) {
      if (typeof value === 'string') {
        // Remove HTML comments and potentially problematic characters
        return value.replace(/<!--.*?-->/g, '').replace(/[<>]/g, '').trim();
      }
      return value || '';
    },

    sanitizeAttribute(value) {
      if (typeof value === 'string') {
        // More aggressive sanitization for attributes
        return value.replace(/<!--.*?-->/g, '')
                    .replace(/[<>"']/g, '')
                    .replace(/[\r\n\t]/g, ' ')
                    .trim();
      }
      return value;
    },
    setupAuthListener() {
      // return new Promise((resolve) => {
        // The onAuthStateChanged listener will fire immediately with the current user state
      onAuthStateChanged(auth, (user) => {
        this.loggedInUser = user; // Update loggedInUser reactive property
        if (user) {
          console.log("User logged in:", user.displayName);
          // Only start data listeners if a user is logged in (authenticated or anonymous)
          this.startApplicantListener();
          this.setupQuestionsListener(); // Call this here as it depends on loggedInUser
          this.setupPositionsListener(); // Call this here to ensure permissions are ready
        } else {
          console.log("User logged out.");
          // Clear all user-specific data and unsubscribe listeners on logout
          this.loggedInUser = null;
          this.applicants = [];
          this.positions = []; // Clear positions on logout
          this.questions = []; // Clear questions on logout

          if (this.unsubscribeApplicantListener) {
            this.unsubscribeApplicantListener();
            this.unsubscribeApplicantListener = null; // Clear reference
          }
          if (this.unsubscribePositions) {
            this.unsubscribePositions();
            this.unsubscribePositions = null; // Clear reference
          }
          if (this.unsubscribeQuestions) {
            this.unsubscribeQuestions();
            this.unsubscribeQuestions = null; // Clear reference
          }
                  
            this.openLoginModal();          
        }
      });
    },

    openLoginModal() {
      this.showLoginModal = true;
      this.showMenu = false; // Close the side menu if it's open when opening the login modal
    },

    handleLoginSuccess() { // ADDED: Method to handle successful login from modal
      this.showLoginModal = false;
      // The onAuthStateChanged listener will handle re-fetching data after login
    },

    openManageQuestionsModal() {
      this.showManageQuestionsModal = true;
    },

    closeManageQuestionsModal() {
      this.showManageQuestionsModal = false;
    },

    setupPositionsListener() {
      // Ensure this method exists and handles its own onSnapshot.
      // It will be called from setupAuthListener when a user is logged in.
      if (this.unsubscribePositions) {
        this.unsubscribePositions(); // Unsubscribe previous listener if it exists
      }
      const positionsCollectionRef = collection(db, 'positions');
      const q = query(positionsCollectionRef, orderBy('name'));

      this.unsubscribePositions = onSnapshot(q, (snapshot) => {
        const positions = [];
        snapshot.forEach(doc => {
          positions.push({ id: doc.id, ...doc.data() });
        });
        this.availablePositions = positions;
        console.log("App.vue: Available positions fetched:", this.availablePositions);
      }, (error) => {
        console.error("Error fetching available positions:", error);
      });
    },

    setupQuestionsListener() {
      // Ensure this method exists and handles its own onSnapshot.
      // It will be called from setupAuthListener when a user is logged in.
      if (this.unsubscribeQuestions) {
        this.unsubscribeQuestions(); // Unsubscribe previous listener if it exists
      }
      if (!this.loggedInUser) {
        this.questions = [];
        return;
      }
      const questionsCollectionRef = collection(db, "questions");
      const q = query(questionsCollectionRef, orderBy("createdAt", "desc"));

      this.unsubscribeQuestions = onSnapshot(q, (snapshot) => {
        this.questions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("App.vue: Questions fetched by listener:", this.questions.length);
      }, (error) => {
        console.error("Error fetching questions via listener:", error);
      });
    },

    async logoutUser() {
      try {
        await signOut(auth);
        alert("ログアウトしました！");
        this.showMenu = false; // Close menu on logout
        this.showLoginModal = true;
      } catch (error) {
        console.error("Error logging out:", error.message);
      }
    },

    fetchApplicants() {
      if (!this.loggedInUser) {
        this.applicants = []; // Clear applicants if not logged in
        return;
      }
      const applicantsCollection = collection(db, "applicants");
      const q = query(
        applicantsCollection,
        orderBy("interviewDate", "asc"), // Sort by interviewDate ascending
        orderBy("timestamp", "desc") // Then by submission timestamp descending for tie-breaking
      );
      onSnapshot(q, (snapshot) => {
        this.applicants = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Applicants fetched:", this.applicants.length);
      });
    },

    startApplicantListener() {
      if (this.unsubscribeApplicantListener) {
        this.unsubscribeApplicantListener();
      }
      const applicantsCollectionRef = collection(db, "applicants");
      const q = query(applicantsCollectionRef, orderBy("timestamp", "desc"));

      this.unsubscribeApplicantListener = onSnapshot(
        q,
        (snapshot) => {
          this.applicants = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        },
        (error) => {
          console.error("Error fetching applicants: ", error);
        }
      );
    },

    formatTimestamp(timestamp) {
      if (timestamp && timestamp.toDate) {
        const date = timestamp.toDate();

        // Options for the date part (MM/DD/YY)
        // Keeping 'en-US' or similar locale to ensure MM/DD/YY order
        const dateOptions = {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
        };

        // Options for the time part (HH:MM)
        const timeOptions = {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false, // Ensures 24-hour format (e.g., 17:35)
        };

        // Format date using 'en-US' to get MM/DD/YY order
        const formattedDate = date.toLocaleDateString("en-US", dateOptions);

        // Format time using 'ja-JP' for Japan's time parameters (e.g., 24-hour clock)
        const formattedTime = date.toLocaleTimeString("ja-JP", timeOptions);

        return `${formattedDate}, ${formattedTime}`;
      }
      return "N/A";
    },

    // --- MODAL RELATED METHODS ---
    toggleMenu() {
      this.showMenu = !this.showMenu;
    },

    openEditModal(applicant) {
      this.selectedApplicant = { ...applicant }; // Create a shallow copy to avoid direct mutation
      this.showEditModal = true;
      console.log("Opening modal for:", applicant.id); // Add this for debugging
    },

    closeEditModal() {
      this.showEditModal = false;
      this.selectedApplicant = null; // Clear selected applicant when modal closes
      console.log("Closing modal."); // Add this for debugging
    },

    handleSaveSuccess() {
      // Logic to run after saving changes in the edit modal
      console.log("Applicant saved successfully.");
      this.fetchApplicants(); // Re-fetch applicants to update the list
    },

    openManagePositionsModal() {
      this.showManagePositionsModal = true;
      this.toggleMenu(); // Close the side menu when opening the modal
    },

    closeManagePositionsModal() {
      this.showManagePositionsModal = false;
    }, 
    
    // --- END MODAL RELATED METHODS ---

    async deleteApplicant(id) {
      if (
        confirm(
          "この応募者を削除しますか？関連する履歴書ファイルも削除されます。"
        )
      ) {
        try {
          // 1. Fetch the applicant document to get the CV URL
          const applicantRef = doc(db, "applicants", id);
          const applicantDoc = await getDoc(applicantRef); // Use getDoc to fetch the single document

          if (!applicantDoc.exists()) {
            console.warn(
              "Applicant document not found, cannot delete CV from storage."
            );
            await deleteDoc(applicantRef); // Still delete the document if it somehow exists without data
            console.log("Applicant document deleted (no CV found).");
            return;
          }

          const applicantData = applicantDoc.data();
          const cvUrl = applicantData.cvUrl;

          // 2. If a CV URL exists, attempt to delete the file from Firebase Storage
          if (cvUrl) {
            try {
              // Extract the file path from the full Firebase Storage URL
              const url = new URL(cvUrl);
              // The file path is typically after '/o/' and before '?' query parameters
              let filePath = decodeURIComponent(
                url.pathname.split("/o/")[1].split("?")[0]
              );

              const fileRef = ref(storage, filePath);
              await deleteObject(fileRef); // Delete the file from Storage
              console.log("CV file deleted from Storage:", filePath);
            } catch (storageError) {
              console.warn(
                "Could not delete CV file from Storage (it might not exist or permissions issue):",
                storageError
              );
              // Important: Do NOT return here. Continue to delete the Firestore document
              // even if the storage file deletion fails, to maintain data integrity.
            }
          }

          // 3. Delete the applicant document from Firestore
          await deleteDoc(applicantRef);
          console.log("Applicant record deleted successfully from Firestore!");
        } catch (error) {
          console.error("Error deleting applicant or CV: ", error);
          alert(
            "応募者または関連CVの削除に失敗しました。再度お試しください。"
          );
        }
      }
    }
  }

};
</script>

<style>
/* src/App.vue styles (or put in src/assets/main.css) */

.app-header {
  position: fixed; /* Fixes the header to the viewport */
  top: 0; /* Aligns it to the top edge */
  left: 0; /* Aligns it to the left edge */
  width: 100%; /* Makes it span the full width */
  margin-top: 5px auto;
  margin-right: 8% auto;
  margin-left: 8% auto;
  background-color: #282c34;
  color: white;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center; /* Vertically center items */
  padding: 10px 20px; /* Adjust padding as needed */
  height: 60px; /* Give it a fixed height */
}

.app-header h1 {
  margin: 0;
  flex-grow: 1;
  text-align: center;
}

.auth-info {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 0.9em;
}

.logout-btn {
  background-color: #dc3545;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background-color: #c82333;
}

.container {
  max-width: 1000px;
  margin: 20px auto;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

section {
  flex-grow: 3;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

section:last-child {
  border-bottom: none;
}

h2 {
  color: #333;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="password"],
.form-group select {
  width: calc(100% - 22px); /* Account for padding and border */
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box; /* Include padding and border in the element's total width and height */
}

button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #0056b3;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  color: #333;
}

table th,
table td {
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

.current-user-selection {
  margin-top: 15px;
  margin-bottom: 25px;
  color: #333;
  font-weight: bold;
}

.current-user-selection label {
  margin-right: 10px;
}

.current-user-selection select {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  color: #333;
}

/* Authentication specific styles */
.auth-section {
  max-width: 400px;
  margin: 40px auto;
  padding: 30px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #f9f9f9;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.auth-section h2 {
  text-align: center;
  color: #007bff;
  margin-bottom: 30px;
}

.auth-section button {
  width: 100%;
  margin-top: 20px;
}

.toggle-mode {
  margin-top: 20px;
  font-size: 0.9em;
  color: #666;
}

.toggle-mode span {
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
}

.toggle-mode span:hover {
  color: #0056b3;
}

.error-message {
  color: #dc3545;
  margin-top: 15px;
  font-size: 0.9em;
}

/* Inside your <style> section */
.delete-btn {
  background-color: #dc3545; /* Red color for delete */
  margin-left: 10px; /* Space between save/edit and delete */
}

.delete-btn:hover {
  background-color: #c82333;
}

/* Styles for the icon container button */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; /* Fixed width for the button */
  height: 40px; /* Fixed height for the button */
  border-radius: 5px;
  cursor: pointer;
  border: none;
  box-sizing: border-box;
  transition: background-color 0.3s ease;
}

.icon-button .icon {
  width: 20px; /* **This is critical for icon size** */
  height: 20px; /* **This is critical for icon size** */
  flex-shrink: 0; /* Prevents icon from shrinking in flex containers */
  display: block; /* Ensures proper sizing behavior */
  object-fit: contain; /* Ensures SVG scales correctly within its box */
  filter: invert(1); /* Turns black icons white for visibility */
}

/* Your specific button colors (keep these) */
.interview-btn {
  background-color: #3f8d87;
}

.interview-btn:hover {
  background-color: #224d49;
}
.edit-btn {
  background-color: #007bff;
}

.edit-btn:hover {
  background-color: #0056b3;
}

.delete-btn {
  background-color: #dc3545;
  margin-left: 5px;
}

.delete-btn:hover {
  background-color: #c82333;
}

/* Optional: Add some styling for the input fields in edit mode */
table td input,
table td select {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #007bff;
  border-radius: 4px;
}

.cv-link {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}

.cv-link:hover {
  text-decoration: underline;
}

.upload-progress {
  font-size: 0.8em;
  color: #007bff;
  margin-top: 5px;
}

.table-controls {
  margin-bottom: 20px;
  text-align: right; /* Align button to the right, for example */
}

.add-applicant-btn {
  background-color: #28a745; /* Green color */
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease;
}

.add-applicant-btn:hover {
  background-color: #218838;
}

@media (max-width: 1000px) {
  .responsive-hide {
    display: none;
  }

  /* Optional: Adjust padding/font size for remaining columns on smaller screens */
  table th,
  table td {
    padding: 8px; /* Slightly less padding */
    font-size: 0.9em; /* Slightly smaller font */
  }

  /* Adjust action button size if they look too big */
  .icon-button {
    width: 28px;
    height: 28px;
    padding: 5px;
  }
  .icon-button .icon {
    width: 16px;
    height: 16px;
  }
}

/* For very small screens, you might want to hide more or adjust table behavior further */
@media (max-width: 600px) {
  /* Example: hide email on very small screens, too */
  table th:nth-child(1), /* Email header */
  table td:nth-child(1) {
    /* Email data */
    display: none;
  }
}

/* Menu Toggle Button */
.menu-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: white; /* Icon color */
  display: flex; /* For centering SVG */
  align-items: center;
  justify-content: center;
  z-index: 1001; /* Ensure button is clickable above other elements if needed */
}

.menu-toggle-btn:hover {
  opacity: 0.8;
}

.menu-icon {
  width: 28px; /* Size of the hamburger icon */
  height: 28px;
}

/* Side Menu Overlay */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4); /* Semi-transparent overlay */
  z-index: 999; /* Below the menu, above content */
  transition: opacity 0.3s ease;
}

/* Side Navigation Menu */
.side-menu {
  position: fixed;
  top: 0;
  left: -250px; /* Initially off-screen to the left */
  width: 250px; /* Width of your side menu */
  height: 100%;
  background-color: #2c3e50; /* Dark background for the menu */
  color: white;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.3);
  transition: left 0.3s ease; /* Smooth slide-in/out transition */
  z-index: 1000; /* On top of content, below overlay */
  display: flex;
  flex-direction: column;
}

.side-menu.is-open {
  left: 0; /* Slide in when 'is-open' class is present */
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #22303e; /* Slightly darker header for the menu */
  border-bottom: 1px solid #3a4b5c;
}

.menu-header h3 {
  margin: 0;
  color: white;
}

.close-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: white;
  padding: 5px;
}

.close-icon {
  width: 24px;
  height: 24px;
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1; /* Allows list to take available space */
}

.menu-list li a {
  display: block;
  padding: 15px;
  color: white;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.menu-list li a:hover {
  background-color: #34495e; /* Hover effect for menu items */
}

/* Adjust main content margin to account for fixed header */
.container {
  margin-top: 60px; /* Should match the height of your main-header */
  padding: 20px;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 768px) {
  .main-header .auth-container {
    /* Hide auth form elements on small screens if they take too much space */
    /* Or adjust their layout */
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
  }
  .main-header .auth-form {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
@media (max-width: 480px) {
  .main-header {
    flex-wrap: wrap;
    height: auto; /* Allow header to grow if content wraps */
    padding-bottom: 10px;
  }
  .app-title {
    order: 1; /* Change order if needed */
    width: 100%;
    text-align: left;
    margin-top: 10px;
  }
  .menu-toggle-btn {
    order: 0; /* Place button first */
  }
  .auth-container {
    order: 2; /* Place auth last */
    width: 100%;
    justify-content: flex-start;
  }
  .auth-form {
    flex-direction: column;
    align-items: flex-start;
  }
  .container {
    margin-top: 120px; /* Adjust based on new header height */
  }
}
</style>
