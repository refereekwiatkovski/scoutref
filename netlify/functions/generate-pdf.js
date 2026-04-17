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

  const { matchData, arbData, team1Data, team2Data, planData, matchContext } = body;

  const formatMatchContext = (ctx) => {
    if (!ctx) return '';
    let t = '';
    if (ctx.classificacaoGeral?.tabela?.length) {
      t += `Classificação (${ctx.classificacaoGeral.competicao || ''}):\n`;
      ctx.classificacaoGeral.tabela.slice(0, 8).forEach(r => {
        t += `  ${r.posicao}º ${r.equipe} — ${r.pontos}pts (${r.vitorias}V ${r.empates}E ${r.derrotas}D)\n`;
      });
    }
    if (ctx.confrontoDireto) {
      const c = ctx.confrontoDireto;
      t += `\nConfrontos diretos: ${c.totalJogos || 0} jogos — ${c.vitoriasMandante||0}V ${c.empates||0}E ${c.vitoriasVisitante||0}D\n`;
      if (c.resumo) t += c.resumo + '\n';
    }
    if (ctx.contextoConfrontoAtual) t += '\n' + ctx.contextoConfrontoAtual;
    return t;
  };

  const formatStats = (data, name) => {
    if (!data) return `${name}: sem dados estatísticos`;
    let t = '';
    if (data.standings) {
      const s = data.standings;
      t += `${s.position}º lugar — ${s.points}pts (${s.played}J: ${s.wins}V ${s.draws}E ${s.losses}D) | Gols: ${s.goalsFor} marcados, ${s.goalsAgainst} sofridos\n`;
    }
    if (data.summary?.form) t += `Forma recente: ${data.summary.form}\n`;
    if (data.recentGames?.length) {
      t += `Últimos jogos:\n`;
      data.recentGames.forEach(g => { t += `  ${g.date} ${g.home ? 'Casa' : 'Fora'} vs ${g.opponent}: ${g.score} (${g.result})\n`; });
    }
    return t || `${name}: sem dados`;
  };

  const prompt = `Você é um especialista em arbitragem de futsal. Gere uma análise pré-jogo completa e profissional para a equipe de arbitragem. Use linguagem direta, técnica e assertiva.

PARTIDA:
Competição: ${matchData.comp}
Fase/Rodada: ${matchData.fase}
Data: ${matchData.datahora} | Ginásio: ${matchData.ginasio} — ${matchData.cidade}
Mandante: ${matchData.mandante} | Visitante: ${matchData.visitante}
Contexto: ${matchData.contexto}
O que está em jogo: ${matchData.emjogo}
Intensidade emocional: ${matchData.intensidade}
Torcida: ${matchData.torcida}
Nível técnico: ${matchData.nivel}

ARBITRAGEM:
Árbitro 1: ${arbData.arb1} | Árbitro 2: ${arbData.arb2}
Anotador(a): ${arbData.anotador} | Cronometrista: ${arbData.crono}
Orientações: ${arbData.logistica}

CONTEXTO DO CONFRONTO:
${formatMatchContext(matchContext)}

MANDANTE — ${matchData.mandante}:
Classificação: ${arbData.t1class || 'não informada'}
Últimos jogos: ${arbData.t1jogos || 'não informados'}
Perfil tático: ${arbData.t1tatico}
Comportamento: ${arbData.t1comportamento}
Pontos de atenção: ${arbData.t1atencao}
Atleta/técnico a monitorar: ${arbData.t1player}

VISITANTE — ${matchData.visitante}:
Classificação: ${arbData.t2class || 'não informada'}
Últimos jogos: ${arbData.t2jogos || 'não informados'}
Perfil tático: ${arbData.t2tatico}
Comportamento: ${arbData.t2comportamento}
Pontos de atenção: ${arbData.t2atencao}
Atleta/técnico a monitorar: ${arbData.t2player}

CONFRONTO DIRETO:
${arbData.confronto || 'não informado'}

PLANO:
Zonas de risco: ${planData.riscos}
Pontos de atenção específicos: ${planData.atencaoEspecifica}
Início: ${planData.mcInicio}
Durante: ${planData.mcMeio}
Final: ${planData.mcFinal}
Objetivo: ${planData.objetivo}

Gere nos seguintes blocos EXATOS (use esses títulos):
1. CONTEXTO DA PARTIDA
2. PERFIL — ${matchData.mandante}
3. PERFIL — ${matchData.visitante}
4. PLANO DE ARBITRAGEM
5. ORIENTAÇÕES LOGÍSTICAS
6. FRASE-CHAVE

Cada bloco deve ser objetivo, direto e com no máximo 5-6 linhas. Sem introduções. Sem enrolação.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const analysis = data.content?.map(b => b.text || '').join('') || '';
    return { statusCode: 200, headers, body: JSON.stringify({ analysis }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
