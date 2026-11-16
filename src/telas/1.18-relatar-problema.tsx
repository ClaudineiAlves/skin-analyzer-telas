import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { TEMPOS } from "../config";
import { registrarRelato1_18, type CategoriaRelato1_18 } from "../mocks";
import { useSessao } from "../sessao";
import { Botao } from "../ui";

const CATEGORIAS: { valor: CategoriaRelato1_18; rotulo: string }[] = [
  { valor: "resultado_errado", rotulo: "O resultado parece errado" },
  { valor: "captura", rotulo: "Problema na captura" },
  { valor: "travou", rotulo: "O aparelho travou ou reiniciou" },
  { valor: "risco_dano", rotulo: "Risco ou dano a alguém" },
  { valor: "outro", rotulo: "Outro" },
];

// Quem abre esta tela a partir de outra pode mandar um código técnico e para onde voltar.
interface EstadoEntrada {
  codigo?: string;
  voltarPara?: string;
}

function lerEstado(state: unknown): EstadoEntrada {
  if (!state || typeof state !== "object") return {};
  const { codigo, voltarPara } = state as Record<string, unknown>;
  return {
    codigo: typeof codigo === "string" ? codigo : undefined,
    voltarPara: typeof voltarPara === "string" ? voltarPara : undefined,
  };
}

type Fase = "escolha" | "enviando" | "registrado";

