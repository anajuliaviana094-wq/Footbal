# Prancheta FC — manager de futebol com IA (MVP)

Jogo web de gerenciamento de futebol: escolha um clube, monte elenco e tática, jogue a temporada rodada a rodada no **campo 2D** e acompanhe tabela, artilharia, cartões e lesões. Jogadores têm **personalidade** que influencia o jogo, a **narração** dos lances decisivos e os **relatórios de olheiro** são gerados por IA.

> **Tudo é fictício**: ligas, clubes, cidades, estádios e jogadores são gerados por código. Escudos são SVG procedurais. Há uma blocklist de combinações de nomes famosos (`src/data/leagues.ts`).

## Stack

- Next.js 16 (App Router) + TypeScript estrito + Tailwind CSS 4
- Postgres (Neon) + Drizzle ORM com migrations versionadas (`drizzle/`)
- Auth.js v5 (e-mail/senha + Google opcional)
- Anthropic SDK — modelo `claude-haiku-5-5` (só no servidor)
- Stripe (modo teste) isolado em `src/billing/`
- Canvas 2D para o campo, Vitest para os testes

## Estrutura

```
src/
  engine/    motor de partida (puro, determinístico) + testes
  seed/      geração procedural de ligas, clubes e jogadores (arquétipos)
  data/      ligas fictícias e pools de nomes (JSON por país)
  career/    regras da carreira: calendário, rodadas, suspensões, lesões, moral, temporada
  ai/        narração, olheiro, templates de fallback, limites e log de tokens
  billing/   planos + provedor de pagamento (Stripe hoje; interface para trocar)
  db/        schema Drizzle, conexão, migrate
  app/       páginas e rotas de API
  components/ UI (escudo SVG, campo 2D, centro de partida)
```

## Rodando localmente

```bash
npm install
cp .env.example .env.local      # preencha DATABASE_URL e AUTH_SECRET (mínimo)
npm run db:setup                # aplica migrations + seed (8 ligas, 154 clubes, 3.850 jogadores)
npm run dev                     # http://localhost:3000
```

`AUTH_SECRET`: `npx auth secret` ou `openssl rand -base64 32`.

Sem `ANTHROPIC_API_KEY` o jogo funciona normalmente com narração/relatórios por template. Sem Stripe, a tela de planos aparece com o botão desabilitado.

### Scripts

| Script | O que faz |
|---|---|
| `npm test` | testes (motor, inclusive o estatístico de 1.000 jogos; regras de carreira; calendário) |
| `npm run smoke` | teste de ponta a ponta no banco: cria usuário/carreira, faz substituição ao vivo, joga a temporada inteira e inicia a seguinte |
| `npm run db:generate` | gera nova migration após mudar `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:setup` | migrations / seed determinístico (upsert, pode rodar de novo) |
| `npm run db:setup:http` | o mesmo via HTTPS (driver HTTP do Neon) — use quando a porta 5432 estiver bloqueada |
| `npm run typecheck` / `lint` / `build` | checagens |

## Deploy (Vercel + Neon)

1. **Neon**: crie o projeto e copie a connection string **pooled** (`...-pooler...?sslmode=require`).
2. Localmente, com essa URL em `.env.local`, rode `npm run db:setup`.
3. **Vercel**: importe o repositório e configure as variáveis do `.env.example`. Defina `APP_URL` com a URL pública (ex.: `https://seu-app.vercel.app`).
4. **Google (opcional)**: crie um OAuth Client (Web) no Google Cloud com o redirect `https://SEU_DOMINIO/api/auth/callback/google` e preencha `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Sem eles, o botão do Google não aparece.
5. **Stripe (modo teste)**:
   - crie um produto “Premium” com preço **recorrente mensal de R$ 19,90 (BRL)** → `STRIPE_PRICE_ID_PREMIUM`;
   - `STRIPE_SECRET_KEY` = chave `sk_test_...`;
   - webhook apontando para `https://SEU_DOMINIO/api/billing/webhook` com os eventos `checkout.session.completed`, `customer.subscription.created|updated|deleted` → `STRIPE_WEBHOOK_SECRET`;
   - local: `stripe listen --forward-to localhost:3000/api/billing/webhook`;
   - para o portal do cliente (“Gerenciar assinatura”), ative o Customer Portal no painel do Stripe.
