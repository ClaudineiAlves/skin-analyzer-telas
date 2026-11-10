// Estado em memória: some ao recarregar a página (dado de saúde não vai para o navegador).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PerfilPainel, Resultado, Usuario } from "./mocks";

export interface Atendimento {
  codigo: string;
  local: string;
  faixaIdade?: string;
  sexo?: "feminino" | "masculino" | "nao_informado";
}

export interface UsuarioPainel {
  email: string;
  nome: string;
  perfil: PerfilPainel;
}

interface Sessao {
  usuario: Usuario | null;
  atendimento: Atendimento | null;
  capturaUrl: string | null;
  resultado: Resultado | null;
  reprovacoesSeguidas: number;
  usuarioPainel: UsuarioPainel | null;
}

interface SessaoCtx extends Sessao {
  atualizar: (parcial: Partial<Sessao>) => void;
  sair: () => void;
  sairPainel: () => void;
}

const VAZIA: Sessao = {
  usuario: null,
  atendimento: null,
  capturaUrl: null,
  resultado: null,
  reprovacoesSeguidas: 0,
  usuarioPainel: null,
};

const Ctx = createContext<SessaoCtx | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Sessao>(VAZIA);
  const valor = useMemo<SessaoCtx>(
    () => ({
      ...s,
      atualizar: (parcial) => setS((atual) => ({ ...atual, ...parcial })),
      sair: () => setS((atual) => ({ ...VAZIA, usuarioPainel: atual.usuarioPainel })),
      sairPainel: () => setS((atual) => ({ ...atual, usuarioPainel: null })),
    }),
    [s],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): SessaoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do SessaoProvider");
  return c;
}
