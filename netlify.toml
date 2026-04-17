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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Pesquise dados completos da equipe de futsal "${teamName}" no Brasil em 2026. Busque em futsalparana.com.br, sofascore.com, cbfs.com.br e outras fontes esportivas. Retorne APENAS JSON puro sem markdown, sem texto antes ou depois:
{
  "nome": "nome completo da equipe",
  "competicao": "competição atual em 2026",
  "classificacao": {
    "posicao": 0,
    "pontos": 0,
    "jogos": 0,
    "vitorias": 0,
    "empates": 0,
    "derrotas": 0,
    "golsPro": 0,
    "golsContra": 0,
    "saldoGols": 0
  },
  "forma": "VVDED",
  "ultimosJogos": [
    {"data": "dd/mm", "adversario": "nome", "placar": "2 x 1", "resultado": "V", "mandante": true, "competicao": "nome"}
  ],
  "contexto": "resumo do momento atual: posição na tabela, sequência de resultados, destaques, pressão ou confiança da equipe"
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let teamData = {};
    try {
      teamData = JSON.parse(clean);
    } catch(e) {
      teamData = { nome: teamName, contexto: text.substring(0, 500) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(teamData) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
