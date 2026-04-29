// Module de persistance localStorage
const EVENTS_KEY = 'cve_events';
const API_KEY    = 'cve_albert_key';

export function loadEvents() {
  const raw = localStorage.getItem(EVENTS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export function getApiKey() {
  return localStorage.getItem(API_KEY) || '';
}

export function saveApiKey(key) {
  localStorage.setItem(API_KEY, key.trim());
}
