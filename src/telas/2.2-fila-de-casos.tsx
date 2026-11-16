import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AVISO_TRIAGEM, TEXTO_CONDUTA, TEXTO_RISCO, type Conduta } from "../dominio";
import { buscarCasosPainel2_2, type CasoPainel2_2, type StatusCaso2_2 } from "../mocks";
import { useSessao } from "../sessao";
import { BlocoConduta, Botao, FaixaTriagem } from "../ui";

// Pendente de mover para config.ts (LIMITES); ver relatório da tela.
const PERIODOS_DIAS = [7, 30, 90] as const;

// Seguimento fica fora da fila; a ordem desta lista é a ordem de prioridade.
const CONDUTAS_FILA: Conduta[] = ["encaminhar_prioritario", "indeterminado", "encaminhar_eletivo"];

const STATUS: { valor: StatusCaso2_2; rotulo: string; vazio: string }[] = [
  { valor: "aguardando", rotulo: "Aguardando", vazio: "Nenhum caso aguardando revisão." },
  { valor: "em_revisao", rotulo: "Em revisão", vazio: "Nenhum caso em revisão." },
  { valor: "concluido", rotulo: "Concluído", vazio: "Nenhum caso concluído." },
];

const TODOS = "todos";

interface Filtros {
  unidade: string;
  conduta: Conduta | typeof TODOS;
  status: StatusCaso2_2;
  periodo: string; // dias, ou TODOS
}

const FILTROS_PADRAO: Filtros = { unidade: TODOS, conduta: TODOS, status: "aguardando", periodo: TODOS };

// Indeterminado não sugere conduta, então não há o que divergir.
const diverge = (c: CasoPainel2_2) =>
  c.decisao_ponta !== null && c.resultado.conduta !== "indeterminado" && c.decisao_ponta !== c.resultado.conduta;

function filtrarEOrdenar(casos: CasoPainel2_2[], f: Filtros): CasoPainel2_2[] {
  return casos
    .filter((c) => CONDUTAS_FILA.includes(c.resultado.conduta))
    .filter((c) => c.status === f.status)
    .filter((c) => f.unidade === TODOS || c.unidade === f.unidade)
    .filter((c) => f.conduta === TODOS || c.resultado.conduta === f.conduta)
    .filter((c) => f.periodo === TODOS || c.espera_dias <= Number(f.periodo))
    .sort(
      (a, b) =>
        CONDUTAS_FILA.indexOf(a.resultado.conduta) - CONDUTAS_FILA.indexOf(b.resultado.conduta) ||
        b.espera_dias - a.espera_dias,
    );
}

