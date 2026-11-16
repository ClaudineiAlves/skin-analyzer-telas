import { useEffect, useState, type CSSProperties } from "react";
import { Link, Navigate, NavLink, useSearchParams } from "react-router-dom";
import {
  APROVACOES_NECESSARIAS_2_6,
  ARQUIVOS_PACOTE_2_6,
  aprovarPublicacao2_6,
  buscarVersoesModelo2_6,
  retirarVersao2_6,
  UNIDADE_PILOTO_2_6,
  type Alcance2_6,
  type EstadoVersao2_6,
  type MetricasPacote2_6,
  type VersaoModelo2_6,
} from "../mocks";
import { useSessao, type UsuarioPainel } from "../sessao";
import { Botao, Dialogo, MensagemProblema } from "../ui";

// Navegação da equipe entre 2.4, 2.5 e 2.6 (cópia da 2.5; candidata a ir para o LayoutPainel).
const NAV_EQUIPE: [rota: string, rotulo: string][] = [
  ["/painel/metricas", "Métricas"],
  ["/painel/aparelhos", "Aparelhos"],
  ["/painel/modelos", "Modelos"],
];

const SEM_EXPERIMENTO =
  "Sem experimento registrado: esta versão não pode ser publicada.";
const SEM_METRICAS = "Nenhuma métrica registrada.";
const AGUARDANDO_2A = "Aguardando 2ª aprovação";

const ROTULO_ESTADO: Record<EstadoVersao2_6, string> = {
  rascunho: "Rascunho",
  validada: "Validada",
  publicada: "Publicada",
  retirada: "Retirada",
};
const ICONE_ESTADO: Record<EstadoVersao2_6, string> = {
  rascunho: "○",
  validada: "◐",
  publicada: "●",
  retirada: "⊘",
};

const ROTULO_ALCANCE: Record<Alcance2_6, string> = {
  piloto: `Unidade piloto · ${UNIDADE_PILOTO_2_6}`,
  todas: "Todas as unidades",
};
// «unidade» no texto do diálogo de publicar.
const DESTINO_ALCANCE: Record<Alcance2_6, string> = {
  piloto: UNIDADE_PILOTO_2_6,
  todas: "todas as unidades",
};

// ── Formatação ─────────────────────────────────────────────────────────
const inteiro = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const indice = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const dois = (n: number) => String(n).padStart(2, "0");
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const METRICAS: { rotulo: string; valor: (m: MetricasPacote2_6) => string }[] =
  [
    { rotulo: "Casos no conjunto de teste", valor: (m) => inteiro(m.n_teste) },
    {
      rotulo: "Sensibilidade para malignas (encaminhamento sugerido)",
      valor: (m) => pct(m.sensibilidade_maligna),
    },
    {
      rotulo: "Falso negativo crítico (malignas com seguimento sugerido)",
      valor: (m) => pct(m.falso_negativo_critico),
    },
    {
      rotulo: "Especificidade (não malignas sem encaminhamento)",
      valor: (m) => pct(m.especificidade),
    },
    { rotulo: "Indeterminado", valor: (m) => pct(m.indeterminado) },
    { rotulo: "AUC", valor: (m) => indice(m.auc) },
  ];

// ── Regras de tela derivadas dos dados ─────────────────────────────────
const temPedido = (v: VersaoModelo2_6) => v.pedido_alcance !== null;

// Alcances que ainda podem ser pedidos; vazio = versão fora do fluxo de publicação.
const alcancesPossiveis = (v: VersaoModelo2_6): Alcance2_6[] => {
  if (v.pedido_alcance) return [v.pedido_alcance];
  if (v.estado === "validada") return ["piloto", "todas"];
  if (v.estado === "publicada" && v.alcance === "piloto") return ["todas"];
  return [];
};

type Publicacao = { pode: true } | { pode: false; motivo: string };

const podePublicar = (v: VersaoModelo2_6, quem: UsuarioPainel): Publicacao => {
  if (!v.experimento) return { pode: false, motivo: SEM_EXPERIMENTO };
  if (v.estado === "rascunho")
    return {
      pode: false,
      motivo: "Esta versão ainda não foi validada: não pode ser publicada.",
    };
  if (v.aprovacoes.some((a) => a.email === quem.email) && temPedido(v))
    return {
      pode: false,
      motivo: `${AGUARDANDO_2A}. Você já aprovou; falta a aprovação de outra pessoa da equipe.`,
    };
  return { pode: true };
};

