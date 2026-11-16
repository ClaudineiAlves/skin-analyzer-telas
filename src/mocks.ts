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

// ── Tela 1.14 ──────────────────────────────────────────────────────────
// Cadastro de usuários do aparelho (admin). Lista própria do "servidor" em memória, semeada a
// partir de USUARIOS: some ao recarregar e ainda não reflete no login (1.2).
export interface UsuarioCadastro1_14 extends Usuario {
  registro: string | null; // registro profissional, opcional
}

export type NovoUsuario1_14 = Pick<UsuarioCadastro1_14, "nome" | "funcao" | "perfil" | "registro">;

export type RespostaDesativar1_14 = { status: "ok" } | { status: "ultimo_admin" };

const usuariosCadastro1_14: UsuarioCadastro1_14[] = [
  ...USUARIOS.map((u) => ({ ...u, registro: u.funcao === "medico" ? "CRM-SP 000000" : null })),
  { id: "u-5", nome: "Carla Mendes", funcao: "tecnico_enfermagem", perfil: "operador", ativo: false, registro: null },
];

// PIN temporário: o "servidor" gera e devolve uma única vez.
const gerarPinTemporario1_14 = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(LIMITES.pinDigitos)), (n) => String(n % 10)).join("");

export function buscarUsuariosCadastro1_14(): Promise<UsuarioCadastro1_14[]> {
  return esperar(usuariosCadastro1_14.map((u) => ({ ...u })));
}

export function criarUsuario1_14(
  novo: NovoUsuario1_14,
): Promise<{ usuario: UsuarioCadastro1_14; pinTemporario: string }> {
  const usuario: UsuarioCadastro1_14 = { ...novo, id: `u-${crypto.randomUUID()}`, ativo: true };
  usuariosCadastro1_14.push(usuario);
  return esperar({ usuario: { ...usuario }, pinTemporario: gerarPinTemporario1_14() });
}

export function desativarUsuario1_14(usuarioId: string): Promise<RespostaDesativar1_14> {
  const alvo = usuariosCadastro1_14.find((u) => u.id === usuarioId);
  const adminsAtivos = usuariosCadastro1_14.filter((u) => u.ativo && u.perfil === "administrador").length;
  if (alvo?.ativo && alvo.perfil === "administrador" && adminsAtivos <= 1) {
    return esperar({ status: "ultimo_admin" });
  }
  if (alvo) alvo.ativo = false;
  return esperar({ status: "ok" });
}

export function redefinirPin1_14(_usuarioId: string): Promise<{ pinTemporario: string }> {
  return esperar({ pinTemporario: gerarPinTemporario1_14() });
}

// ── Tela 2.2 ──
// Casos de triagem enviados ao painel (2.2 Fila de casos; reaproveitados pela 2.3 Revisão do caso).
// Sem nome de paciente: o caso é identificado só pelo código do atendimento.
// Variações pela URL: ?fila=vazia (nenhum caso no painel)
export const cenarioFila2_2: "normal" | "vazia" =
  new URLSearchParams(window.location.search).get("fila") === "vazia" ? "vazia" : "normal";

export type StatusCaso2_2 = "aguardando" | "em_revisao" | "concluido";
export type DecisaoPonta2_2 = Exclude<Conduta, "indeterminado">;

export interface CasoPainel2_2 {
  id: string; // rota /painel/casos/:id
  codigo: string; // código do atendimento no aparelho
  unidade: string;
  aparelho: string;
  data_triagem: string; // ISO
  operador: string; // quem fez a triagem no aparelho
  local: string;
  faixa_idade: string; // faixas de LIMITES.faixaIdadeAnos, como na 1.4
  sexo: "feminino" | "masculino" | "nao_informado";
  resultado: Resultado; // conduta sugerida, risco, versão do modelo, classes, aviso
  decisao_ponta: DecisaoPonta2_2 | null; // null = profissional da ponta não registrou decisão
  status: StatusCaso2_2;
  revisor: { nome: string; email: string } | null; // quem abriu/concluiu a revisão
  espera_dias: number; // dias desde a triagem, calculados pelo "servidor"
}

// "Hoje" do painel = HOJE_MOCK, o mesmo dia das triagens do aparelho.
const esperaDias2_2 = (dataIso: string) =>
  Math.round((Date.parse(HOJE_MOCK) - Date.parse(dataIso.slice(0, 10))) / 86_400_000);

const resultado2_2 = (conduta: Conduta, risco: Risco | null, modelo_versao = "1.2.0"): Resultado => ({
  ...RESULTADO_PRIORITARIO_MOCK,
  conduta,
  risco,
  modelo_versao,
});

const REVISOR_OUTRO_2_2 = { nome: "Dr. Henrique Prado", email: "henrique.prado@exemplo.invalid" };
const REVISOR_SESSAO_2_2 = { nome: CONTAS_PAINEL[0].nome, email: CONTAS_PAINEL[0].email };

type CasoSemEspera2_2 = Omit<CasoPainel2_2, "espera_dias">;

const CASOS_BASE_2_2: CasoSemEspera2_2[] = [
  // Mesma triagem A-0412 do aparelho (TRIAGENS_MOCK), já sincronizada.
  { id: "c-0412", codigo: "A-0412", unidade: "UBS Jardim das Flores", aparelho: "SA-0017", data_triagem: "2026-11-10T09:12:00", operador: "Ana Souza", local: "Dorso", faixa_idade: "55–59", sexo: "feminino", resultado: resultado2_2("encaminhar_prioritario", "alto"), decisao_ponta: "encaminhar_prioritario", status: "aguardando", revisor: null },
  { id: "c-0377", codigo: "A-0377", unidade: "UBS Vila Nova", aparelho: "SA-0009", data_triagem: "2026-11-04T14:30:00", operador: "Rita Moraes", local: "Couro cabeludo", faixa_idade: "70–74", sexo: "masculino", resultado: resultado2_2("encaminhar_prioritario", "alto"), decisao_ponta: "encaminhar_eletivo", status: "aguardando", revisor: null },
  { id: "c-0391", codigo: "A-0391", unidade: "UBS Centro", aparelho: "SA-0004", data_triagem: "2026-11-06T11:05:00", operador: "Pedro Alves", local: "Mão direita", faixa_idade: "40–44", sexo: "feminino", resultado: resultado2_2("indeterminado", null), decisao_ponta: null, status: "aguardando", revisor: null },
  { id: "c-0365", codigo: "A-0365", unidade: "UBS Vila Nova", aparelho: "SA-0009", data_triagem: "2026-11-03T10:40:00", operador: "Rita Moraes", local: "Face", faixa_idade: "45–49", sexo: "masculino", resultado: resultado2_2("indeterminado", null), decisao_ponta: "encaminhar_eletivo", status: "aguardando", revisor: null },
  { id: "c-0358", codigo: "A-0358", unidade: "UBS Jardim das Flores", aparelho: "SA-0017", data_triagem: "2026-11-02T08:50:00", operador: "Marcos Ribeiro", local: "Perna esquerda", faixa_idade: "30–34", sexo: "nao_informado", resultado: resultado2_2("encaminhar_eletivo", "moderado", "1.1.3"), decisao_ponta: "encaminhar_eletivo", status: "aguardando", revisor: null },
  { id: "c-0402", codigo: "A-0402", unidade: "UBS Centro", aparelho: "SA-0004", data_triagem: "2026-11-07T15:20:00", operador: "Pedro Alves", local: "Ombro direito", faixa_idade: "60–64", sexo: "masculino", resultado: resultado2_2("encaminhar_eletivo", "moderado"), decisao_ponta: "seguimento", status: "aguardando", revisor: null },
  // Seguimento chega ao painel, mas fica fora da fila de revisão.
  { id: "c-0385", codigo: "A-0385", unidade: "UBS Centro", aparelho: "SA-0004", data_triagem: "2026-11-05T09:30:00", operador: "Pedro Alves", local: "Abdome", faixa_idade: "25–29", sexo: "feminino", resultado: resultado2_2("seguimento", "baixo"), decisao_ponta: "seguimento", status: "aguardando", revisor: null },
  { id: "c-0349", codigo: "A-0349", unidade: "UBS Vila Nova", aparelho: "SA-0009", data_triagem: "2026-11-01T16:10:00", operador: "Rita Moraes", local: "Tórax", faixa_idade: "65–69", sexo: "masculino", resultado: resultado2_2("encaminhar_prioritario", "alto", "1.1.3"), decisao_ponta: "encaminhar_prioritario", status: "em_revisao", revisor: REVISOR_OUTRO_2_2 },
  { id: "c-0395", codigo: "A-0395", unidade: "UBS Jardim das Flores", aparelho: "SA-0017", data_triagem: "2026-11-06T13:45:00", operador: "Ana Souza", local: "Braço esquerdo", faixa_idade: "50–54", sexo: "feminino", resultado: resultado2_2("encaminhar_eletivo", "moderado"), decisao_ponta: "encaminhar_prioritario", status: "em_revisao", revisor: REVISOR_SESSAO_2_2 },
  { id: "c-0330", codigo: "A-0330", unidade: "UBS Centro", aparelho: "SA-0004", data_triagem: "2026-10-27T10:00:00", operador: "Pedro Alves", local: "Costas", faixa_idade: "75–79", sexo: "masculino", resultado: resultado2_2("encaminhar_prioritario", "alto", "1.1.3"), decisao_ponta: "encaminhar_prioritario", status: "concluido", revisor: REVISOR_SESSAO_2_2 },
  { id: "c-0341", codigo: "A-0341", unidade: "UBS Jardim das Flores", aparelho: "SA-0017", data_triagem: "2026-10-30T14:15:00", operador: "Marcos Ribeiro", local: "Pescoço", faixa_idade: "35–39", sexo: "feminino", resultado: resultado2_2("encaminhar_eletivo", "moderado", "1.1.3"), decisao_ponta: null, status: "concluido", revisor: REVISOR_OUTRO_2_2 },
];

