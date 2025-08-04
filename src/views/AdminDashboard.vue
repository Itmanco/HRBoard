<template>
  <div class="admin-dashboard">
    <h1>管理者ダッシュボード</h1>
    <nav class="admin-nav">
      <ul>
        <li><router-link to="/admin/users">ユーザー管理</router-link></li>
        <li><router-link to="/admin/centers">センター管理</router-link></li>
      </ul>
    </nav>
    <router-view /> </div>
</template>

<script>
import { getAuth } from 'firebase/auth';
import { useRouter } from 'vue-router';
// Import necessary Firebase functions if needed directly here,
// or use a dedicated Firebase service module.

export default {
  name: 'AdminDashboard',
  setup() {
    const auth = getAuth();
    const router = useRouter();

    // You might want to display the logged-in super admin's name
    // const user = auth.currentUser;
    // const displayName = user ? user.displayName : 'Admin';

    return {
      // displayName
    };
  },
};
</script>

<style scoped>
.admin-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.admin-nav ul {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.admin-nav ul li a {
  text-decoration: none;
  color: #333;
  font-weight: bold;
}
.admin-nav ul li a.router-link-active {
  color: #007bff;
}
</style>
