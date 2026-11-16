// Dados falsos do protótipo. Nenhum valor aqui vem de uso real.
import { LIMITES, TEMPOS } from "./config";
import type { Conduta, Risco } from "./dominio";

export type Cenario = "normal" | "integridade" | "dermatoscopio" | "lento";

export const cenario: Cenario = (() => {
  const c = new URLSearchParams(window.location.search).get("cenario");
  return c === "integridade" || c === "dermatoscopio" || c === "lento" ? c : "normal";
})();

const esperar = <T,>(valor: T, ms: number = TEMPOS.atrasoMockMs) =>
  new Promise<T>((ok) => setTimeout(() => ok(valor), ms));

// ── Saúde do aparelho (1.1, 1.1b, BarraStatus) ─────────────────────────
export type IdItemSaude = "servicos" | "modelo" | "banco" | "dermatoscopio";
export type EstadoItem = "pendente" | "ok" | "desconectado";

export interface Saude {
  itens: { id: IdItemSaude; estado: EstadoItem }[];
  pronto: boolean;
  modelo_versao: string;
  modelo_integro: boolean | null; // null = ainda não conferido
  dermatoscopio_conectado: boolean;
  modelo_usa_metadata: boolean;
}

const ORDEM_ITENS: IdItemSaude[] = ["servicos", "modelo", "banco", "dermatoscopio"];
const PASSO_ITEM_MS = 700;
let inicioSaude: number | null = null;

export function buscarSaude(): Promise<Saude> {
  inicioSaude ??= Date.now();
  const passos = Math.floor((Date.now() - inicioSaude) / PASSO_ITEM_MS);
  // "lento": os serviços nunca terminam de subir
  const concluidos = cenario === "lento" ? 0 : Math.min(passos, ORDEM_ITENS.length);
  const modeloConferido = concluidos >= 2;
  const integro = cenario !== "integridade";

  const itens = ORDEM_ITENS.map((id, i) => {
    let estado: EstadoItem = i < concluidos ? "ok" : "pendente";
    if (id === "dermatoscopio" && estado === "ok" && cenario === "dermatoscopio") estado = "desconectado";
    if (id === "modelo" && modeloConferido && !integro) estado = "pendente";
    return { id, estado };
  });

  return esperar(
    {
      itens,
      pronto: concluidos === ORDEM_ITENS.length,
      modelo_versao: "1.2.0",
      modelo_integro: modeloConferido ? integro : null,
      dermatoscopio_conectado: cenario !== "dermatoscopio",
      modelo_usa_metadata: true,
    },
    150,
  );
}

// ── Usuários do aparelho (1.2, 1.12, 1.14) ─────────────────────────────
export type Perfil = "operador" | "administrador";
export type Funcao = "enfermeiro" | "medico" | "tecnico_enfermagem" | "administracao" | "outro";

export interface Usuario {
  id: string;
  nome: string;
  funcao: Funcao;
  perfil: Perfil;
  ativo: boolean;
}

export const USUARIOS: Usuario[] = [
  { id: "u-1", nome: "Ana Souza", funcao: "enfermeiro", perfil: "operador", ativo: true },
  { id: "u-2", nome: "Marcos Ribeiro", funcao: "medico", perfil: "operador", ativo: true },
  { id: "u-3", nome: "Joana Costa", funcao: "administracao", perfil: "administrador", ativo: true },
];

export const PIN_MOCK = "123456";

export function buscarUsuarios(): Promise<Usuario[]> {
  return esperar(USUARIOS.filter((u) => u.ativo));
}

// ── Triagens (1.3, 1.8–1.11, 1.15) ─────────────────────────────────────
export interface Resultado {
  conduta: Conduta;
  risco: Risco | null;
  aviso: string;
  limitacoes: string[];
  classes: { rotulo: string; nome: string; valor: number }[];
  probabilidade_maligna: number;
  threshold_usado: number;
  modelo: string;
  modelo_versao: string;
  dataset_treino: string;
}

export interface Triagem {
  id: string;
  codigo: string;
  data: string; // ISO
  operador_id: string;
  local: string;
  resultado: Resultado | null; // null = encerrado sem resultado
  sync: "aguardando" | "enviado";
}

