import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { TEMPOS } from "../config";
import { TEXTO_CONDUTA } from "../dominio";
import {
  CODIGO_SEM_AVISO_1_7,
  momentoTriagem1_8,
  registrarTriagem1_8,
  type DecisaoProfissional1_8,
  type Resultado,
} from "../mocks";
import { useSessao } from "../sessao";
import {
  BlocoConduta,
  Botao,
  Dialogo,
  FaixaTriagem,
  Logo,
  MensagemProblema,
} from "../ui";

const DECISOES: { valor: DecisaoProfissional1_8; rotulo: string }[] = [
  {
    valor: "encaminhar_prioritario",
    rotulo: TEXTO_CONDUTA.encaminhar_prioritario.tituloCurto,
  },
  {
    valor: "encaminhar_eletivo",
    rotulo: TEXTO_CONDUTA.encaminhar_eletivo.tituloCurto,
  },
  { valor: "seguimento", rotulo: TEXTO_CONDUTA.seguimento.tituloCurto },
  { valor: "outra", rotulo: "Outra" },
];

// Textos literais do prompt da 1.9. O título vem de TEXTO_CONDUTA.indeterminado e é exibido em caixa alta.
const MOTIVO = "Esta imagem não permitiu uma triagem confiável.";
const ORIENTACAO = TEXTO_CONDUTA.indeterminado.subtitulo;

const rotuloDecisao = (d: DecisaoProfissional1_8 | null) =>
  d ? DECISOES.find((x) => x.valor === d)?.rotulo : "Não registrada";

