import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LIMITES } from "../config";
import { AVISO_TRIAGEM, TEXTO_CONDUTA, type Conduta } from "../dominio";
import {
  CODIGO_PIN_PAUSADO_1_15,
  HOJE_MOCK,
  MOTIVOS_ANULACAO_1_15,
  anularTriagem1_15,
  buscarTriagensUnidade1_15,
  type MotivoAnulacao1_15,
  type TriagemUnidade1_15,
} from "../mocks";
import { useSessao } from "../sessao";
import { BlocoConduta, Botao, Dialogo, FaixaTriagem, TecladoNumerico } from "../ui";

// Pendente de mover para config.ts (LIMITES); ver relatório da tela.
const PERIODOS_DIAS = [7, 30] as const;

const CONDUTAS: Conduta[] = ["encaminhar_prioritario", "encaminhar_eletivo", "seguimento", "indeterminado"];

const TODOS = "todos";
const SEM_RESULTADO = "sem_resultado";
const HOJE = "hoje";

type FiltroAnulados = "incluir" | "ocultar" | "somente";

interface Filtros {
  periodo: string; // HOJE, dias, ou TODOS
  operador: string;
  conduta: Conduta | typeof SEM_RESULTADO | typeof TODOS;
  local: string;
  sync: "aguardando" | "enviado" | typeof TODOS;
  anulados: FiltroAnulados;
}

const FILTROS_PADRAO: Filtros = {
  periodo: TODOS,
  operador: TODOS,
  conduta: TODOS,
  local: TODOS,
  sync: TODOS,
  anulados: "incluir",
};

const ROTULO_SYNC = { aguardando: "Aguardando envio", enviado: "Enviada" } as const;
const ROTULO_ANULADOS: Record<FiltroAnulados, string> = {
  incluir: "Mostrar",
  ocultar: "Ocultar",
  somente: "Só anulados",
};

const rotuloMotivo = (m: MotivoAnulacao1_15) => MOTIVOS_ANULACAO_1_15.find((x) => x.valor === m)!.rotulo;

const dois = (n: number) => String(n).padStart(2, "0");

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

// "Hoje" do protótipo é HOJE_MOCK, o mesmo dia das triagens de exemplo.
const diasAtras = (iso: string) => Math.round((Date.parse(HOJE_MOCK) - Date.parse(iso.slice(0, 10))) / 86_400_000);

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

const pct = (a: number, n: number) => `${Math.round((a / n) * 100)}%`;

const rotuloPeriodo = (p: string) => (p === TODOS ? "Todo o período" : p === HOJE ? "Hoje" : `Últimos ${p} dias`);

const rotuloConduta = (c: Filtros["conduta"]) =>
  c === TODOS ? "Todas" : c === SEM_RESULTADO ? "Sem resultado" : TEXTO_CONDUTA[c].tituloCurto;

// Todos os filtros menos "anulados", que a lista e o relatório tratam de jeitos diferentes.
function noRecorte(t: TriagemUnidade1_15, f: Filtros): boolean {
  const dias = diasAtras(t.data);
  if (f.periodo === HOJE && dias !== 0) return false;
  if (f.periodo !== HOJE && f.periodo !== TODOS && dias >= Number(f.periodo)) return false;
  if (f.operador !== TODOS && t.operador_id !== f.operador) return false;
  if (f.conduta === SEM_RESULTADO && t.resultado) return false;
  if (f.conduta !== TODOS && f.conduta !== SEM_RESULTADO && t.resultado?.conduta !== f.conduta) return false;
  if (f.local !== TODOS && t.local !== f.local) return false;
  if (f.sync !== TODOS && t.sync !== f.sync) return false;
  return true;
}

function filtrarLista(triagens: TriagemUnidade1_15[], f: Filtros) {
  return triagens
    .filter((t) => noRecorte(t, f))
    .filter((t) => (f.anulados === "ocultar" ? !t.anulacao : f.anulados === "somente" ? !!t.anulacao : true))
    .sort((a, b) => b.data.localeCompare(a.data));
}