export const LIMITACOES_MOCK = [
  "Modelo treinado majoritariamente com imagens de pele clara; o desempenho em outros fototipos não foi medido.",
  "Protótipo sem validação clínica.",
];

export const RESULTADO_PRIORITARIO_MOCK: Resultado = {
  conduta: "encaminhar_prioritario",
  risco: "alto",
  aviso: "TRIAGEM — NÃO É DIAGNÓSTICO. A decisão de conduta permanece integralmente com o profissional de saúde.",
  limitacoes: LIMITACOES_MOCK,
  classes: [
    { rotulo: "mel", nome: "Melanoma", valor: 0.6 },
    { rotulo: "nv", nome: "Nevo melanocítico", valor: 0.3 },
    { rotulo: "bkl", nome: "Ceratose benigna pigmentada", valor: 0.1 },
  ],
  probabilidade_maligna: 0.62,
  threshold_usado: 0.5,
  modelo: "modelo-exemplo",
  modelo_versao: "1.2.0",
  dataset_treino: "dataset de exemplo (mock)",
};

export const TRIAGENS_MOCK: Triagem[] = [
  { id: "t-0412", codigo: "A-0412", data: "2026-11-10T09:12:00", operador_id: "u-1", local: "Dorso", resultado: RESULTADO_PRIORITARIO_MOCK, sync: "enviado" },
  { id: "t-0418", codigo: "A-0418", data: "2026-11-10T09:40:00", operador_id: "u-1", local: "Antebraço esquerdo", resultado: { ...RESULTADO_PRIORITARIO_MOCK, conduta: "seguimento", risco: "baixo" }, sync: "aguardando" },
  { id: "t-0421", codigo: "A-0421", data: "2026-11-10T10:05:00", operador_id: "u-1", local: "Pé", resultado: { ...RESULTADO_PRIORITARIO_MOCK, conduta: "indeterminado", risco: null }, sync: "aguardando" },
  { id: "t-0423", codigo: "A-0423", data: "2026-11-10T10:20:00", operador_id: "u-2", local: "Face", resultado: null, sync: "enviado" },
];

export function buscarTriagens(): Promise<Triagem[]> {
  return esperar(TRIAGENS_MOCK);
}

export function buscarPendentesSync(): Promise<number> {
  return esperar(TRIAGENS_MOCK.filter((t) => t.sync === "aguardando").length);
}

// ── Painel (2.1) ───────────────────────────────────────────────────────
export type PerfilPainel = "dermatologista" | "equipe";

export const CONTAS_PAINEL = [
  { email: "derm@exemplo.invalid", nome: "Dra. Exemplo", perfil: "dermatologista" as PerfilPainel },
  { email: "equipe@exemplo.invalid", nome: "Equipe Exemplo", perfil: "equipe" as PerfilPainel },
];
export const SENHA_PAINEL_MOCK = "senha-de-teste";
export const CODIGO_2FA_MOCK = "000000";

// ── Login por PIN (1.2) ────────────────────────────────────────────────
// Variações pela URL, além de ?cenario=: ?login=sem-operadores · ?login=primeiro-acesso
export type CenarioLogin = "normal" | "sem-operadores" | "primeiro-acesso";

export const cenarioLogin: CenarioLogin = (() => {
  const c = new URLSearchParams(window.location.search).get("login");
  return c === "sem-operadores" || c === "primeiro-acesso" ? c : "normal";
})();

// Política de pausa devolvida pelo "servidor" após LIMITES.tentativasPin erros seguidos.
export const PAUSA_PIN_MINUTOS = 5;

export interface UsuarioLogin extends Usuario {
  primeiro_acesso: boolean; // ainda não criou o próprio PIN
  pausado: boolean;
}

export type RespostaPin =
  | { status: "ok" }
  | { status: "incorreto"; restantes: number }
  | { status: "pausado"; minutos: number };

const USUARIO_PRIMEIRO_ACESSO: Usuario = {
  id: "u-4",
  nome: "Paulo Lima",
  funcao: "tecnico_enfermagem",
  perfil: "operador",
  ativo: true,
};

