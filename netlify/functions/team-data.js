exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { teamId } = event.queryStringParameters || {};
  if (!teamId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'teamId obrigatório' }) };
  }

  const sfHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.sofascore.com/'
  };

  try {
    const [eventsRes, standingsRes] = await Promise.allSettled([
      fetch(`https://www.sofascore.com/api/v1/team/${teamId}/events/last/0`, { headers: sfHeaders }),
      fetch(`https://www.sofascore.com/api/v1/team/${teamId}/standings`, { headers: sfHeaders })
    ]);

    let recentGames = [];
    if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
      const evData = await eventsRes.value.json();
      recentGames = (evData.events || []).slice(-5).map(e => {
        const isHome = e.homeTeam?.id == teamId;
        const myScore = isHome ? e.homeScore?.current : e.awayScore?.current;
        const oppScore = isHome ? e.awayScore?.current : e.homeScore?.current;
        const opponent = isHome ? e.awayTeam?.name : e.homeTeam?.name;
        let result = 'E';
        if (myScore > oppScore) result = 'V';
        if (myScore < oppScore) result = 'D';
        return {
          date: e.startTimestamp ? new Date(e.startTimestamp * 1000).toLocaleDateString('pt-BR') : '',
          opponent,
          score: `${myScore} x ${oppScore}`,
          result,
          home: isHome,
          tournament: e.tournament?.name || ''
        };
      });
    }

    let standings = null;
    if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
      const stData = await standingsRes.value.json();
      const allRows = stData.standings?.flatMap(s => s.rows || []) || [];
      const row = allRows.find(r => r.team?.id == teamId);
      if (row) {
        standings = {
          position: row.position,
          points: row.points,
          played: row.matches,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          goalsFor: row.scoresFor,
          goalsAgainst: row.scoresAgainst,
          tournament: stData.standings?.[0]?.tournament?.name || ''
        };
      }
    }

    const wins = recentGames.filter(g => g.result === 'V').length;
    const draws = recentGames.filter(g => g.result === 'E').length;
    const losses = recentGames.filter(g => g.result === 'D').length;
    const form = recentGames.map(g => g.result).join('');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        recentGames,
        standings,
        summary: { form, wins, draws, losses, totalGames: recentGames.length }
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
