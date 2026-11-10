# Skin Analyzer AI — protótipo de telas

Protótipo navegável só de front-end (dados falsos, sem backend) das 25 telas do Skin Analyzer AI: o aparelho de **triagem** usado na UBS e o painel web. Não é um dispositivo médico e não faz diagnóstico.

```bash
npm install
npm run dev     # http://localhost:5173  (painel em /painel/login)
npm run build
```

## Simular estados

Use `?cenario=` na URL:

| Cenário | Efeito |
|---|---|
| `integridade` | o pacote do modelo não passa na verificação → 1.1b |
| `dermatoscopio` | dermatoscópio desconectado (não bloqueia a inicialização) |
| `lento` | o aparelho não termina de iniciar → mensagem com Reiniciar após o limite |

Acessos do mock: PIN `123456`. Painel: `derm@exemplo.invalid` ou `equipe@exemplo.invalid`, senha `senha-de-teste`, código `000000`.

## Telas

As regras e o fluxo estão no [CLAUDE.md](CLAUDE.md). Os prompts de cada tela estão no Google Doc "Skin Analyzer AI — Prompts das telas (versão simplificada)".

Prontas: **1.1 Inicialização**, **1.1b Bloqueio técnico**. As outras são placeholders com botões para as saídas.
