require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'events.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Data helpers ---
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { events: [], categories: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Events CRUD ---
app.get('/api/events', (req, res) => {
  const { status, type, search } = req.query;
  let { events } = readData();
  if (status) events = events.filter(e => e.status === status);
  if (type) events = events.filter(e => e.type === type);
  if (search) {
    const q = search.toLowerCase();
    events = events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      (e.laboratory || '').toLowerCase().includes(q)
    );
  }
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(events);
});

app.get('/api/events/:id', (req, res) => {
  const { events } = readData();
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
  res.json(event);
});

app.post('/api/events', (req, res) => {
  const data = readData();
  const event = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'planifié',
    participants: 0,
    budget: 0,
    documents: [],
    tags: [],
    ...req.body
  };
  data.events.push(event);
  writeData(data);
  res.status(201).json(event);
});

app.put('/api/events/:id', (req, res) => {
  const data = readData();
  const idx = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Événement non trouvé' });
  data.events[idx] = { ...data.events[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeData(data);
  res.json(data.events[idx]);
});

app.delete('/api/events/:id', (req, res) => {
  const data = readData();
  const idx = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Événement non trouvé' });
  data.events.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
  const { events } = readData();
  const now = new Date();
  const stats = {
    total: events.length,
    planifié: events.filter(e => e.status === 'planifié').length,
    'en cours': events.filter(e => e.status === 'en cours').length,
    terminé: events.filter(e => e.status === 'terminé').length,
    annulé: events.filter(e => e.status === 'annulé').length,
    totalParticipants: events.reduce((s, e) => s + (Number(e.participants) || 0), 0),
    totalBudget: events.reduce((s, e) => s + (Number(e.budget) || 0), 0),
    upcoming: events.filter(e => new Date(e.date) > now && e.status !== 'annulé').length,
    byType: events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {}),
    byDomain: events.reduce((acc, e) => {
      (e.domains || []).forEach(d => { acc[d] = (acc[d] || 0) + 1; });
      return acc;
    }, {})
  };
  res.json(stats);
});

// --- IA : chat assistant ---
app.post('/api/ai/chat', async (req, res) => {
  const { messages, context } = req.body;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Clé API OpenAI non configurée. Veuillez créer un fichier .env avec OPENAI_API_KEY.' });
  }
  try {
    const systemPrompt = `Tu es CyberValo, un assistant expert en valorisation de la recherche universitaire, spécialisé pour l'Université Paris 8 Vincennes-Saint-Denis.
Tu aides à piloter les événements de valorisation de la recherche : conférences, séminaires, journées d'étude, expositions, workshops, colloques, etc.
Tu connais les processus universitaires, les laboratoires de recherche, les appels à projets (ANR, H2020, etc.) et les enjeux de diffusion scientifique.
${context ? `\nContexte actuel des événements : ${JSON.stringify(context)}` : ''}
Réponds en français, de manière précise, professionnelle et bienveillante.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- IA : génération de description ---
app.post('/api/ai/generate-description', async (req, res) => {
  const { title, type, domains, objectives } = req.body;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Clé API OpenAI non configurée.' });
  }
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Rédige une description professionnelle et engageante (3-4 paragraphes) pour un événement de valorisation de la recherche à l'Université Paris 8 avec les informations suivantes :
- Titre : ${title}
- Type : ${type}
- Domaines de recherche : ${(domains || []).join(', ') || 'non précisé'}
- Objectifs : ${objectives || 'non précisé'}
La description doit être adaptée à une communication universitaire, mettre en valeur l'intérêt scientifique et sociétal, et inciter à la participation.`
      }],
      temperature: 0.8,
      max_tokens: 600
    });
    res.json({ description: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- IA : rapport de bilan ---
app.post('/api/ai/generate-report', async (req, res) => {
  const { eventId } = req.body;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Clé API OpenAI non configurée.' });
  }
  const { events } = readData();
  const event = events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Rédige un rapport de bilan structuré pour cet événement de valorisation de la recherche à l'Université Paris 8 :
${JSON.stringify(event, null, 2)}
Le rapport doit inclure : résumé exécutif, déroulement, bilan des participants, impact scientifique et sociétal, points positifs, axes d'amélioration, recommandations pour les prochaines éditions. Rédige en français, format professionnel.`
      }],
      temperature: 0.6,
      max_tokens: 1200
    });
    res.json({ report: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- IA : suggestions ---
app.post('/api/ai/suggest', async (req, res) => {
  const { prompt } = req.body;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Clé API OpenAI non configurée.' });
  }
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: "Tu es un expert en valorisation de la recherche universitaire à Paris 8. Fournis des suggestions concrètes et actionnables en JSON."
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 800
    });
    res.json({ suggestion: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CyberValoEvents démarré sur http://localhost:${PORT}`);
});
