exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { query } = event.queryStringParameters || {};
  if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query obrigatória' }) };

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
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Pesquise dados da equipe de futsal "${query}" no Brasil. Busque classificação atual, últimos 5 jogos e informações gerais. Retorne APENAS JSON puro sem markdown:
{
  "nome": "nome completo da equipe",
  "competicao": "competição atual",
  "classificacao": {
    "posicao": 0,
    "pontos": 0,
    "jogos": 0,
    "vitorias": 0,
    "empates": 0,
    "derrotas": 0,
    "golsPro": 0,
    "golsContra": 0
  },
  "forma": "VVDED",
  "ultimosJogos": [
    {"data": "", "adversario": "", "placar": "", "resultado": "V/E/D", "mandante": true}
  ],
  "observacoes": "informações relevantes sobre o momento da equipe"
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    
    let teamData = {};
    try { teamData = JSON.parse(clean); } catch(e) { teamData = { nome: query, observacoes: text }; }
    
    return { statusCode: 200, headers, body: JSON.stringify({ team: teamData }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