// Estado do "servidor" em memória: some ao recarregar.
const errosPin = new Map<string, number>();
const pausaPinAte = new Map<string, number>();
const pinsCriados = new Map<string, string>();

const pinPausado = (id: string) => (pausaPinAte.get(id) ?? 0) > Date.now();

export function buscarUsuariosLogin(): Promise<UsuarioLogin[]> {
  const base =
    cenarioLogin === "sem-operadores"
      ? USUARIOS.filter((u) => u.perfil === "administrador")
      : cenarioLogin === "primeiro-acesso"
        ? [...USUARIOS, USUARIO_PRIMEIRO_ACESSO]
        : USUARIOS;
  return esperar(
    base
      .filter((u) => u.ativo)
      .map((u) => ({
        ...u,
        primeiro_acesso: u.id === USUARIO_PRIMEIRO_ACESSO.id && !pinsCriados.has(u.id),
        pausado: pinPausado(u.id),
      })),
  );
}

export function verificarPin(usuarioId: string, pin: string): Promise<RespostaPin> {
  if (pinPausado(usuarioId)) return esperar({ status: "pausado", minutos: PAUSA_PIN_MINUTOS });
  if (pin === (pinsCriados.get(usuarioId) ?? PIN_MOCK)) {
    errosPin.delete(usuarioId);
    return esperar({ status: "ok" });
  }
  const erros = (errosPin.get(usuarioId) ?? 0) + 1;
  if (erros >= LIMITES.tentativasPin) {
    errosPin.delete(usuarioId);
    pausaPinAte.set(usuarioId, Date.now() + PAUSA_PIN_MINUTOS * 60_000);
    return esperar({ status: "pausado", minutos: PAUSA_PIN_MINUTOS });
  }
  errosPin.set(usuarioId, erros);
  return esperar({ status: "incorreto", restantes: LIMITES.tentativasPin - erros });
}

export function criarPin(usuarioId: string, pin: string): Promise<void> {
  pinsCriados.set(usuarioId, pin);
  return esperar(undefined);
}

// ── Início (1.3) ───────────────────────────────────────────────────────
// Variações pela URL, além de ?cenario=: ?inicio=vazia (nenhuma triagem hoje)
export type CenarioInicio = "normal" | "vazia";

export const cenarioInicio: CenarioInicio =
  new URLSearchParams(window.location.search).get("inicio") === "vazia" ? "vazia" : "normal";

// "Hoje" do protótipo: as triagens de exemplo são deste dia.
export const HOJE_MOCK = "2026-11-10";

export function buscarTriagensDeHoje(operadorId: string): Promise<Triagem[]> {
  if (cenarioInicio === "vazia") return esperar([]);
  return esperar(TRIAGENS_MOCK.filter((t) => t.operador_id === operadorId && t.data.startsWith(HOJE_MOCK)));
}

// ── Dados do atendimento (1.4) ─────────────────────────────────────────
// Variações pela URL, além de ?cenario=:
// ?atendimento=repetido (código sugerido já tem triagem hoje) · ?metadata=nao (modelo sem idade/sexo)
export const CODIGO_ATENDIMENTO_PREFIXO = "A-";
export const CODIGO_ATENDIMENTO_DIGITOS = 4;
// Última faixa de idade aceita pelo modelo ("85 anos ou mais"); as anteriores vêm de LIMITES.faixaIdadeAnos.
export const IDADE_ULTIMA_FAIXA_ANOS = 85;

const parametrosAtendimento = new URLSearchParams(window.location.search);
const atendimentoRepetido = parametrosAtendimento.get("atendimento") === "repetido";
const modeloSemMetadata = parametrosAtendimento.get("metadata") === "nao";

export function buscarProximoCodigoAtendimento(): Promise<string> {
  return esperar(atendimentoRepetido ? "A-0423" : "A-0426");
}

export function buscarModeloUsaMetadata(): Promise<boolean> {
  return buscarSaude().then((s) => s.modelo_usa_metadata && !modeloSemMetadata);
}

export function codigoTemTriagemHoje(codigo: string): Promise<boolean> {
  return esperar(TRIAGENS_MOCK.some((t) => t.codigo === codigo && t.data.startsWith(HOJE_MOCK)));
}