export default function Tela() {
  const navigate = useNavigate();
  const { usuarioPainel } = useSessao();
  const [casos, setCasos] = useState<CasoPainel2_2[] | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);

  useEffect(() => {
    let ativo = true;
    buscarCasosPainel2_2().then((c) => ativo && setCasos(c));
    return () => {
      ativo = false;
    };
  }, []);

  if (!usuarioPainel) return <Navigate to="/painel/login" replace />;
  if (usuarioPainel.perfil !== "dermatologista") return <Navigate to="/painel/metricas" replace />;

  const unidades = [...new Set((casos ?? []).map((c) => c.unidade))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lista = casos ? filtrarEOrdenar(casos, filtros) : [];
  const filtrosExtras =
    filtros.unidade !== TODOS || filtros.conduta !== TODOS || filtros.periodo !== TODOS;
  const textoVazio = STATUS.find((s) => s.valor === filtros.status)!.vazio;

  const mudar = <K extends keyof Filtros>(chave: K, valor: Filtros[K]) =>
    setFiltros((atual) => ({ ...atual, [chave]: valor }));

  return (
    <div style={S.tela}>
      <h1 style={S.titulo}>Fila de casos</h1>
      <FaixaTriagem aviso={AVISO_TRIAGEM} />

      <form style={S.filtros} aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <label style={S.campo}>
          <span style={S.rotulo}>Unidade</span>
          <select style={S.select} value={filtros.unidade} onChange={(e) => mudar("unidade", e.target.value)}>
            <option value={TODOS}>Todas</option>
            {unidades.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label style={S.campo}>
          <span style={S.rotulo}>Conduta</span>
          <select
            style={S.select}
            value={filtros.conduta}
            onChange={(e) => mudar("conduta", e.target.value as Filtros["conduta"])}
          >
            <option value={TODOS}>Todas</option>
            {CONDUTAS_FILA.map((c) => (
              <option key={c} value={c}>
                {TEXTO_CONDUTA[c].tituloCurto}
              </option>
            ))}
          </select>
        </label>
        <label style={S.campo}>
          <span style={S.rotulo}>Status</span>
          <select
            style={S.select}
            value={filtros.status}
            onChange={(e) => mudar("status", e.target.value as StatusCaso2_2)}
          >
            {STATUS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label style={S.campo}>
          <span style={S.rotulo}>Período</span>
          <select style={S.select} value={filtros.periodo} onChange={(e) => mudar("periodo", e.target.value)}>
            <option value={TODOS}>Todo o período</option>
            {PERIODOS_DIAS.map((d) => (
              <option key={d} value={String(d)}>
                Últimos {d} dias
              </option>
            ))}
          </select>
        </label>
        {filtrosExtras && (
          <Botao variante="texto" style={S.limpar} onClick={() => setFiltros({ ...FILTROS_PADRAO, status: filtros.status })}>
            Limpar filtros
          </Botao>
        )}
      </form>

      {casos === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando casos…
        </p>
      ) : lista.length === 0 ? (
        <p style={S.vazio} aria-live="polite">
          {filtrosExtras ? `${textoVazio.slice(0, -1)} com esses filtros.` : textoVazio}
        </p>
      ) : (
        <>
          <p style={S.secundario} aria-live="polite">
            {lista.length} {lista.length === 1 ? "caso" : "casos"}
          </p>
          <div style={S.rolagem}>
            <table style={S.tabela}>
              <thead>
                <tr>
                  {["PRIORIDADE", "ESPERA", "UNIDADE", "LOCAL", "SUGERIDO", "DECISÃO NA PONTA"].map((t) => (
                    <th key={t} scope="col" style={S.th}>
                      {t}
                    </th>
                  ))}
                  <th scope="col" style={S.th}>
                    <span style={S.oculto}>Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const outroRevisor =
                    c.status === "em_revisao" && c.revisor !== null && c.revisor.email !== usuarioPainel.email;
                  const meu = c.status === "em_revisao" && c.revisor?.email === usuarioPainel.email;
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>
                        <BlocoConduta conduta={c.resultado.conduta} variante="marcador" />
                      </td>
                      <td style={{ ...S.td, ...S.numero }}>{c.espera_dias} d</td>
                      <td style={S.td}>{c.unidade}</td>
                      <td style={S.td}>{c.local}</td>
                      <td style={S.td}>
                        {TEXTO_CONDUTA[c.resultado.conduta].tituloCurto}
                        {c.resultado.risco && (
                          <span style={S.risco}>risco {TEXTO_RISCO[c.resultado.risco].toLowerCase()}</span>
                        )}
                      </td>
                      <td style={S.td}>
                        {c.decisao_ponta ? TEXTO_CONDUTA[c.decisao_ponta].tituloCurto : <span aria-label="sem decisão registrada">—</span>}
                        {diverge(c) && (
                          <span style={S.diverge}>
                            <span aria-hidden="true">≠ </span>diverge
                          </span>
                        )}
                      </td>
                      <td style={{ ...S.td, ...S.acao }}>
                        {outroRevisor && <span style={S.revisor}>em revisão por {c.revisor!.nome}</span>}
                        {meu && <span style={S.revisor}>em revisão por você</span>}
                        <Botao
                          disabled={outroRevisor}
                          aria-label={`Revisar caso ${c.codigo}`}
                          onClick={() => navigate(`/painel/casos/${c.id}`)}
                        >
                          Revisar
                        </Botao>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  filtros: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "calc(var(--espaco) * 2)" },
  campo: { display: "grid", gap: 4 },
  rotulo: { fontWeight: 600 },
  select: {
    minHeight: "var(--toque)",
    minWidth: 200,
    padding: "0 var(--espaco)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-secundario)",
    borderRadius: "var(--raio)",
  },
  limpar: { paddingLeft: 0, paddingRight: 0 },
  vazio: {
    padding: "calc(var(--espaco) * 4)",
    textAlign: "center",
    color: "var(--cor-secundario)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  rolagem: { overflowX: "auto" },
  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
  },
  th: {
    padding: "calc(var(--espaco) * 1.5) calc(var(--espaco) * 2)",
    textAlign: "left",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--cor-secundario)",
    borderBottom: "2px solid var(--cor-borda)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "calc(var(--espaco) * 1.5) calc(var(--espaco) * 2)",
    borderBottom: "1px solid var(--cor-borda)",
    verticalAlign: "middle",
  },
  numero: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  risco: { display: "block", fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  diverge: { display: "block", fontSize: "var(--fonte-pequena)", fontWeight: 700, color: "var(--cor-laranja-700)" },
  acao: { textAlign: "right", whiteSpace: "nowrap" },
  revisor: { marginRight: "calc(var(--espaco) * 2)", fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  oculto: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
};