export const CASOS_PAINEL_2_2: CasoPainel2_2[] = CASOS_BASE_2_2.map((c) => ({
  ...c,
  espera_dias: esperaDias2_2(c.data_triagem),
}));

export function buscarCasosPainel2_2(): Promise<CasoPainel2_2[]> {
  return esperar(cenarioFila2_2 === "vazia" ? [] : CASOS_PAINEL_2_2);
}

export function buscarCasoPainel2_2(id: string): Promise<CasoPainel2_2 | null> {
  return esperar(CASOS_PAINEL_2_2.find((c) => c.id === id) ?? null);
}

// ── Tela 1.6 ── Captura reprovada ──────────────────────────────────────
// O controle de qualidade identifica o motivo pelo código (a 1.5 hoje só devolve QC-FOCO).
// Variações pela URL, só para testar a 1.6:
// ?reprovacao=foco|enquadramento|escura|clara (troca o motivo recebido da 1.5)
// ?reprovacoes-seguidas=3 (mostra a orientação de várias reprovações seguidas)
export const CODIGOS_REPROVACAO_1_6 = {
  foco: "QC-FOCO",
  enquadramento: "QC-ENQUADRAMENTO",
  escura: "QC-ESCURA",
  clara: "QC-CLARA",
} as const;

export type MotivoReprovacao1_6 = keyof typeof CODIGOS_REPROVACAO_1_6;

const parametrosReprovacao1_6 = new URLSearchParams(window.location.search);
const motivoTeste1_6 = parametrosReprovacao1_6.get("reprovacao");
export const reprovacoesSeguidasTeste1_6 = Number(parametrosReprovacao1_6.get("reprovacoes-seguidas")) || 0;

// Coordenadas em % da imagem (viewBox 0–100). "quadro" = o problema é a imagem inteira.
export type AreaReprovacao1_6 = { tipo: "circulo"; cx: number; cy: number; r: number } | { tipo: "quadro" };

export interface CapturaReprovada1_6 {
  codigo: string;
  motivo: MotivoReprovacao1_6 | null; // null = código que a tela não conhece
  imagem_url: string;
  area: AreaReprovacao1_6;
  centro_esperado: { cx: number; cy: number; r: number } | null; // só no enquadramento
}

