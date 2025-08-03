// src/stores/centerStore.js
import { defineStore } from 'pinia';
import { collection, query, orderBy, onSnapshot, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export const useCenterStore = defineStore('center', {
  state: () => ({
    selectedCenterId: 'all',
    userAccessibleCenters: [],
    allCentersMap: new Map(),
    unsubscribeCentersListener: null,
  }),
  getters: {
    showCenterFilter: (state) => {
      const hasAllOption = state.userAccessibleCenters.length > 0 && state.isSuperAdmin;
      const hasMultipleCenters = state.userAccessibleCenters.length > 1;
      return hasMultipleCenters || hasAllOption;
    },
    getCenterName: (state) => (centerId) => {
      return state.allCentersMap.get(centerId)?.name || '不明なセンター';
    },
    isSpecificCenterSelected: (state) => state.selectedCenterId !== 'all' && !!state.selectedCenterId,
    isSuperAdmin: (state) => {
      // Assuming a user with claims has been passed to initializeUserAccessibleCenters
      return state.userAccessibleCenters.length > 0 && state.userAccessibleCenters[0].role === 'superadmin';
    }
  },
  actions: {
    setSelectedCenterId(centerId) {
      this.selectedCenterId = centerId;
    },

    async initializeUserAccessibleCenters(loggedInUser) {
      if (this.unsubscribeCentersListener) {
        this.unsubscribeCentersListener();
        this.unsubscribeCentersListener = null;
      }

      if (!loggedInUser || !loggedInUser.customClaims) {
        this.userAccessibleCenters = [];
        this.allCentersMap = new Map();
        this.selectedCenterId = 'all';
        return;
      }

      const userCenterIdsInClaims = loggedInUser.customClaims.centerIds || [];
      const isSuperAdmin = loggedInUser.customClaims.role === 'superadmin';

      const centersCollectionRef = collection(db, 'centers');
      let q;

      if (isSuperAdmin) {
        q = query(centersCollectionRef, orderBy('name'));
      } else if (userCenterIdsInClaims.length > 0) {
        q = query(centersCollectionRef, where(documentId(), 'in', userCenterIdsInClaims));
      } else {
        this.userAccessibleCenters = [];
        this.allCentersMap = new Map();
        this.selectedCenterId = 'all';
        return;
      }

      this.unsubscribeCentersListener = onSnapshot(q, (snapshot) => {
        const centers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.userAccessibleCenters = centers;

        const newAllCentersMap = new Map();
        centers.forEach(center => newAllCentersMap.set(center.id, center));
        this.allCentersMap = newAllCentersMap;

        // --- CORRECTED LOGIC: Auto-select if only one center is available ---
        if (this.userAccessibleCenters.length === 1) {
          // Auto-select the unique center, regardless of user role
          this.selectedCenterId = this.userAccessibleCenters[0].id;
        } else if (isSuperAdmin) {
          // If superadmin and multiple centers, default to 'all'
          this.selectedCenterId = 'all';
        } else if (this.userAccessibleCenters.length > 1) {
          // If a center_admin has multiple centers, also default to 'all'
          this.selectedCenterId = 'all';
        } else {
            // No centers, reset to 'all' or default
            this.selectedCenterId = 'all';
        }
      }, (error) => {
        console.error("Error initializing accessible centers:", error);
        this.userAccessibleCenters = [];
        this.allCentersMap = new Map();
        this.selectedCenterId = 'all';
      });
    },

    clearCenterListener() {
      if (this.unsubscribeCentersListener) {
        this.unsubscribeCentersListener();
        this.unsubscribeCentersListener = null;
      }
      this.userAccessibleCenters = [];
      this.allCentersMap = new Map();
      this.selectedCenterId = 'all';
    },
  },
});