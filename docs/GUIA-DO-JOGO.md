# Prancheta FC — Guia completo do jogo

> Documento de referência do jogo como ele está hoje (motor v1, carreira v2).
> Todos os números abaixo saem do código. Quando uma regra mudar, atualize este guia junto.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Planos e acesso](#2-planos-e-acesso)
3. [O mundo do jogo](#3-o-mundo-do-jogo)
4. [Jogadores](#4-jogadores)
5. [Carreira: formato da temporada](#5-carreira-formato-da-temporada)
6. [Tática e escalação](#6-tática-e-escalação)
7. [A partida](#7-a-partida)
8. [Regras disciplinares, lesões, físico e moral](#8-regras-disciplinares-lesões-físico-e-moral)
9. [Classificação e critérios de desempate](#9-classificação-e-critérios-de-desempate)
10. [Copa nacional](#10-copa-nacional)
11. [Acesso e rebaixamento](#11-acesso-e-rebaixamento)
12. [Finanças](#12-finanças)
13. [Valores de mercado e salários](#13-valores-de-mercado-e-salários)
14. [Mercado de transferências](#14-mercado-de-transferências)
15. [Categorias de base](#15-categorias-de-base)
16. [Fim de temporada e evolução](#16-fim-de-temporada-e-evolução)
17. [Liga com amigos (multiplayer)](#17-liga-com-amigos-multiplayer)
18. [Telas do jogo](#18-telas-do-jogo)
19. [Narração e olheiro](#19-narração-e-olheiro)
20. [Limites e o que ainda não existe](#20-limites-e-o-que-ainda-não-existe)
21. [Referência técnica](#21-referência-técnica)

---

## 1. Visão geral

**Prancheta FC** é um manager de futebol para navegador, no estilo Brasfoot. O jogador escolhe um clube, monta elenco e tática e disputa temporadas completas com liga, copa nacional, mercado, finanças e base. Também dá para jogar com amigos na mesma liga.

- **Tudo é fictício.** Ligas, países, clubes, cidades, estádios e jogadores são gerados por código. Os escudos são SVG procedurais. Uma lista de bloqueio impede nomes de jogadores famosos (`src/data/leagues.ts`).
- **Mobile-first**, com tema escuro. No celular a navegação fica numa barra inferior com o botão **Jogar** no centro.
- **Partidas determinísticas.** A mesma entrada (escalações, tática e semente) gera sempre o mesmo jogo. Por isso os replays são recalculados e não precisam ser gravados.
- **Visualização da partida em 3D** (câmera de estádio com bonecos low-poly) **ou 2D** (transmissão vista de cima). A escolha fica salva no navegador.

### O ciclo do jogo

```
Criar carreira → Ajustar elenco/tática → Jogar o dia (liga ou copa)
      ↑                                              ↓
Nova temporada ← Fim de temporada ← Notícias, tabela, finanças, mercado, base
```

---

## 2. Planos e acesso

| | **Grátis** | **Premium — R$ 19,90/mês** |
|---|---|---|
| Ligas para treinar um clube | Pindorama — Acesso e Deserto Dourado | Todas as 8 |
| Carreiras salvas | até 3 | até 3 |
| Mercado (comprar de qualquer liga) | sim | sim |
| Liga com amigos | sim, em ligas grátis | sim, em todas |

Regras:
- O acesso é sempre verificado **no servidor**. O plano é lido do banco, nunca do token de login.
- Quem cai do Premium para o Grátis fica com as carreiras premium **travadas** até assinar de novo. Nada é apagado.
- Se o seu clube for promovido de Pindorama — Acesso para a **Elite** (que é premium), a carreira passa a exigir Premium.
- Na liga com amigos, **cada técnico** precisa ter acesso à liga do próprio clube.
- O pagamento é pelo Stripe, hoje em **modo de teste** (cartão `4242 4242 4242 4242`, qualquer validade futura e CVC). Um webhook atualiza o plano do usuário.

Login: e-mail e senha, ou Google (o botão só aparece quando o Google OAuth está configurado).

---

## 3. O mundo do jogo

### 3.1 Ligas

São 8 ligas, 154 clubes e cerca de 3.850 jogadores. O **nível** é o "geral" médio aproximado dos titulares.

| Liga | País | Inspiração | Nível | Clubes | Plano | Estrangeiros |
|---|---|---|---|---|---|---|
| Liga Pindorama — Elite | Pindorama 🟩 | Brasil, 1ª divisão | 72 | 20 | Premium | 8% |
| Liga Pindorama — Acesso | Pindorama 🟩 | Brasil, 2ª divisão | 64 | 20 | **Grátis** | 4% |
| Liga Albion | Albion 🟥 | Inglaterra | 77 | 20 | Premium | 35% |
| Liga Hispânia | Hispânia 🟨 | Espanha | 76 | 20 | Premium | 25% |
| Lega Peninsulare | Peninsulare | Itália | 75 | 20 | Premium | 30% |
| Liga Teutônica | Teutônia | Alemanha | 74 | 18 | Premium | 28% |
| Liga Gália | Gália | França | 73 | 18 | Premium | 25% |
| Liga do Deserto Dourado | Deserto Dourado | Arábia Saudita | 67 | 18 | **Grátis** | 24% |

Cada país usa seu próprio banco de nomes (brasileiro, inglês, espanhol, italiano, alemão, francês, árabe…), e os estrangeiros vêm de outros bancos com pesos por liga.

### 3.2 Sistemas de liga (países)

Uma carreira acontece dentro de um **sistema**, ou seja, um país:

| Sistema | Divisões | Copa nacional | Acesso/rebaixamento |
|---|---|---|---|
| Pindorama | Elite + Acesso | Taça Pindorama | 4 sobem / 4 caem |
| Albion | 1 | Copa Albion | — |
| Hispânia | 1 | Copa Hispânia | — |
| Peninsulare | 1 | Coppa Peninsulare | — |
| Teutônia | 1 | Taça Teutônia | — |
| Gália | 1 | Copa Gália | — |
| Deserto Dourado | 1 | Taça do Deserto | — |

As duas divisões de Pindorama são simuladas juntas no mesmo calendário. O **mercado**, por outro lado, é mundial: todos os 154 clubes existem em toda carreira, com caixa e elenco próprios.

### 3.3 Clubes

Cada clube tem: nome, sigla, cidade, cores, escudo procedural, **força** (média do elenco) e, por carreira, **caixa**, **capacidade do estádio** e **nível da base**.

---

## 4. Jogadores

### 4.1 Posições

| Sigla | Posição |
|---|---|
| GOL | Goleiro |
| ZAG | Zagueiro |
| LAT | Lateral |
| VOL | Volante |
| MC | Meio-campo |
| MEI | Meia |
| PON | Ponta |
| ATA | Atacante |

Elenco gerado: 25 jogadores por clube (3 GOL, 4 ZAG, 4 LAT, 3 VOL, 3 MC, 2 MEI, 3 PON, 3 ATA).

### 4.2 Atributos técnicos e físicos (1–99)

Finalização, Passe, Drible, Cruzamento, Cabeceio, Desarme, Marcação, Posicionamento, Velocidade, Resistência, Força, Visão de jogo. Os goleiros têm ainda Reflexo, Saída do gol e Jogo com os pés.

### 4.3 Geral (overall)

O geral é uma média ponderada dos atributos que importam para a posição:

| Posição | Pesos |
|---|---|
| GOL | Reflexo 4, Posicionamento 3, Saída do gol 2, Jogo com os pés 1 |
| ZAG | Desarme 3, Marcação 3, Cabeceio 2, Força 2, Posicionamento 2, Velocidade 1, Passe 1 |
| LAT | Velocidade 3, Cruzamento 2, Desarme 2, Marcação 2, Resistência 2, Passe 1, Drible 1 |
| VOL | Desarme 3, Marcação 3, Passe 2, Posicionamento 2, Resistência 2, Força 1, Visão 1 |
| MC | Passe 3, Visão 2, Resistência 2, Desarme 1, Drible 1, Finalização 1, Posicionamento 1 |
| MEI | Passe 3, Visão 3, Drible 2, Finalização 2, Posicionamento 1 |
| PON | Velocidade 3, Drible 3, Cruzamento 2, Finalização 1, Passe 1 |
| ATA | Finalização 4, Posicionamento 2, Cabeceio 2, Velocidade 1, Força 1, Drible 1 |

### 4.4 Personalidade (traços, 1–99)

| Traço | Efeito no jogo |
|---|---|
| **Agressividade** | Mais faltas, amarelos e chance de vermelho direto |
| **Temperamento** | Cartão por reclamação; acima de 80, risco extra de vermelho |
| **Frieza** | Escolha e conversão de pênaltis (no jogo e na disputa) |
| **Liderança** | O maior líder em campo acima de 70 dá bônus ao time todo |
| **Disciplina tática** | Média do time: amplia o efeito da pressão, da marcação e da retranca |
| **Propensão a lesão** | Chance de lesão, com e sem contato |
| **Consistência** | Quanto menor, maior a variação de "forma do dia" do jogador em cada partida |

### 4.5 Arquétipos

Os jogadores nascem de arquétipos que puxam atributos e traços para um perfil:

Goleiro seguro · Goleiro de reflexos · Zagueiro xerife · Zagueiro técnico · Lateral apoiador · Lateral marcador · Volante cão de guarda · Volante construtor · Meia box-to-box · Meia criativo (camisa 10) · Ponta driblador · Centroavante finalizador · Centroavante pivô · Veterano experiente · Jovem promessa.

### 4.6 Outros dados

Idade, potencial (teto de evolução), número da camisa, nacionalidade, valor de mercado e salário (ver §13). Na carreira cada jogador também tem condição física, moral, cartões acumulados, suspensão, dias de lesão e estatísticas da temporada (jogos, gols, assistências, cartões, nota média).

---

## 5. Carreira: formato da temporada

### 5.1 Criar uma carreira

1. **Minhas carreiras → Nova carreira**: escolha a liga e o clube.
2. Opcional: marque **"Liga com amigos"** para gerar um código de convite (§17).
3. Limite: **3 carreiras** por usuário. Dá para excluir as antigas.

Ao criar, o jogo copia o mundo inteiro para a carreira (clubes, caixas, elencos, salários) e gera a primeira leva da base. Carreiras de antes da versão 2 aparecem como "versão antiga" e só podem ser excluídas.

### 5.2 Dias de jogo

A temporada é uma sequência de **dias de jogo**. Cada dia é uma **rodada da liga** ou uma **fase da copa**, e as fases da copa ficam espalhadas pelo calendário em intervalos regulares.

- Liga: pontos corridos, turno e returno (todos jogam contra todos, em casa e fora).
- Em cada dia, **todos** os jogos do sistema são simulados, inclusive os da outra divisão e os da copa.

| Sistema | Rodadas da liga | Fases da copa | Total de dias | Dias de copa |
|---|---|---|---|---|
| Pindorama | 38 | 6 | **44** | 6, 13, 19, 26, 32, 39 |
| Albion, Hispânia, Peninsulare | 38 | 5 | **43** | 7, 15, 22, 29, 37 |
| Teutônia, Gália, Deserto Dourado | 34 | 5 | **39** | 7, 13, 20, 27, 33 |

Se o seu time não joga num dia (eliminado da copa, ou com folga na 1ª fase), aparece **"Avançar o calendário"**.

### 5.3 Jogar o dia (carreira individual)

Na tela **Jogar**:
- **▶ Assistir partida**: abre o jogo em 3D/2D, com as mexidas ao vivo (§7.4).
- **⏩ Só o resultado**: simula na hora e mostra o placar.

Ao terminar o seu jogo, o restante do dia é processado: os outros jogos, a tabela, cartões, lesões, finanças, notícias e as propostas da IA.

---

## 6. Tática e escalação

### 6.1 Formações

`4-4-2` · `4-3-3` · `4-2-3-1` · `3-5-2` · `5-3-2`

Cada formação define 11 posições no campo, cada uma com um papel (GOL, ZAG, LAT…).

### 6.2 Instruções

| Instrução | Opções | Efeito |
|---|---|---|
| **Estilo** | Defensivo · Equilibrado · Ofensivo | Ofensivo: mais dribles, cruzamentos e chutes, mas a defesa fica mais exposta. Defensivo: mais passes seguros e uma "retranca" mais forte perto da área |
| **Pressão** | Baixa · Média · Alta | Pressão alta recupera mais bolas, mas faz mais faltas e cansa mais |
| **Marcação** | Zona · Individual | Individual dificulta a vida do atacante, mas aumenta as faltas |

O efeito de pressão, marcação e retranca é multiplicado pela **disciplina tática** média do time.

### 6.3 Escalação

- Na tela **Tática**, toque em dois jogadores para trocá-los. No computador também dá para arrastar.
- **Encaixe de posição**: um jogador na posição natural rende 100%; numa posição vizinha (ZAG↔VOL, LAT↔PON, VOL↔MC, MC↔MEI, MEI↔PON, MEI↔ATA, PON↔ATA, LAT↔ZAG) rende 88%; fora disso, 72%. Um jogador de linha no gol, ou um goleiro na linha, rende 30%.
- Suspensos e lesionados não entram. Se faltar alguém, a escalação é completada com o melhor disponível.
- Banco: até 9 reservas, com pelo menos um goleiro quando houver.
- Os clubes da IA escalam sozinhos o melhor time para a formação deles, levando em conta a condição física.

---

## 7. A partida

### 7.1 Estrutura

- O jogo é dividido em **ticks de 20 segundos** (3 por minuto).
- 45 minutos + **1 a 3 de acréscimo** no 1º tempo e 45 + **2 a 6** no 2º.
- Na velocidade 1x, uma partida dura cerca de 2 minutos reais. Também há 2x e 4x.

### 7.2 Como o motor decide os lances

A cada tick, o time com a bola escolhe um jogador conforme a **zona do campo** (5 faixas, da defesa ao ataque) e um defensor adversário o enfrenta. A ação (passe, drible, bola longa, cruzamento ou chute) é sorteada com pesos que dependem da zona, do estilo e dos atributos do jogador. O resultado compara os atributos **efetivos** dos dois.

O **valor efetivo** de um atributo leva em conta:
- o encaixe de posição (§6.3);
- a condição física (de 72% a 100% do atributo);
- a forma do dia (sorteada pela consistência);
- a moral média do time: `(moral − 50) / 12`;
- a liderança: bônus quando o maior líder em campo tem mais de 70;
- o **mando de campo**: +2,5;
- lesionado sem substituto: −15;
- inferioridade numérica: cerca de 3,5% por jogador a menos.

Outros eventos: faltas, cartões, pênaltis (frieza + finalização escolhem o batedor), faltas perigosas, escanteios, defesas do goleiro, bloqueios e chutes para fora.

A calibragem é verificada por um teste de 1.000 jogos: **≈2,44 gols por jogo, ≈3,6 amarelos, vermelho em ≈12% dos jogos e 46% de vitórias do mandante**.

### 7.3 Cansaço e substituições automáticas

- Cada tick em campo gasta fôlego, mais para quem tem pouca resistência e para times com pressão alta. O goleiro quase não cansa. No intervalo todos recuperam +4.
- **Máximo de 5 substituições.**
- Se um jogador se lesiona e ainda há troca disponível, entra o melhor reserva para a posição. Sem troca, ele continua em campo bem limitado.
- **Todos os times, inclusive o seu**, trocam sozinhos aos **60'** (1 jogador com condição < 80), **70'** (2 com < 77) e **80'** (2 com < 75). Também tiram o pendurado muito agressivo. Quem está perdendo aos 70' passa a jogar no ofensivo. Assistindo ao vivo, você pode se antecipar e fazer as suas trocas antes.
- Expulsão do goleiro: entra o reserva no lugar do jogador mais avançado. Sem reserva, um jogador de linha vai para o gol.

### 7.4 Assistindo e mexendo no time

- Controles: ▶/⏸, velocidade **1x / 2x / 4x** e **pular para o fim**. A câmera alterna entre 3D e 2D.
- No **intervalo** o jogo pausa e abre o painel **"Mexer no time"**. O mesmo painel pode ser aberto **a qualquer momento** pelo botão ⇄.
- No painel você faz substituições e muda formação, estilo, pressão e marcação.
- O jogo é **idêntico até o momento da mudança** e então segue com a nova configuração. Não dá para voltar no tempo: cada mudança precisa ser posterior à anterior.
- Se você sair, o jogo fica salvo e aparece **"▶ Retomar partida"**.

### 7.5 Notas dos jogadores

Todos começam com 6,0. Principais ajustes: gol +1,0 (+0,3 a mais para defensor), assistência +0,6, defesa do goleiro +0,25 a +0,45, chute bloqueado +0,12, desarmes e jogadas certas com pequenos bônus. Perdem nota: chance clara perdida −0,35, falta −0,1, amarelo −0,4, expulsão −1,5 e gol sofrido (goleiro −0,3, zagueiros e laterais −0,1). Goleiro, zagueiros e laterais que jogaram 60 minutos ou mais sem sofrer gol ganham +0,5. A nota afeta a moral e o valor de mercado.

### 7.6 Replays

Toda partida do seu clube pode ser revista em **Jogar → Replay do último jogo** ou em **Tabela → Jogos do dia → Ver replay**.

---

## 8. Regras disciplinares, lesões, físico e moral

Valem para **todos os clubes**, inclusive os da IA.

### 8.1 Cartões e suspensões

| Situação | Suspensão |
|---|---|
| 3 amarelos acumulados | 1 jogo (o contador volta a zero) |
| 2º amarelo no mesmo jogo | 1 jogo |
| Vermelho direto | 2 jogos |

- A suspensão só é cumprida num dia em que o **clube joga**. Ficar fora da copa não "queima" a suspensão.
- O pendurado (2 amarelos) aparece no painel em **Desfalques**.
- Quem já tem amarelo tende a se segurar, a menos que seja muito agressivo.
- Os cartões são zerados a cada temporada.

### 8.2 Lesões

- Duração sorteada: 60% leves (3–10 dias), 30% médias (11–30 dias) e 10% graves (31–90 dias).
- Cada dia de jogo vale **7 dias** de recuperação.
- A chance de lesão aumenta com a propensão a lesão e dobra (nas lesões sem contato) quando a condição física está abaixo de 50.

### 8.3 Condição física (0–100)

- Cai durante o jogo (§7.3).
- Entre um dia de jogo e outro recupera **14 + resistência/10**.
- Abaixo de 100 reduz o rendimento e entra no critério da escalação automática.

### 8.4 Moral (10–100)

| Evento | Moral |
|---|---|
| Vitória do clube | +4 |
| Empate | +0,5 |
| Derrota | −4 |
| Nota ≥ 7,5 na partida | +3 |
| Nota ≤ 5,5 na partida | −3 |
| Disponível, mas fora do jogo (elenco principal) | −1,5 |
| Tendência natural | Volta 8% em direção a 60 a cada dia |

A moral média do time em campo entra no valor efetivo de todos os atributos (§7.2).

---

## 9. Classificação e critérios de desempate

Vitória vale 3 pontos, empate 1 e derrota 0. Ordem de desempate:

1. Pontos
2. Vitórias
3. Saldo de gols
4. Gols marcados
5. Ordem fixa por clube (para nunca haver empate absoluto)

A tabela mostra também a forma nos últimos 5 jogos (V/E/D).

---

## 10. Copa nacional

- Participam **todos os clubes do país**, ou seja, as duas divisões em Pindorama (40 clubes).
- O mata-mata é em **jogo único**. Empate leva a **disputa de pênaltis**.
- A chave é completada até uma potência de 2: os **mais fortes entram direto na 2ª fase** (24 isentos em Pindorama, 12 nos países com 20 clubes e 14 nos de 18). Os demais jogam a 1ª fase em confrontos sorteados.
- Cada fase seguinte tem **novo sorteio** entre os classificados.
- Nomes das fases: … → Oitavas → Quartas → Semifinal → Final.
- **Pênaltis**: 5 cobranças para cada lado, encerrando antes se um time não puder mais alcançar o outro, e depois alternadas até alguém errar. A ordem dos batedores segue finalização + frieza. A chance de gol fica entre 45% e 92%, conforme o batedor (finalização e frieza) e o reflexo do goleiro.
- Prêmios por fase alcançada e para o campeão (§12).
- A tela **Copa** mostra a chave completa e os resultados.

---

## 11. Acesso e rebaixamento

Por enquanto só em **Pindorama**:
- Os **4 primeiros** da Acesso sobem para a Elite.
- Os **4 últimos** da Elite caem para a Acesso.
- A mudança vale na temporada seguinte. Notícias anunciam o "🎉 ACESSO CONQUISTADO!" ou o rebaixamento.
- Os outros países têm divisão única, sem rebaixamento.

---

## 12. Finanças

Cada clube tem um **caixa** próprio na carreira. As movimentações do seu clube aparecem no **extrato** da tela Finanças.

### 12.1 Receitas e despesas

| Item | Quando | Como é calculado |
|---|---|---|
| **Cota de TV** | Rodada de liga | 0,45 × unidade da liga |
| **Patrocínio** | Rodada de liga | 0,35 × unidade × reputação do clube |
| **Bilheteria** | Jogo em casa (liga ou copa) | Capacidade × ocupação × preço. A ocupação vai de 45% a 100%, conforme a fase recente e a reputação. Na copa, a bilheteria vale ×1,2 |
| **Folha salarial** | Rodada de liga | Soma dos salários mensais ÷ 4,33 (uma semana) |
| **Prêmio da liga** | Fim da temporada | De 5 (último) a 30 (campeão) unidades, proporcional à posição |
| **Prêmio da copa** | Ao ser eliminado | 1,5 unidade × fase alcançada; o campeão leva 15 unidades |
| **Transferências** | Compra/venda | Valor da negociação |
| **Base** | Investimento | Custo do upgrade (§15) |

A **unidade da liga** é aproximadamente a folha semanal de um clube médio. Ela cresce 17% a cada ponto de nível da liga: `unidade = 62.500 × 1,17^(nível − 64)`.

A **reputação** depende da força do clube em relação à média da liga: clubes maiores atraem mais patrocínio e público.

### 12.2 Números de referência (clube médio de cada liga)

| Liga | Caixa inicial | Estádio | TV/rodada | Patrocínio/rodada | Bilheteria/jogo em casa | Prêmio 1º | Prêmio último | Campeão da copa |
|---|---|---|---|---|---|---|---|---|
| Pindorama — Acesso | R$ 4,4 mi | 33.500 | R$ 28 mil | R$ 22 mil | R$ 75 mil | R$ 1,9 mi | R$ 313 mil | R$ 938 mil |
| Deserto Dourado | R$ 7,0 mi | 35.500 | R$ 45 mil | R$ 35 mil | R$ 128 mil | R$ 3,0 mi | R$ 501 mil | R$ 1,5 mi |
| Pindorama — Elite | R$ 15,4 mi | 38.500 | R$ 99 mil | R$ 77 mil | R$ 303 mil | R$ 6,6 mi | R$ 1,1 mi | R$ 3,3 mi |
| Gália | R$ 18,0 mi | 39.000 | R$ 116 mil | R$ 90 mil | R$ 359 mil | R$ 7,7 mi | R$ 1,3 mi | R$ 3,9 mi |
| Teutônica | R$ 21,0 mi | 39.500 | R$ 135 mil | R$ 105 mil | R$ 426 mil | R$ 9,0 mi | R$ 1,5 mi | R$ 4,5 mi |
| Peninsulare | R$ 24,6 mi | 40.000 | R$ 158 mil | R$ 123 mil | R$ 505 mil | R$ 10,5 mi | R$ 1,8 mi | R$ 5,3 mi |
| Hispânia | R$ 28,8 mi | 41.000 | R$ 185 mil | R$ 144 mil | R$ 605 mil | R$ 12,3 mi | R$ 2,1 mi | R$ 6,2 mi |
| Albion | R$ 33,7 mi | 41.500 | R$ 217 mil | R$ 168 mil | R$ 717 mil | R$ 14,4 mi | R$ 2,4 mi | R$ 7,2 mi |

Clubes acima da média da liga começam com mais caixa e um estádio maior, e os abaixo da média, com menos.

> O caixa **pode ficar negativo** (aparece em vermelho). Hoje não há punição automática, mas um caixa negativo impede contratações e investimentos na base.

---

## 13. Valores de mercado e salários

### 13.1 Valor de mercado (dinâmico)

O valor parte do **geral** e da **idade** e depois é ajustado:
- **Jovens (≤ 23 anos):** +4% por ponto entre o potencial e o geral atual.
- **Fase:** com pelo menos 3 jogos na temporada, a nota média ajusta o valor entre −20% e +30% (a referência é a nota 6,5).
- Mínimo de R$ 25 mil, arredondado de R$ 5 mil em R$ 5 mil.

Exemplos (sem ajuste de fase, potencial = geral + 6):

| Geral | Idade | Valor aproximado |
|---|---|---|
| 60 | 20 | R$ 415 mil |
| 65 | 25 | R$ 630 mil |
| 70 | 27 | R$ 1,4 mi |
| 70 | 33 | R$ 405 mil |
| 75 | 24 | R$ 3,0 mi |
| 80 | 28 | R$ 5,6 mi |

### 13.2 Salário

- O salário é **mensal** e vale por carreira. Ele é pago semanalmente nas rodadas de liga (§12).
- Um jogador contratado pede cerca de **2,25% do valor de mercado por mês** (mínimo R$ 5 mil).
- Os garotos da base ganham 40% do salário equivalente ao valor deles.

---

## 14. Mercado de transferências

O mercado fica **aberto o ano todo** (não há janela) e inclui **jogadores de todas as ligas do mundo**.

### 14.1 Buscar e comprar

- Filtros: nome, posição, liga, valor máximo, geral mínimo, idade máxima e "só à venda".
- Ao abrir um jogador aparece a **cotação**: o preço pedido e o salário esperado.
- Regras para fazer uma proposta:
  - ter **caixa** para o valor;
  - o seu elenco ter menos de **32** jogadores;
  - jogadores da **base** não estão à venda.

### 14.2 Como a IA responde (na hora)

1. **Elenco mínimo:** se o clube vendedor tem 16 jogadores ou menos no elenco principal, recusa.
2. **Preço pedido:**
   - Base: valor × 1,10.
   - **Peça-chave** (um dos 11 melhores do clube): valor × 1,45.
   - Clube rico: ×1,10; clube pobre: ×0,95.
   - Peça-chave numa posição em que o clube tem 2 jogadores ou menos: ×1,25 a mais.
   - Abaixo do preço → **recusa com contraproposta** (o valor pedido), que dá para aceitar com um clique.
3. **Aceite do jogador:** ele só vai para um clube mais fraco se ganhar mais:
   - mesmo nível ou clube mais forte: +5% sobre o salário atual;
   - clube até 6 pontos mais fraco: +20%;
   - clube mais de 6 pontos mais fraco: +60%.
4. Aceita → o jogador vai **na hora** para o seu elenco e o valor sai do caixa.

### 14.3 Vender

- Em **Jogador → Colocar à venda** você pode definir um preço pedido.
- A cada dia de jogo a IA pode fazer propostas:
  - jogador **à venda**: 40% de chance por dia, com oferta entre 82% e 105% do preço pedido (ou do valor);
  - jogador **não listado** e bem acima da média do elenco (+4): 3,5% por dia, com oferta entre 115% e 160% do valor;
  - os demais: 0,6% por dia.
- No máximo 2 propostas novas por clube por dia. O comprador precisa ter caixa e força de no mínimo a do seu clube − 8.
- As propostas ficam em **Mercado → Propostas** e **expiram em 2 dias de jogo**.
- Não é possível vender se o elenco ficar com menos de 16 jogadores.

### 14.4 Entre técnicos humanos (liga com amigos)

A proposta fica **pendente** até o outro técnico aceitar ou recusar (prazo de 2 dias de jogo). Na hora de aceitar, o jogo confere de novo o caixa do comprador e o elenco mínimo do vendedor.

### 14.5 Mercado da IA entre temporadas

Na virada de temporada, os clubes da IA com caixa fazem até 18 negócios entre si. Eles reforçam o elenco com jogadores de até 30 anos de clubes iguais ou mais fracos, pagando valor × 1,2. As principais negociações aparecem nas notícias.

---

## 15. Categorias de base

- A cada temporada (e ao criar a carreira) chega uma **leva de garotos de 16 a 18 anos**.
- Tamanho da leva: 3 + metade do nível da base (arredondado para baixo) + 0 ou 1 sorteado.
- **Potencial médio** esperado: `56 + 5 × nível da base + (força do clube − 65) × 0,5`, com variação. O geral atual fica 12 a 24 pontos abaixo do potencial.
- Os garotos da base **não jogam** e não perdem moral por não jogar.
- Ações:
  - **Promover**: o garoto sobe para o elenco principal (limite de 32).
  - **Dispensar**: ele sai do jogo.
- **Estrutura da base**: vai do nível 1 ao 5. Cada upgrade custa `18 × unidade da liga × nível atual`. Por exemplo, na Acesso, do nível 1 para o 2 custa R$ 1,13 mi e do 4 para o 5 custa R$ 4,5 mi. Na Elite, os mesmos upgrades custam R$ 3,95 mi e R$ 15,8 mi.

---

## 16. Fim de temporada e evolução

Ao terminar o último dia:
1. Prêmios da liga são pagos a todos os clubes.
2. Os campeões, vices, artilheiros e clubes promovidos e rebaixados vão para o **Histórico** (Tabela → Histórico).
3. O painel mostra o resumo com o botão **"Começar temporada N+1"**. Na liga com amigos, só o anfitrião pode clicar.

Ao começar a nova temporada:
- Todos os jogadores fazem **+1 ano** e evoluem:

| Idade (na nova temporada) | Evolução do geral |
|---|---|
| até 21 | +1 a +5 (limitado ao potencial) |
| 22–24 | 0 a +3 (limitado ao potencial) |
| 25–29 | −1 a +2 |
| 30–32 | −1 a −3 |
| 33+ | −2 a −5 |

- Condição volta a 100 e moral a 60. Cartões, suspensões, lesões e estatísticas são zerados.
- Rodam o mercado da IA (§14.5) e a nova leva da base (§15).
- Um novo calendário é gerado, com novo sorteio da copa e as divisões já atualizadas.

---

## 17. Liga com amigos (multiplayer)

### 17.1 Montando a liga

1. O **anfitrião** cria a carreira marcando **"Liga com amigos"** e recebe um **código de convite de 6 caracteres** (tela **Amigos**, com botão de copiar).
2. Os amigos entram em **Minhas carreiras → Entrar com código** e escolhem um **clube livre de qualquer divisão** do mesmo país.
3. Cada clube tem um único técnico. A carreira conta no limite de 3 carreiras de cada participante.
4. Clubes de ligas premium exigem Premium de quem os escolhe.

### 17.2 O dia de jogo

- Cada técnico ajusta a tática e a escalação e clica em **"✓ Estou pronto"**. Dá para desmarcar.
- Quando o **último** técnico marca pronto, o dia é processado na hora. O botão avisa: **"✓ Estou pronto (processa o dia)"**.
- O **anfitrião** também pode clicar em **"Processar agora"** sem esperar os outros.
- Depois do processamento:
  - quem clicou vai direto para os **resultados do dia**;
  - os outros veem o aviso **"O dia X foi processado!"**, porque a tela se atualiza sozinha a cada 8 segundos;
  - todos voltam para "aguardando" no dia seguinte;
  - o painel mostra o **último jogo** de cada técnico, com links para os resultados e o replay.
- As partidas são simuladas com a tática salva. Não há jogo ao vivo nem mexidas durante a partida no multiplayer, mas cada um pode assistir ao **replay** do seu jogo.
- Notícias, propostas e extrato são **individuais por clube**. Tabela, copa e histórico são compartilhados.

### 17.3 Negociação entre amigos

Funciona como em §14.4: a proposta fica pendente para o outro técnico responder no Mercado.

---

## 18. Telas do jogo

| Tela | O que tem |
|---|---|
| **Minhas carreiras** | Lista, criar, entrar com código, excluir |
| **Painel** | Próxima partida, posição, caixa, moral, notícias, últimos resultados, desfalques e pendurados, aviso de propostas, resumo de fim de temporada e o painel "Estou pronto" no multiplayer |
| **Elenco** | Elenco principal com posição, idade, geral, condição, moral, jogos, gols, nota média, valor e situação (lesão/suspensão/à venda) |
| **Tática** | Formação, estilo, pressão, marcação e escalação no campinho |
| **Jogar** | Jogo ao vivo (3D/2D), só o resultado, avançar o calendário, replay; no multiplayer, o "Estou pronto" |
| **Jogador** | Atributos, traços, arquétipo, potencial, estatísticas, valor e salário, relatório do olheiro, colocar à venda, fazer proposta |
| **Mercado** | Buscar jogadores · Propostas (recebidas e enviadas) · Meus à venda |
| **Finanças** | Caixa, receitas e despesas da temporada, extrato detalhado |
| **Base** | Garotos com potencial, promover ou dispensar, investir na estrutura |
| **Tabela** | Classificação (por divisão) · Jogos do dia (com gols e expulsões, navegação por dia) · Artilharia · Cartões · Histórico |
| **Copa** | Chave completa por fase, placares e pênaltis |
| **Amigos** | Código de convite, técnicos, painel "Estou pronto" e regras (só no multiplayer) |
| **Mais** | Atalhos para as telas fora da barra principal (celular) |
| **Planos** | Grátis × Premium, assinatura e gerenciamento |

---

## 19. Narração e olheiro

- **Narração** dos lances principais da partida e **relatório do olheiro** na página do jogador.
- **Hoje funcionam por templates** (textos prontos combinados com os dados do lance e do jogador), sem custo.
- A integração com IA (Anthropic, modelo Haiku) já está pronta no servidor, com limite diário por usuário e registro de tokens. Ela está **desligada** porque não há `ANTHROPIC_API_KEY` configurada. Sem a chave, ou se o limite estourar, o jogo usa os templates.

---

## 20. Limites e o que ainda não existe

**Limites atuais**

| Regra | Valor |
|---|---|
| Carreiras por usuário | 3 |
| Elenco principal | mín. 16 / máx. 32 |
| Substituições por jogo | 5 |
| Reservas no banco | 9 |
| Prazo de proposta pendente | 2 dias de jogo |
| Propostas da IA por clube/dia | 2 |
| Nível máximo da base | 5 |

**Ainda não existe**
- Contratos com duração, renovação, rescisão e multa.
- Aposentadoria (jogadores mais velhos só perdem rendimento).
- Empréstimos.
- Treinamento.
- Punição por caixa negativo, demissão do técnico e metas da diretoria.
- Divisões inferiores nos países fora de Pindorama, competições continentais e seleções.
- Jogo ao vivo e chat no multiplayer.
- Narração por IA ligada por padrão e narração por voz.

---

## 21. Referência técnica

| Item | Detalhe |
|---|---|
| Stack | Next.js 16 (App Router) + TypeScript + Tailwind 4 |
| Banco | Postgres (Neon) + Drizzle ORM, migrations em `drizzle/` |
| Login | Auth.js v5 (e-mail/senha + Google) |
| Pagamento | Stripe (modo teste), isolado em `src/billing/` |
| Visualização | three.js (3D) e Canvas 2D |
| Testes | Vitest: motor (incluindo o teste estatístico de 1.000 jogos), regras, calendário; `npm run smoke` para o ponta a ponta |
| Hospedagem | Vercel (deploy de produção a partir do branch `master`) |

**Onde está cada regra no código**

| Assunto | Arquivo |
|---|---|
| Ligas, países, copas | `src/data/leagues.ts` |
| Atributos, posições, formações, táticas | `src/engine/types.ts`, `formations.ts`, `ratings.ts` |
| Motor da partida | `src/engine/simulate.ts` |
| Escalação automática | `src/engine/lineup.ts` |
| Pênaltis | `src/engine/shootout.ts` |
| Geração de jogadores e arquétipos | `src/seed/generate.ts`, `archetypes.ts` |
| Cartões, lesões, moral, físico, tabela, evolução | `src/career/rules.ts` |
| Calendário e copa | `src/career/calendar.ts`, `cup.ts` |
| Economia (receitas, prêmios, valores, salários) | `src/career/economy.ts` |
| Transferências (decisão da IA) | `src/career/transfers.ts`, `market.ts` |
| Base | `src/career/academy.ts` |
| Processamento do dia e fim de temporada | `src/career/matchday.ts` |
| Nova temporada | `src/career/season.ts` |
| Criar/entrar em carreira | `src/career/setup.ts` |
