<template>
  <div id="app">
    <header class="app-header">
      <img :src="Logo" alt="Logo" class="logo" style="width: 100px" />
      <div v-if="loggedInUser" class="header-center-filter">
        <CenterFilter :isSuperAdmin="isSuperAdmin" />
      </div>
      <div v-if="loggedInUser" class="header-right-group">
        <div class="auth-info">
          <span>ログインユーザー：
            <br />
            <strong>{{ sanitizeText(loggedInUser.displayName) || sanitizeText(loggedInUser.email) }}</strong></span>
          <button @click="logoutUser" class="logout-btn">ログアウト</button>
        </div>
        <button @click="toggleMenu" class="menu-toggle-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="menu-icon">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
      </div>
      <div v-else class="header-right-group">
        <span>応募者管理のため、ログインをお願いいたします。</span>
        <button @click="toggleMenu" class="menu-toggle-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="menu-icon">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="showMenu" class="menu-overlay" @click="toggleMenu"></div>

    <nav :class="['side-menu', { 'is-open': showMenu }]">
      <div class="menu-header">
        <h3>メニュー</h3>
        <button @click="toggleMenu" class="close-menu-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="close-icon">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
      <ul class="menu-list">
        <li><router-link to="/" @click="toggleMenu()">応募者一覧</router-link></li>
        <li v-if="(isSuperAdmin || isCenterAdmin) && centerStore.isSpecificCenterSelected"><a href="#" @click.prevent="openManagePositionsModal()">求人管理</a></li>
        <li v-if="(isSuperAdmin || isCenterAdmin) && centerStore.isSpecificCenterSelected"><a href="#" @click.prevent="openManageQuestionsModal()">設問管理</a></li>
        <li v-if="isSuperAdmin"><router-link to="/admin/users" @click="toggleMenu()">ユーザー管理</router-link></li>
        <li v-if="isSuperAdmin"><router-link to="/admin/centers" @click="toggleMenu()">センター管理</router-link></li>
        <!-- <li v-if="isSuperAdmin"><a href="#" @click.prevent="runDataMigration(); toggleMenu()">データ移行 (一時的)</a></li> -->
        <li v-if="loggedInUser"><a href="#" @click.prevent="logoutUser">ログアウト</a></li>
      </ul>
    </nav>

    <div class="container">
      <router-view
        :loggedInUser="loggedInUser"
        :availablePositions="availablePositions"
        :filteredPositions="filteredPositions"
        :filteredQuestions="filteredQuestions"
      ></router-view>
    </div>

    <LoginModal :isVisible="showLoginModal" @close="showLoginModal = false" @login-success="handleLoginSuccess" />

    <ManagePositionsModal
      v-if="loggedInUser && showManagePositionsModal"
      :isVisible="showManagePositionsModal"
      :availablePositions="filteredPositions"
      :loggedInUser="loggedInUser"
      @close="closeManagePositionsModal"
    />

    <ManageQuestionsModal
      v-if="loggedInUser && showManageQuestionsModal"
      :isVisible="showManageQuestionsModal"
      :loggedInUser="loggedInUser"
      :availableQuestions="filteredQuestions" 
      :availablePositions="filteredPositions"
      @close="closeManageQuestionsModal"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { useCenterStore } from '@/stores/centerStore';
import { storeToRefs } from 'pinia';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { sanitizeText, sanitizeAttribute } from '@/utils/sanitizers.js';
import { auth, db, functions } from './firebaseConfig';

import LoginModal from './components/LoginModal.vue';
import ManagePositionsModal from './components/ManagePositionsModal.vue';
import ManageQuestionsModal from './components/ManageQuestionsModal.vue';
import CenterFilter from './components/CenterFilter.vue';
import Logo from './assets/logo2.png';

// --- State Management and Data ---
const router = useRouter();
const centerStore = useCenterStore();
const { isSpecificCenterSelected, selectedCenterId } = storeToRefs(centerStore);

const loggedInUser = ref(null);
const showLoginModal = ref(false);
const showMenu = ref(false);
const showManagePositionsModal = ref(false);
const showManageQuestionsModal = ref(false);

const availablePositions = ref([]);
const filteredPositions = ref([]);
const availableQuestions = ref([]);
const filteredQuestions = ref([]);

const unsubscribePositions = ref(null);
const unsubscribeQuestions = ref(null);