// A versão publicada para todas as unidades mais recente serve de comparação.
const acharReferencia = (versoes: VersaoModelo2_6[]) =>
  versoes
    .filter(
      (v) =>
        v.estado === "publicada" && v.alcance === "todas" && v.publicada_em,
    )
    .sort((a, b) =>
      (b.publicada_em ?? "").localeCompare(a.publicada_em ?? ""),
    )[0] ?? null;

const textoAprovacoes = (v: VersaoModelo2_6) => {
  if (temPedido(v))
    return `${v.aprovacoes.length} de ${APROVACOES_NECESSARIAS_2_6}`;
  if (v.estado === "publicada")
    return `${APROVACOES_NECESSARIAS_2_6} de ${APROVACOES_NECESSARIAS_2_6}`;
  if (v.estado === "retirada") return "Sem pedido aberto";
  return `0 de ${APROVACOES_NECESSARIAS_2_6}`;
};

const textoAlcance = (v: VersaoModelo2_6) => {
  if (v.estado === "publicada" && v.alcance) return ROTULO_ALCANCE[v.alcance];
  if (v.estado === "retirada") return "Nenhum (retirada)";
  return "Não publicada";
};

export default function Tela() {
  const { usuarioPainel } = useSessao();
  const [params, setParams] = useSearchParams();
  const [versoes, setVersoes] = useState<VersaoModelo2_6[] | null>(null);
  const versaoAberta = params.get("versao");

  useEffect(() => {
    let ativo = true;
    buscarVersoesModelo2_6().then((l) => ativo && setVersoes(l));
    return () => {
      ativo = false;
    };
  }, []);

  if (!usuarioPainel) return <Navigate to="/painel/login" replace />;
  if (usuarioPainel.perfil === "dermatologista")
    return <Navigate to="/painel/casos" replace />;

  // Mantém os demais parâmetros da URL (ex.: ?cenario=).
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("versao", id);
    else p.delete("versao");
    setParams(p);
  };
  const hrefVersao = (id: string) => {
    const p = new URLSearchParams(params);
    p.set("versao", id);
    return `/painel/modelos?${p.toString()}`;
  };
  const substituir = (nova: VersaoModelo2_6) =>
    setVersoes((l) => l && l.map((v) => (v.id === nova.id ? nova : v)));

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

      {versoes === null ? (
        <>
          <h1 style={S.titulo}>Modelos</h1>
          <p style={S.secundario} aria-live="polite">
            Carregando versões…
          </p>
        </>
      ) : versaoAberta ? (
        <Detalhe
          key={versaoAberta}
          id={versaoAberta}
          versoes={versoes}
          usuario={usuarioPainel}
          voltar={() => abrir(null)}
          aoMudar={substituir}
        />
      ) : (
        <Lista versoes={versoes} abrir={abrir} hrefVersao={hrefVersao} />
      )}
    </div>
  );
}