const svgCaptura1_6 = (conteudo: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${conteudo}</svg>`);

// A 1.5 devolve sempre a mesma imagem; aqui simulamos como a captura teria saído em cada motivo.
const IMAGENS_REPROVADAS_1_6: Record<MotivoReprovacao1_6, string> = {
  foco: svgCaptura1_6(
    '<defs><filter id="b"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="400" height="400" fill="#c9b9a6"/><g filter="url(#b)"><ellipse cx="188" cy="196" rx="70" ry="58" fill="#6b4a33" opacity="0.5"/><ellipse cx="212" cy="204" rx="70" ry="58" fill="#6b4a33" opacity="0.7"/></g>',
  ),
  enquadramento: svgCaptura1_6(
    '<rect width="400" height="400" fill="#c9b9a6"/><ellipse cx="320" cy="300" rx="70" ry="58" fill="#6b4a33"/>',
  ),
  escura: svgCaptura1_6(
    '<rect width="400" height="400" fill="#2e2620"/><ellipse cx="200" cy="200" rx="70" ry="58" fill="#1a130e"/>',
  ),
  clara: svgCaptura1_6(
    '<rect width="400" height="400" fill="#f4efe9"/><ellipse cx="200" cy="200" rx="70" ry="58" fill="#ddcdbd"/>',
  ),
};

const AREAS_REPROVACAO_1_6: Record<MotivoReprovacao1_6, AreaReprovacao1_6> = {
  foco: { tipo: "circulo", cx: 50, cy: 50, r: 26 },
  enquadramento: { tipo: "circulo", cx: 80, cy: 75, r: 22 },
  escura: { tipo: "quadro" },
  clara: { tipo: "quadro" },
};

// Mesmo círculo-guia da 1.5.
const CENTRO_ESPERADO_1_6 = { cx: 50, cy: 50, r: 30 };

export function buscarCapturaReprovada1_6(codigoRecebido: string, capturaUrl: string | null): Promise<CapturaReprovada1_6> {
  const codigo =
    motivoTeste1_6 && motivoTeste1_6 in CODIGOS_REPROVACAO_1_6
      ? CODIGOS_REPROVACAO_1_6[motivoTeste1_6 as MotivoReprovacao1_6]
      : codigoRecebido;
  const motivo =
    (Object.keys(CODIGOS_REPROVACAO_1_6) as MotivoReprovacao1_6[]).find((m) => CODIGOS_REPROVACAO_1_6[m] === codigo) ??
    null;
  return esperar({
    codigo,
    motivo,
    imagem_url: motivo ? IMAGENS_REPROVADAS_1_6[motivo] : (capturaUrl ?? CAPTURA_IMAGEM_MOCK_URL),
    area: motivo ? AREAS_REPROVACAO_1_6[motivo] : { tipo: "quadro" },
    centro_esperado: motivo === "enquadramento" ? CENTRO_ESPERADO_1_6 : null,
  });
}

export const MOTIVO_NAO_ANALISADO_1_6 = "Não analisado — captura inadequada";

export interface TriagemNaoAnalisada1_6 extends Triagem {
  motivo_sem_resultado: string;
}

// Registra o atendimento sem resultado; entra na lista de hoje da 1.3 e nas pendentes de envio.
export function registrarNaoAnalisado1_6(dados: { codigo: string; local: string; operador_id: string }): Promise<void> {
  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const triagem: TriagemNaoAnalisada1_6 = {
    id: `t-${crypto.randomUUID()}`,
    ...dados,
    data: `${HOJE_MOCK}T${hora}:00`,
    resultado: null,
    sync: "aguardando",
    motivo_sem_resultado: MOTIVO_NAO_ANALISADO_1_6,
  };
  TRIAGENS_MOCK.push(triagem);
  return esperar(undefined);
}

// ── Tela 2.3 ──
// Revisão do caso. O desfecho do especialista fica num registro à parte: não altera o
// resultado do modelo. Em memória: some ao recarregar.
export type CondutaEspecialista2_3 = "biopsia" | "excisao" | "acompanhamento" | "alta";
export type ConcordanciaPrioridade2_3 = "adequada" | "deveria_ser_maior" | "deveria_ser_menor";

// Valor do select histopatológico fora das classes do modelo.
export const HISTOPATOLOGICO_OUTRO_2_3 = "outro";

export interface Desfecho2_3 {
  conduta: CondutaEspecialista2_3;
  concordancia: ConcordanciaPrioridade2_3;
  histopatologico: string | null; // rótulo da classe, HISTOPATOLOGICO_OUTRO_2_3 ou null = ainda não disponível
}

export interface DesfechoRegistrado2_3 extends Desfecho2_3 {
  caso_id: string;
  revisor: { nome: string; email: string };
  registrado_em: string; // ISO
}

// Só a triagem A-0412 (a mesma do aparelho) chegou com imagem; as demais não foram enviadas.
const IMAGENS_CASOS_2_3: Record<string, string> = { "c-0412": CAPTURA_IMAGEM_MOCK_URL };

export function buscarImagemCaso2_3(casoId: string): Promise<string | null> {
  return esperar(IMAGENS_CASOS_2_3[casoId] ?? null);
}

const desfechos2_3 = new Map<string, DesfechoRegistrado2_3>();

// Conclui a revisão do caso na fila (2.2); o resultado do modelo fica como estava.
export function registrarDesfecho2_3(
  casoId: string,
  desfecho: Desfecho2_3,
  revisor: { nome: string; email: string },
): Promise<void> {
  desfechos2_3.set(casoId, { ...desfecho, caso_id: casoId, revisor, registrado_em: new Date().toISOString() });
  const caso = CASOS_PAINEL_2_2.find((c) => c.id === casoId);
  if (caso) {
    caso.status = "concluido";
    caso.revisor = revisor;
  }
  return esperar(undefined);
}

// ── Tela 1.7 ── Processando ────────────────────────────────────────────
// Regra do mock pelo local escolhido na 1.4:
// pé ("Pé … (peito do pé)" / "Pé … (sola)") → indeterminado (1.9) · "Dorso" → prioritário (1.8) · outros → seguimento (1.8).
// Variações pela URL, além de ?cenario=lento (análise só responde depois do limite de TEMPOS.predictTimeoutMs):
// ?analise=lenta (o mesmo, sem travar a 1.1) · ?analise=sem-aviso (resposta chega sem o aviso de triagem)
const parametroAnalise1_7 = new URLSearchParams(window.location.search).get("analise");
const analiseLenta1_7 = cenario === "lento" || parametroAnalise1_7 === "lenta";
const analiseSemAviso1_7 = parametroAnalise1_7 === "sem-aviso";

export const ANALISE_DURACAO_MS_1_7 = 3_000;
// Resposta que chegou sem o aviso de triagem: a tela não mostra resultado.
export const CODIGO_SEM_AVISO_1_7 = "API-SEM-AVISO";

export const RESULTADO_SEGUIMENTO_MOCK_1_7: Resultado = {
  ...RESULTADO_PRIORITARIO_MOCK,
  conduta: "seguimento",
  risco: "baixo",
  classes: [
    { rotulo: "nv", nome: "Nevo melanocítico", valor: 0.82 },
    { rotulo: "bkl", nome: "Ceratose benigna pigmentada", valor: 0.12 },
    { rotulo: "mel", nome: "Melanoma", valor: 0.06 },
  ],
  probabilidade_maligna: 0.08,
};

export const RESULTADO_INDETERMINADO_MOCK_1_7: Resultado = {
  ...RESULTADO_PRIORITARIO_MOCK,
  conduta: "indeterminado",
  risco: null,
  classes: [
    { rotulo: "nv", nome: "Nevo melanocítico", valor: 0.38 },
    { rotulo: "mel", nome: "Melanoma", valor: 0.34 },
    { rotulo: "bkl", nome: "Ceratose benigna pigmentada", valor: 0.28 },
  ],
  probabilidade_maligna: 0.41,
};

const resultadoPorLocal1_7 = (local: string): Resultado => {
  const l = local.trim().toLowerCase();
  if (l.startsWith("pé") || l.includes("sola") || l.includes("peito do pé")) return RESULTADO_INDETERMINADO_MOCK_1_7;
  if (l === "dorso") return RESULTADO_PRIORITARIO_MOCK;
  return RESULTADO_SEGUIMENTO_MOCK_1_7;
};

export function analisarImagem1_7(dados: { local: string; imagemUrl: string }): Promise<Resultado> {
  const base = resultadoPorLocal1_7(dados.local);
  const resultado = analiseSemAviso1_7 ? { ...base, aviso: "" } : base;
  return esperar(
    resultado,
    analiseLenta1_7 ? TEMPOS.predictTimeoutMs + ANALISE_DURACAO_MS_1_7 : ANALISE_DURACAO_MS_1_7,
  );
}

// ── Tela 1.15 ──
// Histórico da unidade (admin): todas as triagens do aparelho, de todos os operadores.
// O "servidor" junta TRIAGENS_MOCK (inclusive as acrescentadas em tempo de execução) com
// triagens mais antigas da mesma unidade, nome do operador, capturas, decisão do profissional
// e anulação. Os códigos A-0341, A-0358 e A-0395 batem com os casos da 2.2 (UBS Jardim das Flores).
// Variações pela URL: ?historico-unidade=vazio (nenhum registro)
export const cenarioHistoricoUnidade1_15: "normal" | "vazio" =
  new URLSearchParams(window.location.search).get("historico-unidade") === "vazio" ? "vazio" : "normal";

export type MotivoAnulacao1_15 = "codigo_errado" | "triagem_de_teste" | "outro_paciente";

export const MOTIVOS_ANULACAO_1_15: { valor: MotivoAnulacao1_15; rotulo: string }[] = [
  { valor: "codigo_errado", rotulo: "Código errado" },
  { valor: "triagem_de_teste", rotulo: "Triagem de teste" },
  { valor: "outro_paciente", rotulo: "Outro paciente" },
];

export type DecisaoProfissional1_15 = Exclude<Conduta, "indeterminado">;

export interface Anulacao1_15 {
  motivo: MotivoAnulacao1_15;
  por: string; // nome do administrador
  em: string; // ISO
}

export interface TriagemUnidade1_15 extends Triagem {
  operador_nome: string;
  operador_ativo: boolean;
  // null = o aparelho não registrou as tentativas desta triagem
  capturas: { feitas: number; reprovadas: number } | null;
  decisao_profissional: DecisaoProfissional1_15 | null; // null = sem decisão registrada
  anulacao: Anulacao1_15 | null;
}

export type RespostaAnular1_15 =
  | { status: "ok" }
  | { status: "incorreto"; restantes: number }
  | { status: "pausado"; minutos: number };

export const CODIGO_PIN_PAUSADO_1_15 = "ADM-PIN-PAUSA";

// Usuários que já não estão em USUARIOS (desativados ou fora do login padrão).
const OPERADORES_EXTRAS_1_15: Usuario[] = [
  { id: "u-4", nome: "Paulo Lima", funcao: "tecnico_enfermagem", perfil: "operador", ativo: true },
  { id: "u-5", nome: "Carla Mendes", funcao: "tecnico_enfermagem", perfil: "operador", ativo: false },
];

const resultado1_15 = (conduta: Conduta, risco: Risco | null, modelo_versao = "1.2.0"): Resultado => ({
  ...RESULTADO_PRIORITARIO_MOCK,
  conduta,
  risco,
  modelo_versao,
});

const TRIAGENS_ANTERIORES_1_15: Triagem[] = [
  { id: "t-0341", codigo: "A-0341", data: "2026-10-30T14:15:00", operador_id: "u-2", local: "Pescoço", resultado: resultado1_15("encaminhar_eletivo", "moderado", "1.1.3"), sync: "enviado" },
  { id: "t-0352", codigo: "A-0352", data: "2026-11-01T09:20:00", operador_id: "u-5", local: "Perna direita", resultado: resultado1_15("seguimento", "baixo", "1.1.3"), sync: "enviado" },
  { id: "t-0358", codigo: "A-0358", data: "2026-11-02T08:50:00", operador_id: "u-2", local: "Perna esquerda", resultado: resultado1_15("encaminhar_eletivo", "moderado", "1.1.3"), sync: "enviado" },
  { id: "t-0363", codigo: "A-0363", data: "2026-11-03T11:30:00", operador_id: "u-1", local: "Mão esquerda", resultado: resultado1_15("indeterminado", null), sync: "enviado" },
  { id: "t-0370", codigo: "A-0370", data: "2026-11-04T10:10:00", operador_id: "u-5", local: "Face", resultado: null, sync: "enviado" },
  { id: "t-0374", codigo: "A-0374", data: "2026-11-04T15:40:00", operador_id: "u-2", local: "Dorso", resultado: resultado1_15("seguimento", "baixo"), sync: "enviado" },
  { id: "t-0381", codigo: "A-0381", data: "2026-11-05T09:05:00", operador_id: "u-1", local: "Tórax", resultado: resultado1_15("encaminhar_prioritario", "alto"), sync: "enviado" },
  { id: "t-0388", codigo: "A-0388", data: "2026-11-05T14:25:00", operador_id: "u-1", local: "Abdome", resultado: resultado1_15("seguimento", "baixo"), sync: "enviado" },
  { id: "t-0395", codigo: "A-0395", data: "2026-11-06T13:45:00", operador_id: "u-1", local: "Braço esquerdo", resultado: resultado1_15("encaminhar_eletivo", "moderado"), sync: "enviado" },
  { id: "t-0399", codigo: "A-0399", data: "2026-11-07T08:40:00", operador_id: "u-2", local: "Couro cabeludo", resultado: resultado1_15("encaminhar_eletivo", "moderado"), sync: "enviado" },
  { id: "t-0404", codigo: "A-0404", data: "2026-11-08T10:50:00", operador_id: "u-2", local: "Orelha direita", resultado: resultado1_15("seguimento", "baixo"), sync: "enviado" },
  { id: "t-0407", codigo: "A-0407", data: "2026-11-09T16:15:00", operador_id: "u-1", local: "Ombro esquerdo", resultado: resultado1_15("encaminhar_prioritario", "alto"), sync: "enviado" },
];

// Por id de triagem. Triagens criadas em tempo de execução (1.6, 1.7) ainda não têm estes dados.
const REGISTROS_1_15: Record<string, { capturas: { feitas: number; reprovadas: number }; decisao: DecisaoProfissional1_15 | null }> = {
  "t-0341": { capturas: { feitas: 1, reprovadas: 0 }, decisao: null },
  "t-0352": { capturas: { feitas: 2, reprovadas: 1 }, decisao: "seguimento" },
  "t-0358": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "encaminhar_eletivo" },
  "t-0363": { capturas: { feitas: 3, reprovadas: 2 }, decisao: "encaminhar_eletivo" },
  "t-0370": { capturas: { feitas: 3, reprovadas: 3 }, decisao: null },
  "t-0374": { capturas: { feitas: 1, reprovadas: 0 }, decisao: null },
  "t-0381": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "encaminhar_prioritario" },
  "t-0388": { capturas: { feitas: 2, reprovadas: 1 }, decisao: "encaminhar_eletivo" },
  "t-0395": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "encaminhar_prioritario" },
  "t-0399": { capturas: { feitas: 2, reprovadas: 1 }, decisao: "encaminhar_eletivo" },
  "t-0404": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "seguimento" },
  "t-0407": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "encaminhar_prioritario" },
  "t-0412": { capturas: { feitas: 1, reprovadas: 0 }, decisao: "encaminhar_prioritario" },
  "t-0418": { capturas: { feitas: 2, reprovadas: 1 }, decisao: "seguimento" },
  "t-0421": { capturas: { feitas: 1, reprovadas: 0 }, decisao: null },
  "t-0423": { capturas: { feitas: 3, reprovadas: 3 }, decisao: null },
};

// Anulações no "servidor" em memória: somem ao recarregar. A-0374 já vem anulada para mostrar o estado.
const anulacoes1_15 = new Map<string, Anulacao1_15>([
  ["t-0374", { motivo: "triagem_de_teste", por: "Joana Costa", em: "2026-11-04T16:02:00" }],
]);

export function buscarTriagensUnidade1_15(): Promise<TriagemUnidade1_15[]> {
  if (cenarioHistoricoUnidade1_15 === "vazio") return esperar([]);
  const usuarios = [...USUARIOS, ...OPERADORES_EXTRAS_1_15];
  return esperar(
    [...TRIAGENS_ANTERIORES_1_15, ...TRIAGENS_MOCK].map((t) => {
      const u = usuarios.find((x) => x.id === t.operador_id);
      const r = REGISTROS_1_15[t.id];
      return {
        ...t,
        operador_nome: u?.nome ?? "Operador não identificado",
        operador_ativo: u?.ativo ?? false,
        capturas: r ? { ...r.capturas } : null,
        decisao_profissional: r?.decisao ?? null,
        anulacao: anulacoes1_15.get(t.id) ?? null,
      };
    }),
  );
}

// Confere o PIN do administrador (mesma regra de tentativas e pausa do login) e anula o registro.
export async function anularTriagem1_15(dados: {
  triagemId: string;
  motivo: MotivoAnulacao1_15;
  adminId: string;
  adminNome: string;
  pin: string;
}): Promise<RespostaAnular1_15> {
  const r = await verificarPin(dados.adminId, dados.pin);
  if (r.status !== "ok") return r;
  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  anulacoes1_15.set(dados.triagemId, { motivo: dados.motivo, por: dados.adminNome, em: `${HOJE_MOCK}T${hora}:00` });
  return { status: "ok" };
}

// ── Tela 1.8 ── Resultado ──────────────────────────────────────────────
// Decisão opcional do profissional da ponta; "outra" = conduta fora das três sugeridas.
export type DecisaoProfissional1_8 = Exclude<Conduta, "indeterminado"> | "outra";

export interface TriagemSalva1_8 extends Triagem {
  decisao_profissional: DecisaoProfissional1_8 | null; // null = não registrada
}

// Momento da triagem: dia do protótipo (HOJE_MOCK) com a hora do aparelho, como na 1.6.
export function momentoTriagem1_8(): string {
  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  return `${HOJE_MOCK}T${hora}:00`;
}

// Salva a triagem com o resultado; entra na lista de hoje da 1.3 e nas pendentes de envio.
export function registrarTriagem1_8(dados: {
  codigo: string;
  local: string;
  operador_id: string;
  data: string; // ISO, de momentoTriagem1_8
  resultado: Resultado;
  decisao_profissional: DecisaoProfissional1_8 | null;
}): Promise<void> {
  const triagem: TriagemSalva1_8 = { id: `t-${crypto.randomUUID()}`, ...dados, sync: "aguardando" };
  TRIAGENS_MOCK.push(triagem);
  return esperar(undefined);
}

// ── Tela 1.16 ──
// Atualização do modelo (admin). O modelo em uso vem do mesmo status da 1.13 até a primeira
// instalação/reversão; depois fica no "servidor" em memória (some ao recarregar).
// O aparelho nunca atualiza sozinho: só instala/reverte quando a tela chama instalarModelo1_16.
// Variações pela URL:
// ?atualizacao-modelo=falha (a nova versão não passa no teste de verificação → MOD-FUMACA)
// ?atualizacao-modelo=nenhuma (nenhuma atualização disponível)
// ?triagem-em-andamento=sim (simula uma triagem aberta: instalar e reverter ficam desabilitados)
const parametros1_16 = new URLSearchParams(window.location.search);
const parametroAtualizacao1_16 = parametros1_16.get("atualizacao-modelo");
export const cenarioAtualizacao1_16: "normal" | "falha" | "nenhuma" =
  parametroAtualizacao1_16 === "falha" || parametroAtualizacao1_16 === "nenhuma" ? parametroAtualizacao1_16 : "normal";
export const triagemEmAndamentoTeste1_16 = parametros1_16.get("triagem-em-andamento") === "sim";

export interface VersaoModelo1_16 {
  nome: string;
  versao: string;
}

export interface ModeloEmUso1_16 extends VersaoModelo1_16 {
  instalado_em: string; // ISO
}

export interface PacoteModelo1_16 extends VersaoModelo1_16 {
  mudancas: string[];
  tipo_mudanca: string;
}

export interface SituacaoModelo1_16 {
  em_uso: ModeloEmUso1_16;
  disponivel: PacoteModelo1_16 | null; // null = nenhuma atualização disponível
  anterior: VersaoModelo1_16 | null; // null = nenhuma versão anterior guardada
}

export type EtapaInstalacao1_16 = "integridade" | "teste" | "troca";
export const ETAPAS_INSTALACAO_1_16: EtapaInstalacao1_16[] = ["integridade", "teste", "troca"];
export const ETAPA_INSTALACAO_MS_1_16 = 1_500;

export type AcaoModelo1_16 = "instalar" | "reverter";

export type RespostaInstalacao1_16 =
  | { status: "ok"; versao: VersaoModelo1_16 }
  | { status: "nao_passou"; etapa: EtapaInstalacao1_16; versao: VersaoModelo1_16; continua_com: VersaoModelo1_16 };

const PACOTE_DISPONIVEL_1_16: PacoteModelo1_16 = {
  nome: RESULTADO_PRIORITARIO_MOCK.modelo,
  versao: "1.3.0",
  mudancas: [
    "Retreinado com mais imagens de peles com fototipos IV a VI.",
    "Mesmas classes e mesmas condutas sugeridas da versão em uso.",
    "Análise mais rápida no aparelho.",
  ],
  tipo_mudanca: "Retreino com mais dados (classes e limiar de encaminhamento mantidos)",
};

// Mesma versão anterior que aparece nas triagens antigas (1.15, 2.2).
const VERSAO_ANTERIOR_1_16: VersaoModelo1_16 = { nome: RESULTADO_PRIORITARIO_MOCK.modelo, versao: "1.1.3" };

let emUso1_16: ModeloEmUso1_16 | null = null;
let disponivel1_16: PacoteModelo1_16 | null = cenarioAtualizacao1_16 === "nenhuma" ? null : PACOTE_DISPONIVEL_1_16;
let anterior1_16: VersaoModelo1_16 | null = VERSAO_ANTERIOR_1_16;

const agoraIso1_16 = () => {
  const d = new Date();
  return `${HOJE_MOCK}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
};

