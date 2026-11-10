import { useEffect, useState } from "react";
import { CODIGOS } from "../config";
import { buscarSaude } from "../mocks";
import { Logo, MensagemProblema } from "../ui";

// Estado terminal: nenhum botão leva à triagem.
export default function Tela() {
  const [versao, setVersao] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarSaude().then((s) => ativo && setVersao(s.modelo_versao));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="tela-cheia">
      <Logo grande />
      <MensagemProblema
        oQueHouve="O modelo de análise não passou na verificação de integridade."
        oQueFazer="A triagem está bloqueada para sua segurança. Acione o suporte."
        codigo={CODIGOS.MOD_INTEGRIDADE}
        rodape={versao ? `modelo v${versao}` : undefined}
      />
    </div>
  );
}
