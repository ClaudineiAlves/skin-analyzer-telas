import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, NavLink, useNavigate } from "react-router-dom";
import {
  buscarMetricas2_4,
  CONDUTAS_MATRIZ_2_4,
  LIMIARES_PSI_2_4,
  N_MINIMO_ESTIMATIVA_2_4,
  PERIODO_PADRAO_2_4,
  PERIODOS_DIAS_2_4,
  type AlertaDrift2_4,
  type ConcordanciaPrioridade2_3,
  type Estimativa2_4,
  type LinhaMatriz2_4,
  type Metricas2_4,
  type PeriodoDias2_4,
} from "../mocks";
import { useSessao } from "../sessao";
import { BlocoConduta, Botao } from "../ui";

const AVISO_DADOS_SIMULADOS =
  "DADOS SIMULADOS — nenhum número desta tela vem de uso real.";
const INSUFICIENTE = "Casos insuficientes para estimar";

// Navegação da equipe entre 2.4, 2.5 e 2.6; ver relatório (candidata a ir para o LayoutPainel).
const NAV_EQUIPE: [rota: string, rotulo: string][] = [
  ["/painel/metricas", "Métricas"],
  ["/painel/aparelhos", "Aparelhos"],
  ["/painel/modelos", "Modelos"],
];

const PARTES_PONTA: [
  keyof Metricas2_4["concordancia"]["ponta_partes"],
  string,
][] = [
  ["concordante", "Igual à sugestão"],
  ["ponta_maior", "Ponta com prioridade maior"],
  ["ponta_menor", "Ponta com prioridade menor"],
];

const PARTES_ESPECIALISTA: [ConcordanciaPrioridade2_3, string][] = [
  ["adequada", "Adequada"],
  ["deveria_ser_maior", "Deveria ser maior"],
  ["deveria_ser_menor", "Deveria ser menor"],
];

// ── Formatação ─────────────────────────────────────────────────────────
const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const indice = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const inteiro = (v: number) => v.toLocaleString("pt-BR");
const dois = (n: number) => String(n).padStart(2, "0");
const data = (aaaaMmDd: string) => aaaaMmDd.split("-").reverse().join("/");
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

type Formato = "proporcao" | "indice";
const fmt = (v: number, f: Formato) => (f === "proporcao" ? pct(v) : indice(v));

const faixaPsi = (v: number) =>
  v >= LIMIARES_PSI_2_4.investigar
    ? `investigar (a partir de ${indice(LIMIARES_PSI_2_4.investigar)})`
    : v >= LIMIARES_PSI_2_4.atencao
      ? `atenção (de ${indice(LIMIARES_PSI_2_4.atencao)} a ${indice(LIMIARES_PSI_2_4.investigar)})`
      : `estável (abaixo de ${indice(LIMIARES_PSI_2_4.atencao)})`;

