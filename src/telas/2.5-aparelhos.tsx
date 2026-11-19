import { useEffect, useState, type CSSProperties } from "react";
import {
  Link,
  Navigate,
  NavLink,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  buscarAparelho2_5,
  buscarAparelhos2_5,
  CONSULTADO_EM_2_5,
  solicitarVerificacao2_5,
  type Aparelho2_5,
  type CampoAparelho2_5,
  type TipoEventoAparelho2_5,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, MensagemProblema } from "../ui";

// Navegação da equipe entre 2.4, 2.5 e 2.6 (cópia da 2.4; candidata a ir para o LayoutPainel).
const NAV_EQUIPE: [rota: string, rotulo: string][] = [
  ["/painel/metricas", "Métricas"],
  ["/painel/aparelhos", "Aparelhos"],
  ["/painel/modelos", "Modelos"],
];

const MSG_VERIFICACAO =
  "Verificação solicitada. O aparelho envia o pacote na próxima sincronização.";

const ROTULO_EVENTO: Record<TipoEventoAparelho2_5, string> = {
  instalacao: "Instalação",
  reversao: "Reversão",
  incidente: "Incidente",
  verificacao: "Verificação",
};

// ── Formatação ─────────────────────────────────────────────────────────
const pctInteiro = (v: number) => `${Math.round(v * 100)}%`;
const pctTaxa = (v: number | null) =>
  v === null
    ? "Sem triagens"
    : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const inteiro = (v: number) => v.toLocaleString("pt-BR");
const dois = (n: number) => String(n).padStart(2, "0");
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const emAtencao = (a: Aparelho2_5, campo: CampoAparelho2_5) =>
  a.atencao.some((m) => m.campo === campo);

// Colunas da tabela e linhas do detalhe usam a mesma definição.
const CAMPOS: {
  rotulo: string;
  campo: CampoAparelho2_5 | null;
  numero: boolean;
  valor: (a: Aparelho2_5) => string;
}[] = [
  {
    rotulo: "Versão do modelo",
    campo: "modelo",
    numero: false,
    valor: (a) => `v${a.modelo_versao}`,
  },
  {
    rotulo: "Última sincronização",
    campo: "sincronizacao",
    numero: false,
    valor: (a) => dataHora(a.ultima_sincronizacao),
  },
  {
    rotulo: "Pendentes",
    campo: "pendentes",
    numero: true,
    valor: (a) => inteiro(a.pendentes),
  },
  {
    rotulo: "Bateria",
    campo: "bateria",
    numero: true,
    valor: (a) => pctInteiro(a.bateria),
  },
  {
    rotulo: "Armazenamento usado",
    campo: "armazenamento",
    numero: true,
    valor: (a) => pctInteiro(a.armazenamento),
  },
  {
    rotulo: "Reprovação na semana",
    campo: "reprovacao",
    numero: true,
    valor: (a) => pctTaxa(a.taxa_reprovacao_semana),
  },
  {
    rotulo: "Indeterminado na semana",
    campo: "indeterminado",
    numero: true,
    valor: (a) => pctTaxa(a.taxa_indeterminado_semana),
  },
  {
    rotulo: "Incidentes abertos",
    campo: "incidentes",
    numero: true,
    valor: (a) => inteiro(a.incidentes_abertos),
  },
];

export default function Tela() {
  const { usuarioPainel } = useSessao();
  const { aparelhoId } = useParams();

  if (!usuarioPainel) return <Navigate to="/painel/login" replace />;
  if (usuarioPainel.perfil === "dermatologista")
    return <Navigate to="/painel/casos" replace />;

  return (
    <div style={S.tela}>
      <nav aria-label="Seções da equipe" style={S.nav}>
        {NAV_EQUIPE.map(([rota, rotulo]) => (
          <NavLink
            key={rota}
            to={rota}
            style={({ isActive }) => ({
              ...S.navItem,
              ...(isActive ? S.navAtivo : {}),
            })}
          >
            {rotulo}
          </NavLink>
        ))}
      </nav>

      {aparelhoId ? <Detalhe key={aparelhoId} id={aparelhoId} /> : <Lista />}
    </div>
  );
}