// Só contagens: nada aqui mede sensibilidade ou acurácia.
function consolidar(triagens: TriagemUnidade1_15[], f: Filtros) {
  const recorte = triagens.filter((t) => noRecorte(t, f));
  const validas = recorte.filter((t) => !t.anulacao);
  const comResultado = validas.filter((t) => t.resultado);
  const porConduta = CONDUTAS.map((c) => ({
    conduta: c,
    n: comResultado.filter((t) => t.resultado!.conduta === c).length,
  }));
  const comCapturas = validas.filter((t) => t.capturas);
  const capturasFeitas = comCapturas.reduce((s, t) => s + t.capturas!.feitas, 0);
  const capturasReprovadas = comCapturas.reduce((s, t) => s + t.capturas!.reprovadas, 0);
  const comparaveis = comResultado.filter(
    (t) => t.resultado!.conduta !== "indeterminado" && t.decisao_profissional !== null,
  );
  return {
    total: validas.length,
    anuladas: recorte.length - validas.length,
    comResultado: comResultado.length,
    semResultado: validas.length - comResultado.length,
    porConduta,
    indeterminadas: porConduta.find((p) => p.conduta === "indeterminado")!.n,
    capturasFeitas,
    capturasReprovadas,
    semRegistroCaptura: validas.length - comCapturas.length,
    comparaveis: comparaveis.length,
    concordantes: comparaveis.filter((t) => t.decisao_profissional === t.resultado!.conduta).length,
  };
}

