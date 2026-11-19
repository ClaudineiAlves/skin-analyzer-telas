import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LIMITES } from "../config";
import {
  buscarCapturaReprovada1_6,
  registrarNaoAnalisado1_6,
  reprovacoesSeguidasTeste1_6,
  type CapturaReprovada1_6,
  type MotivoReprovacao1_6,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, useTelaEstreita } from "../ui";

const ORIENTACAO_LUZ = "Confira se a ponteira está encostada na pele e se a lente está limpa.";

const TEXTOS: Record<MotivoReprovacao1_6, { titulo: string; orientacao: string }> = {
  foco: {
    titulo: "A imagem saiu tremida.",
    orientacao: "Apoie o punho e mantenha a ponteira encostada até ouvir o bipe.",
  },
  enquadramento: {
    titulo: "A lesão ficou fora do centro.",
    orientacao: "Mova a ponteira até a lesão ficar dentro do círculo.",
  },
  escura: { titulo: "A imagem ficou escura demais.", orientacao: ORIENTACAO_LUZ },
  clara: { titulo: "A imagem ficou clara demais.", orientacao: ORIENTACAO_LUZ },
};

// Código que a tela não conhece: texto neutro, sem inventar a causa.
const TEXTO_GENERICO = {
  titulo: "Não foi possível usar esta imagem.",
  orientacao: "Encoste a ponteira na pele, com a lesão dentro do círculo, e capture de novo.",
};

const AVISO_REPETIDAS = "Várias imagens não passaram. Limpe a lente e troque a ponteira antes de tentar de novo.";

interface EstadoNavegacao {
  codigo?: string;
}

export default function Tela() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const codigoRecebido = (state as EstadoNavegacao | null)?.codigo;
  const { usuario, atendimento, capturaUrl, reprovacoesSeguidas, atualizar } = useSessao();
  const [captura, setCaptura] = useState<CapturaReprovada1_6 | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const estreita = useTelaEstreita();

  useEffect(() => {
    if (!codigoRecebido) return;
    let ativo = true;
    buscarCapturaReprovada1_6(codigoRecebido, capturaUrl).then((c) => ativo && setCaptura(c));
    return () => {
      ativo = false;
    };
  }, [codigoRecebido, capturaUrl]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (!atendimento) return <Navigate to="/triagem/atendimento" replace />;
  if (!codigoRecebido) return <Navigate to="/triagem/captura" replace />;

  const variasSeguidas =
    Math.max(reprovacoesSeguidas, reprovacoesSeguidasTeste1_6) >= LIMITES.reprovacoesSeguidasAviso;
  const textos = captura?.motivo ? TEXTOS[captura.motivo] : TEXTO_GENERICO;

  const encerrar = async () => {
    setEncerrando(true);
    await registrarNaoAnalisado1_6({ codigo: atendimento.codigo, local: atendimento.local, operador_id: usuario.id });
    navigate("/inicio");
    atualizar({ atendimento: null, capturaUrl: null, resultado: null, reprovacoesSeguidas: 0 });
  };

  return (
    <div style={{ ...S.tela, ...(estreita ? S.telaEstreita : null) }}>
      <div style={{ ...S.colunas, ...(estreita ? S.umaColuna : null) }}>
        <section style={{ ...S.imagem, ...(estreita ? S.imagemEstreita : null) }} aria-label="Imagem capturada, com a área do problema destacada">
          {captura && (
            <>
              <img src={captura.imagem_url} alt="" style={S.foto} />
              <AreaDestacada captura={captura} />
              <span style={S.legendaImagem}>Imagem capturada</span>
              <span style={S.legendaArea}>
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="var(--cor-laranja)" strokeWidth="3" strokeDasharray="4 3" />
                </svg>
                Área do problema
              </span>
            </>
          )}
        </section>

        {captura && (
          <section style={S.lateral} aria-live="polite">
            <h1 style={S.titulo}>{textos.titulo}</h1>
            <p style={S.orientacao}>{textos.orientacao}</p>

            {variasSeguidas && <p style={S.repetidas}>{AVISO_REPETIDAS}</p>}

            <div style={S.acoes}>
              <Botao onClick={() => navigate("/triagem/captura")} disabled={encerrando} style={S.capturar}>
                Capturar de novo
              </Botao>
              {variasSeguidas && (
                <Botao variante="secundario" onClick={encerrar} disabled={encerrando} style={S.encerrar}>
                  {encerrando ? "Encerrando…" : "Encerrar sem resultado"}
                </Botao>
              )}
            </div>
          </section>
        )}
      </div>

      <footer style={{ ...S.rodape, ...(estreita ? S.rodapeEstreito : null) }}>
        <p>Imagem assim não é analisada: o resultado não seria confiável.</p>
        {captura && <p style={S.codigo}>{captura.codigo}</p>}
      </footer>
    </div>
  );
}

function AreaDestacada({ captura }: { captura: CapturaReprovada1_6 }) {
  const { area, centro_esperado } = captura;
  // Traço duplo (grafite por baixo, laranja por cima) para contrastar em imagem clara ou escura.
  const traco = (props: { cx: number; cy: number; r: number }) => (
    <>
      <circle {...props} fill="none" stroke="var(--cor-grafite)" strokeWidth="2.4" />
      <circle {...props} fill="none" stroke="var(--cor-laranja)" strokeWidth="1.4" strokeDasharray="3 2" />
    </>
  );
  return (
    <svg viewBox="0 0 100 100" style={S.sobreposicao} aria-hidden="true">
      {centro_esperado && (
        <circle {...centro_esperado} fill="none" stroke="var(--cor-offwhite)" strokeWidth="0.8" strokeDasharray="3 2" />
      )}
      {area.tipo === "circulo" ? (
        traco(area)
      ) : (
        <>
          <rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="var(--cor-grafite)" strokeWidth="2.4" />
          <rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="var(--cor-laranja)" strokeWidth="1.4" strokeDasharray="3 2" />
        </>
      )}
    </svg>
  );
}

// Estilos locais, no mesmo padrão da 1.5 (estilos.css é compartilhado).
const ALTURA_RODAPE = 72;
const LADO_IMAGEM = 580;

const legenda: CSSProperties = {
  position: "absolute",
  left: "calc(var(--espaco) * 2)",
  padding: "calc(var(--espaco) / 2) var(--espaco)",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--espaco)",
  color: "var(--cor-offwhite)",
  background: "rgb(43 48 54 / 0.8)",
  borderRadius: "var(--raio)",
};

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
  foto: { width: "100%", height: "100%", display: "block", objectFit: "cover" },
  sobreposicao: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  legendaImagem: { ...legenda, top: "calc(var(--espaco) * 2)" },
  legendaArea: { ...legenda, bottom: "calc(var(--espaco) * 2)" },
  lateral: { display: "grid", gap: "calc(var(--espaco) * 3)", alignContent: "start", paddingTop: "calc(var(--espaco) * 2)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  orientacao: { fontSize: 24, lineHeight: 1.35 },
  repetidas: {
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    fontSize: 22,
    fontWeight: 600,
    background: "var(--cor-branco)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  acoes: { display: "grid", gap: "calc(var(--espaco) * 2)", marginTop: "calc(var(--espaco) * 2)" },
  capturar: { width: "100%", minHeight: 96, fontSize: 28 },
  encerrar: { width: "100%", minHeight: 72, fontSize: 22 },
  rodape: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: ALTURA_RODAPE,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 4)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    color: "var(--cor-secundario)",
    background: "var(--cor-offwhite)",
    borderTop: "1px solid var(--cor-borda)",
  },
  codigo: { fontSize: "var(--fonte-pequena)" },
};
