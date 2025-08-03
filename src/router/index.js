// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from 'firebase/auth'; // Import Firebase Auth

// Import your main application components
import ApplicantList from '@/views/ApplicantList.vue'; // We'll create this next
import LoginModal from '@/components/LoginModal.vue'; // Your existing login modal

// Import your new admin components
import AdminDashboard from '@/views/AdminDashboard.vue';
import UserManagement from '@/views/UserManagement.vue';
import CenterManagement from '@/views/CenterManagement.vue';

const routes = [
  // Public route for login
  { path: '/login', name: 'Login', component: LoginModal },

  // Main application route (e.g., your applicant list)
  {
    path: '/',
    name: 'Home',
    component: ApplicantList, // This will be your main view
    meta: { requiresAuth: true }, // Requires authentication for all regular app pages
  },

  // Admin section routes
  {
    path: '/admin',
    name: 'Admin',
    component: AdminDashboard, // Layout component for admin pages
    meta: { requiresAuth: true, requiresRole: 'superadmin' }, // Only superadmins can access this path
    children: [
      {
        path: 'users', // /admin/users
        name: 'UserManagement',
        component: UserManagement,
        meta: { requiresAuth: true, requiresRole: 'superadmin' },
      },
      {
        path: 'centers', // /admin/centers
        name: 'CenterManagement',
        component: CenterManagement,
        meta: { requiresAuth: true, requiresRole: 'superadmin' },
      },
      // You can add more admin sub-routes here (e.g., /admin/positions, /admin/questions if they become full admin pages)
    ],
  },
  // Add a catch-all route for 404 (optional)
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundComponent },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation Guard for Authentication and Authorization
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const requiredRole = to.meta.requiresRole;
  const auth = getAuth(); // Get the Firebase Auth instance
  const currentUser = auth.currentUser;

  // 1. Check Authentication
  if (requiresAuth && !currentUser) {
    console.log('Router Guard: Not authenticated. Redirecting to login.');
    next({ name: 'Login' }); // Redirect to login page
    return;
  }

  // 2. Check Authorization (if authenticated and role is required)
  if (requiresAuth && currentUser) {
    try {
      // Force refresh of ID token to get the latest custom claims
      const idTokenResult = await currentUser.getIdTokenResult(true);
      const userRole = idTokenResult.claims.role;

      if (requiredRole && userRole !== requiredRole) {
        console.log(`Router Guard: Access denied. User role '${userRole}' is not '${requiredRole}'. Redirecting to home.`);
        next({ name: 'Home' }); // Redirect to home or an access-denied page
        return;
      }
    } catch (error) {
      console.error('Router Guard: Error fetching ID token result:', error);
      // If there's an error getting claims, assume not authorized or token is invalid
      next({ name: 'Login' }); // Force re-login
      return;
    }
  }

  // If all checks pass, proceed to the route
  next();
});

export default router;