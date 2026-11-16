import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LIMITES, TEMPOS } from "../config";
import { PAUSA_PIN_MINUTOS, verificarPin } from "../mocks";
import { useSessao } from "../sessao";
import { Botao, MensagemProblema, TecladoNumerico } from "../ui";

// Copiados de 1.2 (mesmos textos e comportamento); pendentes de mover para config.ts.
const CODIGO_PIN_PAUSA = "PIN-PAUSA";
const TREMOR_MS = 320;
const TREMOR_PX = 6;

const INSTRUCAO = "Digite o PIN para continuar";

const textoRestantes = (n: number) =>
  n === 1
    ? "PIN incorreto. Resta 1 tentativa."
    : `PIN incorreto. Restam ${n} tentativas.`;

// Enviado por useBloqueioPorInatividade (ui/layouts.tsx): rota anterior e o state dela.
interface EstadoBloqueio {
  voltarPara?: string;
  voltarEstado?: unknown;
}

export default function Tela() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { usuario, sair } = useSessao();
  const [pin, setPin] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const [minutosPausa, setMinutosPausa] = useState(PAUSA_PIN_MINUTOS);
  const [enviando, setEnviando] = useState(false);
  const areaPin = useRef<HTMLDivElement>(null);
  const ativo = useRef(true);

  const { voltarPara, voltarEstado } = (state as EstadoBloqueio | null) ?? {};
  const destinoPadrao =
    usuario?.perfil === "administrador" ? "/admin/status" : "/inicio";
  const destino =
    voltarPara && voltarPara !== "/bloqueio" ? voltarPara : destinoPadrao;

  const encerrarSessao = () => {
    sair();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  // Conta desde a entrada no bloqueio; toques na tela não reiniciam.
  // Depende só do id: `sair` muda a cada render da sessão, mas age sobre o estado atual.
  useEffect(() => {
    if (!usuario) return;
    const t = window.setTimeout(
      encerrarSessao,
      TEMPOS.sessaoBloqueadaEncerraMs,
    );
    return () => window.clearTimeout(t);
  }, [usuario?.id]);

  if (!usuario) return <Navigate to="/login" replace />;

  const tremer = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    areaPin.current?.querySelector(".teclado__visor")?.animate(
      [0, -TREMOR_PX, TREMOR_PX, -TREMOR_PX, TREMOR_PX, 0].map((x) => ({
        transform: `translateX(${x}px)`,
      })),
      { duration: TREMOR_MS, easing: "ease-in-out" },
    );
  };

  const enviar = async (valor: string) => {
    setEnviando(true);
    const r = await verificarPin(usuario.id, valor);
    if (!ativo.current) return;
    setEnviando(false);
    if (r.status === "ok") {
      navigate(destino, { replace: true, state: voltarEstado });
    } else if (r.status === "incorreto") {
      setPin("");
      setAviso(textoRestantes(r.restantes));
      tremer();
    } else {
      setPin("");
      setMinutosPausa(r.minutos);
      setPausado(true);
    }
  };

  const digitar = (valor: string) => {
    if (enviando) return;
    setPin(valor);
    if (valor.length === LIMITES.pinDigitos) enviar(valor);
  };

  // ── Acesso pausado: só resta trocar de operador ──────────────────────
  if (pausado) {
    return (
      <div className="tela-cheia" style={S.fundo}>
        <MensagemProblema
          oQueHouve={`Acesso de ${usuario.nome} pausado por ${minutosPausa} minutos.`}
          oQueFazer="Se esqueceu o PIN, fale com a administração da unidade."
          acoes={[{ rotulo: "Trocar operador", onClick: encerrarSessao }]}
          codigo={CODIGO_PIN_PAUSA}
        />
      </div>
    );
  }

  return (
    <div className="tela-cheia" style={{ ...S.fundo, ...S.telaPin }}>
      <div style={S.cabecalho}>
        <h1 style={S.titulo}>Aparelho bloqueado</h1>
        <p style={S.nome}>{usuario.nome}</p>
        <p>{INSTRUCAO}</p>
      </div>
      <p role="alert" style={S.aviso}>
        {aviso}
      </p>
      <div ref={areaPin}>
        <TecladoNumerico
          valor={pin}
          onChange={digitar}
          max={LIMITES.pinDigitos}
          mascarar
          rotulo={INSTRUCAO}
        />
      </div>
      <Botao variante="secundario" onClick={encerrarSessao} disabled={enviando}>
        Trocar operador
      </Botao>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  fundo: { background: "var(--cor-grafite)", color: "var(--cor-offwhite)" },
  telaPin: { gap: "calc(var(--espaco) * 2)" },
  cabecalho: { display: "grid", gap: "var(--espaco)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  nome: { fontSize: 24, fontWeight: 700 },
  // Laranja de ação (#E97E24) no lugar do #A8521A: contraste suficiente sobre grafite.
  aviso: { minHeight: "1.4em", color: "var(--cor-laranja)", fontWeight: 600 },
};
