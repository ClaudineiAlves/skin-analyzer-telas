import { useEffect, useState } from "react";
import { LAYOUT } from "../config";

const CONSULTA = `(max-width: ${LAYOUT.larguraEstreitaPx}px)`;

// O aparelho é 1280×800; em tela estreita (celular) as telas empilham as colunas.
export function useTelaEstreita(): boolean {
  const [estreita, setEstreita] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const mudar = () => setEstreita(mq.matches);
    mq.addEventListener("change", mudar);
    return () => mq.removeEventListener("change", mudar);
  }, []);
  return estreita;
}