// ── Tela 2.1 ──
// Variações pela URL: ?painel=sessao-expirada (abre 2.1 com o aviso de sessão expirada por inatividade)
export type CenarioLoginPainel = "normal" | "sessao-expirada";

export const cenarioLoginPainel: CenarioLoginPainel =
  new URLSearchParams(window.location.search).get("painel") === "sessao-expirada" ? "sessao-expirada" : "normal";

export type ContaPainel = (typeof CONTAS_PAINEL)[number];

export type RespostaCredenciaisPainel = { status: "ok"; desafio: string } | { status: "nao_conferem" };
export type RespostaCodigoPainel = { status: "ok"; token: string; conta: ContaPainel } | { status: "nao_confere" };

// Desafios de 2º fator pendentes no "servidor" em memória: somem ao recarregar.
const desafiosPainel = new Map<string, ContaPainel>();

export function verificarCredenciaisPainel(email: string, senha: string): Promise<RespostaCredenciaisPainel> {
  const conta = CONTAS_PAINEL.find((c) => c.email === email.trim().toLowerCase());
  if (!conta || senha !== SENHA_PAINEL_MOCK) return esperar({ status: "nao_conferem" });
  const desafio = `desafio-${crypto.randomUUID()}`;
  desafiosPainel.set(desafio, conta);
  return esperar({ status: "ok", desafio });
}

export function verificarCodigoPainel(desafio: string, codigo: string): Promise<RespostaCodigoPainel> {
  const conta = desafiosPainel.get(desafio);
  if (!conta || codigo !== CODIGO_2FA_MOCK) return esperar({ status: "nao_confere" });
  desafiosPainel.delete(desafio);
  return esperar({ status: "ok", token: `token-painel-${crypto.randomUUID()}`, conta });
}

// ── Tela 1.13 ──────────────────────────────────────────────────────────
// Status do aparelho (admin). O "servidor" já devolve o motivo de atenção de cada cartão
// (null = sem atenção); a tela não decide limites.
// Variações pela URL, além de ?cenario= (integridade → Modelo; dermatoscopio → Dermatoscópio):
// ?status-aparelho=atencao → Sincronização, Armazenamento, Bateria e Relógio também em atenção.
export const cenarioStatusAparelho1_13: "normal" | "atencao" =
  new URLSearchParams(window.location.search).get("status-aparelho") === "atencao" ? "atencao" : "normal";

export interface StatusAparelho1_13 {
  consultado_em: string; // ISO
  modelo: { nome: string; versao: string; instalado_em: string; integro: boolean; atencao: string | null };
  sincronizacao: { ultima: string; pendentes: number; atencao: string | null };
  armazenamento: { usado_gb: number; total_gb: number; atencao: string | null };
  bateria: { nivel: number; na_tomada: boolean; atencao: string | null }; // nivel 0–1
  dermatoscopio: { conectado: boolean; identificacao: string; atencao: string | null };
  relogio: { hora_aparelho: string; diferenca_rede_min: number; atencao: string | null };
  uso: {
    triagens_hoje: number;
    triagens_semana: number;
    taxa_indeterminado: number; // 0–1, na semana
    taxa_reprovacao: number; // 0–1, capturas reprovadas na semana
    atencao: string | null;
  };
}

