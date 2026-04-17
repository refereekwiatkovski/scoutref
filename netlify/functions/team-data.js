exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { teamName } = event.queryStringParameters || {};
  if (!teamName) return { statusCode: 400, headers, body: JSON.stringify({ error: 'teamName obrigatório' }) };

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chave não configurada' }) };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Pesquise informações completas sobre a equipe de futsal "${teamName}" no Brasil em 2026. Busque no site futsalparana.com.br, sofascore.com, e outras fontes. Retorne APENAS JSON puro sem markdown:
{
  "nome": "nome completo",
  "competicao": "competição atual",
  "standings": {
    "position": 0,
    "points": 0,
    "played": 0,
    "wins": 0,
    "draws": 0,
    "losses": 0,
    "goalsFor": 0,
    "goalsAgainst": 0,
    "tournament": "nome da competição"
  },
  "recentGames": [
    {"date": "dd/mm", "opponent": "nome", "score": "2 x 1", "result": "V", "home": true, "tournament": "competição"}
  ],
  "summary": {
    "form": "VVDED",
    "wins": 0,
    "draws": 0,
    "losses": 0,
    "totalGames": 5
  },
  "contexto": "resumo do momento atual da equipe, resultados recentes, destaques"
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let teamData = {};
    try { teamData = JSON.parse(clean); } catch(e) { teamData = { contexto: text }; }

    return { statusCode: 200, headers, body: JSON.stringify(teamData) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
