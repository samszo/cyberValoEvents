// Client OpenAI — appels directs depuis le navigateur
import { getApiKey } from './storage.js';

// Toutes les requêtes passent par proxy.php pour éviter le CORS.
const PROXY = 'proxy.php';
const apiUrl = 'https://albert.api.etalab.gouv.fr/v1/';// path => `${PROXY}?path=${path}`;
const MODEL = 'gpt-4o-mini';

async function complete(messages, { temperature = 0.7, max_tokens = 1200 } = {}) {
  const key = getApiKey();
  if (!key) throw new Error('Clé API non configurée. Cliquez sur "Clé API" pour la renseigner.');

  const res = await fetch(apiUrl('chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur OpenAI (${res.status})`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

const SYSTEM_BASE = `Tu es CyberValo, un assistant expert en valorisation de la recherche universitaire pour l'Université Paris 8 Vincennes-Saint-Denis.
Tu aides à piloter les événements scientifiques : colloques, séminaires, workshops, journées d'étude, expositions, etc.
Tu connais les dispositifs de financement (ANR, H2020/Horizon Europe, Région Île-de-France, MSH Paris Nord), les processus universitaires et les enjeux de diffusion scientifique.
Réponds en français, de manière précise, professionnelle et bienveillante.`;

export async function getModels() {
  const key = getApiKey();
  const response = await fetch(apiUrl+'models', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
  });

  const data = await response.json();
  return data;
  
}


export async function chat(messages, statsContext = null) {
  const systemContent = SYSTEM_BASE + (statsContext
    ? `\n\nContexte actuel des événements de Paris 8 :\n${JSON.stringify(statsContext, null, 2)}`
    : '');
  return complete([{ role: 'system', content: systemContent }, ...messages]);
}

export async function generateDescription({ title, type, domains = [], objectives = '' }) {
  return complete([{
    role: 'user',
    content: `Rédige une description professionnelle et engageante (3-4 paragraphes) pour un événement de valorisation de la recherche à l'Université Paris 8 :
- Titre : ${title}
- Type : ${type}
- Domaines : ${domains.join(', ') || 'non précisé'}
- Objectifs : ${objectives || 'non précisé'}
La description doit valoriser l'intérêt scientifique et sociétal, et inciter à la participation. Ton universitaire, clair et engageant.`
  }], { temperature: 0.8, max_tokens: 700 });
}

export async function generateReport(event) {
  return complete([{
    role: 'user',
    content: `Rédige un rapport de bilan structuré pour cet événement de valorisation de la recherche à l'Université Paris 8 :
${JSON.stringify(event, null, 2)}

Structure du rapport : résumé exécutif, déroulement, bilan quantitatif (participants, budget), impact scientifique et sociétal, points positifs, axes d'amélioration, recommandations pour les prochaines éditions.
Format professionnel, en français.`
  }], { temperature: 0.6, max_tokens: 1400 });
}

export async function suggestIdeas() {
  return complete([{
    role: 'user',
    content: `Propose 5 idées d'événements innovants de valorisation de la recherche adaptés à une université pluridisciplinaire comme Paris 8 (sciences humaines, arts, sciences sociales, numérique).
Pour chaque idée : titre, format, thématique, public cible, pistes de financement, impact attendu.`
  }], { temperature: 0.8, max_tokens: 1000 });
}
