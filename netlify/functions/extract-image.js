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

  const { image, type } = body;
  if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Imagem obrigatória' }) };

  const prompt = type === 'classificacao'
    ? `Analise esta imagem de uma tabela de classificação de futsal. Extraia todos os dados da tabela e retorne APENAS JSON puro sem markdown:
{
  "competicao": "nome da competição",
  "tabela": [
    {"posicao": 1, "equipe": "nome", "pontos": 0, "jogos": 0, "vitorias": 0, "empates": 0, "derrotas": 0, "golsPro": 0, "golsContra": 0}
  ]
}`
    : `Analise esta imagem esportiva e extraia os dados visíveis. Retorne APENAS JSON puro sem markdown com os dados encontrados.`;

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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let result = {};
    try { result = JSON.parse(clean); } catch(e) { result = { raw: text }; }

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
