import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { TEMPOS } from "../config";
import { buscarSaude, capturarLesao, observarQualidadeCaptura, type QualidadeCaptura } from "../mocks";
import { useSessao } from "../sessao";
import { Botao, MensagemProblema, useTelaEstreita } from "../ui";

// Ainda não existe em CODIGOS (config.ts): ver relatório.
const CODIGO_DESCONECTADO = "DERM-DESCONECTADO";

// Lembrete de higienização: uma vez por atendimento (código). Memória do módulo, some ao recarregar.
let lembreteHigienizacaoVistoPara: string | null = null;

const INDICADORES: { chave: keyof Omit<QualidadeCaptura, "contato">; rotulo: string; ok: string; ajustar: string }[] = [
  { chave: "foco", rotulo: "Foco", ok: "Nítido", ajustar: "Ajustando" },
  { chave: "centro", rotulo: "Lesão no centro", ok: "Dentro do círculo", ajustar: "Fora do círculo" },
  { chave: "luz", rotulo: "Luz", ok: "Adequada", ajustar: "Insuficiente" },
];

const orientacao = (q: QualidadeCaptura) => {
  if (!q.contato) return "Encoste a ponteira na pele, sobre a lesão.";
  if (!q.centro) return "Centralize a lesão no círculo.";
  if (!q.foco || !q.luz) return "Mantenha firme por um instante.";
  return "Pronto para capturar.";
};

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atendimento, reprovacoesSeguidas, atualizar } = useSessao();
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [qualidade, setQualidade] = useState<QualidadeCaptura | null>(null);
  const [capturando, setCapturando] = useState(false);
  const estreita = useTelaEstreita();
  const [lembrete, setLembrete] = useState(
    () => !!atendimento && lembreteHigienizacaoVistoPara !== atendimento.codigo,
  );

  const verificarConexao = () => buscarSaude().then((s) => setConectado(s.dermatoscopio_conectado));

  useEffect(() => {
    let ativo = true;
    const ler = () => buscarSaude().then((s) => ativo && setConectado(s.dermatoscopio_conectado));
    ler();
    const id = window.setInterval(ler, TEMPOS.pollingSaudeMs);
    return () => {
      ativo = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!conectado) {
      setQualidade(null);
      return;
    }
    return observarQualidadeCaptura(setQualidade);
  }, [conectado]);

  // Some em 5 s ou ao primeiro toque; só conta como visto quando some.
  useEffect(() => {
    if (!lembrete || !atendimento) return;
    const fechar = () => {
      lembreteHigienizacaoVistoPara = atendimento.codigo;
      setLembrete(false);
    };
    const id = window.setTimeout(fechar, TEMPOS.lembreteHigienizacaoMs);
    window.addEventListener("pointerdown", fechar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", fechar);
    };
  }, [lembrete, atendimento]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (!atendimento) return <Navigate to="/triagem/atendimento" replace />;

  const capturar = async () => {
    setCapturando(true);
    const r = await capturarLesao(reprovacoesSeguidas);
    if (r.aprovada) {
      atualizar({ capturaUrl: r.url, reprovacoesSeguidas: 0 });
      navigate("/triagem/processando");
    } else {
      atualizar({ capturaUrl: r.url, reprovacoesSeguidas: reprovacoesSeguidas + 1 });
      navigate("/triagem/captura-reprovada", { state: { motivo: r.motivo, codigo: r.codigo } });
    }
  };

  const desconectado = conectado === false;

  return (
    <div style={{ ...S.tela, ...(estreita ? S.telaEstreita : null) }}>
      <div style={{ ...S.colunas, ...(estreita ? S.umaColuna : null) }}>
        <section style={{ ...S.imagem, ...(estreita ? S.imagemEstreita : null) }} aria-label="Imagem ao vivo do dermatoscópio">
          {desconectado ? (
            <div style={S.problema}>
              <MensagemProblema
                oQueHouve="Dermatoscópio desconectado. Reconecte o cabo."
                acoes={[{ rotulo: "Verificar conexão", onClick: verificarConexao, variante: "secundario" }]}
                codigo={CODIGO_DESCONECTADO}
              />
            </div>
          ) : (
            <>
              <span style={S.legendaImagem}>Imagem ao vivo</span>
              <svg viewBox="0 0 100 100" style={S.guia} aria-hidden="true">
                <circle cx="50" cy="50" r="30" fill="none" stroke="var(--cor-offwhite)" strokeWidth="0.8" strokeDasharray="3 2" />
                <path d="M50 47v6M47 50h6" stroke="var(--cor-offwhite)" strokeWidth="0.5" />
              </svg>
            </>
          )}
          {lembrete && (
            <p role="status" style={S.lembrete}>
              Ponteira higienizada desde o último paciente?
            </p>
          )}
        </section>

        <aside style={S.lateral}>
          <dl style={S.dados}>
            <div>
              <dt style={S.rotulo}>Local</dt>
              <dd style={S.valor}>{atendimento.local}</dd>
            </div>
            <div>
              <dt style={S.rotulo}>Código</dt>
              <dd style={{ ...S.valor, ...S.codigo }}>{atendimento.codigo}</dd>
            </div>
          </dl>

          {qualidade && (
            <ul style={S.indicadores} aria-label="Qualidade da imagem">
              {INDICADORES.map(({ chave, rotulo, ok, ajustar }) => {
                const bom = qualidade[chave];
                return (
                  <li key={chave} style={S.indicador}>
                    <span style={{ ...S.icone, ...(bom ? S.iconeOk : S.iconeAjustar) }} aria-hidden="true">
                      {bom ? "✓" : "!"}
                    </span>
                    <span style={S.indicadorTexto}>
                      <strong>{rotulo}</strong>
                      <span style={bom ? S.estadoOk : S.estadoAjustar}>{bom ? ok : ajustar}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <Botao
            onClick={capturar}
            disabled={!conectado || capturando}
            aria-describedby="orientacao-captura"
            style={S.capturar}
          >
            {capturando ? "Capturando…" : "Capturar"}
          </Botao>
        </aside>
      </div>

      <footer style={{ ...S.rodape, ...(estreita ? S.rodapeEstreito : null) }}>
        <Botao variante="secundario" onClick={() => navigate("/triagem/atendimento")}>
          Voltar
        </Botao>
        <p id="orientacao-captura" style={S.orientacao} aria-live="polite">
          {qualidade ? orientacao(qualidade) : ""}
        </p>
      </footer>
    </div>
  );
}

// Estilos locais, no mesmo padrão da 1.4 (estilos.css é compartilhado).
const ALTURA_RODAPE = 88;
const LADO_IMAGEM = 580;

const S: Record<string, CSSProperties> = {
  // Celular: imagem ocupa a largura e as colunas empilham.
  telaEstreita: { paddingBottom: ALTURA_RODAPE * 2 },
  umaColuna: { gridTemplateColumns: "minmax(0, 1fr)", gap: "calc(var(--espaco) * 2)" },
  imagemEstreita: { width: "100%", height: "auto", aspectRatio: "1 / 1" },
  rodapeEstreito: { flexWrap: "wrap", gap: "var(--espaco) calc(var(--espaco) * 2)", padding: "var(--espaco) calc(var(--espaco) * 2)" },
  tela: { maxWidth: 1232, margin: "0 auto", paddingBottom: ALTURA_RODAPE },
  colunas: {
    display: "grid",
    gridTemplateColumns: `${LADO_IMAGEM}px 1fr`,
    gap: "calc(var(--espaco) * 4)",
    alignItems: "start",
  },
  imagem: {
    position: "relative",
    width: LADO_IMAGEM,
    height: LADO_IMAGEM,
    background: "var(--cor-grafite)",
    borderRadius: "var(--raio)",
    overflow: "hidden",
  },
  legendaImagem: {
    position: "absolute",
    top: "calc(var(--espaco) * 2)",
    left: "calc(var(--espaco) * 2)",
    color: "var(--cor-offwhite)",
  },
  guia: { width: "100%", height: "100%", display: "block" },
  problema: { height: "100%", display: "grid", placeItems: "center", padding: "calc(var(--espaco) * 3)" },
  lembrete: {
    position: "absolute",
    left: "calc(var(--espaco) * 3)",
    right: "calc(var(--espaco) * 3)",
    bottom: "calc(var(--espaco) * 3)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    fontSize: 22,
    fontWeight: 600,
    textAlign: "center",
    color: "var(--cor-grafite)",
    background: "var(--cor-offwhite)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  lateral: { display: "grid", gap: "calc(var(--espaco) * 4)", alignContent: "start" },
  dados: { display: "grid", gridTemplateColumns: "1fr auto", gap: "calc(var(--espaco) * 3)", margin: 0 },
  rotulo: { color: "var(--cor-secundario)" },
  valor: { margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3 },
  codigo: { fontVariantNumeric: "tabular-nums", letterSpacing: "0.05em" },
  indicadores: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "calc(var(--espaco) * 2)" },
  indicador: { display: "flex", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  icone: {
    width: 40,
    height: 40,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    fontSize: 22,
    fontWeight: 700,
  },
  iconeOk: { color: "var(--cor-grafite)", border: "3px solid var(--cor-grafite)" },
  iconeAjustar: { color: "var(--cor-grafite)", background: "var(--cor-laranja)", border: "3px solid var(--cor-laranja)" },
  indicadorTexto: { display: "flex", flexDirection: "column", fontSize: 20, lineHeight: 1.3 },
  estadoOk: { color: "var(--cor-secundario)" },
  estadoAjustar: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  capturar: { width: "100%", minHeight: 96, fontSize: 28 },
  rodape: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: ALTURA_RODAPE,
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--espaco) * 4)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    background: "var(--cor-offwhite)",
    borderTop: "1px solid var(--cor-borda)",
  },
  orientacao: { fontSize: 24, fontWeight: 600 },
};
