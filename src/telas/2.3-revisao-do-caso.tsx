import { useEffect, useId, useState, type CSSProperties } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { TEXTO_CONDUTA, TEXTO_RISCO } from "../dominio";
import {
  buscarCasoPainel2_2,
  buscarImagemCaso2_3,
  HISTOPATOLOGICO_OUTRO_2_3,
  registrarDesfecho2_3,
  type CasoPainel2_2,
  type ConcordanciaPrioridade2_3,
  type CondutaEspecialista2_3,
} from "../mocks";
import { useSessao } from "../sessao";
import { BlocoConduta, Botao, FaixaTriagem, MensagemProblema } from "../ui";

// Pendente de mover para config.ts (CODIGOS); ver relatório da tela.
const CODIGO_CASO_NAO_ENCONTRADO = "CASO-NAO-ENCONTRADO";

const CONDUTAS_ESPECIALISTA: [CondutaEspecialista2_3, string][] = [
  ["biopsia", "Biópsia"],
  ["excisao", "Excisão"],
  ["acompanhamento", "Acompanhamento"],
  ["alta", "Alta"],
];

const CONCORDANCIAS: [ConcordanciaPrioridade2_3, string][] = [
  ["adequada", "Adequada"],
  ["deveria_ser_maior", "Deveria ser maior"],
  ["deveria_ser_menor", "Deveria ser menor"],
];

const SEXO: Record<CasoPainel2_2["sexo"], string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  nao_informado: "Não informado",
};

const AINDA_NAO_DISPONIVEL = "";

const dois = (n: number) => String(n).padStart(2, "0");

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

// Faixas da 1.4: "55–59" → "55 a 59 anos"; "85+" → "85 anos ou mais".
const idade = (faixa: string) =>
  faixa.endsWith("+") ? `${faixa.slice(0, -1)} anos ou mais` : `${faixa.replace("–", " a ")} anos`;

type Estado =
  | { tipo: "carregando" }
  | { tipo: "nao_encontrado" }
  | { tipo: "pronto"; caso: CasoPainel2_2; imagem: string | null };

export default function Tela() {
  const navigate = useNavigate();
  const { casoId = "" } = useParams();
  const { usuarioPainel } = useSessao();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let ativo = true;
    setEstado({ tipo: "carregando" });
    Promise.all([buscarCasoPainel2_2(casoId), buscarImagemCaso2_3(casoId)]).then(([caso, imagem]) => {
      if (!ativo) return;
      setEstado(caso ? { tipo: "pronto", caso, imagem } : { tipo: "nao_encontrado" });
    });
    return () => {
      ativo = false;
    };
  }, [casoId]);

  if (!usuarioPainel) return <Navigate to="/painel/login" replace />;
  if (usuarioPainel.perfil !== "dermatologista") return <Navigate to="/painel/metricas" replace />;

  const voltar = () => navigate("/painel/casos");

  if (estado.tipo === "carregando") {
    return (
      <p style={S.secundario} aria-live="polite">
        Carregando caso…
      </p>
    );
  }

  if (estado.tipo === "nao_encontrado") {
    return (
      <MensagemProblema
        oQueHouve="Não foi possível encontrar este caso."
        oQueFazer="Confira o caso na fila e abra a revisão por lá."
        acoes={[{ rotulo: "Voltar à fila", onClick: voltar }]}
        codigo={CODIGO_CASO_NAO_ENCONTRADO}
      />
    );
  }

  const { caso, imagem } = estado;
  const { resultado } = caso;

  return (
    <div style={S.tela}>
      <div>
        <Botao variante="texto" style={S.voltarTopo} onClick={voltar}>
          <span aria-hidden="true">← </span>Voltar à fila
        </Botao>
        <h1 style={S.titulo}>
          Caso {caso.codigo} · {caso.unidade} · triado em {dataHora(caso.data_triagem)} por {caso.operador}
        </h1>
      </div>

      <div style={S.faixa}>
        <FaixaTriagem aviso={resultado.aviso} />
      </div>

      <div style={S.colunas}>
        <figure style={S.imagem}>
          {imagem ? (
            <img src={imagem} alt={`Imagem da lesão do caso ${caso.codigo}`} style={S.img} />
          ) : (
            <figcaption style={S.semImagem}>Imagem não enviada pelo aparelho.</figcaption>
          )}
        </figure>

        <section style={S.cartao} aria-labelledby="dados-caso">
          <h2 id="dados-caso" style={S.subtitulo}>
            Dados da triagem
          </h2>
          <dl style={S.dados}>
            <dt style={S.dt}>Sugestão</dt>
            <dd style={S.dd}>
              <BlocoConduta conduta={resultado.conduta} variante="marcador" />
              {resultado.risco && <span style={S.risco}> · risco {TEXTO_RISCO[resultado.risco].toLowerCase()}</span>}
            </dd>
            <dt style={S.dt}>Decisão na ponta</dt>
            <dd style={S.dd}>
              {caso.decisao_ponta ? TEXTO_CONDUTA[caso.decisao_ponta].tituloCurto : "Não registrada"}
            </dd>
            <dt style={S.dt}>Local</dt>
            <dd style={S.dd}>{caso.local}</dd>
            <dt style={S.dt}>Idade</dt>
            <dd style={S.dd}>{idade(caso.faixa_idade)}</dd>
            <dt style={S.dt}>Sexo</dt>
            <dd style={S.dd}>{SEXO[caso.sexo]}</dd>
          </dl>
          <p style={S.secundario}>Modelo {resultado.modelo_versao}</p>
          <Distribuicao classes={resultado.classes} />
        </section>
      </div>

      <RegistrarDesfecho caso={caso} revisor={usuarioPainel} aoVoltar={voltar} />
    </div>
  );
}