export default function Tela() {
  const { usuarioPainel } = useSessao();
  const [dias, setDias] = useState<PeriodoDias2_4>(PERIODO_PADRAO_2_4);
  const [metricas, setMetricas] = useState<Metricas2_4 | null>(null);

  useEffect(() => {
    let ativo = true;
    setMetricas(null);
    buscarMetricas2_4(dias).then((m) => ativo && setMetricas(m));
    return () => {
      ativo = false;
    };
  }, [dias]);

  if (!usuarioPainel) return <Navigate to="/painel/login" replace />;
  if (usuarioPainel.perfil === "dermatologista")
    return <Navigate to="/painel/casos" replace />;

  return (
    <div style={S.tela}>
      <p style={S.faixaSimulados} role="note">
        {AVISO_DADOS_SIMULADOS}
      </p>

      <nav aria-label="Seções da equipe" style={S.nav}>
        {NAV_EQUIPE.map(([rota, rotulo]) => (
          <NavLink
            key={rota}
            to={rota}
            end
            style={({ isActive }) => ({
              ...S.navItem,
              ...(isActive ? S.navAtivo : {}),
            })}
          >
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <div style={S.cabecalho}>
        <h1 style={S.titulo}>Métricas</h1>
        <div role="group" aria-label="Período" style={S.periodos}>
          {PERIODOS_DIAS_2_4.map((d) => (
            <Botao
              key={d}
              variante={d === dias ? "primario" : "secundario"}
              aria-pressed={d === dias}
              onClick={() => setDias(d)}
            >
              {d} dias
            </Botao>
          ))}
        </div>
      </div>

      {metricas === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando métricas…
        </p>
      ) : (
        <Conteudo m={metricas} />
      )}
    </div>
  );
}

function Conteudo({ m }: { m: Metricas2_4 }) {
  const { desempenho: d, sinais: s, concordancia: c } = m;
  return (
    <>
      <p style={S.secundario} aria-live="polite">
        Período: {data(m.inicio)} a {data(m.fim)} · modelo{" "}
        {m.modelo_versoes.map((v) => `v${v}`).join(", ")} · atualizado em{" "}
        {dataHora(m.atualizado_em)} · estimativas exigem n ≥{" "}
        {N_MINIMO_ESTIMATIVA_2_4}
      </p>

      <div style={S.colunas}>
        <div style={S.principal}>
          <Card
            titulo="Desempenho com desfecho"
            sub={`${inteiro(d.n_com_desfecho)} casos com histopatológico registrado no período.`}
          >
            <div style={S.destaques}>
              <Metrica
                rotulo="Sensibilidade em lesão maligna"
                definicao="Lesões malignas no histopatológico com encaminhamento sugerido (prioritário ou eletivo). Quanto maior, melhor."
                e={d.sensibilidade_maligna}
                formato="proporcao"
                destaque
              />
              <Metrica
                rotulo="Taxa de falso negativo crítico"
                definicao="Lesões malignas no histopatológico com seguimento sugerido. Quanto menor, melhor."
                e={d.falso_negativo_critico}
                formato="proporcao"
                destaque
              />
            </div>
            <MatrizConfusao linhas={d.matriz} />
            <p style={S.nota}>
              A acurácia global não é exibida: com mais lesões não malignas que
              malignas, ela pode parecer alta mesmo quando lesões malignas
              recebem seguimento.
            </p>
          </Card>

          <Card
            titulo="Por classe"
            sub="Encaminhamento sugerido (prioritário ou eletivo) por classe no histopatológico."
          >
            <div style={S.rolagem}>
              <table style={S.tabela}>
                <thead>
                  <tr>
                    <th scope="col" style={S.th}>
                      CLASSE
                    </th>
                    <th scope="col" style={S.th}>
                      GRUPO
                    </th>
                    <th scope="col" style={{ ...S.th, ...S.direita }}>
                      N
                    </th>
                    <th scope="col" style={S.th}>
                      ENCAMINHAMENTO SUGERIDO · IC95
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {m.por_classe.map((l) => (
                    <tr key={l.rotulo}>
                      <th scope="row" style={{ ...S.td, ...S.thLinha }}>
                        {l.nome}
                      </th>
                      <td style={S.td}>
                        {l.maligna ? "Maligna" : "Não maligna"}
                      </td>
                      <td style={{ ...S.td, ...S.numero, ...S.direita }}>
                        {inteiro(l.encaminhamento.n)}
                      </td>
                      <td style={{ ...S.td, ...S.celulaBarra }}>
                        {l.encaminhamento.suficiente ? (
                          <div style={S.linhaBarra}>
                            <span style={S.numero}>
                              {pct(l.encaminhamento.valor)} (
                              {pct(l.encaminhamento.ic95[0])} a{" "}
                              {pct(l.encaminhamento.ic95[1])})
                            </span>
                            <BarraIC
                              e={l.encaminhamento}
                              rotulo={`Encaminhamento sugerido, ${l.nome}`}
                            />
                          </div>
                        ) : (
                          <span style={S.secundario}>{INSUFICIENTE}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={S.nota}>
              Em classes malignas, é a sensibilidade da classe (quanto maior,
              melhor). Em classes não malignas, valores altos indicam
              encaminhamentos que poderiam ser evitados.
            </p>
          </Card>

          <Card
            titulo="Sinais sem desfecho"
            sub="Calculados sobre todas as triagens do período, sem esperar o histopatológico."
          >
            <div style={S.grade}>
              <Metrica
                rotulo="Encaminhamento sugerido"
                definicao="Triagens com encaminhamento prioritário ou eletivo sugerido."
                e={s.encaminhamento}
                formato="proporcao"
              />
              <Metrica
                rotulo="Indeterminado"
                definicao="Triagens que não puderam ser classificadas com segurança."
                e={s.indeterminado}
                formato="proporcao"
              />
              <Metrica
                rotulo="Captura reprovada"
                definicao="Capturas reprovadas pelo controle de qualidade, sobre todas as tentativas."
                e={s.captura_reprovada}
                formato="proporcao"
              />
              <Metrica
                rotulo="PSI"
                definicao="Índice de estabilidade da distribuição da probabilidade de malignidade em relação à referência do modelo."
                e={s.psi}
                formato="indice"
                extra={
                  s.psi.suficiente
                    ? `Faixa: ${faixaPsi(s.psi.valor)}`
                    : undefined
                }
              />
            </div>
          </Card>

          <Card titulo="Concordância">
            <div style={S.grade}>
              <div style={S.bloco}>
                <Metrica
                  rotulo="Ponta × sugestão"
                  definicao="Decisão registrada pelo profissional da ponta igual à conduta sugerida. Exclui indeterminado e casos sem decisão registrada."
                  e={c.ponta}
                  formato="proporcao"
                />
                <Partes
                  partes={PARTES_PONTA.map(([k, r]) => [r, c.ponta_partes[k]])}
                  rotulo="Ponta × sugestão"
                />
              </div>
              <div style={S.bloco}>
                <Metrica
                  rotulo="Especialista × prioridade"
                  definicao="Casos revisados no painel em que o especialista considerou a prioridade sugerida adequada."
                  e={c.especialista}
                  formato="proporcao"
                />
                <Partes
                  partes={PARTES_ESPECIALISTA.map(([k, r]) => [
                    r,
                    c.especialista_partes[k],
                  ])}
                  rotulo="Especialista × prioridade"
                />
              </div>
            </div>
          </Card>

          <Card titulo="Estratificação">
            <p style={S.vazio}>Estratificação ainda não disponível.</p>
          </Card>
        </div>

        <aside style={S.lateral} aria-labelledby="titulo-drift">
          <Alertas alertas={m.alertas} />
        </aside>
      </div>
    </>
  );
}

// ── Peças ──────────────────────────────────────────────────────────────
function Card({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section style={S.card} aria-label={titulo}>
      <div>
        <h2 style={S.cardTitulo}>{titulo}</h2>
        {sub && <p style={S.secundario}>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Metrica({
  rotulo,
  definicao,
  e,
  formato,
  destaque = false,
  extra,
}: {
  rotulo: string;
  definicao: string;
  e: Estimativa2_4;
  formato: Formato;
  destaque?: boolean;
  extra?: string;
}) {
  return (
    <div style={destaque ? S.metricaDestaque : S.metrica}>
      <h3 style={S.metricaRotulo}>{rotulo}</h3>
      {e.suficiente ? (
        <>
          <p style={{ ...S.numero, ...(destaque ? S.valorDestaque : S.valor) }}>
            {fmt(e.valor, formato)}
          </p>
          <p style={S.numero}>
            IC95 {fmt(e.ic95[0], formato)} a {fmt(e.ic95[1], formato)} · n ={" "}
            {inteiro(e.n)}
          </p>
          {formato === "proporcao" && <BarraIC e={e} rotulo={rotulo} escala />}
          {extra && <p style={S.extra}>{extra}</p>}
        </>
      ) : (
        <>
          <p style={S.insuficiente}>{INSUFICIENTE}</p>
          <p style={S.numero}>n = {inteiro(e.n)}</p>
        </>
      )}
      <p style={S.nota}>{definicao}</p>
    </div>
  );
}

// Faixa 0–100%: trecho claro = IC95; traço grafite = valor. O texto ao lado traz os mesmos números.
function BarraIC({
  e,
  rotulo,
  escala = false,
}: {
  e: Extract<Estimativa2_4, { suficiente: true }>;
  rotulo: string;
  escala?: boolean;
}) {
  const [lo, hi] = e.ic95;
  return (
    <div style={S.barraBloco}>
      <div
        style={S.barra}
        role="img"
        aria-label={`${rotulo}: ${pct(e.valor)}, IC95 de ${pct(lo)} a ${pct(hi)}, n = ${inteiro(e.n)}`}
      >
        <span
          style={{
            ...S.barraIC,
            left: `${lo * 100}%`,
            width: `${(hi - lo) * 100}%`,
          }}
        />
        <span
          style={{ ...S.barraValor, left: `calc(${e.valor * 100}% - 2px)` }}
        />
      </div>
      {escala && (
        <div style={S.escala} aria-hidden="true">
          <span>0%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}

function MatrizConfusao({ linhas }: { linhas: LinhaMatriz2_4[] }) {
  const grupos: [string, LinhaMatriz2_4[]][] = [
    ["Malignas", linhas.filter((l) => l.maligna)],
    ["Não malignas", linhas.filter((l) => !l.maligna)],
  ];
  return (
    <div style={S.bloco}>
      <h3 style={S.metricaRotulo}>Matriz de confusão</h3>
      <div style={S.rolagem}>
        <table style={S.tabela}>
          <caption style={S.legendaTabela}>
            Linhas: histopatológico. Colunas: conduta sugerida. Cada célula traz
            o número de casos e a parte da linha; cor mais intensa indica parte
            maior da linha. Contorno tracejado com “crítico”: lesão maligna com
            seguimento sugerido.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...S.th, whiteSpace: "normal" }}>
                HISTOPATOLÓGICO ↓ · SUGERIDO →
              </th>
              {CONDUTAS_MATRIZ_2_4.map((c) => (
                <th key={c} scope="col" style={S.th}>
                  <BlocoConduta conduta={c} variante="marcador" />
                </th>
              ))}
              <th scope="col" style={{ ...S.th, ...S.direita }}>
                N
              </th>
            </tr>
          </thead>
          {grupos.map(([grupo, ls]) => (
            <tbody key={grupo}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={CONDUTAS_MATRIZ_2_4.length + 2}
                  style={S.grupo}
                >
                  {grupo}
                </th>
              </tr>
              {ls.map((l) => (
                <tr key={l.rotulo}>
                  <th scope="row" style={{ ...S.td, ...S.thLinha }}>
                    {l.nome}
                  </th>
                  {CONDUTAS_MATRIZ_2_4.map((c) => {
                    const qtd = l.contagens[c];
                    const parte = l.n > 0 ? qtd / l.n : 0;
                    const critico = l.maligna && c === "seguimento";
                    return (
                      <td
                        key={c}
                        style={{
                          ...S.td,
                          ...S.celula,
                          background: `rgb(233 126 36 / ${(0.06 + parte * 0.6).toFixed(2)})`,
                          ...(critico ? S.celulaCritica : {}),
                        }}
                      >
                        <span style={S.celulaQtd}>{inteiro(qtd)}</span>
                        <span style={S.celulaParte}>
                          {l.n > 0 ? pct(parte) : "—"}
                        </span>
                        {critico && <span style={S.critico}>crítico</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...S.td, ...S.numero, ...S.direita }}>
                    {inteiro(l.n)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function Partes({
  partes,
  rotulo,
}: {
  partes: [string, number][];
  rotulo: string;
}) {
  const total = partes.reduce((t, [, v]) => t + v, 0);
  return (
    <ul style={S.partes} aria-label={`${rotulo}: composição`}>
      {partes.map(([r, v]) => (
        <li key={r} style={S.parte}>
          <span>{r}</span>
          <span style={S.parteTrilho} aria-hidden="true">
            <span
              style={{
                ...S.parteBarra,
                width: `${total > 0 ? (v / total) * 100 : 0}%`,
              }}
            />
          </span>
          <span style={{ ...S.numero, ...S.direita }}>
            {inteiro(v)}
            {total > 0 && ` · ${pct(v / total)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Alertas({ alertas }: { alertas: AlertaDrift2_4[] }) {
  const navigate = useNavigate();
  return (
    <div style={S.card}>
      <div>
        <h2 id="titulo-drift" style={S.cardTitulo}>
          Alertas de drift
        </h2>
        <p style={S.secundario}>
          Cada alerta é um gatilho de investigação: indica mudança nos dados,
          não confirma queda de desempenho.
        </p>
      </div>
      {alertas.length === 0 ? (
        <p style={S.vazio}>Nenhum gatilho de investigação no período.</p>
      ) : (
        <ul style={S.listaAlertas}>
          {alertas.map((a) => (
            <li key={a.id} style={S.alerta}>
              <span style={S.etiqueta}>
                <span aria-hidden="true">▲ </span>Gatilho de investigação
              </span>
              <strong>{a.metrica}</strong>
              <span>{a.escopo}</span>
              {a.estimativa.suficiente ? (
                <span style={S.numero}>
                  {fmt(a.estimativa.valor, a.formato)} (IC95{" "}
                  {fmt(a.estimativa.ic95[0], a.formato)} a{" "}
                  {fmt(a.estimativa.ic95[1], a.formato)}) · n ={" "}
                  {inteiro(a.estimativa.n)}
                </span>
              ) : (
                <span>
                  {INSUFICIENTE} · n = {inteiro(a.estimativa.n)}
                </span>
              )}
              <span style={S.secundario}>
                Limiar: {fmt(a.limiar, a.formato)}
              </span>
              <span style={S.secundario}>Desde {dataHora(a.desde)}</span>
              {a.aparelho ? (
                <Botao
                  variante="secundario"
                  onClick={() => navigate(`/painel/aparelhos/${a.aparelho}`)}
                >
                  Ver aparelho {a.aparelho}
                </Botao>
              ) : (
                <Botao
                  variante="secundario"
                  onClick={() => navigate("/painel/modelos")}
                >
                  Ver modelos
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  faixaSimulados: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    padding: "calc(var(--espaco) * 1.5) calc(var(--espaco) * 2)",
    background: "var(--cor-grafite)",
    color: "var(--cor-offwhite)",
    border: "3px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
    fontWeight: 700,
  },
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
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  periodos: { display: "flex", flexWrap: "wrap", gap: "var(--espaco)" },
  secundario: { color: "var(--cor-secundario)" },
  colunas: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "calc(var(--espaco) * 3)",
  },
  principal: {
    flex: "1 1 720px",
    minWidth: 0,
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
  },
  lateral: { flex: "0 1 340px", minWidth: 280, position: "sticky", top: 72 },
  card: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cardTitulo: { fontSize: 22, lineHeight: 1.3 },
  destaques: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 2)",
  },
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 2)",
  },
  bloco: { display: "grid", gap: "var(--espaco)", alignContent: "start" },
  metrica: {
    display: "grid",
    gap: 4,
    alignContent: "start",
    padding: "calc(var(--espaco) * 2)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  metricaDestaque: {
    display: "grid",
    gap: 4,
    alignContent: "start",
    padding: "calc(var(--espaco) * 2)",
    border: "2px solid var(--cor-grafite)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  metricaRotulo: { fontSize: 16, fontWeight: 700 },
  valor: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
  valorDestaque: { fontSize: 40, fontWeight: 700, lineHeight: 1.1 },
  insuficiente: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--cor-laranja-700)",
  },
  extra: { fontWeight: 600 },
  nota: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  numero: { fontVariantNumeric: "tabular-nums" },
  direita: { textAlign: "right" },
  barraBloco: { display: "grid", gap: 2, marginTop: 4 },
  barra: {
    position: "relative",
    height: 12,
    minWidth: 120,
    background: "var(--cor-offwhite)",
    border: "1px solid var(--cor-borda)",
    borderRadius: 6,
  },
  barraIC: {
    position: "absolute",
    top: 0,
    bottom: 0,
    background: "rgb(233 126 36 / 0.45)",
    borderRadius: 6,
  },
  barraValor: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 4,
    background: "var(--cor-grafite)",
    borderRadius: 2,
  },
  escala: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "var(--cor-secundario)",
  },
  rolagem: { overflowX: "auto" },
  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid var(--cor-borda)",
  },
  legendaTabela: {
    captionSide: "bottom",
    paddingTop: "var(--espaco)",
    textAlign: "left",
    fontSize: "var(--fonte-pequena)",
    color: "var(--cor-secundario)",
  },
  th: {
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    textAlign: "left",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--cor-secundario)",
    borderBottom: "2px solid var(--cor-borda)",
    whiteSpace: "nowrap",
  },
  thLinha: { textAlign: "left", fontWeight: 600 },
  grupo: {
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    textAlign: "left",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    background: "var(--cor-offwhite)",
    borderBottom: "1px solid var(--cor-borda)",
  },
  td: {
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    borderBottom: "1px solid var(--cor-borda)",
    verticalAlign: "middle",
  },
  celula: {
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    minWidth: 96,
  },
  celulaCritica: {
    outline: "2px dashed var(--cor-laranja-700)",
    outlineOffset: -4,
  },
  celulaQtd: { display: "block", fontWeight: 700 },
  celulaParte: { display: "block", fontSize: "var(--fonte-pequena)" },
  critico: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--cor-laranja-700)",
  },
  celulaBarra: { minWidth: 280 },
  linhaBarra: { display: "grid", gap: 4 },
  partes: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 },
  parte: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 80px auto",
    alignItems: "center",
    gap: "var(--espaco)",
    fontSize: "var(--fonte-pequena)",
  },
  parteTrilho: {
    height: 10,
    background: "var(--cor-offwhite)",
    border: "1px solid var(--cor-borda)",
    borderRadius: 5,
    overflow: "hidden",
  },
  parteBarra: {
    display: "block",
    height: "100%",
    background: "var(--cor-grafite)",
  },
  vazio: {
    padding: "calc(var(--espaco) * 3)",
    textAlign: "center",
    color: "var(--cor-secundario)",
    background: "var(--cor-offwhite)",
    borderRadius: "var(--raio)",
  },
  listaAlertas: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
  },
  alerta: {
    display: "grid",
    gap: 4,
    justifyItems: "start",
    padding: "calc(var(--espaco) * 2)",
    border: "2px dashed var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  etiqueta: {
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    color: "var(--cor-laranja-700)",
  },
};
