exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chave da API não configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { matchData, team1Data, team2Data, arbData, planData } = body;

  const formatTeamStats = (teamData, teamName) => {
    if (!teamData) return `${teamName}: dados não disponíveis`;
    let text = '';
    if (teamData.standings) {
      const s = teamData.standings;
      text += `Classificação: ${s.position}º lugar — ${s.points} pts (${s.played} jogos: ${s.wins}V ${s.draws}E ${s.losses}D) | Gols: ${s.goalsFor} marcados, ${s.goalsAgainst} sofridos\n`;
    }
    if (teamData.summary?.form) {
      text += `Forma recente (últimos 5): ${teamData.summary.form} | ${teamData.summary.wins}V ${teamData.summary.draws}E ${teamData.summary.losses}D\n`;
    }
    if (teamData.recentGames?.length) {
      text += `Últimos jogos:\n`;
      teamData.recentGames.forEach(g => {
        text += `  ${g.date} — ${g.home ? 'Casa' : 'Fora'} vs ${g.opponent}: ${g.score} (${g.result}) [${g.tournament}]\n`;
      });
    }
    return text || `${teamName}: sem dados estatísticos disponíveis`;
  };

  const prompt = `Você é um especialista em arbitragem de futsal com foco em preparação pré-jogo. Com base nos dados abaixo, gere uma análise pré-jogo completa e objetiva para a equipe de arbitragem. Use linguagem direta, técnica e assertiva — como um documento profissional de preparação.

═══════════════════════════════
DADOS DA PARTIDA
═══════════════════════════════
Competição: ${matchData.comp}
Fase/Rodada: ${matchData.fase}
Data e hora: ${matchData.datahora}
Ginásio: ${matchData.ginasio} — ${matchData.cidade}
Mandante: ${matchData.mandante}
Visitante: ${matchData.visitante}
O que está em jogo: ${matchData.emjogo}
Contexto: ${matchData.contexto}

═══════════════════════════════
EQUIPE DE ARBITRAGEM
═══════════════════════════════
Árbitro 1: ${arbData.arb1}
Árbitro 2: ${arbData.arb2}
Anotador(a): ${arbData.anotador}
Cronometrista: ${arbData.crono}
${arbData.link ? `Link transmissão: ${arbData.link}` : ''}
Orientações logísticas: ${arbData.logistica}

═══════════════════════════════
DADOS ESTATÍSTICOS — ${matchData.mandante}
═══════════════════════════════
${formatTeamStats(team1Data, matchData.mandante)}
Perfil informado: ${arbData.t1perfil}
Ponto de atenção: ${arbData.t1alert}
Atleta/técnico a monitorar: ${arbData.t1player}

═══════════════════════════════
DADOS ESTATÍSTICOS — ${matchData.visitante}
═══════════════════════════════
${formatTeamStats(team2Data, matchData.visitante)}
Perfil informado: ${arbData.t2perfil}
Ponto de atenção: ${arbData.t2alert}
Atleta/técnico a monitorar: ${arbData.t2player}

═══════════════════════════════
PLANO DE ARBITRAGEM
═══════════════════════════════
Zonas de risco selecionadas: ${planData.riscos}
Momentos críticos — Início: ${planData.mcInicio}
Momentos críticos — Durante: ${planData.mcMeio}
Momentos críticos — Final: ${planData.mcFinal}
Objetivo da equipe: ${planData.objetivo}

═══════════════════════════════

Gere a análise nos seguintes blocos, usando os dados estatísticos para enriquecer o contexto:

1. CONTEXTO DA PARTIDA
Inclua o momento de cada equipe na competição (posição, forma recente, pressão por resultado) baseado nos dados estatísticos acima.

2. PERFIL — ${matchData.mandante}
Combine o perfil informado com os dados estatísticos. Destaque tendências de desempenho em casa, forma recente, pontos de atenção disciplinares.

3. PERFIL — ${matchData.visitante}
Mesmo formato do mandante.

4. PLANO DE ARBITRAGEM
Zonas de risco, momentos críticos com orientações específicas para cada fase do jogo. Use os dados para fundamentar os alertas.

5. ORIENTAÇÕES LOGÍSTICAS
Liste de forma objetiva o checklist pré-jogo.

6. FRASE-CHAVE
Uma frase curta e direta que resume o foco da equipe de arbitragem para este jogo.

Seja direto. Sem introduções genéricas. Cada bloco começa com o título em maiúsculas.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    return { statusCode: 200, headers, body: JSON.stringify({ analysis: text }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
