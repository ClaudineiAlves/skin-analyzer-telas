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