export function buscarStatusAparelho1_13(): Promise<StatusAparelho1_13> {
  const atencao = cenarioStatusAparelho1_13 === "atencao";
  const integro = cenario !== "integridade";
  const dermatoscopio = cenario !== "dermatoscopio";
  return esperar({
    consultado_em: `${HOJE_MOCK}T10:32:00`,
    modelo: {
      nome: RESULTADO_PRIORITARIO_MOCK.modelo,
      versao: RESULTADO_PRIORITARIO_MOCK.modelo_versao,
      instalado_em: "2026-10-28T14:05:00",
      integro,
      atencao: integro
        ? null
        : "A verificação de integridade não confirmou o arquivo do modelo instalado. Reinstale a versão em Atualização do modelo.",
    },
    sincronizacao: {
      ultima: atencao ? "2026-11-08T17:40:00" : `${HOJE_MOCK}T10:15:00`,
      pendentes: TRIAGENS_MOCK.filter((t) => t.sync === "aguardando").length,
      atencao: atencao
        ? "Sem sincronizar com o painel há 2 dias. Confira a conexão de rede em Configurações."
        : null,
    },
    armazenamento: {
      usado_gb: atencao ? 119.4 : 41.3,
      total_gb: 128,
      atencao: atencao
        ? "Resta pouco espaço livre. Sincronize as triagens pendentes; se continuar, fale com o suporte técnico."
        : null,
    },
    bateria: {
      nivel: atencao ? 0.14 : 0.82,
      na_tomada: !atencao,
      atencao: atencao ? "Bateria baixa e fora da tomada. Conecte o carregador." : null,
    },
    dermatoscopio: {
      conectado: dermatoscopio,
      identificacao: "Dermatoscópio de exemplo · série EX-0417",
      atencao: dermatoscopio ? null : "Dermatoscópio não conectado. Confira o cabo USB e reconecte o aparelho.",
    },
    relogio: {
      hora_aparelho: `${HOJE_MOCK}T10:32:00`,
      diferenca_rede_min: atencao ? 7 : 0,
      atencao: atencao
        ? "Relógio 7 minutos adiantado em relação à rede. Ajuste em Configurações para que as datas das triagens fiquem corretas."
        : null,
    },
    uso: {
      triagens_hoje: TRIAGENS_MOCK.filter((t) => t.data.startsWith(HOJE_MOCK)).length,
      triagens_semana: 27,
      taxa_indeterminado: 0.11,
      taxa_reprovacao: 0.18,
      atencao:
        "Taxa de capturas reprovadas subiu nesta semana. Causa comum: lente suja ou ponteira desgastada.",
    },
  });
}

// ── Tela 1.5 ── Captura ────────────────────────────────────────────────
// Leitura ao vivo do dermatoscópio. "contato" = ponteira encostada na pele (só orienta o rodapé).
export interface QualidadeCaptura {
  contato: boolean;
  foco: boolean;
  centro: boolean;
  luz: boolean;
}

// Sequência simulada ao abrir a tela: encosta → centraliza → firma → pronto (e fica pronto).
const QUALIDADE_CAPTURA_SEQUENCIA: { leitura: QualidadeCaptura; duracaoMs: number }[] = [
  { leitura: { contato: false, foco: false, centro: false, luz: false }, duracaoMs: 2000 },
  { leitura: { contato: true, foco: false, centro: false, luz: true }, duracaoMs: 2000 },
  { leitura: { contato: true, foco: false, centro: true, luz: true }, duracaoMs: 1500 },
  { leitura: { contato: true, foco: true, centro: true, luz: true }, duracaoMs: 0 },
];

export function observarQualidadeCaptura(aoLer: (q: QualidadeCaptura) => void): () => void {
  let timer: number | undefined;
  const passo = (i: number) => {
    const { leitura, duracaoMs } = QUALIDADE_CAPTURA_SEQUENCIA[i];
    aoLer(leitura);
    if (i < QUALIDADE_CAPTURA_SEQUENCIA.length - 1) timer = window.setTimeout(() => passo(i + 1), duracaoMs);
  };
  passo(0);
  return () => window.clearTimeout(timer);
}

// Imagem capturada de mentira: fundo neutro com uma mancha no centro.
export const CAPTURA_IMAGEM_MOCK_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#c9b9a6"/><ellipse cx="200" cy="200" rx="70" ry="58" fill="#6b4a33"/></svg>',
  );

export type ResultadoCaptura =
  | { aprovada: true; url: string }
  | { aprovada: false; url: string; motivo: string; codigo: string };

// Regra do mock: a 1ª tentativa do atendimento é reprovada (→ 1.6) e a seguinte aprovada (→ 1.7).
export function capturarLesao(reprovacoesSeguidas: number): Promise<ResultadoCaptura> {
  return esperar(
    reprovacoesSeguidas === 0
      ? { aprovada: false, url: CAPTURA_IMAGEM_MOCK_URL, motivo: "A imagem ficou sem foco.", codigo: "QC-FOCO" }
      : { aprovada: true, url: CAPTURA_IMAGEM_MOCK_URL },
  );
}
