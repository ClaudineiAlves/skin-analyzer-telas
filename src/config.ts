// Tempos e limites são propostas de design, a validar com o grupo e com teste de uso.
export const TEMPOS = {
  atrasoMockMs: 500,
  pollingSaudeMs: 1000,
  inicializacaoLimiteMs: 60_000,
  inicializacaoPausaFinalMs: 600,
  inatividadeMs: 2 * 60_000,
  sessaoBloqueadaEncerraMs: 30 * 60_000,
  lembreteHigienizacaoMs: 5_000,
  confirmacaoSalvoMs: 2_000,
  predictTimeoutMs: 30_000,
} as const;

export const LIMITES = {
  pinDigitos: 6,
  tentativasPin: 5,
  reprovacoesSeguidasAviso: 3,
  faixaIdadeAnos: 5,
} as const;

export const CODIGOS = {
  INIT_TIMEOUT: "INIT-TIMEOUT",
  MOD_INTEGRIDADE: "MOD-INTEGRIDADE",
  MOD_FUMACA: "MOD-FUMACA",
  API_TIMEOUT: "API-TIMEOUT",
} as const;

// Abaixo desta largura (celular), as telas trocam colunas lado a lado por uma coluna só.
export const LAYOUT = {
  larguraEstreitaPx: 760,
} as const;
