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

  const { image, mediaType } = body;
  if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Imagem obrigatória' }) };

  const mt = mediaType || 'image/jpeg';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
            { type: 'text', text: `Esta imagem mostra uma tabela de classificação de futsal brasileiro. Leia todos os dados com atenção.

Extraia TODAS as linhas e retorne APENAS JSON puro sem markdown:

{"competicao":"nome se visível","tabela":[{"posicao":1,"equipe":"nome","pontos":0,"jogos":0,"vitorias":0,"empates":0,"derrotas":0,"golsPro":0,"golsContra":0}]}

Se não houver tabela: {"tabela":[],"erro":"tabela não encontrada"}` }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    let result = {};
    try { result = JSON.parse(clean); } catch(e) { result = { tabela: [], erro: 'Erro ao extrair', raw: text.substring(0,300) }; }
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