// --- Computed Properties ---
const isSuperAdmin = computed(() => loggedInUser.value && loggedInUser.value.customClaims && loggedInUser.value.customClaims.role === 'superadmin');
const isCenterAdmin = computed(() => loggedInUser.value && loggedInUser.value.customClaims && loggedInUser.value.customClaims.role === 'center_admin');

// --- Watchers ---
watch(selectedCenterId, (newVal) => {
  if (newVal) {
    filterPositionsByCenter(newVal);
    filterQuestionsByCenter(newVal);
  } else {
    filterPositionsByCenter(isSuperAdmin.value ? 'all' : null);
    filterQuestionsByCenter(isSuperAdmin.value ? 'all' : null);
  }
});

watch(availablePositions, () => {
  filterPositionsByCenter(centerStore.selectedCenterId);
});

watch(availableQuestions, () => {
  filterQuestionsByCenter(centerStore.selectedCenterId);
});

// --- Methods (as standalone functions) ---
const openManagePositionsModal = () => {
  showManagePositionsModal.value = true;
  toggleMenu();
};
const closeManagePositionsModal = () => {
  showManagePositionsModal.value = false;
};
const openManageQuestionsModal = () => {
  showManageQuestionsModal.value = true;
  toggleMenu();
};
const closeManageQuestionsModal = () => {
  showManageQuestionsModal.value = false;
};

const setupAuthListener = () => {
  onAuthStateChanged(auth, async (user) => {
    loggedInUser.value = user;
    if (user) {
      console.log('App.vue: User logged in:', user.displayName || user.email);

      try {
        const idTokenResult = await user.getIdTokenResult(true);
        loggedInUser.value.customClaims = idTokenResult.claims;
        console.log('App.vue: User Custom Claims:', loggedInUser.value.customClaims);

        const isUserAdmin = isSuperAdmin.value || isCenterAdmin.value;

        if (isUserAdmin) {
          if (!router.currentRoute.value.path.startsWith('/admin')) {
            router.push('/admin/users');
          }
        } else {
          const userCenterIds = loggedInUser.value.customClaims.centerIds || [];
          if (userCenterIds.length === 1) {
            centerStore.selectedCenterId = userCenterIds[0];
          }
          if (router.currentRoute.value.path !== '/') {
            router.push('/');
          }
        }
      } catch (error) {
        console.error('App.vue: Error fetching ID token result:', error);
        logoutUser();
      }

      setupPositionsListener();
      setupQuestionsListener();
      showLoginModal.value = false;
      centerStore.initializeUserAccessibleCenters(user);
    } else {
      console.log('App.vue: User logged out.');
      loggedInUser.value = null;
      availablePositions.value = [];
      filteredPositions.value = [];
      availableQuestions.value = [];
      filteredQuestions.value = [];
      if (unsubscribePositions.value) {
        unsubscribePositions.value();
        unsubscribePositions.value = null;
      }
      if (unsubscribeQuestions.value) {
        unsubscribeQuestions.value();
        unsubscribeQuestions.value = null;
      }

      openLoginModal();
      if (router.currentRoute.value.meta && router.currentRoute.value.meta.requiresAuth) {
        router.push('/login');
      } else if (router.currentRoute.value.path.startsWith('/admin')) {
        router.push('/login');
      }
    }
  });
};

const openLoginModal = () => {
  showLoginModal.value = true;
  showMenu.value = false;
};
const handleLoginSuccess = () => {
  showLoginModal.value = false;
};
const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};
const logoutUser = async () => {
  try {
    await signOut(auth);
    alert('ログアウトしました！');
    showMenu.value = false;
    centerStore.clearCenterListener();
  } catch (error) {
    console.error('Error logging out:', error.message);
  }
};

const setupPositionsListener = () => {
  if (!loggedInUser.value || !loggedInUser.value.customClaims) {
    availablePositions.value = [];
    return;
  }

  if (unsubscribePositions.value) {
    unsubscribePositions.value();
  }

  const positionsCollectionRef = collection(db, 'positions');
  const q = query(positionsCollectionRef, orderBy('name'));

  unsubscribePositions.value = onSnapshot(
    q,
    (snapshot) => {
      availablePositions.value = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log('App.vue: Available positions fetched (all):', availablePositions.value.length);
    },
    (error) => {
      console.error('Error fetching available positions:', error);
    }
  );
};

