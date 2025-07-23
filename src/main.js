// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import './assets/main.css'; // Optional: keep or remove, App.vue includes styles

const app = createApp(App);
app.mount('#app');