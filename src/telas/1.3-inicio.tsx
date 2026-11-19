import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AVISO_TRIAGEM } from "../dominio";
import { buscarPendentesSync, buscarSaude, buscarTriagensDeHoje, type Triagem } from "../mocks";
import { useSessao } from "../sessao";
import { BlocoConduta, Botao, FaixaTriagem, useTelaEstreita } from "../ui";

// Pendentes de mover para config.ts (TEMPOS/LIMITES); ver relatório da tela.
const HORA_FIM_MANHA = 12;
const HORA_FIM_TARDE = 18;

const saudacao = (hora: number) =>
  hora < HORA_FIM_MANHA ? "Bom dia" : hora < HORA_FIM_TARDE ? "Boa tarde" : "Boa noite";

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atualizar } = useSessao();
  const [triagens, setTriagens] = useState<Triagem[] | null>(null);
  const [dermatoscopio, setDermatoscopio] = useState<boolean | null>(null);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    buscarTriagensDeHoje(usuario.id).then(
      (t) => ativo && setTriagens([...t].sort((a, b) => b.data.localeCompare(a.data))),
    );
    buscarSaude().then((s) => ativo && setDermatoscopio(s.dermatoscopio_conectado));
    buscarPendentesSync().then((n) => ativo && setPendentes(n));
    return () => {
      ativo = false;
    };
  }, [usuario]);

  const estreita = useTelaEstreita();

  if (!usuario) return <Navigate to="/login" replace />;

  const novaTriagem = () => {
    atualizar({ atendimento: null, capturaUrl: null, resultado: null, reprovacoesSeguidas: 0 });
    navigate("/triagem/atendimento");
  };

  const podeIniciar = dermatoscopio === true;
  const temResultado = triagens?.some((t) => t.resultado) ?? false;

  return (
    <div style={S.tela}>
      <h1 style={S.saudacao}>
        {saudacao(new Date().getHours())}, {primeiroNome(usuario.nome)}.
      </h1>

      <div style={S.blocoAcao}>
        <Botao
          onClick={novaTriagem}
          disabled={!podeIniciar}
          aria-describedby={dermatoscopio === false ? "aviso-dermatoscopio" : undefined}
          style={{ ...S.novaTriagem, ...(estreita ? S.larguraTotal : null), ...(podeIniciar ? null : S.novaTriagemCinza) }}
        >
          + Nova triagem
        </Botao>
        {dermatoscopio === false && (
          <p id="aviso-dermatoscopio" style={S.aviso}>
            Conecte o dermatoscópio para começar.
          </p>
        )}
      </div>

      {pendentes > 0 && (
        <p style={S.pendentes}>
          {pendentes}{" "}
          {plural(
            pendentes,
            "triagem aguarda conexão para enviar ao painel.",
            "triagens aguardam conexão para enviar ao painel.",
          )}{" "}
          Nada se perde.
        </p>
      )}

      <section style={S.hoje} aria-labelledby="titulo-hoje">
        <div style={S.cabecalhoHoje}>
          <h2 id="titulo-hoje" style={S.tituloHoje}>
            {triagens === null
              ? "Hoje"
              : `Hoje · ${triagens.length} ${plural(triagens.length, "triagem", "triagens")}`}
          </h2>
          <Botao variante="texto" onClick={() => navigate("/historico")}>
            Ver histórico ›
          </Botao>
        </div>

        {triagens === null ? (
          <p style={S.secundario} aria-live="polite">
            Carregando triagens…
          </p>
        ) : triagens.length === 0 ? (
          <p style={S.secundario}>Nenhuma triagem hoje ainda.</p>
        ) : (
          <ul style={S.lista}>
            {triagens.map((t) => (
              <li key={t.id}>
                <button type="button" style={{ ...S.item, ...(estreita ? S.itemEstreito : null) }} onClick={() => navigate(`/historico/${t.id}`)}>
                  <span style={S.hora}>{hhmm(t.data)}</span>
                  <span style={S.codigo}>{t.codigo}</span>
                  {t.resultado ? (
                    <BlocoConduta conduta={t.resultado.conduta} variante="marcador" />
                  ) : (
                    <span style={S.secundario}>Encerrada sem resultado</span>
                  )}
                  <span style={S.seta} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* A lista mostra condutas sugeridas: a faixa fica fixa no rodapé enquanto houver alguma. */}
      {temResultado && (
        <div style={S.faixa}>
          <FaixaTriagem aviso={AVISO_TRIAGEM} />
        </div>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: {
    maxWidth: 1040,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
  },
  saudacao: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  blocoAcao: { display: "grid", gap: "var(--espaco)" },
  novaTriagem: { width: "50%", minHeight: 72, fontSize: 24 },
  novaTriagemCinza: {
    background: "var(--cor-borda)",
    color: "var(--cor-secundario)",
    opacity: 1,
  },
  aviso: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  pendentes: { color: "var(--cor-secundario)" },
  hoje: { display: "grid", gap: "var(--espaco)" },
  cabecalhoHoje: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  tituloHoje: { fontSize: 22, lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  lista: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  item: {
    width: "100%",
    minHeight: 56,
    display: "grid",
    gridTemplateColumns: "80px 120px 1fr auto",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "0 calc(var(--espaco) * 2)",
    background: "none",
    border: 0,
    borderBottom: "1px solid var(--cor-borda)",
    font: "inherit",
    color: "var(--cor-grafite)",
    textAlign: "left",
    cursor: "pointer",
  },
  itemEstreito: { gridTemplateColumns: "auto auto minmax(0, 1fr) auto", gap: "var(--espaco)" },
  larguraTotal: { width: "100%" },
  hora: { fontVariantNumeric: "tabular-nums" },
  codigo: { fontWeight: 700 },
  seta: { color: "var(--cor-secundario)", fontSize: 24 },
  faixa: {
    position: "sticky",
    bottom: 0,
    paddingBottom: "calc(var(--espaco) * 2)",
    background: "var(--cor-offwhite)",
  },
};