// Barras sem número: a distribuição é contexto para o especialista, não grau de certeza.
function Distribuicao({ classes }: { classes: CasoPainel2_2["resultado"]["classes"] }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const ordenadas = [...classes].sort((a, b) => b.valor - a.valor);
  const maior = ordenadas[0]?.valor || 1;
  return (
    <div>
      <Botao variante="texto" style={S.semRecuo} aria-expanded={aberta} aria-controls={id} onClick={() => setAberta(!aberta)}>
        {aberta ? "ocultar distribuição entre classes" : "ver distribuição entre classes"}
      </Botao>
      {aberta && (
        <ul id={id} style={S.barras} aria-label="Classes em ordem decrescente">
          {ordenadas.map((c) => (
            <li key={c.rotulo} style={S.barraLinha}>
              <span>{c.nome}</span>
              <span style={S.barraTrilho} aria-hidden="true">
                <span style={{ ...S.barra, width: `${(c.valor / maior) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RegistrarDesfecho({
  caso,
  revisor,
  aoVoltar,
}: {
  caso: CasoPainel2_2;
  revisor: { nome: string; email: string };
  aoVoltar: () => void;
}) {
  const [conduta, setConduta] = useState<CondutaEspecialista2_3 | null>(null);
  const [concordancia, setConcordancia] = useState<ConcordanciaPrioridade2_3 | null>(null);
  const [histopatologico, setHistopatologico] = useState(AINDA_NAO_DISPONIVEL);
  const [salvando, setSalvando] = useState(false);
  const [registrado, setRegistrado] = useState(false);

  if (registrado) {
    return (
      <section style={S.cartao} aria-labelledby="desfecho">
        <h2 id="desfecho" style={S.subtitulo}>
          Registrar desfecho
        </h2>
        <p role="status">Desfecho registrado. Obrigado — é isso que permite medir o sistema de verdade.</p>
        <div>
          <Botao onClick={aoVoltar}>Voltar à fila</Botao>
        </div>
      </section>
    );
  }

  const podeSalvar = conduta !== null && concordancia !== null && !salvando;

  const salvar = () => {
    if (!conduta || !concordancia) return;
    setSalvando(true);
    registrarDesfecho2_3(
      caso.id,
      { conduta, concordancia, histopatologico: histopatologico || null },
      { nome: revisor.nome, email: revisor.email },
    ).then(() => setRegistrado(true));
  };

  return (
    <form
      style={S.cartao}
      aria-labelledby="desfecho"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeSalvar) salvar();
      }}
    >
      <h2 id="desfecho" style={S.subtitulo}>
        Registrar desfecho
      </h2>
      <p style={S.secundario}>O desfecho fica registrado à parte e não altera o resultado do modelo.</p>

      <Opcoes
        legenda="Conduta do especialista"
        nome="conduta"
        opcoes={CONDUTAS_ESPECIALISTA}
        valor={conduta}
        aoMudar={setConduta}
      />
      <Opcoes
        legenda="Concordância com a prioridade sugerida"
        nome="concordancia"
        opcoes={CONCORDANCIAS}
        valor={concordancia}
        aoMudar={setConcordancia}
      />

      <label style={S.campo}>
        <span style={S.rotulo}>Resultado histopatológico</span>
        <select style={S.select} value={histopatologico} onChange={(e) => setHistopatologico(e.target.value)}>
          <option value={AINDA_NAO_DISPONIVEL}>ainda não disponível</option>
          {caso.resultado.classes.map((c) => (
            <option key={c.rotulo} value={c.rotulo}>
              {c.nome}
            </option>
          ))}
          <option value={HISTOPATOLOGICO_OUTRO_2_3}>Outro diagnóstico</option>
        </select>
      </label>

      <div style={S.acoes}>
        <Botao type="submit" disabled={!podeSalvar}>
          {salvando ? "Salvando…" : "Salvar desfecho"}
        </Botao>
        {!podeSalvar && !salvando && (
          <span style={S.secundario}>Escolha a conduta e a concordância para salvar.</span>
        )}
      </div>
    </form>
  );
}

function Opcoes<T extends string>({
  legenda,
  nome,
  opcoes,
  valor,
  aoMudar,
}: {
  legenda: string;
  nome: string;
  opcoes: [T, string][];
  valor: T | null;
  aoMudar: (v: T) => void;
}) {
  return (
    <fieldset style={S.fieldset}>
      <legend style={{ ...S.rotulo, ...S.legenda }}>{legenda}</legend>
      <div style={S.opcoes}>
        {opcoes.map(([v, rotulo]) => {
          const marcado = valor === v;
          return (
            <label key={v} style={{ ...S.opcao, ...(marcado ? S.opcaoMarcada : null) }}>
              <input
                type="radio"
                name={nome}
                value={v}
                checked={marcado}
                onChange={() => aoMudar(v)}
                style={S.radio}
              />
              {rotulo}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 3)", maxWidth: 1200 },
  voltarTopo: { paddingLeft: 0, paddingRight: 0, marginBottom: "var(--espaco)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  subtitulo: { fontSize: 22, lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  // A faixa acompanha a rolagem: não sai de vista enquanto houver resultado na tela.
  faixa: { position: "sticky", top: 0, zIndex: 1 },
  colunas: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 3)",
    alignItems: "start",
  },
  imagem: {
    margin: 0,
    aspectRatio: "1 / 1",
    display: "grid",
    placeItems: "center",
    background: "var(--cor-branco)",
    border: "2px dashed var(--cor-borda)",
    borderRadius: "var(--raio)",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%", objectFit: "cover" },
  semImagem: { padding: "calc(var(--espaco) * 3)", textAlign: "center", color: "var(--cor-secundario)" },
  cartao: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    alignContent: "start",
    // 24 px no desktop; encolhe até 16 px em celular pequeno.
    padding: "clamp(calc(var(--espaco) * 2), 4vw, calc(var(--espaco) * 3))",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  dados: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "calc(var(--espaco) * 3)",
    rowGap: "var(--espaco)",
    margin: 0,
  },
  dt: { fontWeight: 600, color: "var(--cor-secundario)" },
  dd: { margin: 0 },
  risco: { color: "var(--cor-secundario)" },
  semRecuo: { paddingLeft: 0, paddingRight: 0 },
  barras: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--espaco)" },
  barraLinha: { display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 2fr", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  barraTrilho: { display: "block", height: 12, background: "var(--cor-offwhite)", borderRadius: 6 },
  barra: { display: "block", height: "100%", background: "var(--cor-secundario)", borderRadius: 6 },
  fieldset: { margin: 0, padding: 0, border: 0, display: "grid", gap: "var(--espaco)" },
  legenda: { padding: 0, marginBottom: "var(--espaco)" },
  rotulo: { fontWeight: 600 },
  opcoes: { display: "flex", flexWrap: "wrap", gap: "var(--espaco)" },
  opcao: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--espaco)",
    minHeight: "var(--toque)",
    padding: "0 calc(var(--espaco) * 2)",
    border: "2px solid var(--cor-secundario)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  opcaoMarcada: { borderColor: "var(--cor-laranja)", fontWeight: 600 },
  radio: { width: 18, height: 18, margin: 0, accentColor: "var(--cor-laranja-700)" },
  campo: { display: "grid", gap: 4, justifyItems: "start" },
  select: {
    minHeight: "var(--toque)",
    minWidth: "min(320px, 100%)",
    maxWidth: "100%",
    padding: "0 var(--espaco)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-secundario)",
    borderRadius: "var(--raio)",
  },
  acoes: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
};
