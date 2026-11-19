import { useEffect, useState, type CSSProperties } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AVISO_TRIAGEM, TEXTO_CONDUTA, TEXTO_RISCO } from "../dominio";
import {
  CODIGO_ATENDIMENTO_DIGITOS,
  CODIGO_ATENDIMENTO_PREFIXO,
  CODIGO_SEM_AVISO_1_7,
  CODIGO_TRIAGEM_NAO_ENCONTRADA_1_11,
  HOJE_MOCK,
  MOTIVO_NAO_ANALISADO_1_6,
  MOTIVOS_ANULACAO_1_15,
  buscarHistoricoOperador1_11,
  type DecisaoProfissional1_8,
  type TriagemOperador1_11,
} from "../mocks";
import { useSessao } from "../sessao";
import {
  BlocoConduta,
  Botao,
  Dialogo,
  FaixaTriagem,
  MensagemProblema,
  TecladoNumerico,
  useTelaEstreita,
} from "../ui";

// Pendente de mover para config.ts (LIMITES); ver relatório da tela.
// "dias" = quantos dias contados a partir de hoje entram no filtro (Hoje = só o dia de hoje).
const PERIODOS = [
  { id: "hoje", rotulo: "Hoje", dias: 1 },
  { id: "7", rotulo: "7 dias", dias: 7 },
  { id: "30", rotulo: "30 dias", dias: 30 },
] as const;
type PeriodoId = (typeof PERIODOS)[number]["id"];
const PERIODO_PADRAO: PeriodoId = "hoje";

// Textos literais do prompt da 1.11.
const VAZIO = "Nenhuma triagem neste período.";
const EXPORTAR_INDISPONIVEL = "Relatório ainda não disponível neste protótipo.";
// Mesmos textos da 1.9, para o indeterminado aparecer aqui como apareceu lá.
const MOTIVO_INDETERMINADO = "Esta imagem não permitiu uma triagem confiável.";

const ROTULO_SYNC = {
  aguardando: "⏳ aguardando",
  enviado: "⇅ enviado",
} as const;

const rotuloDecisao = (d: DecisaoProfissional1_8 | null) =>
  d === null
    ? "Não registrada"
    : d === "outra"
      ? "Outra"
      : TEXTO_CONDUTA[d].tituloCurto;

const rotuloMotivoAnulacao = (m: string) =>
  MOTIVOS_ANULACAO_1_15.find((x) => x.valor === m)?.rotulo ?? m;

// "2026-11-10T09:12:00" → hh:mm e dd/mm/aaaa, sem passar por fuso horário.
const hhmm = (iso: string) => iso.slice(11, 16);
const dia = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const dataHora = (iso: string) => `${dia(iso)} ${hhmm(iso)}`;

// "Hoje" do protótipo é HOJE_MOCK, o mesmo dia das triagens de exemplo.
const diasAtras = (iso: string) =>
  Math.round(
    (Date.parse(HOJE_MOCK) - Date.parse(iso.slice(0, 10))) / 86_400_000,
  );

const plural = (n: number, um: string, varios: string) =>
  n === 1 ? um : varios;

const ehPeriodo = (p: string | null): p is PeriodoId =>
  PERIODOS.some((x) => x.id === p);
const DIGITOS_BUSCA = new RegExp(`^\\d{1,${CODIGO_ATENDIMENTO_DIGITOS}}$`);

