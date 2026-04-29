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

const openai = new OpenAI({base_url:"https://albert.api.etalab.gouv.fr/v1", apiKey: process.env.OPENAI_API_KEY });
const openai = client = OpenAI(
    base_url="https://albert.api.etalab.gouv.fr/v1",
    api_key=os.environ["ALBERT_API_KEY"],
)

// --- Helpers ---

function readEvents() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
}

// --- Routes CRUD Événements ---

app.get('/api/events', (req, res) => {
  const events = readEvents();
  const { search, type, annee } = req.query;
  let result = events;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(e =>
      e.titre?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.chercheur?.toLowerCase().includes(q) ||
      e.laboratoire?.toLowerCase().includes(q)
    );
  }
  if (type) result = result.filter(e => e.type === type);
  if (annee) result = result.filter(e => e.date?.startsWith(annee));

  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(result);
});

app.get('/api/events/:id', (req, res) => {
  const events = readEvents();
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
  res.json(event);
});

app.post('/api/events', (req, res) => {
  const events = readEvents();
  const event = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  events.push(event);
  writeEvents(events);
  res.status(201).json(event);
});

app.put('/api/events/:id', (req, res) => {
  const events = readEvents();
  const idx = events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Événement non trouvé' });
  events[idx] = { ...events[idx], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  writeEvents(events);
  res.json(events[idx]);
});

app.delete('/api/events/:id', (req, res) => {
  const events = readEvents();
  const idx = events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Événement non trouvé' });
  events.splice(idx, 1);
  writeEvents(events);
  res.json({ success: true });
});

// --- Routes IA (OpenAI) ---

app.post('/api/ai/generate-description', async (req, res) => {
  const { titre, type, chercheur, laboratoire, date, mots_cles } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant spécialisé dans la valorisation de la recherche académique à l'Université Paris 8.
Tu aides à rédiger des descriptions professionnelles et valorisantes pour des événements de recherche.
Réponds toujours en français. Sois concis (3-5 phrases) mais percutant.`
        },
        {
          role: 'user',
          content: `Rédige une description professionnelle pour cet événement de valorisation :
- Titre : ${titre}
- Type : ${type}
- Chercheur(s) : ${chercheur}
- Laboratoire : ${laboratoire}
- Date : ${date}
- Mots-clés : ${mots_cles || 'non spécifiés'}

Mets en valeur l'impact scientifique et sociétal de cet événement.`
        }
      ],
      max_tokens: 400
    });
    res.json({ description: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/suggest-tags', async (req, res) => {
  const { titre, description, type } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en classification de la recherche académique.
Génère des mots-clés pertinents pour des événements de valorisation scientifique.
Réponds uniquement avec une liste JSON de mots-clés, sans explication.`
        },
        {
          role: 'user',
          content: `Suggère 6 à 8 mots-clés pour cet événement :
- Titre : ${titre}
- Type : ${type}
- Description : ${description || 'non disponible'}

Réponds avec un tableau JSON de strings, exemple: ["mot1", "mot2", ...]`
        }
      ],
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });
    const content = JSON.parse(completion.choices[0].message.content);
    const tags = content.tags || content.mots_cles || content.keywords || Object.values(content)[0];
    res.json({ tags: Array.isArray(tags) ? tags : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/generate-report', async (req, res) => {
  const { events, periode, format } = req.body;
  if (!events || events.length === 0) {
    return res.status(400).json({ error: 'Aucun événement à synthétiser' });
  }
  const eventsSummary = events.map(e =>
    `- [${e.type}] ${e.titre} (${e.chercheur}, ${e.laboratoire}, ${e.date})`
  ).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en valorisation de la recherche à l'Université Paris 8.
Tu rédiges des rapports de synthèse professionnels sur les activités de valorisation des chercheurs.
Réponds en français avec un style académique et institutionnel.`
        },
        {
          role: 'user',
          content: `Rédige un rapport de synthèse ${format === 'court' ? 'concis (1 page)' : 'détaillé (2-3 pages)'} sur les activités de valorisation pour la période : ${periode}.

Événements à synthétiser :
${eventsSummary}

Structure le rapport avec : Introduction, Bilan par type d'activité, Points forts, Perspectives.`
        }
      ],
      max_tokens: format === 'court' ? 600 : 1200
    });
    res.json({ rapport: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { messages, context } = req.body;
  try {
    const systemMessage = {
      role: 'system',
      content: `Tu es CyberValo, l'assistant IA de l'application de gestion des événements de valorisation des chercheurs de l'Université Paris 8.
Tu aides les utilisateurs à :
- Comprendre et documenter leurs activités de valorisation
- Rédiger des descriptions et résumés professionnels
- Analyser les tendances de valorisation
- Préparer des rapports institutionnels
- Identifier les types d'événements appropriés

Types d'événements gérés : Conférence, Séminaire, Publication, Brevet, Prix/Distinction, Contrat de recherche, Partenariat industriel, Exposition/Médiation, Création d'entreprise.

${context ? `Contexte actuel : ${context}` : ''}

Réponds toujours en français de manière professionnelle et bienveillante.`
    };
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...messages],
      max_tokens: 600
    });
    res.json({ message: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
  const events = readEvents();
  const stats = {
    total: events.length,
    par_type: {},
    par_annee: {},
    par_laboratoire: {}
  };
  events.forEach(e => {
    stats.par_type[e.type] = (stats.par_type[e.type] || 0) + 1;
    const annee = e.date?.substring(0, 4);
    if (annee) stats.par_annee[annee] = (stats.par_annee[annee] || 0) + 1;
    if (e.laboratoire) stats.par_laboratoire[e.laboratoire] = (stats.par_laboratoire[e.laboratoire] || 0) + 1;
  });
  res.json(stats);
});

// --- Stats ---

app.get('/api/models', (req, res) => {
  const events = readEvents();
  const stats = {
    total: events.length,
    par_type: {},
    par_annee: {},
    par_laboratoire: {}
  };
  events.forEach(e => {
    stats.par_type[e.type] = (stats.par_type[e.type] || 0) + 1;
    const annee = e.date?.substring(0, 4);
    if (annee) stats.par_annee[annee] = (stats.par_annee[annee] || 0) + 1;
    if (e.laboratoire) stats.par_laboratoire[e.laboratoire] = (stats.par_laboratoire[e.laboratoire] || 0) + 1;
  });
  res.json(stats);
});

models = client.models.list()

app.listen(PORT, () => {
  console.log(`\n🎓 CyberValoEvents - Université Paris 8`);
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}\n`);
});