// "2026-11-10T09:12:00" → hh:mm e dd/mm/aaaa hh:mm, sem passar por fuso horário.
const hhmm = (iso: string) => iso.slice(11, 16);
const dataHora = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${hhmm(iso)}`;

// Momento e decisão sobrevivem à ida até 1.10 e volta. Memória do módulo, some ao recarregar.
let memoria: {
  codigo: string;
  resultado: Resultado;
  momento: string;
  decisao: DecisaoProfissional1_8 | null;
} | null = null;

type Estado = "resultado" | "salvando" | "salvo";

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atendimento, capturaUrl, resultado, atualizar } =
    useSessao();

  const mesmo =
    !!memoria &&
    memoria.codigo === atendimento?.codigo &&
    memoria.resultado === resultado;
  const [momento] = useState(() =>
    mesmo && memoria ? memoria.momento : momentoTriagem1_8(),
  );
  const [decisao, setDecisao] = useState<DecisaoProfissional1_8 | null>(() =>
    mesmo && memoria ? memoria.decisao : null,
  );
  const [estado, setEstado] = useState<Estado>("resultado");
  const [descartar, setDescartar] = useState(false);
  const [exportar, setExportar] = useState(false);

  useEffect(() => {
    if (atendimento && resultado)
      memoria = { codigo: atendimento.codigo, resultado, momento, decisao };
  }, [atendimento, resultado, momento, decisao]);

  useEffect(() => {
    if (estado !== "salvo") return;
    const id = window.setTimeout(() => {
      memoria = null;
      navigate("/inicio");
      atualizar({
        atendimento: null,
        capturaUrl: null,
        resultado: null,
        reprovacoesSeguidas: 0,
      });
    }, TEMPOS.confirmacaoSalvoMs);
    return () => window.clearTimeout(id);
  }, [estado]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (!atendimento || !resultado) return <Navigate to="/inicio" replace />;
  if (resultado.conduta !== "indeterminado")
    return <Navigate to="/triagem/resultado" replace />;

  // A 1.7 já barra resposta sem aviso; aqui é a última defesa, porque sem faixa não há resultado.
  if (!resultado.aviso?.trim()) {
    return (
      <div style={S.centro}>
        <MensagemProblema
          oQueHouve="Não foi possível exibir o resultado desta análise."
          oQueFazer="Capture a imagem de novo. Se continuar, relate o problema pelo menu com o seu nome."
          acoes={[
            {
              rotulo: "Capturar de novo",
              onClick: () => navigate("/triagem/captura"),
            },
          ]}
          codigo={CODIGO_SEM_AVISO_1_7}
        />
      </div>
    );
  }

  const ocupado = estado !== "resultado";

  const salvar = async () => {
    setEstado("salvando");
    await registrarTriagem1_8({
      codigo: atendimento.codigo,
      local: atendimento.local,
      operador_id: usuario.id,
      data: momento,
      resultado,
      decisao_profissional: decisao,
    });
    setEstado("salvo");
  };

  const capturarDeNovo = () => {
    memoria = null;
    navigate("/triagem/captura");
    atualizar({ capturaUrl: null, resultado: null });
  };

  return (
    <div style={S.tela}>
      <div style={S.colunas}>
        <section style={S.esquerda} aria-label="Imagem analisada">
          <div style={S.moldura}>
            {capturaUrl ? (
              <img
                src={capturaUrl}
                alt={`Lesão analisada, ${atendimento.local}`}
                style={S.foto}
              />
            ) : (
              <span style={S.semImagem}>
                Imagem indisponível neste aparelho
              </span>
            )}
          </div>
          <p style={S.local}>{atendimento.local}</p>
          <p style={S.secundario}>
            {atendimento.codigo} · {hhmm(momento)}
          </p>
        </section>

        <section style={S.direita} aria-labelledby="titulo-conduta">
          <h1 id="titulo-conduta" style={S.rotulo}>
            CONDUTA SUGERIDA
          </h1>
          <div style={S.caixaAlta}>
            <BlocoConduta conduta="indeterminado" />
          </div>
          <p style={S.subtitulo}>{MOTIVO}</p>
          <p style={S.subtitulo}>{ORIENTACAO}</p>
          <div>
            <Botao
              variante="secundario"
              onClick={() => setDescartar(true)}
              disabled={ocupado}
              style={S.botaoRodape}
            >
              Tentar com nova captura
            </Botao>
          </div>

          <div style={S.decisao}>
            <h2 id="titulo-decisao" style={S.tituloDecisao}>
              Sua decisão (opcional)
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="titulo-decisao"
              style={S.opcoes}
            >
              {DECISOES.map((d) => {
                const marcada = decisao === d.valor;
                return (
                  <button
                    key={d.valor}
                    type="button"
                    role="radio"
                    aria-checked={marcada}
                    disabled={ocupado}
                    // Toque de novo na opção marcada desfaz a escolha: a decisão é opcional.
                    onClick={() => setDecisao(marcada ? null : d.valor)}
                    style={{ ...S.opcao, ...(marcada ? S.opcaoMarcada : null) }}
                  >
                    <span aria-hidden="true" style={S.opcaoIcone}>
                      {marcada ? "●" : "○"}
                    </span>
                    {d.rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div style={S.faixa}>
        <FaixaTriagem aviso={resultado.aviso} />
      </div>

      {resultado.limitacoes.length > 0 && (
        <section style={S.limitacoes} aria-labelledby="titulo-limitacoes">
          <h2 id="titulo-limitacoes" style={S.tituloLimitacoes}>
            Limitações
          </h2>
          <ul style={S.listaLimitacoes}>
            {resultado.limitacoes.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      <footer style={S.rodape}>
        <div style={S.rodapeGrupo}>
          <Botao
            variante="secundario"
            onClick={() => setDescartar(true)}
            disabled={ocupado}
            style={S.botaoRodape}
          >
            Nova captura
          </Botao>
          <Botao
            variante="secundario"
            onClick={() => setExportar(true)}
            disabled={ocupado}
            style={S.botaoRodape}
          >
            Exportar
          </Botao>
        </div>
        <div style={S.rodapeGrupo}>
          <Botao
            variante="texto"
            onClick={() => navigate("/triagem/detalhes")}
            disabled={ocupado}
            style={S.botaoRodape}
          >
            Ver detalhes ›
          </Botao>
          <Botao onClick={salvar} disabled={ocupado} style={S.salvar}>
            {estado === "salvando" ? "Salvando…" : "SALVAR"}
          </Botao>
        </div>
      </footer>

      {estado === "salvo" && (
        <div style={S.confirmacaoFundo}>
          <p role="status" style={S.confirmacao}>
            Triagem salva.
          </p>
        </div>
      )}

      <Dialogo
        aberto={descartar}
        texto="Descartar este resultado e capturar de novo?"
        confirmar={{ rotulo: "Descartar e capturar", onClick: capturarDeNovo }}
        cancelar={{
          rotulo: "Manter resultado",
          onClick: () => setDescartar(false),
        }}
      />

      {exportar && (
        <PreviaRelatorio
          dados={{
            codigo: atendimento.codigo,
            local: atendimento.local,
            operador: usuario.nome,
            momento,
            capturaUrl,
            resultado,
            decisao,
          }}
          fechar={() => setExportar(false)}
        />
      )}
    </div>
  );
}

// ── Prévia do relatório para impressão ─────────────────────────────────
// Ao imprimir, só o relatório aparece (regras de impressão locais a esta tela).
// !important porque os estilos da prévia são inline.
const CSS_IMPRESSAO = `
@media print {
  body * { visibility: hidden; }
  .relatorio-1-9, .relatorio-1-9 * { visibility: visible; }
  .relatorio-1-9__fundo { position: absolute !important; inset: 0 !important; padding: 0 !important; background: none !important; display: block !important; }
  .relatorio-1-9 { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; overflow: visible !important; }
  .relatorio-1-9__acoes { display: none !important; }
}`;

function PreviaRelatorio({
  dados,
  fechar,
}: {
  dados: {
    codigo: string;
    local: string;
    operador: string;
    momento: string;
    capturaUrl: string | null;
    resultado: Resultado;
    decisao: DecisaoProfissional1_8 | null;
  };
  fechar: () => void;
}) {
  const { resultado } = dados;
  return (
    <div className="relatorio-1-9__fundo" style={R.fundo}>
      <style>{CSS_IMPRESSAO}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-relatorio"
        style={R.janela}
      >
        <div className="relatorio-1-9__acoes" style={R.acoes}>
          <p style={R.acoesTexto}>Prévia do relatório para impressão</p>
          <div style={S.rodapeGrupo}>
            <Botao variante="secundario" onClick={fechar}>
              Fechar
            </Botao>
            <Botao onClick={() => window.print()}>Imprimir</Botao>
          </div>
        </div>

        <article className="relatorio-1-9" style={R.folha}>
          <header style={R.cabecalho}>
            <Logo />
            <h1 id="titulo-relatorio" style={R.titulo}>
              Relatório de triagem
            </h1>
            <dl style={R.dados}>
              <dt>Atendimento</dt>
              <dd style={R.dd}>{dados.codigo}</dd>
              <dt>Data</dt>
              <dd style={R.dd}>{dataHora(dados.momento)}</dd>
              <dt>Operador</dt>
              <dd style={R.dd}>{dados.operador}</dd>
            </dl>
          </header>

          <section style={R.corpo}>
            <div style={R.imagemBloco}>
              {dados.capturaUrl ? (
                <img
                  src={dados.capturaUrl}
                  alt={`Lesão analisada, ${dados.local}`}
                  style={R.imagem}
                />
              ) : (
                <span style={S.secundario}>Imagem indisponível</span>
              )}
              <p>
                <strong>Local:</strong> {dados.local}
              </p>
            </div>
            <div style={R.conduta}>
              <p style={R.rotulo}>CONDUTA SUGERIDA</p>
              <p style={{ ...R.condutaTitulo, ...S.caixaAlta }}>
                {TEXTO_CONDUTA.indeterminado.titulo}
              </p>
              <p>{MOTIVO}</p>
              <p>{ORIENTACAO}</p>
              <p>
                Decisão do profissional:{" "}
                <strong>{rotuloDecisao(dados.decisao)}</strong>
              </p>
            </div>
          </section>

          <FaixaTriagem aviso={resultado.aviso} />

          {resultado.limitacoes.length > 0 && (
            <section>
              <h2 style={R.subtitulo}>Limitações</h2>
              <ul style={R.lista}>
                {resultado.limitacoes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          )}

          <footer style={R.rodape}>
            Modelo: {resultado.modelo} · versão {resultado.modelo_versao}
          </footer>
        </article>
      </div>
    </div>
  );
}

// Estilos locais, no mesmo padrão da 1.8 (estilos.css é compartilhado).
const ALTURA_RODAPE = 88;
const LADO_IMAGEM = 300;

const S: Record<string, CSSProperties> = {
  tela: {
    maxWidth: 1232,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    paddingBottom: ALTURA_RODAPE,
  },
  centro: {
    minHeight: "100%",
    display: "flex",
    justifyContent: "center",
    paddingTop: "calc(var(--espaco) * 10)",
  },
  colunas: {
    display: "grid",
    gridTemplateColumns: `${LADO_IMAGEM}px 1fr`,
    gap: "calc(var(--espaco) * 4)",
    alignItems: "start",
  },
  esquerda: { display: "grid", gap: "var(--espaco)" },
  moldura: {
    width: LADO_IMAGEM,
    height: LADO_IMAGEM,
    display: "grid",
    placeItems: "center",
    background: "var(--cor-grafite)",
    borderRadius: "var(--raio)",
    overflow: "hidden",
  },
  foto: { width: "100%", height: "100%", display: "block", objectFit: "cover" },
  semImagem: {
    padding: "calc(var(--espaco) * 2)",
    color: "var(--cor-offwhite)",
    textAlign: "center",
  },
  local: { fontSize: 22, fontWeight: 700, lineHeight: 1.25 },
  secundario: { color: "var(--cor-secundario)" },
  direita: {
    display: "grid",
    gap: "calc(var(--espaco) * 1.5)",
    alignContent: "start",
  },
  rotulo: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "var(--cor-secundario)",
  },
  subtitulo: { fontSize: 22, lineHeight: 1.35 },
  caixaAlta: { textTransform: "uppercase" },
  decisao: {
    display: "grid",
    gap: "var(--espaco)",
    marginTop: "var(--espaco)",
  },
  tituloDecisao: { fontSize: 20, lineHeight: 1.2 },
  opcoes: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--espaco)",
  },
  opcao: {
    minHeight: 56,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--espaco)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    fontWeight: 600,
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  opcaoMarcada: {
    color: "var(--cor-offwhite)",
    background: "var(--cor-grafite)",
    borderColor: "var(--cor-grafite)",
  },
  opcaoIcone: { fontSize: 20 },
  faixa: {
    position: "sticky",
    bottom: ALTURA_RODAPE,
    zIndex: 1,
    paddingTop: "var(--espaco)",
    background: "var(--cor-offwhite)",
  },
  limitacoes: {
    display: "grid",
    gap: "calc(var(--espaco) / 2)",
    color: "var(--cor-secundario)",
  },
  tituloLimitacoes: {
    fontSize: 18,
    lineHeight: 1.3,
    color: "var(--cor-grafite)",
  },
  listaLimitacoes: {
    margin: 0,
    paddingLeft: "1.2em",
    display: "grid",
    gap: "calc(var(--espaco) / 2)",
  },
  rodape: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    minHeight: ALTURA_RODAPE,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    background: "var(--cor-offwhite)",
    borderTop: "1px solid var(--cor-borda)",
  },
  rodapeGrupo: {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
  },
  botaoRodape: { minHeight: 56 },
  salvar: {
    minHeight: 56,
    minWidth: 220,
    fontSize: 22,
    letterSpacing: "0.04em",
  },
  confirmacaoFundo: {
    position: "fixed",
    inset: 0,
    zIndex: 3,
    display: "grid",
    placeItems: "center",
    background: "rgb(43 48 54 / 0.6)",
  },
  confirmacao: {
    padding: "calc(var(--espaco) * 4) calc(var(--espaco) * 6)",
    fontSize: "var(--fonte-titulo)",
    fontWeight: 700,
    background: "var(--cor-branco)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
};

const R: Record<string, CSSProperties> = {
  fundo: {
    position: "fixed",
    inset: 0,
    zIndex: 4,
    display: "grid",
    placeItems: "center",
    padding: "calc(var(--espaco) * 3)",
    background: "rgb(43 48 54 / 0.6)",
  },
  janela: {
    width: "min(900px, 100%)",
    maxHeight: "100%",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    background: "var(--cor-offwhite)",
    borderRadius: "var(--raio)",
    overflow: "hidden",
  },
  acoes: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    borderBottom: "1px solid var(--cor-borda)",
  },
  acoesTexto: { fontWeight: 700 },
  folha: {
    margin: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 4)",
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    color: "var(--cor-grafite)",
    overflowY: "auto",
  },
  cabecalho: {
    display: "grid",
    gap: "var(--espaco)",
    paddingBottom: "calc(var(--espaco) * 2)",
    borderBottom: "2px solid var(--cor-grafite)",
  },
  titulo: { fontSize: 28, lineHeight: 1.2 },
  dados: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "calc(var(--espaco) * 2)",
    rowGap: 4,
    margin: 0,
  },
  dd: { margin: 0, fontWeight: 600 },
  corpo: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "calc(var(--espaco) * 3)",
    alignItems: "start",
  },
  imagemBloco: { display: "grid", gap: "var(--espaco)" },
  imagem: {
    width: 220,
    height: 220,
    objectFit: "cover",
    borderRadius: "var(--raio)",
    display: "block",
  },
  conduta: { display: "grid", gap: "var(--espaco)" },
  rotulo: {
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "var(--cor-secundario)",
  },
  condutaTitulo: { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  subtitulo: { fontSize: 18, marginBottom: 4 },
  lista: { margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 },
  rodape: {
    paddingTop: "calc(var(--espaco) * 2)",
    borderTop: "1px solid var(--cor-borda)",
    color: "var(--cor-secundario)",
  },
};