export default function Tela() {
  const { triagemId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const { usuario, atualizar } = useSessao();
  const [triagens, setTriagens] = useState<TriagemOperador1_11[] | null>(null);
  const [digitando, setDigitando] = useState<string | null>(null); // null = teclado fechado
  const [exportou, setExportou] = useState(false);
  const estreita = useTelaEstreita();

  // Período e busca ficam na URL para sobreviver à ida ao detalhe e à 1.10.
  const p = params.get("periodo");
  const periodo: PeriodoId = ehPeriodo(p) ? p : PERIODO_PADRAO;
  const c = params.get("codigo") ?? "";
  const busca = DIGITOS_BUSCA.test(c) ? c : "";

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    buscarHistoricoOperador1_11(usuario.id).then(
      (t) => ativo && setTriagens(t),
    );
    return () => {
      ativo = false;
    };
  }, [usuario]);

  useEffect(() => setExportou(false), [triagemId]);

  if (!usuario) return <Navigate to="/login" replace />;

  const mudarFiltros = (novo: { periodo?: PeriodoId; codigo?: string }) => {
    const proximo = { periodo, codigo: busca, ...novo };
    const q = new URLSearchParams();
    if (proximo.periodo !== PERIODO_PADRAO) q.set("periodo", proximo.periodo);
    if (proximo.codigo) q.set("codigo", proximo.codigo);
    setParams(q, { replace: true });
  };

  const voltarLista = () => navigate(`/historico${search}`);

  // ── Detalhe (/historico/:triagemId) ──────────────────────────────────
  if (triagemId) {
    if (triagens === null) {
      return (
        <p style={S.secundario} aria-live="polite">
          Carregando triagem…
        </p>
      );
    }
    const t = triagens.find((x) => x.id === triagemId);
    if (!t) {
      return (
        <div style={S.centro}>
          <MensagemProblema
            oQueHouve="Não foi possível abrir esta triagem."
            oQueFazer="Volte ao histórico e toque na triagem de novo."
            acoes={[{ rotulo: "Voltar ao histórico", onClick: voltarLista }]}
            codigo={CODIGO_TRIAGEM_NAO_ENCONTRADA_1_11}
          />
        </div>
      );
    }
    // Sem aviso a faixa não existe, e sem faixa não há resultado na tela.
    if (t.resultado && !t.resultado.aviso?.trim()) {
      return (
        <div style={S.centro}>
          <MensagemProblema
            oQueHouve="Não foi possível exibir o resultado desta triagem."
            oQueFazer="Volte ao histórico. Se continuar, relate o problema pelo menu com o seu nome."
            acoes={[{ rotulo: "Voltar ao histórico", onClick: voltarLista }]}
            codigo={CODIGO_SEM_AVISO_1_7}
          />
        </div>
      );
    }

    const verDetalhes = () => {
      if (!t.resultado) return;
      atualizar({
        resultado: t.resultado,
        atendimento: { codigo: t.codigo, local: t.local },
      });
      navigate("/triagem/detalhes", {
        state: { voltarPara: `/historico/${t.id}${search}` },
      });
    };

    return (
      <Detalhe
        t={t}
        exportou={exportou}
        exportar={() => setExportou(true)}
        voltar={voltarLista}
        verDetalhes={verDetalhes}
      />
    );
  }

  // ── Lista (/historico) ───────────────────────────────────────────────
  const dias = PERIODOS.find((x) => x.id === periodo)!.dias;
  const doPeriodo = (triagens ?? []).filter((t) => {
    const d = diasAtras(t.data);
    return d >= 0 && d < dias;
  });
  const lista = busca
    ? doPeriodo.filter((t) =>
        t.codigo.startsWith(CODIGO_ATENDIMENTO_PREFIXO + busca),
      )
    : doPeriodo;
  const temResultado = lista.some((t) => t.resultado);

  // Agrupa por dia (a lista já vem da mais recente para a mais antiga).
  const grupos: { dia: string; itens: TriagemOperador1_11[] }[] = [];
  for (const t of lista) {
    const d = t.data.slice(0, 10);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === d) ultimo.itens.push(t);
    else grupos.push({ dia: d, itens: [t] });
  }

  const abrirTeclado = () => setDigitando(busca);

  return (
    <div style={S.telaLista}>
      <div style={{ ...S.cabecalho, ...(estreita ? S.quebraLinha : null) }}>
        <h1 style={S.titulo}>Meu histórico</h1>
        <Botao variante="secundario" onClick={() => navigate("/inicio")}>
          ‹ Voltar
        </Botao>
      </div>

      <div style={S.filtros}>
        <div role="group" aria-label="Período" style={{ ...S.periodos, ...(estreita ? S.larguraTotal : null) }}>
          {PERIODOS.map((x) => {
            const marcado = periodo === x.id;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={marcado}
                onClick={() => mudarFiltros({ periodo: x.id })}
                style={{ ...S.opcao, ...(estreita ? S.opcaoEstreita : null), ...(marcado ? S.opcaoMarcada : null) }}
              >
                {x.rotulo}
              </button>
            );
          })}
        </div>

        <div style={{ ...S.busca, ...(estreita ? { ...S.larguraTotal, ...S.quebraLinha } : null) }}>
          <button
            type="button"
            style={{ ...S.campoBusca, ...(estreita ? S.opcaoEstreita : null) }}
            onClick={abrirTeclado}
            aria-label="Buscar código"
          >
            <span style={S.rotuloBusca}>Buscar código</span>
            <span style={S.valorBusca}>
              <span style={S.prefixo}>{CODIGO_ATENDIMENTO_PREFIXO}</span>
              {busca ? (
                <strong>{busca}</strong>
              ) : (
                <span style={S.prefixo}>
                  {"_".repeat(CODIGO_ATENDIMENTO_DIGITOS)}
                </span>
              )}
            </span>
          </button>
          {busca && (
            <Botao
              variante="texto"
              onClick={() => mudarFiltros({ codigo: "" })}
            >
              Limpar busca
            </Botao>
          )}
        </div>
      </div>

      {triagens === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando histórico…
        </p>
      ) : doPeriodo.length === 0 ? (
        <p style={S.vazio}>{VAZIO}</p>
      ) : lista.length === 0 ? (
        <div style={S.vazio}>
          <p>
            Nenhuma triagem com o código {CODIGO_ATENDIMENTO_PREFIXO}
            {busca} neste período.
          </p>
          <Botao
            variante="secundario"
            onClick={() => mudarFiltros({ codigo: "" })}
          >
            Limpar busca
          </Botao>
        </div>
      ) : (
        <>
          <p style={S.secundario} aria-live="polite">
            {lista.length} {plural(lista.length, "triagem", "triagens")}
          </p>
          {grupos.map((g) => (
            <section key={g.dia} aria-label={dia(g.dia)} style={S.grupo}>
              <h2 style={S.tituloGrupo}>
                {g.dia === HOJE_MOCK ? `Hoje · ${dia(g.dia)}` : dia(g.dia)}
              </h2>
              <ul style={S.lista}>
                {g.itens.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      style={{ ...S.item, ...(estreita ? S.itemEstreito : null) }}
                      onClick={() => navigate(`/historico/${t.id}${search}`)}
                    >
                      <span style={S.hora}>{hhmm(t.data)}</span>
                      <span style={S.codigo}>{t.codigo}</span>
                      <span style={S.localItem}>
                        {t.local}
                        {t.anulacao && (
                          <span style={S.anulado}>
                            <span aria-hidden="true">⊘ </span>Anulado
                          </span>
                        )}
                      </span>
                      {t.resultado ? (
                        <BlocoConduta
                          conduta={t.resultado.conduta}
                          variante="marcador"
                        />
                      ) : (
                        <span style={S.secundario}>
                          {MOTIVO_NAO_ANALISADO_1_6}
                        </span>
                      )}
                      <span style={S.sync}>{ROTULO_SYNC[t.sync]}</span>
                      <span style={S.seta} aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {/* A lista mostra condutas sugeridas: a faixa fica fixa no rodapé enquanto houver alguma. */}
      {temResultado && (
        <div style={S.faixaLista}>
          <FaixaTriagem aviso={AVISO_TRIAGEM} />
        </div>
      )}

      <Dialogo
        aberto={digitando !== null}
        texto="Buscar código"
        confirmar={{
          rotulo: "Buscar",
          desabilitado: !digitando,
          onClick: () => {
            mudarFiltros({ codigo: digitando ?? "" });
            setDigitando(null);
          },
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setDigitando(null) }}
      >
        <p style={S.secundario}>
          Digite os números depois de {CODIGO_ATENDIMENTO_PREFIXO}.
        </p>
        <TecladoNumerico
          valor={digitando ?? ""}
          onChange={setDigitando}
          max={CODIGO_ATENDIMENTO_DIGITOS}
          rotulo="Números do código do atendimento"
        />
      </Dialogo>
    </div>
  );
}

// ── Detalhe: o resultado da 1.8 (ou 1.9) só para leitura ──────────────
function Detalhe({
  t,
  exportou,
  exportar,
  voltar,
  verDetalhes,
}: {
  t: TriagemOperador1_11;
  exportou: boolean;
  exportar: () => void;
  voltar: () => void;
  verDetalhes: () => void;
}) {
  const r = t.resultado;
  const indeterminado = r?.conduta === "indeterminado";
  const estreita = useTelaEstreita();

  return (
    <div style={{ ...S.tela, ...(estreita ? S.telaEstreita : null) }}>
      <div style={{ ...S.colunas, ...(estreita ? S.umaColuna : null) }}>
        <section style={{ ...S.esquerda, ...(estreita ? S.esquerdaEstreita : null) }} aria-label="Imagem analisada">
          <div style={{ ...S.moldura, ...(estreita ? S.molduraEstreita : null) }}>
            {t.imagem_url ? (
              <img
                src={t.imagem_url}
                alt={`Lesão analisada, ${t.local}`}
                style={S.foto}
              />
            ) : (
              <span style={S.semImagem}>
                Imagem indisponível neste aparelho
              </span>
            )}
          </div>
          <p style={S.local}>{t.local}</p>
          <p style={S.secundario}>
            {t.codigo} · {hhmm(t.data)}
          </p>
        </section>

        <section style={S.direita} aria-labelledby="titulo-conduta">
          {r ? (
            <>
              <h1 id="titulo-conduta" style={S.rotulo}>
                CONDUTA SUGERIDA
              </h1>
              <div style={indeterminado ? S.caixaAlta : undefined}>
                <BlocoConduta conduta={r.conduta} />
              </div>
              {indeterminado ? (
                <>
                  <p style={S.subtitulo}>{MOTIVO_INDETERMINADO}</p>
                  <p style={S.subtitulo}>
                    {TEXTO_CONDUTA.indeterminado.subtitulo}
                  </p>
                </>
              ) : (
                <p style={S.subtitulo}>{TEXTO_CONDUTA[r.conduta].subtitulo}</p>
              )}
              {r.risco && (
                <p style={S.risco}>
                  Risco: <strong>{TEXTO_RISCO[r.risco]}</strong>
                </p>
              )}
              <p style={S.decisao}>
                Sua decisão:{" "}
                <strong>{rotuloDecisao(t.decisao_profissional)}</strong>
              </p>
            </>
          ) : (
            <h1 id="titulo-conduta" style={S.semResultado}>
              {MOTIVO_NAO_ANALISADO_1_6}
            </h1>
          )}

          <dl style={S.dados}>
            <dt style={S.dt}>{r ? "Data da análise" : "Data"}</dt>
            <dd style={S.dd}>{dataHora(t.data)}</dd>
            {r && (
              <>
                <dt style={S.dt}>Modelo</dt>
                <dd style={S.dd}>
                  {r.modelo} · versão {r.modelo_versao}
                </dd>
              </>
            )}
            <dt style={S.dt}>Envio ao painel</dt>
            <dd style={S.dd}>{ROTULO_SYNC[t.sync]}</dd>
          </dl>

          {t.anulacao && (
            <p style={S.avisoAnulado}>
              <span aria-hidden="true">⊘ </span>
              Registro anulado pela administração em {dataHora(t.anulacao.em)}.
              Motivo: {rotuloMotivoAnulacao(t.anulacao.motivo)}.
            </p>
          )}
        </section>
      </div>

      {r && (
        <div style={{ ...S.faixa, ...(estreita ? S.faixaEstreita : null) }}>
          <FaixaTriagem aviso={r.aviso} />
        </div>
      )}

      {r && r.limitacoes.length > 0 && (
        <section style={S.limitacoes} aria-labelledby="titulo-limitacoes">
          <h2 id="titulo-limitacoes" style={S.tituloLimitacoes}>
            Limitações
          </h2>
          <ul style={S.listaLimitacoes}>
            {r.limitacoes.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ ...S.rodape, ...(estreita ? S.rodapeEstreito : null) }}>
        <Botao variante="secundario" onClick={voltar} style={S.botaoRodape}>
          ‹ Voltar ao histórico
        </Botao>
        {exportou && (
          <p role="status" style={S.avisoExportar}>
            {EXPORTAR_INDISPONIVEL}
          </p>
        )}
        <div style={{ ...S.rodapeGrupo, ...S.quebraLinha }}>
          <Botao variante="secundario" onClick={exportar} style={S.botaoRodape}>
            Exportar
          </Botao>
          {r && (
            <Botao variante="texto" onClick={verDetalhes} style={S.botaoRodape}>
              Ver detalhes ›
            </Botao>
          )}
        </div>
      </footer>
    </div>
  );
}

// Estilos locais, no mesmo padrão da 1.3 e da 1.8 (estilos.css é compartilhado).
const ALTURA_RODAPE = 88;
const LADO_IMAGEM = 300;
const LADO_MINIATURA = 96;

const S: Record<string, CSSProperties> = {
  // Lista
  telaLista: {
    maxWidth: 1040,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
  },
  cabecalho: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  filtros: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "calc(var(--espaco) * 2)",
  },
  periodos: { display: "flex", gap: "var(--espaco)" },
  opcao: {
    minHeight: 56,
    minWidth: 112,
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    fontWeight: 600,
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  // Marcado: fundo + texto invertido + negrito (a cor não vai sozinha).
  opcaoMarcada: {
    color: "var(--cor-offwhite)",
    background: "var(--cor-grafite)",
    fontWeight: 700,
  },
  busca: { display: "flex", alignItems: "center", gap: "var(--espaco)" },
  campoBusca: {
    minHeight: 56,
    minWidth: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  rotuloBusca: { fontWeight: 600 },
  valorBusca: {
    fontSize: 22,
    letterSpacing: "0.08em",
    fontVariantNumeric: "tabular-nums",
  },
  prefixo: { color: "var(--cor-secundario)" },
  vazio: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    justifyItems: "start",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    borderRadius: "var(--raio)",
  },
  grupo: { display: "grid", gap: "var(--espaco)" },
  tituloGrupo: { fontSize: 20, lineHeight: 1.2 },
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
    gridTemplateColumns: "64px 88px minmax(0, 1fr) 300px 150px auto",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    background: "none",
    border: 0,
    borderBottom: "1px solid var(--cor-borda)",
    font: "inherit",
    color: "var(--cor-grafite)",
    textAlign: "left",
    cursor: "pointer",
  },
  hora: { fontVariantNumeric: "tabular-nums" },
  codigo: { fontWeight: 700 },
  localItem: { display: "grid", gap: 2 },
  anulado: {
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    color: "var(--cor-secundario)",
  },
  sync: { color: "var(--cor-secundario)", whiteSpace: "nowrap" },
  seta: { color: "var(--cor-secundario)", fontSize: 24 },
  faixaLista: {
    position: "sticky",
    bottom: 0,
    paddingBottom: "calc(var(--espaco) * 2)",
    background: "var(--cor-offwhite)",
  },

  // Detalhe
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
  caixaAlta: { textTransform: "uppercase" },
  subtitulo: { fontSize: 22, lineHeight: 1.35 },
  risco: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  decisao: { fontSize: 20 },
  semResultado: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  dados: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "calc(var(--espaco) * 2)",
    rowGap: 4,
    margin: 0,
    marginTop: "var(--espaco)",
    paddingTop: "var(--espaco)",
    borderTop: "1px solid var(--cor-borda)",
  },
  dt: { color: "var(--cor-secundario)" },
  dd: { margin: 0, fontWeight: 600 },
  avisoAnulado: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    borderLeft: "4px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
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
  // Celular: filtros ocupam a largura; o item da lista quebra em linhas; no detalhe as
  // colunas empilham e o rodapé sai do fixo para a faixa de triagem ficar sempre visível.
  quebraLinha: { flexWrap: "wrap" },
  larguraTotal: { width: "100%" },
  opcaoEstreita: { flex: 1, minWidth: 0 },
  itemEstreito: { display: "flex", flexWrap: "wrap", columnGap: "calc(var(--espaco) * 2)", rowGap: 4 },
  telaEstreita: { paddingBottom: 0 },
  umaColuna: { gridTemplateColumns: "minmax(0, 1fr)", gap: "calc(var(--espaco) * 2)" },
  // Imagem vira miniatura ao lado do local, para a conduta caber acima da faixa.
  esquerdaEstreita: {
    gridTemplateColumns: `${LADO_MINIATURA}px minmax(0, 1fr)`,
    columnGap: "calc(var(--espaco) * 2)",
    alignContent: "start",
  },
  molduraEstreita: { width: LADO_MINIATURA, height: LADO_MINIATURA, gridRow: "1 / span 2" },
  faixaEstreita: { bottom: 0 },
  rodapeEstreito: { position: "static", flexWrap: "wrap", padding: "calc(var(--espaco) * 2) 0" },
  avisoExportar: {
    flex: 1,
    textAlign: "center",
    color: "var(--cor-secundario)",
  },
};
