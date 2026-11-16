import { useState, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CODIGO_SEM_AVISO_1_7 } from "../mocks";
import { useSessao } from "../sessao";
import { Botao, FaixaTriagem, MensagemProblema } from "../ui";

// Texto literal do prompt da 1.10: única exceção à regra de vocabulário (explica a estimativa).
const EXPLICACAO_PROBABILIDADE =
  "Estimativa calibrada. Não é a chance de a pessoa ter câncer: é como o modelo pontua esta imagem em relação às imagens em que foi treinado.";

// 0.6 → "0,60": vírgula decimal, sem %.
const decimal = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Tela() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, atendimento, resultado } = useSessao();
  // Valores ficam ocultos até o toque; cada linha abre e fecha sozinha.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());

  if (!usuario) return <Navigate to="/login" replace />;
  if (!resultado) return <Navigate to="/inicio" replace />;

  // Origem: 1.11 e 1.15 mandam voltarPara; 1.8 e 1.9 não mandam nada e a conduta decide.
  const estado = location.state as { voltarPara?: unknown } | null;
  const voltarPara =
    typeof estado?.voltarPara === "string" && estado.voltarPara.startsWith("/")
      ? estado.voltarPara
      : resultado.conduta === "indeterminado"
        ? "/triagem/indeterminado"
        : "/triagem/resultado";
  const voltar = () => navigate(voltarPara);

  // Sem aviso a faixa não existe, e sem faixa não há resultado na tela.
  if (!resultado.aviso?.trim()) {
    return (
      <div style={S.centro}>
        <MensagemProblema
          oQueHouve="Não foi possível exibir os detalhes desta análise."
          oQueFazer="Volte à tela anterior. Se continuar, relate o problema pelo menu com o seu nome."
          acoes={[{ rotulo: "‹ Voltar", onClick: voltar }]}
          codigo={CODIGO_SEM_AVISO_1_7}
        />
      </div>
    );
  }

  const alternar = (chave: string) =>
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const classes = [...resultado.classes].sort((a, b) => b.valor - a.valor);
  const probabilidadeAberta = abertos.has("probabilidade");

  return (
    <div style={S.tela}>
      <header style={S.topo}>
        <div style={S.cabecalho}>
          <Botao variante="secundario" onClick={voltar} style={S.voltar}>
            ‹ Voltar
          </Botao>
          <h1 style={S.titulo}>Detalhes técnicos</h1>
          {atendimento && (
            <p style={S.secundario}>
              {atendimento.codigo} · {atendimento.local}
            </p>
          )}
        </div>
        <FaixaTriagem aviso={resultado.aviso} />
      </header>

      {resultado.limitacoes.length > 0 && (
        <section style={S.limitacoes} aria-labelledby="titulo-limitacoes">
          <h2 id="titulo-limitacoes" style={S.tituloLimitacoes}>
            Limitações
          </h2>
          <ul style={S.lista}>
            {resultado.limitacoes.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={S.cartao} aria-labelledby="titulo-classes">
        <h2 id="titulo-classes" style={S.tituloSecao}>
          Distribuição entre as classes
        </h2>
        <p style={S.secundario}>Toque em uma classe para ver o valor.</p>
        <ul style={S.barras}>
          {classes.map((c) => {
            const aberto = abertos.has(c.rotulo);
            const largura = `${Math.min(Math.max(c.valor, 0), 1) * 100}%`;
            return (
              <li key={c.rotulo}>
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => alternar(c.rotulo)}
                  style={S.linhaClasse}
                >
                  <span style={S.nomeClasse}>
                    {c.nome}
                    <span style={S.rotuloTecnico}>{c.rotulo}</span>
                  </span>
                  <span style={S.trilho} aria-hidden="true">
                    <span style={{ ...S.preenchimento, width: largura }} />
                  </span>
                  <span style={aberto ? S.valor : S.verValor}>
                    {aberto ? decimal(c.valor) : "Ver valor"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section style={S.cartao} aria-labelledby="titulo-probabilidade">
        <h2 id="titulo-probabilidade" style={S.tituloSecao}>
          Probabilidade calibrada de lesão maligna
        </h2>
        <button
          type="button"
          aria-expanded={probabilidadeAberta}
          onClick={() => alternar("probabilidade")}
          style={S.botaoProbabilidade}
        >
          {probabilidadeAberta ? (
            <span style={S.valorGrande}>
              {decimal(resultado.probabilidade_maligna)}
            </span>
          ) : (
            <span style={S.verValor}>Ver valor</span>
          )}
        </button>
        <p style={S.texto}>{EXPLICACAO_PROBABILIDADE}</p>
        <p style={S.texto}>
          Limiar usado: <strong>{decimal(resultado.threshold_usado)}</strong>
        </p>
      </section>

      <section style={S.cartao} aria-label="Mapa de atenção">
        <p style={S.texto}>Mapa de atenção não disponível neste aparelho.</p>
      </section>

      <section style={S.cartao} aria-labelledby="titulo-modelo">
        <h2 id="titulo-modelo" style={S.tituloSecao}>
          Sobre o modelo
        </h2>
        <dl style={S.dados}>
          <dt style={S.secundario}>Nome</dt>
          <dd style={S.dd}>{resultado.modelo}</dd>
          <dt style={S.secundario}>Versão</dt>
          <dd style={S.dd}>{resultado.modelo_versao}</dd>
          <dt style={S.secundario}>Dataset</dt>
          <dd style={S.dd}>{resultado.dataset_treino}</dd>
        </dl>
        <p style={S.texto}>
          Métricas de desempenho: nenhum experimento registrado para esta
          versão.
        </p>
      </section>
    </div>
  );
}

// Estilos locais, no mesmo padrão da 1.8 (estilos.css é compartilhado).
const LARGURA_NOME = 380;
const LARGURA_VALOR = 120;

const S: Record<string, CSSProperties> = {
  tela: {
    maxWidth: 1232,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
  },
  centro: {
    minHeight: "100%",
    display: "flex",
    justifyContent: "center",
    paddingTop: "calc(var(--espaco) * 10)",
  },
  // Única tela do operador com rolagem: Voltar e faixa ficam presos no topo.
  topo: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    margin: "calc(var(--espaco) * -3) calc(var(--espaco) * -3) 0",
    padding:
      "calc(var(--espaco) * 3) calc(var(--espaco) * 3) calc(var(--espaco) * 2)",
    background: "var(--cor-offwhite)",
  },
  cabecalho: {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--espaco) * 3)",
  },
  voltar: { minHeight: 56 },
  titulo: { fontSize: 28, lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
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
  lista: {
    margin: 0,
    paddingLeft: "1.2em",
    display: "grid",
    gap: "calc(var(--espaco) / 2)",
  },
  cartao: {
    display: "grid",
    gap: "calc(var(--espaco) * 1.5)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  tituloSecao: { fontSize: 22, lineHeight: 1.25 },
  texto: { lineHeight: 1.45 },
  barras: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: "var(--espaco)",
  },
  linhaClasse: {
    width: "100%",
    minHeight: 64,
    display: "grid",
    gridTemplateColumns: `${LARGURA_NOME}px 1fr ${LARGURA_VALOR}px`,
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    font: "inherit",
    color: "var(--cor-grafite)",
    textAlign: "left",
    background: "var(--cor-offwhite)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  nomeClasse: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--espaco)",
    fontWeight: 600,
  },
  rotuloTecnico: {
    fontSize: "var(--fonte-pequena)",
    fontWeight: 400,
    color: "var(--cor-secundario)",
    fontFamily: "ui-monospace, monospace",
  },
  trilho: {
    height: 20,
    display: "block",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: 4,
    overflow: "hidden",
  },
  preenchimento: {
    height: "100%",
    display: "block",
    background: "var(--cor-grafite)",
  },
  verValor: {
    color: "var(--cor-laranja-700)",
    fontWeight: 600,
    textDecoration: "underline",
    textAlign: "right",
  },
  valor: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  botaoProbabilidade: {
    justifySelf: "start",
    minHeight: 72,
    minWidth: 200,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 calc(var(--espaco) * 3)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-offwhite)",
    border: "2px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  valorGrande: {
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  dados: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "calc(var(--espaco) * 3)",
    rowGap: "var(--espaco)",
    margin: 0,
  },
  dd: { margin: 0, fontWeight: 600 },
};