export async function buscarSituacaoModelo1_16(): Promise<SituacaoModelo1_16> {
  if (!emUso1_16) {
    const { modelo } = await buscarStatusAparelho1_13();
    emUso1_16 = { nome: modelo.nome, versao: modelo.versao, instalado_em: modelo.instalado_em };
  }
  return {
    em_uso: { ...emUso1_16 },
    disponivel: disponivel1_16 && { ...disponivel1_16, mudancas: [...disponivel1_16.mudancas] },
    anterior: anterior1_16 && { ...anterior1_16 },
  };
}

// Avisa cada etapa ao começar. Só ?atualizacao-modelo=falha reprova, e só a instalação da nova versão.
export async function instalarModelo1_16(
  acao: AcaoModelo1_16,
  aoIniciarEtapa: (etapa: EtapaInstalacao1_16) => void,
): Promise<RespostaInstalacao1_16> {
  const { em_uso, disponivel, anterior } = await buscarSituacaoModelo1_16();
  const alvo = acao === "instalar" ? disponivel : anterior;
  if (!alvo) throw new Error(`instalarModelo1_16: nada para ${acao}`);
  const atual: VersaoModelo1_16 = { nome: em_uso.nome, versao: em_uso.versao };

  for (const etapa of ETAPAS_INSTALACAO_1_16) {
    aoIniciarEtapa(etapa);
    await esperar(undefined, ETAPA_INSTALACAO_MS_1_16);
    if (acao === "instalar" && etapa === "teste" && cenarioAtualizacao1_16 === "falha") {
      return { status: "nao_passou", etapa, versao: { nome: alvo.nome, versao: alvo.versao }, continua_com: atual };
    }
  }

  emUso1_16 = { nome: alvo.nome, versao: alvo.versao, instalado_em: agoraIso1_16() };
  if (acao === "instalar") {
    anterior1_16 = atual;
    disponivel1_16 = null;
  } else {
    anterior1_16 = null;
    // A versão revertida volta a ficar disponível para instalar depois.
    if (atual.versao === PACOTE_DISPONIVEL_1_16.versao) disponivel1_16 = PACOTE_DISPONIVEL_1_16;
  }
  return { status: "ok", versao: { nome: alvo.nome, versao: alvo.versao } };
}

