# CLAUDE.md — Skin Analyzer AI (protótipo de telas)

Protótipo SÓ DE TELAS (front-end, sem backend) do "Skin Analyzer AI": aparelho de TRIAGEM de lesões de pele usado em UBS por não dermatologistas (tela de toque 1280×800) + painel web para especialistas e equipe.

Prompts das telas: Google Doc "Skin Analyzer AI — Prompts das telas (versão simplificada)". Uma tela por sessão.

## Estrutura

- `src/mocks.ts` — dados falsos e funções async com atraso. Cenário pela URL: `?cenario=integridade|dermatoscopio|lento`.
- `src/config.ts` — tempos e limites (propostas de design, a validar). Nunca número solto na tela.
- `src/dominio.ts` — textos fixos de domínio (condutas, risco, aviso de triagem).
- `src/sessao.tsx` — Context em memória: usuário, atendimento, captura e resultado atuais.
- `src/ui/` — Botao, TecladoNumerico, Dialogo, FaixaTriagem, BlocoConduta, MensagemProblema, BarraStatus, MenuAdmin, Layouts, Placeholder.
- `src/telas/<id>-<slug>.tsx` — uma tela por arquivo. Mexa só no arquivo da sua tela. Em `mocks.ts` pode ACRESCENTAR dados que a sua tela precisa, sem alterar os existentes. Mudança em `ui/`, `sessao.tsx` ou rotas é pedida à parte.
- Telas prontas: todas (1.1–1.18, 1.1b e 2.1–2.6).
- `src/App.tsx` — rotas do aparelho em `/` e do painel em `/painel/*`.

Comandos: `npm install` · `npm run dev` (http://localhost:5173) · `npm run build`.

## REGRAS

1. É triagem, não diagnóstico. Nunca escreva na interface: diagnóstico, laudo, detectado, câncer, benigno, normal, tudo certo, erro, falha, inválido, "eu acho", porcentagem de certeza, "!" ou emoji. Use: "sugerido", "risco alto/moderado/baixo", "Não foi possível…" + o que fazer.
2. Nenhum número inventado: todo valor vem do mocks.ts.
3. Textos entre aspas no prompt da tela são literais.
4. Onde houver resultado, a FaixaTriagem está sempre visível: "⚠ TRIAGEM — NÃO É DIAGNÓSTICO. A decisão de conduta permanece integralmente com o profissional de saúde." Ela não fecha nem recolhe.
5. BlocoConduta: prioritário = laranja cheio; eletivo = laranja contornado; seguimento = grafite contornado, SEM verde e SEM ✔; indeterminado = grafite com borda laranja tracejada.
6. Paleta: laranja #E97E24 (ação), texto sobre laranja grafite #2B3036, fundo off-white #F6F4F1, texto laranja #A8521A, secundário #646A73. A cor nunca vai sozinha: sempre com texto ou ícone.
7. Aparelho: alvos ≥ 48 px, corpo ≥ 18 px, resultado ≥ 32 px, só toque simples, nenhum campo de texto livre no fluxo do operador (só teclado numérico). Datas dd/mm/aaaa hh:mm.
8. Mensagem de problema = o que houve + botão com o que fazer + código pequeno no rodapé (ex.: QC-FOCO).
9. Nada em localStorage nem em console.log. Sem testes, sem backend.
10. Ao terminar uma tela, rode `npm run build` e diga o que fez e o que ficou pendente. Não faça commit.

## Fluxo

Aparelho: 1.1 Inicialização → 1.2 Login → (admin) 1.13 · (operador) 1.3 Início → 1.4 Atendimento → 1.5 Captura ⇄ 1.6 Reprovada → 1.7 Processando → 1.8 Resultado / 1.9 Indeterminado → 1.10 Detalhes; Salvar → 1.3. As telas de admin 1.13–1.17 têm menu lateral. 1.18 abre pelo menu do nome na BarraStatus. BarraStatus: nome do operador (menu: Meu histórico · Trocar operador · Relatar um problema · Sair) · versão do modelo · online/offline · pendentes. Após 2 min sem toque (exceto em 1.7), vai para /bloqueio.

Painel: 2.1 Login → dermatologista: 2.2 Fila → 2.3 Revisão · equipe: 2.4 Métricas ⇄ 2.5 Aparelhos ⇄ 2.6 Modelos. Barra superior: logo · nome · Sair.
