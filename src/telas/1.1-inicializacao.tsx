import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CODIGOS, TEMPOS } from "../config";
import { buscarSaude, type IdItemSaude, type Saude } from "../mocks";
import { Logo, MensagemProblema } from "../ui";

const ROTULO_OK: Record<IdItemSaude, (s: Saude) => string> = {
  servicos: () => "Serviços iniciados",
  modelo: (s) => `Modelo v${s.modelo_versao} conferido`,
  banco: () => "Banco de dados local aberto",
  dermatoscopio: () => "Dermatoscópio conectado",
};

// Sem modelo íntegro não há triagem; dermatoscópio desconectado não bloqueia aqui (bloqueia a 1.5).
const terminal = (s: Saude) => s.modelo_integro === false || (s.pronto && s.modelo_integro === true);

export default function Tela() {
  const navigate = useNavigate();
  const [saude, setSaude] = useState<Saude | null>(null);
  const [esgotado, setEsgotado] = useState(false);
  const navegou = useRef(false);

  // Consulta a saúde até chegar a um estado terminal.
  useEffect(() => {
    if (esgotado) return;
    let ativo = true;
    let proxima: number | undefined;
    const consultar = async () => {
      const s = await buscarSaude();
      if (!ativo) return;
      setSaude(s);
      if (!terminal(s)) proxima = window.setTimeout(consultar, TEMPOS.pollingSaudeMs);
    };
    consultar();
    return () => {
      ativo = false;
      window.clearTimeout(proxima);
    };
  }, [esgotado]);

  useEffect(() => {
    const limite = window.setTimeout(() => {
      if (!navegou.current) setEsgotado(true);
    }, TEMPOS.inicializacaoLimiteMs);
    return () => window.clearTimeout(limite);
  }, []);

  // Ref contra navegação dupla (StrictMode); a pausa final deixa o último ✓ visível.
  useEffect(() => {
    if (!saude || esgotado || navegou.current || !terminal(saude)) return;
    navegou.current = true;
    if (saude.modelo_integro === false) {
      navigate("/bloqueio-tecnico", { replace: true });
      return;
    }
    const t = window.setTimeout(() => navigate("/login", { replace: true }), TEMPOS.inicializacaoPausaFinalMs);
    return () => {
      window.clearTimeout(t);
      navegou.current = false;
    };
  }, [saude, esgotado, navigate]);

  if (esgotado) {
    return (
      <div className="tela-cheia">
        <Logo grande />
        <MensagemProblema
          oQueHouve="O aparelho não terminou de iniciar."
          acoes={[{ rotulo: "Reiniciar", onClick: () => window.location.reload() }]}
          codigo={CODIGOS.INIT_TIMEOUT}
        />
      </div>
    );
  }

  const visiveis = saude?.itens.filter((i) => i.estado !== "pendente") ?? [];

  return (
    <div className="tela-cheia">
      <Logo grande />
      <p className="inicializacao__titulo">Preparando o aparelho…</p>
      <div className="progresso" role="progressbar" aria-label="Preparando o aparelho" />
      <ul className="inicializacao__lista" aria-live="polite">
        {saude &&
          visiveis.map((item) =>
            item.estado === "ok" ? (
              <li key={item.id}>
                <span className="inicializacao__icone" aria-hidden="true">✓</span>
                {ROTULO_OK[item.id](saude)}
              </li>
            ) : (
              <li key={item.id} className="inicializacao__item--atencao">
                <span className="inicializacao__icone" aria-hidden="true">○</span>
                Dermatoscópio desconectado
              </li>
            ),
          )}
      </ul>
    </div>
  );
}
