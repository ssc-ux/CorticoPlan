import { mount } from 'svelte';
import App from './App.svelte';
import '@fontsource-variable/plus-jakarta-sans';
import './app.css';

mount(App, { target: document.getElementById('app')! });

// Mode hors ligne (uniquement sur le site publié).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