6. **IA**: `ANTHROPIC_API_KEY`. Limites diários por usuário: `AI_DAILY_NARRATION_LIMIT` (padrão 40) e `AI_DAILY_SCOUT_LIMIT` (padrão 60).

## Como testar (por fase)

1. **Base** — `npm run dev`, crie conta em `/registro`, entre/saia. Com Google configurado, teste o botão.
2. **Dados** — `npm run db:setup`; confira no banco: `select league_id, count(*), avg(strength) from clubs group by 1;`. Rodar o seed de novo gera exatamente os mesmos dados.
3. **Motor** — `npm test`. O teste “estatísticas realistas em 1.000 jogos” exige ~2,2–2,8 gols, ~3,4–4,6 amarelos e vermelho em 8–17% dos jogos (hoje: ≈2,44 gols, ≈3,6 amarelos, ≈12% com vermelho, 46% vitórias do mandante). Também testa determinismo, modo rápido = modo detalhado e que mudanças no meio do jogo preservam o trecho anterior.
4. **Carreira** — crie uma carreira numa liga grátis, ajuste a tática (toque em dois jogadores para trocar, ou arraste no desktop), jogue rodadas e veja tabela/artilharia/cartões. Suspensões (3 amarelos = 1 jogo; vermelho direto = 2; segundo amarelo = 1), lesões (dias, −7 por rodada), desgaste/recuperação e moral são aplicados a todos os clubes. Ao fim, “Começar temporada 2” envelhece e evolui os jogadores. `npm run smoke` faz tudo isso automaticamente.
5. **Campo 2D** — “Jogar” → “Assistir partida”: pausa, 1x/2x/4x, pular para o fim; no intervalo abre o painel “Mexer no time” (substituições e tática), que re-simula o restante do jogo.
6. **IA** — com `ANTHROPIC_API_KEY`, abra um jogador (relatório do olheiro é gerado uma vez e fica salvo) e assista a uma partida (selo “IA” na narração). Uso de tokens em `ai_usage_log`. Sem chave/limite estourado/erro → templates.
7. **Monetização** — usuário free vê ligas premium com cadeado; tentar criar carreira premium é bloqueado no servidor (`createCareer`) e carreiras premium ficam travadas se o plano cair (`getCareer`). Assine com o cartão `4242 4242 4242 4242`; o webhook muda `users.plan` para `premium`.

## Decisões técnicas (e desvios do documento original)

- **Driver `pg` em vez de `@neondatabase/serverless`**: o processamento da rodada precisa de transação interativa com `SELECT ... FOR UPDATE` (evita processar a rodada duas vezes). O `pg` funciona com a URL pooled do Neon na Vercel e também com Postgres local.
- **Replays sem salvar frames**: o motor é determinístico, então a partida do usuário guarda só a entrada (escalações/tática), o seed e a lista de alterações; os frames (~120 KB) são recalculados sob demanda. Ao mudar regras do motor, incremente `ENGINE_VERSION`.
- **Alterações ao vivo**: cada mudança é registrada com o tick; a re-simulação reproduz o jogo idêntico até ali (o RNG é re-semeado só a partir do tick da mudança) e segue com a nova configuração.
- **Cache Components desligado** (padrão do create-next-app 16): o app é dinâmico por usuário.
- **Auth.js v5** ainda é publicado como beta; e-mail/senha exige sessão JWT (o adapter Drizzle continua salvando usuários/contas Google). O plano é sempre lido do banco, nunca do token.
- **`.npmrc` com `legacy-peer-deps`** por conflitos de peer deps (next-auth beta / vitest) com Next 16.
- **IA**: uma chamada por partida para os eventos-chave (JSON validado por schema, `thinking` desligado, `effort: low`, `max_tokens` baixo, timeout curto). A narração chega em segundo plano; o playback nunca espera por ela.
- **Fases**: todas as 7 fases foram entregues juntas neste primeiro commit; o roteiro acima permite validar uma por uma.

## Fora do escopo do MVP (arquitetura preparada)

Transferências (`career_player_state.club_id` já é por carreira), finanças, base, copas, acesso/rebaixamento, multiplayer, narração por voz e campo 3D.