// ── Lista ──────────────────────────────────────────────────────────────
function Lista() {
  const navigate = useNavigate();
  const [aparelhos, setAparelhos] = useState<Aparelho2_5[] | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarAparelhos2_5().then((l) => ativo && setAparelhos(l));
    return () => {
      ativo = false;
    };
  }, []);

  if (aparelhos === null)
    return (
      <>
        <h1 style={S.titulo}>Aparelhos</h1>
        <p style={S.secundario} aria-live="polite">
          Carregando aparelhos…
        </p>
      </>
    );

  // Em atenção primeiro; dentro de cada grupo, a ordem do "servidor".
  const ordenados = [
    ...aparelhos.filter((a) => a.atencao.length > 0),
    ...aparelhos.filter((a) => a.atencao.length === 0),
  ];
  const nAtencao = aparelhos.filter((a) => a.atencao.length > 0).length;
  const abrir = (id: string) => navigate(`/painel/aparelhos/${id}`);

  return (
    <>
      <div>
        <h1 style={S.titulo}>Aparelhos</h1>
        <p style={S.secundario} aria-live="polite">
          {inteiro(aparelhos.length)}{" "}
          {aparelhos.length === 1 ? "aparelho" : "aparelhos"} ·{" "}
          {inteiro(nAtencao)} em atenção · atualizado em{" "}
          {dataHora(CONSULTADO_EM_2_5)} · toque na linha para ver o detalhe
        </p>
      </div>

      {aparelhos.length === 0 ? (
        <p style={S.vazio}>Nenhum aparelho cadastrado.</p>
      ) : (
        <div style={S.rolagem}>
          <table style={S.tabela}>
            <thead>
              <tr>
                <th scope="col" style={S.th}>
                  IDENTIFICADOR
                </th>
                <th scope="col" style={S.th}>
                  UNIDADE
                </th>
                {CAMPOS.map((c) => (
                  <th
                    key={c.rotulo}
                    scope="col"
                    style={{ ...S.th, ...(c.numero ? S.direita : {}) }}
                  >
                    {c.rotulo.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            {ordenados.map((a) => {
              const atencao = a.atencao.length > 0;
              const linha: CSSProperties = {
                ...S.linha,
                ...(atencao ? S.linhaAtencao : {}),
              };
              return (
                <tbody key={a.id}>
                  <tr style={linha} onClick={() => abrir(a.id)}>
                    <th
                      scope="row"
                      style={{
                        ...S.td,
                        ...S.thLinha,
                        ...(atencao ? S.semBordaInferior : {}),
                      }}
                    >
                      <Link
                        to={`/painel/aparelhos/${a.id}`}
                        style={S.link}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.id}
                      </Link>
                      {atencao && <Badge />}
                    </th>
                    <td
                      style={{
                        ...S.td,
                        ...(atencao ? S.semBordaInferior : {}),
                      }}
                    >
                      {a.unidade}
                    </td>
                    {CAMPOS.map((c) => {
                      const marcado = c.campo !== null && emAtencao(a, c.campo);
                      return (
                        <td
                          key={c.rotulo}
                          style={{
                            ...S.td,
                            ...(c.numero ? { ...S.numero, ...S.direita } : {}),
                            ...(marcado ? S.valorAtencao : {}),
                            ...(atencao ? S.semBordaInferior : {}),
                          }}
                        >
                          {marcado && <span aria-hidden="true">▲ </span>}
                          {c.valor(a)}
                          {marcado && (
                            <span style={S.oculto}> (em atenção)</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {atencao && (
                    <tr style={linha} onClick={() => abrir(a.id)}>
                      <td
                        colSpan={CAMPOS.length + 2}
                        style={{ ...S.td, ...S.motivosCelula }}
                      >
                        <Motivos a={a} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </>
  );
}

function Badge() {
  return (
    <span style={S.badge}>
      <span aria-hidden="true">▲ </span>Atenção
    </span>
  );
}

function Motivos({ a }: { a: Aparelho2_5 }) {
  return (
    <ul style={S.motivos} aria-label={`Motivos de atenção, ${a.id}`}>
      {a.atencao.map((m) => (
        <li key={m.campo}>{m.motivo}</li>
      ))}
    </ul>
  );
}

// ── Detalhe ────────────────────────────────────────────────────────────
type EstadoDetalhe =
  | { fase: "carregando" }
  | { fase: "nao_encontrado" }
  | { fase: "pronto"; a: Aparelho2_5 };

function Detalhe({ id }: { id: string }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoDetalhe>({ fase: "carregando" });
  const [enviando, setEnviando] = useState(false);
  const voltar = () => navigate("/painel/aparelhos");

  useEffect(() => {
    let ativo = true;
    buscarAparelho2_5(id).then(
      (a) =>
        ativo &&
        setEstado(a ? { fase: "pronto", a } : { fase: "nao_encontrado" }),
    );
    return () => {
      ativo = false;
    };
  }, [id]);

  if (estado.fase === "carregando")
    return (
      <p style={S.secundario} aria-live="polite">
        Carregando aparelho {id}…
      </p>
    );

  if (estado.fase === "nao_encontrado")
    return (
      <MensagemProblema
        oQueHouve={`Não foi possível encontrar o aparelho ${id}.`}
        oQueFazer="Confira o identificador na lista de aparelhos."
        acoes={[{ rotulo: "Voltar à lista", onClick: voltar }]}
        codigo="APR-NAO-ENCONTRADO"
      />
    );

  const { a } = estado;
  const atencao = a.atencao.length > 0;

  const solicitar = async () => {
    setEnviando(true);
    const { solicitada_em } = await solicitarVerificacao2_5(a.id);
    setEstado({
      fase: "pronto",
      a: { ...a, verificacao_solicitada_em: solicitada_em },
    });
    setEnviando(false);
  };

  return (
    <>
      <div style={S.cabecalho}>
        <div style={S.tituloBloco}>
          <h1 style={S.titulo}>Aparelho {a.id}</h1>
          {atencao && <Badge />}
        </div>
        <Botao variante="secundario" onClick={voltar}>
          Voltar à lista
        </Botao>
      </div>
      <p style={S.secundario}>
        {a.unidade} · atualizado em {dataHora(CONSULTADO_EM_2_5)}
      </p>

      <div style={S.colunas}>
        <div style={S.principal}>
          <section style={S.card} aria-labelledby="titulo-dados">
            <h2 id="titulo-dados" style={S.cardTitulo}>
              Dados
            </h2>
            {atencao && (
              <div style={S.caixaAtencao}>
                <strong>
                  <span aria-hidden="true">▲ </span>Em atenção
                </strong>
                <Motivos a={a} />
              </div>
            )}
            <dl style={S.dados}>
              <div style={S.dado}>
                <dt style={S.dt}>Unidade</dt>
                <dd style={S.dd}>{a.unidade}</dd>
              </div>
              {CAMPOS.map((c) => {
                const marcado = c.campo !== null && emAtencao(a, c.campo);
                return (
                  <div key={c.rotulo} style={S.dado}>
                    <dt style={S.dt}>{c.rotulo}</dt>
                    <dd
                      style={{
                        ...S.dd,
                        ...(c.numero ? S.numero : {}),
                        ...(marcado ? S.valorAtencao : {}),
                      }}
                    >
                      {marcado && <span aria-hidden="true">▲ </span>}
                      {c.valor(a)}
                      {marcado && <span style={S.oculto}> (em atenção)</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section style={S.card} aria-labelledby="titulo-eventos">
            <h2 id="titulo-eventos" style={S.cardTitulo}>
              Eventos
            </h2>
            {a.eventos.length === 0 ? (
              <p style={S.vazio}>Nenhum evento registrado.</p>
            ) : (
              <ol style={S.eventos}>
                {a.eventos.map((e) => (
                  <li key={e.id} style={S.evento}>
                    <div style={S.eventoTopo}>
                      <span style={S.tipoEvento}>{ROTULO_EVENTO[e.tipo]}</span>
                      <span style={{ ...S.secundario, ...S.numero }}>
                        {dataHora(e.data)}
                      </span>
                    </div>
                    <p>{e.descricao}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside style={S.lateral} aria-labelledby="titulo-verificacao">
          <section style={S.card}>
            <h2 id="titulo-verificacao" style={S.cardTitulo}>
              Verificação técnica remota
            </h2>
            {a.verificacao_solicitada_em ? (
              <div style={S.confirmacao} role="status">
                <p style={S.confirmacaoTexto}>{MSG_VERIFICACAO}</p>
                <p style={S.nota}>
                  Solicitada em {dataHora(a.verificacao_solicitada_em)}.
                </p>
                <Botao variante="secundario" onClick={voltar}>
                  Voltar à lista
                </Botao>
              </div>
            ) : (
              <>
                <p style={S.secundario}>
                  O aparelho reúne registros e imagens de teste num pacote e o
                  envia ao painel na próxima sincronização.
                </p>
                <Botao onClick={solicitar} disabled={enviando}>
                  {enviando
                    ? "Solicitando…"
                    : "Solicitar verificação técnica remota"}
                </Botao>
              </>
            )}
            <p style={S.nota}>
              O painel não controla o aparelho a distância nem instala modelos:
              instalação e reversão são feitas no próprio aparelho, pelo
              administrador da unidade.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--espaco)",
    borderBottom: "1px solid var(--cor-borda)",
  },
  navItem: {
    minHeight: "var(--toque)",
    display: "inline-flex",
    alignItems: "center",
    padding: "0 calc(var(--espaco) * 2)",
    color: "var(--cor-grafite)",
    textDecoration: "none",
    borderBottom: "4px solid transparent",
  },
  navAtivo: { fontWeight: 700, borderBottomColor: "var(--cor-laranja)" },
  cabecalho: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
  },
  tituloBloco: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  nota: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  numero: { fontVariantNumeric: "tabular-nums" },
  direita: { textAlign: "right" },
  oculto: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  rolagem: {
    position: "relative",
    overflowX: "auto",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  tabela: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "var(--espaco)",
    textAlign: "left",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--cor-secundario)",
    borderBottom: "2px solid var(--cor-borda)",
    verticalAlign: "bottom",
  },
  thLinha: { textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
  td: {
    height: "var(--toque)",
    padding: "var(--espaco)",
    borderBottom: "1px solid var(--cor-borda)",
    verticalAlign: "middle",
  },
  semBordaInferior: { borderBottom: "none" },
  linha: { cursor: "pointer" },
  linhaAtencao: { background: "rgb(233 126 36 / 0.08)" },
  link: { color: "var(--cor-grafite)", fontWeight: 700 },
  valorAtencao: { fontWeight: 700, color: "var(--cor-laranja-700)" },
  badge: {
    display: "inline-block",
    marginLeft: "var(--espaco)",
    padding: "2px var(--espaco)",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    color: "var(--cor-grafite)",
    background: "var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  motivosCelula: {
    paddingTop: 0,
    fontSize: "var(--fonte-pequena)",
    borderLeft: "6px solid var(--cor-laranja)",
  },
  motivos: {
    margin: 0,
    paddingLeft: "calc(var(--espaco) * 2.5)",
    display: "grid",
    gap: 2,
  },
  vazio: {
    padding: "calc(var(--espaco) * 3)",
    textAlign: "center",
    color: "var(--cor-secundario)",
    background: "var(--cor-offwhite)",
    borderRadius: "var(--raio)",
  },
  colunas: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "calc(var(--espaco) * 3)",
  },
  principal: {
    flex: "1 1 640px",
    minWidth: 0,
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
  },
  lateral: { flex: "0 1 360px", minWidth: 280 },
  card: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cardTitulo: { fontSize: 22, lineHeight: 1.3 },
  caixaAtencao: {
    display: "grid",
    gap: 4,
    padding: "calc(var(--espaco) * 2)",
    border: "2px dashed var(--cor-laranja)",
    borderRadius: "var(--raio)",
    color: "var(--cor-grafite)",
  },
  dados: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 2)",
    margin: 0,
  },
  dado: { display: "grid", gap: 2 },
  dt: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  dd: { margin: 0, fontSize: 20, fontWeight: 600 },
  eventos: { listStyle: "none", margin: 0, padding: 0, display: "grid" },
  evento: {
    display: "grid",
    gap: 4,
    padding: "calc(var(--espaco) * 1.5) 0",
    borderBottom: "1px solid var(--cor-borda)",
  },
  eventoTopo: {
    display: "flex",
    flexWrap: "wrap",
    gap: "calc(var(--espaco) * 2)",
    alignItems: "baseline",
  },
  tipoEvento: { fontWeight: 700 },
  confirmacao: {
    display: "grid",
    gap: "var(--espaco)",
    justifyItems: "start",
    padding: "calc(var(--espaco) * 2)",
    border: "2px solid var(--cor-grafite)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  confirmacaoTexto: { fontWeight: 700 },
};
