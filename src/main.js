// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router'; // Import your router
import { createPinia } from 'pinia'; // Import createPinia
import './firebaseConfig'; // Initialize Firebase
import './assets/main.css'; // Optional: keep or remove, App.vue includes styles
import { sanitizeAttribute, sanitizeText } from './utils/sanitizers.js';

const app = createApp(App);
const pinia = createPinia(); // Create a Pinia instance

app.use(router); // Use the router
app.use(pinia); // Use Pinia

// Register the utility methods globally under a single object
app.config.globalProperties.$sanitize = {
  attribute: sanitizeAttribute,
  text: sanitizeText
};

app.mount('#app');