// ── Lista ──────────────────────────────────────────────────────────────
function Lista({
  versoes,
  abrir,
  hrefVersao,
}: {
  versoes: VersaoModelo2_6[];
  abrir: (id: string) => void;
  hrefVersao: (id: string) => string;
}) {
  const [enviando, setEnviando] = useState(false);

  return (
    <>
      <div style={S.cabecalho}>
        <div>
          <h1 style={S.titulo}>Modelos</h1>
          <p style={S.secundario}>
            {inteiro(versoes.length)}{" "}
            {versoes.length === 1 ? "versão" : "versões"} · toque na linha para
            ver o detalhe
          </p>
        </div>
        {!enviando && (
          <Botao onClick={() => setEnviando(true)}>Enviar pacote</Botao>
        )}
      </div>

      {enviando && <EnvioPacote fechar={() => setEnviando(false)} />}

      {versoes.length === 0 ? (
        <p style={S.vazio}>Nenhuma versão enviada.</p>
      ) : (
        <div style={S.rolagem}>
          <table style={S.tabela}>
            <thead>
              <tr>
                {["NOME", "VERSÃO", "ESTADO", "APROVAÇÕES", "ALCANCE"].map(
                  (c) => (
                    <th key={c} scope="col" style={S.th}>
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id} style={S.linha} onClick={() => abrir(v.id)}>
                  <td style={S.td}>{v.nome}</td>
                  <th scope="row" style={{ ...S.td, ...S.thLinha }}>
                    <Link
                      to={hrefVersao(v.id)}
                      style={S.link}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {v.versao}
                    </Link>
                  </th>
                  <td style={S.td}>
                    <BadgeEstado estado={v.estado} />
                  </td>
                  <td style={{ ...S.td, ...S.numero }}>
                    {textoAprovacoes(v)}
                    {temPedido(v) &&
                      v.aprovacoes.length ===
                        APROVACOES_NECESSARIAS_2_6 - 1 && (
                        <span style={S.aguardando}>
                          <span aria-hidden="true">◷ </span>
                          {AGUARDANDO_2A}
                        </span>
                      )}
                  </td>
                  <td style={S.td}>
                    {textoAlcance(v)}
                    {v.pedido_alcance && (
                      <span style={S.notaCelula}>
                        Pedido: {ROTULO_ALCANCE[v.pedido_alcance]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BadgeEstado({ estado }: { estado: EstadoVersao2_6 }) {
  return (
    <span style={{ ...S.badge, ...S[`badge_${estado}`] }}>
      <span aria-hidden="true">{ICONE_ESTADO[estado]} </span>
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

// ── Enviar pacote (só lê os nomes dos arquivos; nada é enviado) ────────
function EnvioPacote({ fechar }: { fechar: () => void }) {
  const [nomes, setNomes] = useState<string[] | null>(null);

  const presentes = new Set(nomes ?? []);
  const faltantes = ARQUIVOS_PACOTE_2_6.filter((a) => !presentes.has(a));
  const obrigatorios = new Set<string>(ARQUIVOS_PACOTE_2_6);
  const outros = (nomes ?? []).filter((n) => !obrigatorios.has(n));

  return (
    <section style={S.card} aria-labelledby="titulo-pacote">
      <div style={S.cabecalho}>
        <h2 id="titulo-pacote" style={S.cardTitulo}>
          Enviar pacote
        </h2>
        <Botao variante="secundario" onClick={fechar}>
          Fechar
        </Botao>
      </div>
      <label style={S.campo}>
        <span>Arquivos do pacote (selecione todos de uma vez)</span>
        <input
          type="file"
          multiple
          style={S.arquivo}
          onChange={(e) =>
            setNomes(Array.from(e.target.files ?? [], (f) => f.name))
          }
        />
      </label>

      <ul style={S.checklist} aria-label="Arquivos obrigatórios">
        {ARQUIVOS_PACOTE_2_6.map((a) => {
          const ok = presentes.has(a);
          return (
            <li key={a} style={S.itemChecklist}>
              <code style={S.codigo}>{a}</code>
              <span style={ok ? S.presente : S.faltando}>
                <span aria-hidden="true">{ok ? "✓ " : "○ "}</span>
                {ok ? "presente" : "faltando"}
              </span>
            </li>
          );
        })}
      </ul>

      <div role="status" aria-live="polite">
        {nomes === null ? (
          <p style={S.secundario}>Nenhum arquivo selecionado.</p>
        ) : faltantes.length > 0 ? (
          <div style={S.caixaAtencao}>
            <strong>
              <span aria-hidden="true">▲ </span>
              {faltantes.length === 1
                ? "Falta 1 arquivo no pacote:"
                : `Faltam ${inteiro(faltantes.length)} arquivos no pacote:`}
            </strong>
            <ul style={S.listaSimples}>
              {faltantes.map((a) => (
                <li key={a}>
                  <code style={S.codigo}>{a}</code>
                </li>
              ))}
            </ul>
            <p>Selecione de novo incluindo os arquivos que faltam.</p>
          </div>
        ) : (
          <p style={S.confirmacaoTexto}>
            Pacote completo: os {inteiro(ARQUIVOS_PACOTE_2_6.length)} arquivos
            obrigatórios estão presentes.
          </p>
        )}
        {outros.length > 0 && (
          <p style={S.nota}>
            Não fazem parte do pacote e serão ignorados: {outros.join(", ")}.
          </p>
        )}
      </div>
      <p style={S.nota}>
        Protótipo: só os nomes dos arquivos são conferidos; nada é enviado e a
        lista de versões não muda.
      </p>
    </section>
  );
}

// ── Detalhe ────────────────────────────────────────────────────────────
type Acao = "publicar" | "retirar" | null;

function Detalhe({
  id,
  versoes,
  usuario,
  voltar,
  aoMudar,
}: {
  id: string;
  versoes: VersaoModelo2_6[];
  usuario: UsuarioPainel;
  voltar: () => void;
  aoMudar: (v: VersaoModelo2_6) => void;
}) {
  const v = versoes.find((x) => x.id === id);
  const possiveis = v ? alcancesPossiveis(v) : [];
  const [dialogo, setDialogo] = useState<Acao>(null);
  const [alcance, setAlcance] = useState<Alcance2_6 | null>(
    possiveis[0] ?? null,
  );
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!v)
    return (
      <MensagemProblema
        oQueHouve={`Não foi possível encontrar a versão ${id}.`}
        oQueFazer="Confira a versão na lista de modelos."
        acoes={[{ rotulo: "Voltar à lista", onClick: voltar }]}
        codigo="MOD-VERSAO-NAO-ENCONTRADA"
      />
    );

  const referencia = acharReferencia(versoes);
  const comparar = referencia && referencia.id !== v.id ? referencia : null;
  const publicacao = podePublicar(v, usuario);
  const alcanceEscolhido = v.pedido_alcance ?? alcance;

  const publicar = async () => {
    if (!alcanceEscolhido) return;
    setOcupado(true);
    const nova = await aprovarPublicacao2_6(v.id, alcanceEscolhido, usuario);
    aoMudar(nova);
    setDialogo(null);
    setOcupado(false);
    setAviso(
      nova.estado === "publicada" && !nova.pedido_alcance
        ? `${nova.nome} ${nova.versao} publicada para ${DESTINO_ALCANCE[alcanceEscolhido]}. O administrador da unidade decide quando instalar.`
        : `Aprovação registrada. ${AGUARDANDO_2A}.`,
    );
  };

  const retirar = async () => {
    setOcupado(true);
    const nova = await retirarVersao2_6(v.id);
    aoMudar(nova);
    setDialogo(null);
    setOcupado(false);
    setAviso(
      `${nova.versao} retirada. Os aparelhos que a usam serão avisados para reverter.`,
    );
  };

  return (
    <>
      <div style={S.cabecalho}>
        <div style={S.tituloBloco}>
          <h1 style={S.titulo}>
            {v.nome} {v.versao}
          </h1>
          <BadgeEstado estado={v.estado} />
        </div>
        <Botao variante="secundario" onClick={voltar}>
          Voltar à lista
        </Botao>
      </div>
      <p style={S.secundario}>
        Enviada em {dataHora(v.enviada_em)} ·{" "}
        {v.experimento
          ? `experimento ${v.experimento.id}, registrado em ${dataHora(v.experimento.registrado_em)}`
          : "sem experimento registrado"}
        {" · "}
        {v.aparelhos_em_uso.length === 0
          ? "nenhum aparelho usa esta versão"
          : `em uso em ${v.aparelhos_em_uso.join(", ")}`}
      </p>

      {aviso && (
        <div style={S.confirmacao} role="status">
          <p style={S.confirmacaoTexto}>{aviso}</p>
        </div>
      )}

      <div style={S.colunas}>
        <div style={S.principal}>
          <section
            style={{ ...S.comparacao, ...(comparar ? {} : S.umaColuna) }}
            aria-label="Pacote comparado com a versão publicada"
          >
            <h2 style={S.cabecaColuna}>Este pacote · {v.versao}</h2>
            {comparar && (
              <h2 style={S.cabecaColuna}>Publicada · {comparar.versao}</h2>
            )}

            <Card titulo="card.md" texto={v.card_md} />
            {comparar && (
              <Card
                titulo={`card.md da ${comparar.versao}`}
                texto={comparar.card_md}
              />
            )}

            <Metricas titulo="metrics.json do pacote" m={v.metricas} />
            {comparar && (
              <Metricas
                titulo={`metrics.json da ${comparar.versao}`}
                m={comparar.metricas}
              />
            )}
          </section>
          {!comparar && (
            <p style={S.nota}>
              {referencia
                ? "Esta é a versão publicada para todas as unidades usada como comparação."
                : "Nenhuma versão publicada para todas as unidades para comparar."}
            </p>
          )}
        </div>

        <aside style={S.lateral} aria-labelledby="titulo-publicacao">
          <section style={S.card}>
            <h2 id="titulo-publicacao" style={S.cardTitulo}>
              Publicação
            </h2>
            <dl style={S.dados}>
              <div style={S.dado}>
                <dt style={S.dt}>Alcance</dt>
                <dd style={S.dd}>{textoAlcance(v)}</dd>
              </div>
              {v.publicada_em && v.estado === "publicada" && (
                <div style={S.dado}>
                  <dt style={S.dt}>Publicada em</dt>
                  <dd style={{ ...S.dd, ...S.numero }}>
                    {dataHora(v.publicada_em)}
                  </dd>
                </div>
              )}
              {v.retirada_em && (
                <div style={S.dado}>
                  <dt style={S.dt}>Retirada em</dt>
                  <dd style={{ ...S.dd, ...S.numero }}>
                    {dataHora(v.retirada_em)}
                  </dd>
                </div>
              )}
              {v.estado !== "retirada" && (
                <div style={S.dado}>
                  <dt style={S.dt}>
                    {v.pedido_alcance
                      ? `Aprovações do pedido para ${DESTINO_ALCANCE[v.pedido_alcance]}`
                      : "Aprovações"}
                  </dt>
                  <dd style={{ ...S.dd, ...S.numero }}>{textoAprovacoes(v)}</dd>
                </div>
              )}
            </dl>

            {v.aprovacoes.length > 0 &&
              (temPedido(v) ||
                v.aprovacoes.length >= APROVACOES_NECESSARIAS_2_6) && (
                <ul style={S.listaSimples} aria-label="Quem aprovou">
                  {v.aprovacoes.map((a) => (
                    <li key={a.email} style={S.nota}>
                      {a.nome} · {dataHora(a.em)}
                    </li>
                  ))}
                </ul>
              )}

            {temPedido(v) &&
              v.aprovacoes.length === APROVACOES_NECESSARIAS_2_6 - 1 && (
                <p style={S.aguardandoBloco}>
                  <span aria-hidden="true">◷ </span>
                  {AGUARDANDO_2A}
                </p>
              )}

            {(possiveis.length > 0 || v.estado === "rascunho") && (
              <>
                <Botao
                  onClick={() => {
                    setAlcance(possiveis[0] ?? null);
                    setDialogo("publicar");
                  }}
                  disabled={!publicacao.pode || ocupado}
                  aria-describedby={
                    publicacao.pode ? undefined : "motivo-publicar"
                  }
                >
                  {temPedido(v) ? "Publicar (2ª aprovação)" : "Publicar"}
                </Botao>
                {!publicacao.pode && (
                  <p id="motivo-publicar" style={S.motivo}>
                    {publicacao.motivo}
                  </p>
                )}
              </>
            )}

            {v.estado === "publicada" && (
              <Botao
                variante="secundario"
                onClick={() => setDialogo("retirar")}
                disabled={ocupado}
              >
                Retirar
              </Botao>
            )}

            <p style={S.nota}>
              Publicar só disponibiliza a versão: o painel não instala modelos.
              O administrador de cada unidade instala ou reverte no próprio
              aparelho.
            </p>
          </section>
        </aside>
      </div>

      <Dialogo
        aberto={dialogo === "publicar" && alcanceEscolhido !== null}
        texto={
          alcanceEscolhido
            ? `Publicar ${v.nome} ${v.versao} para ${DESTINO_ALCANCE[alcanceEscolhido]}? O administrador da unidade decide quando instalar.`
            : ""
        }
        confirmar={{
          rotulo: ocupado ? "Publicando…" : "Publicar",
          onClick: publicar,
          desabilitado: ocupado,
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setDialogo(null) }}
      >
        <fieldset style={S.fieldset}>
          <legend style={S.legenda}>Alcance</legend>
          {(["piloto", "todas"] as Alcance2_6[]).map((a) => {
            const permitido = possiveis.includes(a);
            return (
              <label
                key={a}
                style={{
                  ...S.opcao,
                  ...(permitido ? {} : S.opcaoDesabilitada),
                }}
              >
                <input
                  type="radio"
                  name="alcance"
                  value={a}
                  checked={alcanceEscolhido === a}
                  disabled={!permitido || ocupado}
                  onChange={() => setAlcance(a)}
                  style={S.radio}
                />
                {ROTULO_ALCANCE[a]}
                {!permitido && v.alcance === a && v.estado === "publicada" && (
                  <span style={S.nota}> (já publicada)</span>
                )}
              </label>
            );
          })}
        </fieldset>
        {v.pedido_alcance && (
          <p style={S.nota}>
            O alcance foi escolhido na 1ª aprovação e não muda na 2ª.
          </p>
        )}
        <p style={S.nota}>
          {temPedido(v) && v.aprovacoes.length + 1 >= APROVACOES_NECESSARIAS_2_6
            ? "Com a sua aprovação, a versão é publicada."
            : `A versão só é publicada com ${inteiro(APROVACOES_NECESSARIAS_2_6)} aprovações de pessoas diferentes da equipe.`}
        </p>
      </Dialogo>

      <Dialogo
        aberto={dialogo === "retirar"}
        texto={`Retirar ${v.versao}? Os aparelhos que a usam serão avisados para reverter.`}
        confirmar={{
          rotulo: ocupado ? "Retirando…" : "Retirar",
          onClick: retirar,
          desabilitado: ocupado,
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setDialogo(null) }}
      >
        <p style={S.secundario}>
          {v.aparelhos_em_uso.length === 0
            ? "Nenhum aparelho usa esta versão agora."
            : `Em uso em ${inteiro(v.aparelhos_em_uso.length)} ${v.aparelhos_em_uso.length === 1 ? "aparelho" : "aparelhos"}: ${v.aparelhos_em_uso.join(", ")}.`}
        </p>
      </Dialogo>
    </>
  );
}

function Card({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={S.card}>
      <h3 style={S.subtitulo}>
        <code style={S.codigo}>{titulo}</code>
      </h3>
      <pre style={S.markdown}>{texto}</pre>
    </div>
  );
}

function Metricas({
  titulo,
  m,
}: {
  titulo: string;
  m: MetricasPacote2_6 | null;
}) {
  return (
    <div style={S.card}>
      <h3 style={S.subtitulo}>
        <code style={S.codigo}>{titulo}</code>
      </h3>
      {m === null ? (
        <p style={S.vazio}>{SEM_METRICAS}</p>
      ) : (
        <>
          <dl style={S.metricas}>
            {METRICAS.map((c) => (
              <div key={c.rotulo} style={S.metrica}>
                <dt style={S.dt}>{c.rotulo}</dt>
                <dd style={{ ...S.dd, ...S.numero }}>{c.valor(m)}</dd>
              </div>
            ))}
          </dl>
          <p style={S.nota}>{m.conjunto_teste}</p>
        </>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  nav: {
    display: "flex",
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
  rolagem: {
    overflowX: "auto",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  tabela: { width: "100%", borderCollapse: "collapse" },
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
  thLinha: { textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
  td: {
    height: "var(--toque)",
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    borderBottom: "1px solid var(--cor-borda)",
    verticalAlign: "middle",
  },
  linha: { cursor: "pointer" },
  link: { color: "var(--cor-grafite)", fontWeight: 700 },
  notaCelula: {
    display: "block",
    fontSize: "var(--fonte-pequena)",
    color: "var(--cor-secundario)",
  },
  aguardando: {
    display: "block",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    color: "var(--cor-laranja-700)",
  },
  aguardandoBloco: { fontWeight: 700, color: "var(--cor-laranja-700)" },
  badge: {
    display: "inline-block",
    padding: "2px var(--espaco)",
    fontSize: "var(--fonte-pequena)",
    fontWeight: 700,
    borderRadius: "var(--raio)",
    border: "2px solid var(--cor-grafite)",
    color: "var(--cor-grafite)",
    whiteSpace: "nowrap",
  },
  badge_rascunho: {
    borderStyle: "dashed",
    borderColor: "var(--cor-secundario)",
    color: "var(--cor-secundario)",
  },
  badge_validada: { background: "var(--cor-branco)" },
  badge_publicada: {
    background: "var(--cor-laranja)",
    borderColor: "var(--cor-laranja)",
  },
  badge_retirada: {
    borderColor: "var(--cor-secundario)",
    color: "var(--cor-secundario)",
    background: "var(--cor-offwhite)",
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
    gap: "calc(var(--espaco) * 2)",
  },
  lateral: { flex: "0 1 360px", minWidth: 280 },
  // Uma grade de duas colunas: cabeçalhos, card.md e métricas ficam alinhados lado a lado.
  comparacao: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "calc(var(--espaco) * 2)",
    alignItems: "stretch",
  },
  umaColuna: { gridTemplateColumns: "minmax(0, 1fr)" },
  cabecaColuna: { fontSize: 22, lineHeight: 1.3 },
  card: {
    display: "grid",
    alignContent: "start",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cardTitulo: { fontSize: 22, lineHeight: 1.3 },
  subtitulo: { fontSize: "var(--fonte-corpo)", lineHeight: 1.3 },
  codigo: {
    fontFamily: "ui-monospace, Consolas, monospace",
    fontSize: "0.95em",
  },
  markdown: {
    margin: 0,
    maxHeight: 360,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "ui-monospace, Consolas, monospace",
    fontSize: 15,
    lineHeight: 1.5,
    color: "var(--cor-grafite)",
  },
  metricas: { display: "grid", gap: "var(--espaco)", margin: 0 },
  metrica: {
    display: "grid",
    gap: 2,
    paddingBottom: "var(--espaco)",
    borderBottom: "1px solid var(--cor-borda)",
  },
  dados: { display: "grid", gap: "calc(var(--espaco) * 1.5)", margin: 0 },
  dado: { display: "grid", gap: 2 },
  dt: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  dd: { margin: 0, fontSize: 20, fontWeight: 600 },
  motivo: {
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    border: "2px dashed var(--cor-laranja)",
    borderRadius: "var(--raio)",
    fontWeight: 600,
  },
  listaSimples: {
    margin: 0,
    paddingLeft: "calc(var(--espaco) * 2.5)",
    display: "grid",
    gap: 2,
  },
  campo: { display: "grid", gap: "var(--espaco)", fontWeight: 600 },
  arquivo: { font: "inherit", minHeight: "var(--toque)" },
  checklist: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "var(--espaco)",
  },
  itemChecklist: {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--espaco)",
    padding: "var(--espaco) calc(var(--espaco) * 1.5)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  presente: { fontWeight: 600, color: "var(--cor-grafite)" },
  faltando: { fontWeight: 700, color: "var(--cor-laranja-700)" },
  caixaAtencao: {
    display: "grid",
    gap: 4,
    padding: "calc(var(--espaco) * 2)",
    border: "2px dashed var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  confirmacao: {
    padding: "calc(var(--espaco) * 2)",
    border: "2px solid var(--cor-grafite)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
    background: "var(--cor-branco)",
  },
  confirmacaoTexto: { fontWeight: 700 },
  fieldset: {
    margin: 0,
    padding: 0,
    border: "none",
    display: "grid",
    gap: "var(--espaco)",
  },
  legenda: { fontWeight: 700, marginBottom: "var(--espaco)" },
  opcao: {
    minHeight: "var(--toque)",
    display: "flex",
    alignItems: "center",
    gap: "var(--espaco)",
    padding: "0 calc(var(--espaco) * 1.5)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  opcaoDesabilitada: { color: "var(--cor-secundario)", cursor: "not-allowed" },
  radio: { width: 20, height: 20, accentColor: "var(--cor-laranja)" },
};
