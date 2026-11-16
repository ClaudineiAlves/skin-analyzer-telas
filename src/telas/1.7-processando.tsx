import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CODIGOS, TEMPOS } from "../config";
import { CODIGO_SEM_AVISO_1_7, analisarImagem1_7 } from "../mocks";
import { useSessao } from "../sessao";
import { MensagemProblema } from "../ui";

type Estado = "analisando" | "demorando" | "sem_aviso";

const ETAPAS: { icone: string; texto: string; situacao: "feita" | "atual" | "pendente" }[] = [
  { icone: "✓", texto: "Imagem conferida", situacao: "feita" },
  { icone: "●", texto: "Calculando a classificação", situacao: "atual" },
  { icone: "○", texto: "Definindo a prioridade de encaminhamento", situacao: "pendente" },
];

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atendimento, capturaUrl, atualizar } = useSessao();
  const [tentativa, setTentativa] = useState(1);
  const [estado, setEstado] = useState<Estado>("analisando");
  const montada = useRef(false);
  const disparada = useRef(0);
  // Tentativa cuja resposta ainda vale; após o limite de tempo ou ao sair, a resposta atrasada é ignorada.
  const aguardando = useRef<number | null>(null);

  const pronta = !!usuario && !!atendimento && !!capturaUrl;

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  // Uma análise por tentativa, mesmo com o efeito rodando duas vezes no StrictMode.
  useEffect(() => {
    if (!usuario || !atendimento || !capturaUrl || disparada.current === tentativa) return;
    disparada.current = tentativa;
    aguardando.current = tentativa;
    analisarImagem1_7({ local: atendimento.local, imagemUrl: capturaUrl }).then((r) => {
      if (!montada.current || aguardando.current !== tentativa) return;
      aguardando.current = null;
      // Sem o aviso de triagem o resultado nunca é exibido.
      if (!r.aviso?.trim()) {
        setEstado("sem_aviso");
        return;
      }
      atualizar({ resultado: r });
      navigate(r.conduta === "indeterminado" ? "/triagem/indeterminado" : "/triagem/resultado", { replace: true });
    });
  }, [pronta, tentativa]);

  useEffect(() => {
    if (estado !== "analisando") return;
    const limite = window.setTimeout(() => {
      if (aguardando.current !== tentativa) return;
      aguardando.current = null;
      setEstado("demorando");
    }, TEMPOS.predictTimeoutMs);
    return () => window.clearTimeout(limite);
  }, [estado, tentativa]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (!atendimento) return <Navigate to="/triagem/atendimento" replace />;
  if (!capturaUrl) return <Navigate to="/triagem/captura" replace />;

  const tentarDeNovo = () => {
    setEstado("analisando");
    setTentativa((t) => t + 1);
  };

  const cancelar = () => {
    aguardando.current = null;
    navigate("/inicio");
    atualizar({ atendimento: null, capturaUrl: null, resultado: null, reprovacoesSeguidas: 0 });
  };

  const acoes = [
    { rotulo: "Tentar de novo", onClick: tentarDeNovo },
    { rotulo: "Cancelar", onClick: cancelar, variante: "secundario" as const },
  ];

  if (estado === "demorando") {
    return (
      <div style={S.centro}>
        <MensagemProblema
          oQueHouve="A análise está demorando mais que o normal."
          oQueFazer="Tente de novo. Se cancelar, o atendimento volta para o início sem resultado."
          acoes={acoes}
          codigo={CODIGOS.API_TIMEOUT}
        />
      </div>
    );
  }

  if (estado === "sem_aviso") {
    return (
      <div style={S.centro}>
        <MensagemProblema
          oQueHouve="Não foi possível exibir o resultado desta análise."
          oQueFazer="Tente de novo. Se continuar, relate o problema pelo menu com o seu nome."
          acoes={acoes}
          codigo={CODIGO_SEM_AVISO_1_7}
        />
      </div>
    );
  }

  return (
    <div style={S.centro}>
      <h1 style={S.titulo}>Analisando a imagem…</h1>
      <div className="progresso" role="progressbar" aria-label="Analisando a imagem" style={S.barra} />
      <ul style={S.lista} aria-live="polite">
        {ETAPAS.map((e) => (
          <li key={e.texto} style={{ ...S.etapa, ...S[e.situacao] }} aria-current={e.situacao === "atual" ? "step" : undefined}>
            <span style={S.icone} aria-hidden="true">
              {e.icone}
            </span>
            {e.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  centro: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "calc(var(--espaco) * 4)",
    paddingTop: "calc(var(--espaco) * 10)",
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  barra: { width: 480, height: 6 },
  lista: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "calc(var(--espaco) * 2)", fontSize: 24 },
  etapa: { display: "flex", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  icone: { width: "1.5em", textAlign: "center", fontWeight: 700 },
  feita: {},
  atual: { fontWeight: 700, color: "var(--cor-laranja-700)" },
  pendente: { color: "var(--cor-secundario)" },
};