const setupQuestionsListener = () => {
  if (!loggedInUser.value || !loggedInUser.value.customClaims) {
    availableQuestions.value = [];
    return;
  }
  if (unsubscribeQuestions.value) {
    unsubscribeQuestions.value();
  }

  const questionsCollectionRef = collection(db, 'questions');
  const q = query(questionsCollectionRef);

  unsubscribeQuestions.value = onSnapshot(
    q,
    (snapshot) => {
      availableQuestions.value = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log('App.vue: Available questions fetched (all):', availableQuestions.value.length);
    },
    (error) => {
      console.error('Error fetching available questions:', error);
    }
  );
};

const setInitialScale = (scale) => {
  document.body.style.zoom = scale;
};

const runDataMigration = async () => {
  if (!loggedInUser.value || !loggedInUser.value.customClaims || loggedInUser.value.customClaims.role !== 'superadmin') {
    alert('Error: You must be logged in as a super administrator to run this migration.');
    return;
  }

  const migrateData = httpsCallable(functions, 'migrateDataToCenters');
  const defaultCenterId = 'YOUR_ACTUAL_CENTER_DOCUMENT_ID_HERE';

  if (defaultCenterId === 'YOUR_ACTUAL_CENTER_DOCUMENT_ID_HERE' || !defaultCenterId) {
    alert('Error: Please replace "YOUR_ACTUAL_CENTER_DOCUMENT_ID_HERE" with a real Center Document ID from Firestore.');
    return;
  }

  if (!confirm(`Confirm migration? All existing un-centered data will be assigned to: ${defaultCenterId}`)) {
    return;
  }

  try {
    const result = await migrateData({ defaultCenterId: defaultCenterId });
    console.log('Data Migration successful:', result.data);
    alert('Data migration complete! Check your Firestore documents.');
  } catch (error) {
    console.error('Data Migration failed:', error);
    alert('Data migration failed: ' + error.message);
  }
};

const filterPositionsByCenter = (centerId) => {
  if (centerId && centerId !== 'all') {
    filteredPositions.value = availablePositions.value.filter((pos) => pos.centerId === centerId);
  } else {
    filteredPositions.value = [];
  }
  console.log('App.vue: Positions filtered by center:', centerId, filteredPositions.value.length);
};

const filterQuestionsByCenter = (centerId) => {
  if (centerId && centerId !== 'all') {
    filteredQuestions.value = availableQuestions.value.filter((q) => q.centerId === centerId);
  } else {
    filteredQuestions.value = [];
  }
  console.log('App.vue: Questions filtered by center:', centerId, filteredQuestions.value.length);
};

// --- Lifecycle Hooks ---
onMounted(() => {
  setupAuthListener();
});

onBeforeUnmount(() => {
  if (unsubscribePositions.value) {
    unsubscribePositions.value();
  }
  if (unsubscribeQuestions.value) {
    unsubscribeQuestions.value();
  }
});
</script>

<style>
/* ------------------------------------- NEW HEADER CSS ------------------------------------- */

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background-color: #282c34;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between; /* This distributes space, pushing items to the edges */
  align-items: center;
  padding: 10px 20px;
  height: 60px;
}

.logo {
  flex-shrink: 0; /* Prevents the logo from shrinking */
  margin-right: auto; /* Pushes the logo to the left and creates a gap to the right */
}

.header-center-filter {
  /* This combination of margins is the most reliable way to center a flex item */
  margin: 0 auto; 
}

/* This container ensures the auth info and menu toggle are grouped together on the right */
.header-right-group {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto; /* Pushes this group to the far right */
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
/* ------------------------------------- END NEW HEADER CSS ------------------------------------- */

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

/* Adjust container margin for router-view content */
.container {
  margin-top: 60px;
  padding: 10px;
}

.error-message {
  color: #dc3545;
  margin-top: 15px;
  font-size: 0.9em;
}

/* Side menu styles */
/* Menu Toggle Button */
.menu-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.menu-toggle-btn:hover {
  opacity: 0.8;
}

.menu-icon {
  width: 28px;
  height: 28px;
}

/* Side Menu Overlay */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 999;
  transition: opacity 0.3s ease;
}

/* Side Navigation Menu */
.side-menu {
  position: fixed;
  top: 0;
  left: -250px;
  width: 250px;
  height: 100%;
  background-color: #2c3e50;
  color: white;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.3);
  transition: left 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.side-menu.is-open {
  left: 0;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #22303e;
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
  flex-grow: 1;
}

.menu-list li a {
  display: block;
  padding: 15px;
  color: white;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.menu-list li a:hover {
  background-color: #34495e;
}
</style>