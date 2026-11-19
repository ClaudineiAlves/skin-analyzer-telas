import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { buscarStatusAparelho1_13, type StatusAparelho1_13 } from "../mocks";
import { useSessao } from "../sessao";

const dois = (n: number) => String(n).padStart(2, "0");

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const gb = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const pct = (fracao: number) => `${Math.round(fracao * 100)}%`;

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

interface Cartao {
  id: string;
  titulo: string;
  linhas: [string, ReactNode][];
  atencao: string | null;
  // Destino ao tocar, só quando o cartão está em atenção.
  destino?: { rota: string; rotulo: string };
}

function montarCartoes(s: StatusAparelho1_13): Cartao[] {
  return [
    {
      id: "modelo",
      titulo: "Modelo",
      linhas: [
        ["Nome", s.modelo.nome],
        ["Versão", s.modelo.versao],
        ["Instalação", dataHora(s.modelo.instalado_em)],
        ["Integridade", s.modelo.integro ? "Confirmada" : "Não confirmada"],
      ],
      atencao: s.modelo.atencao,
      destino: { rota: "/admin/modelo", rotulo: "Abrir Atualização do modelo" },
    },
    {
      id: "sincronizacao",
      titulo: "Sincronização",
      linhas: [
        ["Última", dataHora(s.sincronizacao.ultima)],
        [
          "Pendentes",
          `${s.sincronizacao.pendentes} ${plural(s.sincronizacao.pendentes, "triagem", "triagens")}`,
        ],
      ],
      atencao: s.sincronizacao.atencao,
      destino: { rota: "/admin/configuracoes", rotulo: "Abrir Configurações" },
    },
    {
      id: "armazenamento",
      titulo: "Armazenamento",
      linhas: [["Em uso", `${gb(s.armazenamento.usado_gb)} GB de ${gb(s.armazenamento.total_gb)} GB`]],
      atencao: s.armazenamento.atencao,
    },
    {
      id: "bateria",
      titulo: "Bateria",
      linhas: [
        ["Carga", pct(s.bateria.nivel)],
        ["Alimentação", s.bateria.na_tomada ? "Na tomada" : "Fora da tomada"],
      ],
      atencao: s.bateria.atencao,
    },
    {
      id: "dermatoscopio",
      titulo: "Dermatoscópio",
      linhas: [
        ["Conexão", s.dermatoscopio.conectado ? "Conectado" : "Não conectado"],
        ["Aparelho", s.dermatoscopio.identificacao],
      ],
      atencao: s.dermatoscopio.atencao,
    },
    {
      id: "relogio",
      titulo: "Relógio",
      linhas: [
        ["Hora do aparelho", dataHora(s.relogio.hora_aparelho)],
        [
          "Diferença da rede",
          s.relogio.diferenca_rede_min === 0
            ? "Sem diferença"
            : `${Math.abs(s.relogio.diferenca_rede_min)} min ${s.relogio.diferenca_rede_min > 0 ? "adiantado" : "atrasado"}`,
        ],
      ],
      atencao: s.relogio.atencao,
      destino: { rota: "/admin/configuracoes", rotulo: "Abrir Configurações" },
    },
    {
      id: "uso",
      titulo: "Uso",
      linhas: [
        ["Triagens hoje", s.uso.triagens_hoje],
        ["Triagens na semana", s.uso.triagens_semana],
        ["Indeterminado na semana", pct(s.uso.taxa_indeterminado)],
        ["Capturas reprovadas na semana", pct(s.uso.taxa_reprovacao)],
      ],
      atencao: s.uso.atencao,
    },
  ];
}

function ConteudoCartao({ c, tocavel }: { c: Cartao; tocavel: boolean }) {
  return (
    <>
      <div style={S.cabecalhoCartao}>
        <h2 style={S.tituloCartao}>{c.titulo}</h2>
        {c.atencao && (
          <span style={S.selo}>
            <span aria-hidden="true">⚠ </span>Atenção
          </span>
        )}
      </div>
      <dl style={S.linhas}>
        {c.linhas.map(([rotulo, valor]) => (
          <div key={rotulo} style={S.linha}>
            <dt style={S.rotulo}>{rotulo}</dt>
            <dd style={S.valor}>{valor}</dd>
          </div>
        ))}
      </dl>
      {c.atencao && <p style={S.motivo}>{c.atencao}</p>}
      {tocavel && c.destino && (
        <span style={S.acao}>
          {c.destino.rotulo} <span aria-hidden="true">›</span>
        </span>
      )}
    </>
  );
}

export default function Tela() {
  const navigate = useNavigate();
  const { usuario } = useSessao();
  const [status, setStatus] = useState<StatusAparelho1_13 | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarStatusAparelho1_13().then((s) => ativo && setStatus(s));
    return () => {
      ativo = false;
    };
  }, []);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== "administrador") return <Navigate to="/inicio" replace />;

  const cartoes = status ? montarCartoes(status) : [];
  const emAtencao = cartoes.filter((c) => c.atencao).length;

  return (
    <div style={S.tela}>
      <div style={S.cabecalho}>
        <h1 style={S.titulo}>Status do aparelho</h1>
        {status && <p style={S.secundario}>Consultado em {dataHora(status.consultado_em)}</p>}
      </div>

      {status === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando status…
        </p>
      ) : (
        <>
          <p style={emAtencao > 0 ? S.resumoAtencao : S.secundario}>
            {emAtencao > 0
              ? `${emAtencao} ${plural(emAtencao, "item em atenção", "itens em atenção")}.`
              : "Nenhum item em atenção."}
          </p>
          <ul style={S.grade}>
            {cartoes.map((c) => {
              const estilo = { ...S.cartao, ...(c.atencao ? S.cartaoAtencao : null) };
              const tocavel = Boolean(c.atencao && c.destino);
              return (
                <li key={c.id} style={S.item}>
                  {tocavel && c.destino ? (
                    <button
                      type="button"
                      style={{ ...estilo, ...S.cartaoTocavel }}
                      onClick={() => navigate(c.destino!.rota)}
                    >
                      <ConteudoCartao c={c} tocavel />
                    </button>
                  ) : (
                    <section style={estilo} aria-label={c.titulo}>
                      <ConteudoCartao c={c} tocavel={false} />
                    </section>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "calc(var(--espaco) * 2)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  resumoAtencao: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  grade: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 2)",
  },
  item: { display: "flex" },
  cartao: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "var(--espaco)",
    padding: "calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    font: "inherit",
    color: "var(--cor-grafite)",
    textAlign: "left",
  },
  cartaoAtencao: { border: "3px solid var(--cor-laranja)" },
  cartaoTocavel: { cursor: "pointer", minHeight: "var(--toque)" },
  cabecalhoCartao: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--espaco)" },
  tituloCartao: { fontSize: 22, lineHeight: 1.2 },
  selo: { color: "var(--cor-laranja-700)", fontWeight: 700 },
  linhas: { margin: 0, display: "grid", gap: 4 },
  linha: { display: "flex", justifyContent: "space-between", gap: "var(--espaco)" },
  rotulo: { color: "var(--cor-secundario)" },
  valor: { margin: 0, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  motivo: {
    paddingTop: "var(--espaco)",
    borderTop: "1px solid var(--cor-borda)",
    color: "var(--cor-grafite)",
  },
  acao: { marginTop: "auto", color: "var(--cor-laranja-700)", fontWeight: 700, textDecoration: "underline" },
};
