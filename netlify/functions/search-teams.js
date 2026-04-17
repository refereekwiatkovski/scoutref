exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { query } = event.queryStringParameters || {};
  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query obrigatória' }) };
  }

  try {
    const response = await fetch(
      `https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(query)}&page=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com/'
        }
      }
    );

    if (!response.ok) throw new Error('SofaScore indisponível');
    const data = await response.json();

    const teams = (data.results || [])
      .filter(r => r.type === 'team')
      .slice(0, 8)
      .map(r => ({
        id: r.entity.id,
        name: r.entity.name,
        shortName: r.entity.shortName || r.entity.name,
        country: r.entity.country?.name || '',
        sport: r.entity.sport?.name || ''
      }))
      .filter(t => t.sport === 'Futsal' || t.sport === 'Football' || t.sport === '');

    return { statusCode: 200, headers, body: JSON.stringify({ teams }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