export default function Tela() {
  const { usuario, atendimento } = useSessao();
  const navigate = useNavigate();
  const location = useLocation();
  const entrada = lerEstado(location.state);

  const [categoria, setCategoria] = useState<CategoriaRelato1_18 | null>(null);
  const [manterTriagem, setManterTriagem] = useState(true);
  const [fase, setFase] = useState<Fase>("escolha");

  const inicio =
    usuario?.perfil === "administrador" ? "/admin/status" : "/inicio";

  useEffect(() => {
    if (fase !== "registrado") return;
    const id = window.setTimeout(
      () => navigate(inicio, { replace: true }),
      TEMPOS.confirmacaoSalvoMs,
    );
    return () => window.clearTimeout(id);
  }, [fase, inicio, navigate]);

  if (!usuario) return <Navigate to="/login" replace />;

  const codigoTriagem = atendimento?.codigo ?? null;
  const triagemAnexada = manterTriagem ? codigoTriagem : null;
  const risco = categoria === "risco_dano";

  const cancelar = () => {
    if (entrada.voltarPara) navigate(entrada.voltarPara);
    // "default" = esta foi a primeira entrada do histórico: não há para onde voltar.
    else if (location.key !== "default") navigate(-1);
    else navigate(inicio);
  };

  const enviar = async () => {
    if (!categoria) return;
    setFase("enviando");
    await registrarRelato1_18({
      categoria,
      codigo_triagem: triagemAnexada,
      codigo_tecnico: entrada.codigo ?? null,
      operador_id: usuario.id,
    });
    setFase("registrado");
  };

  if (fase === "registrado") {
    return (
      <div style={S.centro} role="status">
        <p style={S.confirmacao}>Relato registrado.</p>
      </div>
    );
  }

  const ocupado = fase === "enviando";

  return (
    <div style={S.tela}>
      <header style={S.cabecalho}>
        <h1 style={S.titulo}>Relatar um problema</h1>
        <p style={S.secundario}>
          O relato vai para o suporte Skin Analyzer AI. Não precisa escrever
          nada: escolha o que aconteceu.
        </p>
      </header>

      <section style={S.bloco} aria-labelledby="relato-categoria">
        <h2 id="relato-categoria" style={S.rotuloSecao}>
          O QUE ACONTECEU?
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="relato-categoria"
          style={S.opcoes}
        >
          {CATEGORIAS.map(({ valor, rotulo }) => {
            const marcada = categoria === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={marcada}
                disabled={ocupado}
                onClick={() => setCategoria(valor)}
                style={{ ...S.opcao, ...(marcada ? S.opcaoMarcada : null) }}
              >
                <span
                  aria-hidden="true"
                  style={{ ...S.marca, ...(marcada ? S.marcaMarcada : null) }}
                >
                  {marcada ? "●" : "○"}
                </span>
                {rotulo}
              </button>
            );
          })}
        </div>
      </section>

      <div style={S.duasColunas}>
        <section style={S.bloco} aria-labelledby="relato-triagem">
          <h2 id="relato-triagem" style={S.rotuloSecao}>
            TRIAGEM RELACIONADA (OPCIONAL)
          </h2>
          <div style={S.linhaCodigo}>
            <span style={S.codigo}>{triagemAnexada ?? "Nenhuma"}</span>
            {codigoTriagem &&
              (triagemAnexada ? (
                <Botao
                  variante="secundario"
                  disabled={ocupado}
                  onClick={() => setManterTriagem(false)}
                >
                  Remover
                </Botao>
              ) : (
                <Botao
                  variante="secundario"
                  disabled={ocupado}
                  onClick={() => setManterTriagem(true)}
                >
                  Incluir {codigoTriagem}
                </Botao>
              ))}
          </div>
          {entrada.codigo && (
            <p style={S.secundario}>
              Código técnico anexado:{" "}
              <strong style={S.codigoTecnico}>{entrada.codigo}</strong>
            </p>
          )}
        </section>

        <p style={{ ...S.bloco, ...S.vaiJunto }}>
          Vai junto: versão do modelo, data e hora, operador e o registro
          técnico do aparelho. Sem imagem e sem dado do paciente.
        </p>
      </div>

      <p style={{ ...S.aviso, ...(risco ? S.avisoRisco : null) }} role="note">
        <span aria-hidden="true">⚠ </span>
        Se alguém se machucou ou o aparelho ofereceu risco, avise também a
        coordenação da unidade agora.
      </p>

      <footer style={S.rodape}>
        <p style={S.pequeno}>Sem rede, o relato espera na fila.</p>
        <div style={S.acoes}>
          <Botao variante="secundario" disabled={ocupado} onClick={cancelar}>
            Cancelar
          </Botao>
          <Botao disabled={!categoria || ocupado} onClick={enviar}>
            {ocupado ? "Enviando…" : "Enviar relato"}
          </Botao>
        </div>
      </footer>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  tela: {
    maxWidth: 1040,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    alignContent: "start",
  },
  cabecalho: { display: "grid", gap: "var(--espaco)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  bloco: {
    display: "grid",
    gap: "calc(var(--espaco) * 1.5)",
    alignContent: "start",
    padding: "calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  rotuloSecao: {
    fontSize: "var(--fonte-corpo)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--cor-secundario)",
  },
  opcoes: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "var(--espaco)",
  },
  opcao: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--espaco) * 1.5)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    textAlign: "left",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  opcaoMarcada: {
    fontWeight: 700,
    background: "var(--cor-offwhite)",
    borderColor: "var(--cor-laranja)",
  },
  marca: { fontSize: 22, lineHeight: 1, color: "var(--cor-secundario)" },
  marcaMarcada: { color: "var(--cor-laranja-700)" },
  duasColunas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "calc(var(--espaco) * 2)",
  },
  linhaCodigo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
    minHeight: "var(--toque)",
  },
  codigo: { fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  codigoTecnico: { color: "var(--cor-grafite)" },
  vaiJunto: { margin: 0, color: "var(--cor-secundario)" },
  aviso: {
    padding: "calc(var(--espaco) * 1.5) calc(var(--espaco) * 2)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    background: "var(--cor-branco)",
  },
  avisoRisco: {
    borderColor: "var(--cor-laranja)",
    fontWeight: 700,
  },
  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
  },
  pequeno: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  acoes: { display: "flex", gap: "var(--espaco)" },
  centro: { minHeight: "60vh", display: "grid", placeItems: "center" },
  confirmacao: { fontSize: "var(--fonte-titulo)", fontWeight: 700 },
};
