export type Conduta =
  | "encaminhar_prioritario"
  | "encaminhar_eletivo"
  | "seguimento"
  | "indeterminado";

export type Risco = "alto" | "moderado" | "baixo";

export const AVISO_TRIAGEM =
  "TRIAGEM — NÃO É DIAGNÓSTICO. A decisão de conduta permanece integralmente com o profissional de saúde.";

export const TEXTO_CONDUTA: Record<Conduta, { titulo: string; tituloCurto: string; subtitulo: string }> = {
  encaminhar_prioritario: {
    titulo: "Encaminhamento prioritário sugerido",
    tituloCurto: "Prioritário",
    subtitulo: "Características que justificam avaliação especializada com prioridade.",
  },
  encaminhar_eletivo: {
    titulo: "Encaminhamento eletivo sugerido",
    tituloCurto: "Eletivo",
    subtitulo: "Recomenda-se avaliação especializada pela via regular.",
  },
  seguimento: {
    titulo: "Seguimento sugerido",
    tituloCurto: "Seguimento",
    subtitulo: "Risco baixo nesta triagem. Reavalie se a lesão mudar de forma, cor ou tamanho.",
  },
  indeterminado: {
    titulo: "Não foi possível classificar com segurança",
    tituloCurto: "Indeterminado",
    subtitulo: "Na dúvida, considere encaminhar para avaliação especializada.",
  },
};

export const TEXTO_RISCO: Record<Risco, string> = {
  alto: "ALTO",
  moderado: "MODERADO",
  baixo: "BAIXO",
};
