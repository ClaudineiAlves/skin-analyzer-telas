// Dados falsos do protótipo. Nenhum valor aqui vem de uso real.
import { TEMPOS } from "./config";
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