// ── Tela 2.4 ──
// Métricas do painel (perfil equipe). Números simulados, um conjunto por período; a tela avisa isso no topo.
// O "servidor" calcula proporção e IC95 (Wilson) a partir das contagens e não estima abaixo de N_MINIMO_ESTIMATIVA_2_4.
export type PeriodoDias2_4 = 7 | 30 | 90 | 365;
export const PERIODOS_DIAS_2_4: PeriodoDias2_4[] = [7, 30, 90, 365];
export const PERIODO_PADRAO_2_4: PeriodoDias2_4 = 30;
export const N_MINIMO_ESTIMATIVA_2_4 = 10;
// PSI abaixo de "atencao" = estável; entre os dois = atenção; a partir de "investigar" = investigar.
export const LIMIARES_PSI_2_4 = { atencao: 0.1, investigar: 0.25 } as const;

export type Estimativa2_4 =
  | { n: number; suficiente: true; valor: number; ic95: [number, number] }
  | { n: number; suficiente: false };

const Z95_2_4 = 1.96;

const proporcao2_4 = (x: number, n: number): Estimativa2_4 => {
  if (n < N_MINIMO_ESTIMATIVA_2_4) return { n, suficiente: false };
  const p = x / n;
  const z2 = Z95_2_4 ** 2;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margem = (Z95_2_4 / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { n, suficiente: true, valor: p, ic95: [Math.max(0, centro - margem), Math.min(1, centro + margem)] };
};

// PSI não é proporção: valor e IC95 (bootstrap) chegam prontos do "servidor".
const indice2_4 = (valor: number, ic95: [number, number], n: number): Estimativa2_4 =>
  n < N_MINIMO_ESTIMATIVA_2_4 ? { n, suficiente: false } : { n, suficiente: true, valor, ic95 };

export type ClasseHisto2_4 = "mel" | "bcc" | "cec" | "nv" | "bkl" | "df";

export const CLASSES_HISTO_2_4: { rotulo: ClasseHisto2_4; nome: string; maligna: boolean }[] = [
  { rotulo: "mel", nome: "Melanoma", maligna: true },
  { rotulo: "bcc", nome: "Carcinoma basocelular", maligna: true },
  { rotulo: "cec", nome: "Carcinoma espinocelular", maligna: true },
  { rotulo: "nv", nome: "Nevo melanocítico", maligna: false },
  { rotulo: "bkl", nome: "Ceratose seborreica e similares", maligna: false },
  { rotulo: "df", nome: "Dermatofibroma", maligna: false },
];

// Colunas da matriz de confusão = conduta sugerida, nesta ordem.
export const CONDUTAS_MATRIZ_2_4: Conduta[] = ["encaminhar_prioritario", "encaminhar_eletivo", "seguimento", "indeterminado"];

export interface LinhaMatriz2_4 {
  rotulo: ClasseHisto2_4;
  nome: string;
  maligna: boolean;
  contagens: Record<Conduta, number>;
  n: number;
}

export interface PorClasse2_4 {
  rotulo: ClasseHisto2_4;
  nome: string;
  maligna: boolean;
  encaminhamento: Estimativa2_4; // prioritário + eletivo sugeridos / casos da classe
}

export interface AlertaDrift2_4 {
  id: string;
  desde: string; // ISO
  metrica: string;
  escopo: string;
  estimativa: Estimativa2_4;
  limiar: number;
  formato: "proporcao" | "indice";
  aparelho: string | null; // abre a 2.5 quando o gatilho é de um aparelho
}

export interface PartesPonta2_4 {
  concordante: number;
  ponta_maior: number; // profissional da ponta escolheu prioridade maior que a sugerida
  ponta_menor: number;
}

export interface Metricas2_4 {
  dias: PeriodoDias2_4;
  inicio: string; // aaaa-mm-dd
  fim: string; // aaaa-mm-dd
  atualizado_em: string; // ISO
  modelo_versoes: string[];
  desempenho: {
    n_com_desfecho: number;
    sensibilidade_maligna: Estimativa2_4; // malignas no histopatológico com encaminhamento sugerido
    falso_negativo_critico: Estimativa2_4; // malignas no histopatológico com seguimento sugerido
    matriz: LinhaMatriz2_4[];
  };
  por_classe: PorClasse2_4[];
  sinais: {
    encaminhamento: Estimativa2_4;
    indeterminado: Estimativa2_4;
    captura_reprovada: Estimativa2_4;
    psi: Estimativa2_4;
  };
  concordancia: {
    ponta: Estimativa2_4;
    ponta_partes: PartesPonta2_4;
    especialista: Estimativa2_4;
    especialista_partes: Record<ConcordanciaPrioridade2_3, number>;
  };
  alertas: AlertaDrift2_4[];
}

interface Base2_4 {
  inicio: string;
  modelo_versoes: string[];
  matriz: Record<ClasseHisto2_4, [prioritario: number, eletivo: number, seguimento: number, indeterminado: number]>;
  triagens: number;
  encaminhadas: number;
  indeterminadas: number;
  capturas: number;
  reprovadas: number;
  psi: { valor: number; ic95: [number, number] };
  ponta: PartesPonta2_4;
  especialista: Record<ConcordanciaPrioridade2_3, number>;
  alertas: AlertaDrift2_4[];
}

const ATUALIZADO_EM_2_4 = `${HOJE_MOCK}T06:00:00`;

const BASES_2_4: Record<PeriodoDias2_4, Base2_4> = {
  7: {
    inicio: "2026-11-04",
    modelo_versoes: ["1.2.0"],
    matriz: { mel: [1, 0, 0, 1], bcc: [1, 1, 0, 0], cec: [0, 0, 0, 0], nv: [0, 2, 3, 0], bkl: [0, 1, 1, 0], df: [0, 0, 0, 0] },
    triagens: 91,
    encaminhadas: 33,
    indeterminadas: 9,
    capturas: 108,
    reprovadas: 17,
    psi: { valor: 0.19, ic95: [0.07, 0.34] },
    ponta: { concordante: 63, ponta_maior: 3, ponta_menor: 5 },
    especialista: { adequada: 15, deveria_ser_maior: 2, deveria_ser_menor: 2 },
    alertas: [
      { id: "d-cap-sa0009-7", desde: "2026-11-05T06:00:00", metrica: "Captura reprovada", escopo: "UBS Vila Nova · aparelho SA-0009", estimativa: proporcao2_4(8, 30), limiar: 0.2, formato: "proporcao", aparelho: "SA-0009" },
    ],
  },
  30: {
    inicio: "2026-10-12",
    modelo_versoes: ["1.2.0"],
    matriz: { mel: [8, 2, 0, 1], bcc: [3, 4, 1, 1], cec: [1, 2, 0, 0], nv: [2, 5, 13, 2], bkl: [1, 3, 6, 1], df: [0, 1, 1, 0] },
    triagens: 402,
    encaminhadas: 139,
    indeterminadas: 37,
    capturas: 471,
    reprovadas: 69,
    psi: { valor: 0.14, ic95: [0.08, 0.21] },
    ponta: { concordante: 271, ponta_maior: 20, ponta_menor: 31 },
    especialista: { adequada: 77, deveria_ser_maior: 7, deveria_ser_menor: 12 },
    alertas: [
      { id: "d-psi-30", desde: "2026-11-06T06:00:00", metrica: "PSI da probabilidade de malignidade", escopo: "Todas as unidades", estimativa: indice2_4(0.14, [0.08, 0.21], 402), limiar: 0.1, formato: "indice", aparelho: null },
      { id: "d-cap-sa0009-30", desde: "2026-11-05T06:00:00", metrica: "Captura reprovada", escopo: "UBS Vila Nova · aparelho SA-0009", estimativa: proporcao2_4(31, 129), limiar: 0.2, formato: "proporcao", aparelho: "SA-0009" },
    ],
  },
  90: {
    inicio: "2026-08-13",
    modelo_versoes: ["1.1.3", "1.2.0"],
    matriz: { mel: [15, 4, 1, 2], bcc: [8, 13, 2, 2], cec: [3, 4, 1, 1], nv: [6, 15, 38, 5], bkl: [2, 10, 18, 4], df: [0, 2, 4, 1] },
    triagens: 1215,
    encaminhadas: 413,
    indeterminadas: 104,
    capturas: 1420,
    reprovadas: 205,
    psi: { valor: 0.09, ic95: [0.06, 0.13] },
    ponta: { concordante: 851, ponta_maior: 58, ponta_menor: 78 },
    especialista: { adequada: 233, deveria_ser_maior: 21, deveria_ser_menor: 33 },
    alertas: [
      { id: "d-ind-sa0004-90", desde: "2026-09-22T06:00:00", metrica: "Indeterminado", escopo: "UBS Centro · aparelho SA-0004", estimativa: proporcao2_4(58, 387), limiar: 0.12, formato: "proporcao", aparelho: "SA-0004" },
    ],
  },
  365: {
    inicio: "2025-11-11",
    modelo_versoes: ["1.1.3", "1.2.0"],
    matriz: { mel: [58, 14, 3, 6], bcc: [31, 52, 6, 7], cec: [12, 15, 2, 3], nv: [22, 61, 148, 19], bkl: [9, 38, 71, 14], df: [1, 6, 15, 3] },
    triagens: 4820,
    encaminhadas: 1590,
    indeterminadas: 386,
    capturas: 5610,
    reprovadas: 790,
    psi: { valor: 0.06, ic95: [0.04, 0.08] },
    ponta: { concordante: 3402, ponta_maior: 214, ponta_menor: 294 },
    especialista: { adequada: 902, deveria_ser_maior: 71, deveria_ser_menor: 131 },
    alertas: [],
  },
};

const montarMetricas2_4 = (dias: PeriodoDias2_4): Metricas2_4 => {
  const b = BASES_2_4[dias];
  const matriz: LinhaMatriz2_4[] = CLASSES_HISTO_2_4.map((c) => {
    const [p, e, s, i] = b.matriz[c.rotulo];
    return {
      ...c,
      contagens: { encaminhar_prioritario: p, encaminhar_eletivo: e, seguimento: s, indeterminado: i },
      n: p + e + s + i,
    };
  });
  const malignas = matriz.filter((l) => l.maligna);
  const nMalignas = malignas.reduce((t, l) => t + l.n, 0);
  const encaminhadasMalignas = malignas.reduce((t, l) => t + l.contagens.encaminhar_prioritario + l.contagens.encaminhar_eletivo, 0);
  const seguimentoMalignas = malignas.reduce((t, l) => t + l.contagens.seguimento, 0);
  const soma = (o: Record<string, number>) => Object.values(o).reduce((t, v) => t + v, 0);
  return {
    dias,
    inicio: b.inicio,
    fim: HOJE_MOCK,
    atualizado_em: ATUALIZADO_EM_2_4,
    modelo_versoes: b.modelo_versoes,
    desempenho: {
      n_com_desfecho: matriz.reduce((t, l) => t + l.n, 0),
      sensibilidade_maligna: proporcao2_4(encaminhadasMalignas, nMalignas),
      falso_negativo_critico: proporcao2_4(seguimentoMalignas, nMalignas),
      matriz,
    },
    por_classe: matriz.map((l) => ({
      rotulo: l.rotulo,
      nome: l.nome,
      maligna: l.maligna,
      encaminhamento: proporcao2_4(l.contagens.encaminhar_prioritario + l.contagens.encaminhar_eletivo, l.n),
    })),
    sinais: {
      encaminhamento: proporcao2_4(b.encaminhadas, b.triagens),
      indeterminado: proporcao2_4(b.indeterminadas, b.triagens),
      captura_reprovada: proporcao2_4(b.reprovadas, b.capturas),
      psi: indice2_4(b.psi.valor, b.psi.ic95, b.triagens),
    },
    concordancia: {
      ponta: proporcao2_4(b.ponta.concordante, soma({ ...b.ponta })),
      ponta_partes: b.ponta,
      especialista: proporcao2_4(b.especialista.adequada, soma(b.especialista)),
      especialista_partes: b.especialista,
    },
    alertas: b.alertas,
  };
};

export function buscarMetricas2_4(dias: PeriodoDias2_4): Promise<Metricas2_4> {
  return esperar(montarMetricas2_4(dias));
}

// ── Tela 1.17 ──
// Configurações (admin). O que o administrador salva fica no "servidor" em memória (some ao recarregar).
// Relógio e sincronização vêm do mesmo status da 1.13; o modelo em uso, da situação da 1.16
// (assim as versões batem depois de uma instalação ou reversão).
// Variações pela URL:
// ?status-aparelho=atencao (via 1.13: relógio 7 min adiantado em data/hora manual, sincronização atrasada)
// ?rede=desconectada (rede sem conexão)
export const cenarioRede1_17: "conectada" | "desconectada" =
  new URLSearchParams(window.location.search).get("rede") === "desconectada" ? "desconectada" : "conectada";

// Pendente de mover para config.ts (LIMITES); ver relatório da tela.
export const OPCOES_BLOQUEIO_MIN_1_17 = [1, 2, 3, 4, 5] as const;
// O "servidor" marca atenção no relógio a partir desta diferença com a rede.
const TOLERANCIA_RELOGIO_MIN_1_17 = 2;

export type ModoDataHora1_17 = "automatica" | "manual";
export type TipoRede1_17 = "wifi" | "cabo";

export interface Configuracoes1_17 {
  data_hora: ModoDataHora1_17;
  hora_manual: string | null; // ISO; só vale em "manual", aplicada ao salvar
  bloqueio_min: number;
  descarte_ao_vencer: boolean;
  impressao: boolean;
  pendrive: boolean;
  bipe_captura: boolean;
}

export interface InfoConfiguracoes1_17 {
  rede: { tipo: TipoRede1_17; nome: string; conectada: boolean };
  sincronizacao: { ultima: string; pendentes: number; atencao: string | null };
  relogio: { hora_aparelho: string; diferenca_rede_min: number; atencao: string | null };
  unidade: { nome: string; codigo: string };
  sobre: {
    aparelho: string;
    software_versao: string;
    modelo: { nome: string; versao: string };
    licencas: string[];
    suporte: { telefone: string; email: string; horario: string };
  };
}

const LICENCAS_1_17 = [
  "Software do aparelho: licença de uso para a unidade (exemplo)",
  "Modelo de triagem: licença de pesquisa (exemplo)",
  "React e React Router: licença MIT",
];

const SUPORTE_1_17 = {
  telefone: "0800 000 0000",
  email: "suporte@exemplo.invalid",
  horario: "Segunda a sexta, das 8h às 18h",
};

let configuracoes1_17: Configuracoes1_17 = {
  data_hora: cenarioStatusAparelho1_13 === "atencao" ? "manual" : "automatica",
  hora_manual: null,
  bloqueio_min: TEMPOS.inatividadeMs / 60_000,
  descarte_ao_vencer: false,
  impressao: true,
  pendrive: false,
  bipe_captura: true,
};
// null = relógio como a 1.13 informa; número = diferença depois de um ajuste salvo aqui.
let diferencaRelogioAjustada1_17: number | null = null;

const msMinuto1_17 = 60_000;

const textoAtencaoRelogio1_17 = (dif: number) =>
  `Relógio ${Math.abs(dif)} ${Math.abs(dif) === 1 ? "minuto" : "minutos"} ${dif > 0 ? "adiantado" : "atrasado"} em relação à rede. Use data e hora automática ou ajuste a hora.`;

export async function buscarConfiguracoes1_17(): Promise<{ config: Configuracoes1_17; info: InfoConfiguracoes1_17 }> {
  const [status, modelo] = await Promise.all([buscarStatusAparelho1_13(), buscarSituacaoModelo1_16()]);
  const horaRede = new Date(status.relogio.hora_aparelho).getTime() - status.relogio.diferenca_rede_min * msMinuto1_17;
  const dif = diferencaRelogioAjustada1_17 ?? status.relogio.diferenca_rede_min;
  const relogio =
    diferencaRelogioAjustada1_17 === null
      ? status.relogio
      : {
          hora_aparelho: new Date(horaRede + dif * msMinuto1_17).toISOString(),
          diferenca_rede_min: dif,
          atencao: Math.abs(dif) >= TOLERANCIA_RELOGIO_MIN_1_17 ? textoAtencaoRelogio1_17(dif) : null,
        };
  return {
    config: { ...configuracoes1_17 },
    info: {
      rede: {
        tipo: "wifi",
        nome: "UBS-JardimDasFlores-Interna",
        conectada: cenarioRede1_17 === "conectada",
      },
      sincronizacao: status.sincronizacao,
      relogio,
      unidade: { nome: "UBS Jardim das Flores", codigo: "JF-001" },
      sobre: {
        aparelho: "SA-0017",
        software_versao: "0.9.3",
        modelo: { nome: modelo.em_uso.nome, versao: modelo.em_uso.versao },
        licencas: [...LICENCAS_1_17],
        suporte: { ...SUPORTE_1_17 },
      },
    },
  };
}

export async function salvarConfiguracoes1_17(
  nova: Configuracoes1_17,
): Promise<{ config: Configuracoes1_17; info: InfoConfiguracoes1_17 }> {
  const { info } = await buscarConfiguracoes1_17();
  const horaRede = new Date(info.relogio.hora_aparelho).getTime() - info.relogio.diferenca_rede_min * msMinuto1_17;
  if (nova.data_hora === "automatica") diferencaRelogioAjustada1_17 = 0;
  else if (nova.hora_manual)
    diferencaRelogioAjustada1_17 = Math.round((new Date(nova.hora_manual).getTime() - horaRede) / msMinuto1_17);
  configuracoes1_17 = { ...nova, hora_manual: null };
  return buscarConfiguracoes1_17();
}

// ── Tela 2.5 ──
// Aparelhos (painel, perfil equipe). Os mesmos SA-0004, SA-0009 e SA-0017 da 2.2 e dos alertas da 2.4.
// SA-0017 repete os números da 1.13 (cenário sem atenção). O "servidor" já devolve os motivos de
// atenção de cada aparelho, com o campo a que se referem; a tela só ordena e exibe.
// Taxas da semana: null = nenhuma triagem na semana. Bateria e armazenamento: 0–1.
// O painel não controla o aparelho: só pede verificação técnica remota, que segue na próxima sincronização.
// Variações pela URL: ?aparelhos=vazio (nenhum aparelho cadastrado)
export const cenarioAparelhos2_5: "normal" | "vazio" =
  new URLSearchParams(window.location.search).get("aparelhos") === "vazio" ? "vazio" : "normal";

export type CampoAparelho2_5 =
  | "sincronizacao"
  | "pendentes"
  | "bateria"
  | "armazenamento"
  | "reprovacao"
  | "indeterminado"
  | "incidentes"
  | "modelo";

export type TipoEventoAparelho2_5 = "instalacao" | "reversao" | "incidente" | "verificacao";

export interface EventoAparelho2_5 {
  id: string;
  tipo: TipoEventoAparelho2_5;
  data: string; // ISO
  descricao: string;
}

export interface Aparelho2_5 {
  id: string; // rota /painel/aparelhos/:aparelhoId
  unidade: string;
  modelo_versao: string;
  ultima_sincronizacao: string; // ISO
  pendentes: number;
  bateria: number; // 0–1
  armazenamento: number; // 0–1, parte usada
  taxa_reprovacao_semana: number | null; // 0–1
  taxa_indeterminado_semana: number | null; // 0–1
  incidentes_abertos: number;
  atencao: { campo: CampoAparelho2_5; motivo: string }[]; // vazio = sem atenção
  eventos: EventoAparelho2_5[]; // mais recente primeiro
  verificacao_solicitada_em: string | null; // ISO; null = nenhuma verificação aguardando
}

export const CONSULTADO_EM_2_5 = `${HOJE_MOCK}T10:32:00`;

const APARELHOS_2_5: Aparelho2_5[] = [
  {
    id: "SA-0017",
    unidade: "UBS Jardim das Flores",
    modelo_versao: "1.2.0",
    ultima_sincronizacao: `${HOJE_MOCK}T10:15:00`,
    pendentes: TRIAGENS_MOCK.filter((t) => t.sync === "aguardando").length,
    bateria: 0.82,
    armazenamento: 41.3 / 128,
    taxa_reprovacao_semana: 0.18,
    taxa_indeterminado_semana: 0.11,
    incidentes_abertos: 0,
    atencao: [],
    eventos: [
      { id: "ev-0017-2", tipo: "instalacao", data: "2026-10-28T14:05:00", descricao: "Modelo 1.2.0 instalado pelo administrador da unidade; verificação de integridade concluída." },
      { id: "ev-0017-1", tipo: "instalacao", data: "2026-06-02T09:30:00", descricao: "Modelo 1.1.3 instalado na entrega do aparelho." },
    ],
    verificacao_solicitada_em: null,
  },
  {
    id: "SA-0009",
    unidade: "UBS Vila Nova",
    modelo_versao: "1.2.0",
    ultima_sincronizacao: `${HOJE_MOCK}T08:50:00`,
    pendentes: 3,
    bateria: 0.67,
    armazenamento: 0.48,
    taxa_reprovacao_semana: 8 / 30, // mesmas contagens do alerta de 7 dias da 2.4
    taxa_indeterminado_semana: 2 / 24,
    incidentes_abertos: 1,
    atencao: [
      { campo: "reprovacao", motivo: "Capturas reprovadas acima do limiar na semana. Causa comum: lente suja ou ponteira desgastada." },
      { campo: "incidentes", motivo: "Incidente aberto: imagens desfocadas relatadas pela unidade." },
    ],
    eventos: [
      { id: "ev-0009-3", tipo: "incidente", data: "2026-11-06T11:20:00", descricao: "Operadora relatou imagens desfocadas em várias capturas seguidas. Aberto, em análise pela equipe." },
      { id: "ev-0009-2", tipo: "instalacao", data: "2026-11-02T16:20:00", descricao: "Modelo 1.2.0 instalado pelo administrador da unidade; verificação de integridade concluída." },
      { id: "ev-0009-1", tipo: "instalacao", data: "2026-05-18T10:00:00", descricao: "Modelo 1.1.3 instalado na entrega do aparelho." },
    ],
    verificacao_solicitada_em: null,
  },
  {
    id: "SA-0021",
    unidade: "UBS São José",
    modelo_versao: "1.1.3",
    ultima_sincronizacao: `${HOJE_MOCK}T09:05:00`,
    pendentes: 1,
    bateria: 0.74,
    armazenamento: 0.41,
    taxa_reprovacao_semana: 0.09,
    taxa_indeterminado_semana: 0.06,
    incidentes_abertos: 0,
    atencao: [],
    eventos: [
      { id: "ev-0021-4", tipo: "incidente", data: "2026-11-04T11:40:00", descricao: "Lentidão na análise relatada pela unidade. Encerrado após a reversão do modelo." },
      { id: "ev-0021-3", tipo: "reversao", data: "2026-11-04T11:30:00", descricao: "Modelo revertido de 1.2.0 para 1.1.3 pelo administrador da unidade." },
      { id: "ev-0021-2", tipo: "instalacao", data: "2026-11-03T09:00:00", descricao: "Modelo 1.2.0 instalado pelo administrador da unidade; verificação de integridade concluída." },
      { id: "ev-0021-1", tipo: "instalacao", data: "2026-07-07T13:15:00", descricao: "Modelo 1.1.3 instalado na entrega do aparelho." },
    ],
    verificacao_solicitada_em: null,
  },
  {
    id: "SA-0012",
    unidade: "UBS Parque das Árvores",
    modelo_versao: "1.2.0",
    ultima_sincronizacao: "2026-11-07T16:45:00",
    pendentes: 14,
    bateria: 0.09,
    armazenamento: 0.88,
    taxa_reprovacao_semana: 3 / 22,
    taxa_indeterminado_semana: 2 / 19,
    incidentes_abertos: 0,
    atencao: [
      { campo: "sincronizacao", motivo: "Sem sincronizar com o painel há 3 dias, com triagens pendentes." },
      { campo: "bateria", motivo: "Bateria baixa e fora da tomada." },
      { campo: "armazenamento", motivo: "Pouco espaço livre de armazenamento." },
    ],
    eventos: [
      { id: "ev-0012-2", tipo: "verificacao", data: "2026-10-15T14:00:00", descricao: "Verificação técnica remota: pacote recebido; dermatoscópio e iluminação dentro do esperado." },
      { id: "ev-0012-1", tipo: "instalacao", data: "2026-10-01T08:40:00", descricao: "Modelo 1.2.0 instalado na entrega do aparelho." },
    ],
    verificacao_solicitada_em: null,
  },
  {
    id: "SA-0004",
    unidade: "UBS Centro",
    modelo_versao: "1.2.0",
    ultima_sincronizacao: `${HOJE_MOCK}T07:30:00`,
    pendentes: 0,
    bateria: 0.91,
    armazenamento: 0.36,
    taxa_reprovacao_semana: 5 / 41,
    taxa_indeterminado_semana: 7 / 38,
    incidentes_abertos: 0,
    atencao: [
      { campo: "indeterminado", motivo: "Taxa de indeterminado acima do limiar de investigação. Veja o alerta em Métricas." },
    ],
    eventos: [
      { id: "ev-0004-3", tipo: "instalacao", data: "2026-10-29T10:10:00", descricao: "Modelo 1.2.0 instalado pelo administrador da unidade; verificação de integridade concluída." },
      { id: "ev-0004-2", tipo: "verificacao", data: "2026-09-25T15:00:00", descricao: "Verificação técnica remota: pacote recebido; iluminação do dermatoscópio abaixo do esperado. Ponteira substituída pela unidade." },
      { id: "ev-0004-1", tipo: "instalacao", data: "2026-04-20T09:00:00", descricao: "Modelo 1.1.3 instalado na entrega do aparelho." },
    ],
    verificacao_solicitada_em: null,
  },
  {
    id: "SA-0023",
    unidade: "UBS Boa Esperança",
    modelo_versao: "1.2.0",
    ultima_sincronizacao: `${HOJE_MOCK}T10:02:00`,
    pendentes: 0,
    bateria: 1,
    armazenamento: 0.05,
    taxa_reprovacao_semana: null,
    taxa_indeterminado_semana: null,
    incidentes_abertos: 0,
    atencao: [],
    eventos: [],
    verificacao_solicitada_em: null,
  },
];

const copiarAparelho2_5 = (a: Aparelho2_5): Aparelho2_5 => ({
  ...a,
  atencao: a.atencao.map((m) => ({ ...m })),
  eventos: a.eventos.map((e) => ({ ...e })),
});

export function buscarAparelhos2_5(): Promise<Aparelho2_5[]> {
  return esperar(cenarioAparelhos2_5 === "vazio" ? [] : APARELHOS_2_5.map(copiarAparelho2_5));
}

// null = aparelho não encontrado
export function buscarAparelho2_5(id: string): Promise<Aparelho2_5 | null> {
  const a = cenarioAparelhos2_5 === "vazio" ? undefined : APARELHOS_2_5.find((x) => x.id === id);
  return esperar(a ? copiarAparelho2_5(a) : null);
}

export function solicitarVerificacao2_5(id: string): Promise<{ solicitada_em: string }> {
  const a = APARELHOS_2_5.find((x) => x.id === id);
  if (!a) throw new Error(`solicitarVerificacao2_5: aparelho ${id} não encontrado`);
  const d = new Date();
  a.verificacao_solicitada_em ??= `${HOJE_MOCK}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
  return esperar({ solicitada_em: a.verificacao_solicitada_em });
}
