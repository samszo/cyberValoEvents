import { chat } from '../openai.js';
import { showToast } from '../utils.js';

const history = [];

export function initChat() {
  document.getElementById('chatSend').addEventListener('click', sendMessage);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.querySelectorAll('#quickActions button').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
  });
}

async function sendMessage(text) {
  const input = document.getElementById('chatInput');
  const msg = (text || input.value).trim();
  if (!msg) return;
  input.value = '';

  appendMessage('user', msg);
  history.push({ role: 'user', content: msg });

  const loader = appendLoader();
  try {
    // Pass minimal stats as context
    const statsEl = document.getElementById('statsRow');
    const stats = statsEl ? { summary: statsEl.innerText.replace(/\s+/g, ' ') } : null;
    const reply = await chat(history, stats);
    loader.remove();
    history.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);
  } catch (err) {
    loader.remove();
    appendMessage('assistant', `⚠️ ${err.message}`);
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.className = `d-flex gap-2 mb-3${isUser ? ' flex-row-reverse' : ''}`;
  div.innerHTML = `
    <div class="chat-avatar ${isUser ? 'bg-primary text-white' : 'bg-primary-subtle text-primary'}">
      ${isUser ? 'Vous' : '⚡'}
    </div>
    <div class="chat-bubble ${isUser ? 'user-bubble' : 'bg-light border'} rounded-3 p-3 small">
      ${text.replace(/\n/g, '<br>')}
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendLoader() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'd-flex gap-2 mb-3';
  div.innerHTML = `
    <div class="chat-avatar bg-primary-subtle text-primary">⚡</div>
    <div class="chat-bubble bg-light border rounded-3 p-3 small">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}
