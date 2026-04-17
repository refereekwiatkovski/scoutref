exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chave não configurada' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { mandante, visitante, competicao } = body;
  if (!mandante || !visitante) return { statusCode: 400, headers, body: JSON.stringify({ error: 'mandante e visitante obrigatórios' }) };

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
          content: `Pesquise informações sobre o confronto entre "${mandante}" e "${visitante}" no futsal brasileiro em 2026${competicao ? ` na ${competicao}` : ''}. Busque em futsalparana.com.br, sofascore.com, cbfs.com.br. Retorne APENAS JSON puro sem markdown:
{
  "classificacaoGeral": {
    "competicao": "nome da competição",
    "tabela": [
      {"posicao": 1, "equipe": "nome", "pontos": 0, "jogos": 0, "vitorias": 0, "empates": 0, "derrotas": 0, "golsPro": 0, "golsContra": 0}
    ]
  },
  "confrontoDireto": {
    "totalJogos": 0,
    "vitoriasMandante": 0,
    "vitoriasVisitante": 0,
    "empates": 0,
    "ultimosJogos": [
      {"data": "dd/mm/aaaa", "mandante": "nome", "placar": "2 x 1", "visitante": "nome", "competicao": "nome"}
    ],
    "resumo": "texto resumindo o histórico entre as equipes"
  },
  "contextoConfrontoAtual": "o que está em jogo neste confronto específico, importância para cada equipe na tabela"
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let matchData = {};
    try {
      matchData = JSON.parse(clean);
    } catch(e) {
      matchData = { contextoConfrontoAtual: text.substring(0, 500) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(matchData) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