function Filtro({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: [string, string][];
}) {
  return (
    <label style={S.campo}>
      <span style={S.rotulo}>{rotulo}</span>
      <select style={S.select} value={valor} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}

function Taxa({ titulo, a, n, deQue, nota }: { titulo: string; a: number; n: number; deQue: string; nota: string }) {
  return (
    <div style={S.cartao}>
      <h3 style={S.cartaoTitulo}>{titulo}</h3>
      {n === 0 ? (
        <p style={S.taxaValor}>
          —<span style={S.taxaN}> sem dados no recorte (n = 0)</span>
        </p>
      ) : (
        <p style={S.taxaValor}>
          {pct(a, n)}
          <span style={S.taxaN}>
            {" "}
            {a} de {n} {deQue}
          </span>
        </p>
      )}
      <p style={S.secundario}>{nota}</p>
    </div>
  );
}

type Anulando = {
  triagem: TriagemUnidade1_15;
  passo: "motivo" | "pin";
  motivo: MotivoAnulacao1_15 | null;
  pin: string;
  enviando: boolean;
  retorno: { status: "incorreto"; restantes: number } | { status: "pausado"; minutos: number } | null;
};

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atualizar } = useSessao();
  const [triagens, setTriagens] = useState<TriagemUnidade1_15[] | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [relatorio, setRelatorio] = useState(false);
  const [anulando, setAnulando] = useState<Anulando | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ativo = useRef(true);

  const carregar = () => buscarTriagensUnidade1_15().then((t) => ativo.current && setTriagens(t));

  useEffect(() => {
    ativo.current = true;
    carregar();
    return () => {
      ativo.current = false;
    };
  }, []);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== "administrador") return <Navigate to="/inicio" replace />;

  const mudar = <K extends keyof Filtros>(chave: K, valor: Filtros[K]) =>
    setFiltros((atual) => ({ ...atual, [chave]: valor }));

  const todas = triagens ?? [];
  const operadores = [...new Map(todas.map((t) => [t.operador_id, t])).values()]
    .map((t) => ({ id: t.operador_id, nome: t.operador_nome, ativo: t.operador_ativo }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const locais = [...new Set(todas.map((t) => t.local))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lista = filtrarLista(todas, filtros);
  const anuladasNaLista = lista.filter((t) => t.anulacao).length;
  const filtrosAlterados = (Object.keys(FILTROS_PADRAO) as (keyof Filtros)[]).some(
    (k) => filtros[k] !== FILTROS_PADRAO[k],
  );

  const verDetalhes = (t: TriagemUnidade1_15) => {
    if (!t.resultado) return;
    atualizar({ resultado: t.resultado, atendimento: { codigo: t.codigo, local: t.local } });
    navigate("/triagem/detalhes", { state: { voltarPara: "/admin/historico", triagemId: t.id } });
  };

  const abrirAnulacao = (t: TriagemUnidade1_15) => {
    setAviso(null);
    setAnulando({ triagem: t, passo: "motivo", motivo: null, pin: "", enviando: false, retorno: null });
  };

  const confirmarAnulacao = () => {
    if (!anulando?.motivo || anulando.pin.length < LIMITES.pinDigitos) return;
    const { triagem, motivo, pin } = anulando;
    setAnulando({ ...anulando, enviando: true });
    anularTriagem1_15({ triagemId: triagem.id, motivo, adminId: usuario.id, adminNome: usuario.nome, pin }).then(
      (r) => {
        if (!ativo.current) return;
        if (r.status === "ok") {
          setAnulando(null);
          setAviso(
            `Registro ${triagem.codigo} anulado. Ele continua na lista, marcado como Anulado, e saiu das contagens.`,
          );
          carregar();
          return;
        }
        setAnulando((atual) => atual && { ...atual, pin: "", enviando: false, retorno: r });
      },
    );
  };

  const filtrosForm = (
    <form style={S.filtros} aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
      <Filtro
        rotulo="Período"
        valor={filtros.periodo}
        onChange={(v) => mudar("periodo", v)}
        opcoes={[TODOS, HOJE, ...PERIODOS_DIAS.map(String)].map((p) => [p, rotuloPeriodo(p)])}
      />
      <Filtro
        rotulo="Operador"
        valor={filtros.operador}
        onChange={(v) => mudar("operador", v)}
        opcoes={[
          [TODOS, "Todos"],
          ...operadores.map((o): [string, string] => [o.id, o.ativo ? o.nome : `${o.nome} (desativado(a))`]),
        ]}
      />
      <Filtro
        rotulo="Conduta sugerida"
        valor={filtros.conduta}
        onChange={(v) => mudar("conduta", v as Filtros["conduta"])}
        opcoes={([TODOS, ...CONDUTAS, SEM_RESULTADO] as Filtros["conduta"][]).map((c) => [c, rotuloConduta(c)])}
      />
      <Filtro
        rotulo="Local"
        valor={filtros.local}
        onChange={(v) => mudar("local", v)}
        opcoes={[[TODOS, "Todos"], ...locais.map((l): [string, string] => [l, l])]}
      />
      <Filtro
        rotulo="Sincronização"
        valor={filtros.sync}
        onChange={(v) => mudar("sync", v as Filtros["sync"])}
        opcoes={[
          [TODOS, "Todas"],
          ["aguardando", ROTULO_SYNC.aguardando],
          ["enviado", ROTULO_SYNC.enviado],
        ]}
      />
      {!relatorio && (
        <Filtro
          rotulo="Anulados"
          valor={filtros.anulados}
          onChange={(v) => mudar("anulados", v as FiltroAnulados)}
          opcoes={(Object.keys(ROTULO_ANULADOS) as FiltroAnulados[]).map((a) => [a, ROTULO_ANULADOS[a]])}
        />
      )}
      {filtrosAlterados && (
        <Botao variante="texto" style={S.limpar} onClick={() => setFiltros(FILTROS_PADRAO)}>
          Limpar filtros
        </Botao>
      )}
    </form>
  );

  if (relatorio) {
    const r = consolidar(todas, filtros);
    const operadorEscolhido = operadores.find((o) => o.id === filtros.operador)?.nome ?? "Todos";
    const recorte = [
      `Período: ${rotuloPeriodo(filtros.periodo)}`,
      `Operador: ${operadorEscolhido}`,
      `Conduta: ${rotuloConduta(filtros.conduta)}`,
      `Local: ${filtros.local === TODOS ? "Todos" : filtros.local}`,
      `Sincronização: ${filtros.sync === TODOS ? "Todas" : ROTULO_SYNC[filtros.sync]}`,
    ].join(" · ");

    return (
      <div style={S.tela}>
        <div style={S.cabecalho}>
          <h1 style={S.titulo}>Relatório consolidado</h1>
          <Botao variante="secundario" onClick={() => setRelatorio(false)}>
            ‹ Voltar à lista
          </Botao>
        </div>
        <FaixaTriagem aviso={AVISO_TRIAGEM} />
        {filtrosForm}

        {triagens === null ? (
          <p style={S.secundario} aria-live="polite">
            Carregando relatório…
          </p>
        ) : (
          <>
            <p style={S.secundario}>{recorte}</p>

            <div style={S.cartao}>
              <h2 style={S.cartaoTitulo}>Total de triagens</h2>
              <p style={S.taxaValor}>
                {r.total}
                <span style={S.taxaN}> (n = {r.total})</span>
              </p>
              <p style={S.secundario}>
                {r.anuladas > 0
                  ? `${r.anuladas} ${plural(r.anuladas, "registro anulado ficou", "registros anulados ficaram")} fora das contagens.`
                  : "Nenhum registro anulado neste recorte."}
              </p>
            </div>

            <section style={S.cartao} aria-labelledby="titulo-distribuicao">
              <h2 id="titulo-distribuicao" style={S.cartaoTitulo}>
                Distribuição por conduta sugerida <span style={S.taxaN}>(n = {r.total})</span>
              </h2>
              <table style={S.tabelaSimples}>
                <thead>
                  <tr>
                    <th scope="col" style={S.th}>
                      Conduta sugerida
                    </th>
                    <th scope="col" style={{ ...S.th, ...S.numero }}>
                      Triagens
                    </th>
                    <th scope="col" style={{ ...S.th, ...S.numero }}>
                      Do total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.porConduta.map((p) => (
                    <tr key={p.conduta}>
                      <td style={S.td}>
                        <BlocoConduta conduta={p.conduta} variante="marcador" />
                      </td>
                      <td style={{ ...S.td, ...S.numero }}>{p.n}</td>
                      <td style={{ ...S.td, ...S.numero }}>{r.total > 0 ? pct(p.n, r.total) : "—"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={S.td}>
                      <span aria-hidden="true">— </span>Encerrada sem resultado
                    </td>
                    <td style={{ ...S.td, ...S.numero }}>{r.semResultado}</td>
                    <td style={{ ...S.td, ...S.numero }}>{r.total > 0 ? pct(r.semResultado, r.total) : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <div style={S.taxas}>
              <Taxa
                titulo="Taxa de indeterminado"
                a={r.indeterminadas}
                n={r.comResultado}
                deQue={plural(r.comResultado, "triagem com resultado", "triagens com resultado")}
                nota="Triagens encerradas sem resultado ficam fora."
              />
              <Taxa
                titulo="Taxa de captura reprovada"
                a={r.capturasReprovadas}
                n={r.capturasFeitas}
                deQue={plural(r.capturasFeitas, "captura", "capturas")}
                nota={
                  r.semRegistroCaptura > 0
                    ? `${r.semRegistroCaptura} ${plural(r.semRegistroCaptura, "triagem sem registro de capturas ficou fora", "triagens sem registro de capturas ficaram fora")}.`
                    : "Conta cada tentativa de captura, aprovada ou reprovada."
                }
              />
              <Taxa
                titulo="Concordância profissional × sistema"
                a={r.concordantes}
                n={r.comparaveis}
                deQue={plural(r.comparaveis, "triagem com decisão registrada", "triagens com decisão registrada")}
                nota="Decisão do profissional igual à conduta sugerida. Indeterminado e triagens sem decisão registrada ficam fora."
              />
            </div>

            <p style={S.nota}>
              Só contagens deste aparelho. Estes números não medem sensibilidade nem acurácia do modelo.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={S.tela}>
      <div style={S.cabecalho}>
        <h1 style={S.titulo}>Histórico da unidade</h1>
        <Botao variante="secundario" onClick={() => setRelatorio(true)} disabled={triagens === null}>
          Relatório consolidado
        </Botao>
      </div>
      <FaixaTriagem aviso={AVISO_TRIAGEM} />
      {filtrosForm}

      {aviso && (
        <p style={S.aviso} role="status">
          {aviso}
        </p>
      )}

      {triagens === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando histórico…
        </p>
      ) : lista.length === 0 ? (
        <div style={S.vazio}>
          <p>
            {todas.length === 0 ? "Nenhuma triagem registrada neste aparelho." : "Nenhum registro com esses filtros."}
          </p>
          {filtrosAlterados && (
            <Botao variante="secundario" onClick={() => setFiltros(FILTROS_PADRAO)}>
              Limpar filtros
            </Botao>
          )}
        </div>
      ) : (
        <>
          <p style={S.secundario} aria-live="polite">
            {lista.length} {plural(lista.length, "registro", "registros")}
            {anuladasNaLista > 0 && ` · ${anuladasNaLista} ${plural(anuladasNaLista, "anulado", "anulados")}`}
          </p>
          <div style={S.rolagem}>
            <table style={S.tabela}>
              <thead>
                <tr>
                  {["Data e hora", "Atendimento", "Conduta sugerida", "Sincronização", "Operador"].map((t) => (
                    <th key={t} scope="col" style={S.th}>
                      {t}
                    </th>
                  ))}
                  <th scope="col" style={S.th}>
                    <span style={S.oculto}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} style={t.anulacao ? S.linhaAnulada : undefined}>
                    <td style={{ ...S.td, ...S.numero }}>{dataHora(t.data)}</td>
                    <td style={S.td}>
                      <span style={S.codigo}>{t.codigo}</span>
                      <span style={S.subLinha}>{t.local}</span>
                      {t.anulacao && (
                        <span style={S.anulado}>
                          <span aria-hidden="true">⊘ </span>Anulado
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      {t.resultado ? (
                        <BlocoConduta conduta={t.resultado.conduta} variante="marcador" />
                      ) : (
                        <span style={S.secundario}>Sem resultado</span>
                      )}
                    </td>
                    <td style={S.td}>
                      <span aria-hidden="true">{t.sync === "enviado" ? "● " : "○ "}</span>
                      {ROTULO_SYNC[t.sync]}
                    </td>
                    <td style={S.td}>
                      {t.operador_nome}
                      {!t.operador_ativo && <span style={S.subLinha}>desativado(a)</span>}
                    </td>
                    <td style={S.td}>
                      <div style={S.acoes}>
                        {t.resultado && (
                          <Botao
                            variante="secundario"
                            style={S.botaoAcao}
                            aria-label={`Ver detalhes de ${t.codigo}`}
                            onClick={() => verDetalhes(t)}
                          >
                            Ver detalhes
                          </Botao>
                        )}
                        {t.anulacao ? (
                          <span style={S.subLinha}>
                            {rotuloMotivo(t.anulacao.motivo)} · por {t.anulacao.por}, {dataHora(t.anulacao.em)}
                          </span>
                        ) : (
                          <Botao
                            variante="texto"
                            style={S.botaoAcao}
                            aria-label={`Anular registro ${t.codigo}`}
                            onClick={() => abrirAnulacao(t)}
                          >
                            Anular registro
                          </Botao>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialogo
        aberto={anulando?.passo === "motivo"}
        texto={`Anular o registro ${anulando?.triagem.codigo}?`}
        confirmar={{
          rotulo: "Continuar",
          desabilitado: !anulando?.motivo,
          onClick: () => anulando && setAnulando({ ...anulando, passo: "pin" }),
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setAnulando(null) }}
      >
        <p>O registro continua na lista, marcado como Anulado, e sai das contagens. Nada é apagado.</p>
        <div style={S.motivos} role="radiogroup" aria-label="Motivo">
          <span style={S.rotulo}>Motivo</span>
          {MOTIVOS_ANULACAO_1_15.map((m) => {
            const marcado = anulando?.motivo === m.valor;
            return (
              <button
                key={m.valor}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => anulando && setAnulando({ ...anulando, motivo: m.valor })}
                style={{ ...S.opcao, ...(marcado ? S.opcaoMarcada : null) }}
              >
                <span aria-hidden="true">{marcado ? "◉ " : "○ "}</span>
                {m.rotulo}
              </button>
            );
          })}
        </div>
      </Dialogo>

      <Dialogo
        aberto={anulando?.passo === "pin" && anulando.retorno?.status !== "pausado"}
        texto={`Anular o registro ${anulando?.triagem.codigo}`}
        confirmar={{
          rotulo: anulando?.enviando ? "Anulando…" : "Anular registro",
          desabilitado: !anulando || anulando.enviando || anulando.pin.length < LIMITES.pinDigitos,
          onClick: confirmarAnulacao,
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setAnulando(null) }}
      >
        <p>
          Motivo: <strong>{anulando?.motivo && rotuloMotivo(anulando.motivo)}</strong>
        </p>
        <p>Digite o seu PIN de administrador para confirmar.</p>
        {anulando?.retorno?.status === "incorreto" && (
          <p style={S.alerta} role="alert">
            PIN não confere. {anulando.retorno.restantes}{" "}
            {plural(anulando.retorno.restantes, "tentativa restante.", "tentativas restantes.")}
          </p>
        )}
        <TecladoNumerico
          rotulo="PIN do administrador"
          valor={anulando?.pin ?? ""}
          max={LIMITES.pinDigitos}
          mascarar
          onChange={(pin) => anulando && !anulando.enviando && setAnulando({ ...anulando, pin })}
        />
      </Dialogo>

      <Dialogo
        aberto={anulando?.retorno?.status === "pausado"}
        texto="Não foi possível confirmar o PIN agora."
        confirmar={{ rotulo: "Voltar à lista", onClick: () => setAnulando(null) }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setAnulando(null) }}
      >
        <p>
          Depois de várias tentativas, o PIN fica pausado por{" "}
          {anulando?.retorno?.status === "pausado" && anulando.retorno.minutos} minutos. Aguarde e tente de novo, ou
          peça a outro administrador. O registro não foi anulado.
        </p>
        <p style={S.codigoProblema}>{CODIGO_PIN_PAUSADO_1_15}</p>
      </Dialogo>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 3)", alignContent: "start", minWidth: 0 },
  cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)", fontWeight: 400 },
  filtros: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "calc(var(--espaco) * 2)",
    alignItems: "end",
  },
  campo: { display: "grid", gap: 4, minWidth: 0 },
  rotulo: { fontWeight: 600 },
  select: {
    minHeight: "var(--toque)",
    padding: "0 var(--espaco)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  limpar: { justifySelf: "start" },
  aviso: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    borderLeft: "4px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
  vazio: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    justifyItems: "start",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    borderRadius: "var(--raio)",
  },
  rolagem: { overflowX: "auto" },
  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
  },
  tabelaSimples: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    color: "var(--cor-secundario)",
    fontWeight: 600,
    borderBottom: "1px solid var(--cor-borda)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    borderBottom: "1px solid var(--cor-borda)",
    verticalAlign: "middle",
  },
  numero: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  codigo: { display: "block", fontWeight: 700 },
  subLinha: { display: "block", color: "var(--cor-secundario)" },
  // Anulado: fundo + ícone + texto (a cor não vai sozinha).
  linhaAnulada: { background: "var(--cor-offwhite)", color: "var(--cor-secundario)" },
  anulado: {
    display: "inline-block",
    marginTop: 4,
    padding: "0 var(--espaco)",
    fontWeight: 700,
    color: "var(--cor-grafite)",
    border: "2px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
  acoes: { display: "grid", gap: 4, justifyItems: "end", textAlign: "right" },
  botaoAcao: { padding: "0 calc(var(--espaco) * 2)", whiteSpace: "nowrap" },
  oculto: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" },
  motivos: { display: "grid", gap: "var(--espaco)" },
  opcao: {
    minHeight: "var(--toque)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    textAlign: "left",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  // Marcado: cor + borda grossa + negrito + ícone.
  opcaoMarcada: { background: "var(--cor-laranja)", border: "3px solid var(--cor-grafite)", fontWeight: 700 },
  alerta: { fontWeight: 600, color: "var(--cor-laranja-700)" },
  codigoProblema: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  cartao: {
    display: "grid",
    gap: "var(--espaco)",
    alignContent: "start",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cartaoTitulo: { fontSize: 20, lineHeight: 1.3 },
  taxas: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "calc(var(--espaco) * 2)" },
  taxaValor: { fontSize: "var(--fonte-titulo)", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  taxaN: { fontSize: "var(--fonte-corpo)", fontWeight: 400, color: "var(--cor-secundario)" },
  nota: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    borderLeft: "4px solid var(--cor-secundario)",
    color: "var(--cor-secundario)",
  },
};
