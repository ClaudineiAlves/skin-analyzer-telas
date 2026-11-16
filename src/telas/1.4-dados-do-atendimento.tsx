import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LIMITES } from "../config";
import {
  CODIGO_ATENDIMENTO_DIGITOS,
  CODIGO_ATENDIMENTO_PREFIXO,
  IDADE_ULTIMA_FAIXA_ANOS,
  buscarModeloUsaMetadata,
  buscarProximoCodigoAtendimento,
  codigoTemTriagemHoje,
} from "../mocks";
import { useSessao, type Atendimento } from "../sessao";
import { Botao, Dialogo, TecladoNumerico } from "../ui";

type Sexo = NonNullable<Atendimento["sexo"]>;
type Vista = "frente" | "costas";

const SEXOS: [Sexo, string][] = [
  ["feminino", "Feminino"],
  ["masculino", "Masculino"],
  ["nao_informado", "Não informado"],
];

const faixasIdade = () => {
  const passo = LIMITES.faixaIdadeAnos;
  const faixas: { id: string; curto: string; longo: string }[] = [];
  for (let i = 0; i < IDADE_ULTIMA_FAIXA_ANOS; i += passo) {
    const fim = i + passo - 1;
    faixas.push({ id: `${i}-${fim}`, curto: `${i}–${fim}`, longo: `${i} a ${fim} anos` });
  }
  const u = IDADE_ULTIMA_FAIXA_ANOS;
  faixas.push({ id: `${u}+`, curto: `${u}+`, longo: `${u} anos ou mais` });
  return faixas;
};
const FAIXAS = faixasIdade();

// ── Boneco: geometria em unidades do viewBox (300×480) ─────────────────
// Desenhado a 460 px de altura: toda região tem ≥ 48 px no menor lado.
// "alcance" amplia a área de toque das peças estreitas (traço invisível).
type Forma =
  | { tipo: "ret"; x: number; y: number; w: number; h: number; r: number }
  | { tipo: "elipse"; cx: number; cy: number; rx: number; ry: number };

type Peca =
  | "cabeca" | "pescoco" | "troncoSup" | "troncoInf" | "pelve"
  | "bracoE" | "bracoD" | "antebracoE" | "antebracoD" | "maoE" | "maoD"
  | "coxaE" | "coxaD" | "pernaE" | "pernaD" | "peE" | "peD";

const VB_L = 300;
const VB_A = 480;
const ALTURA_BONECO_PX = 460;

const ret = (x: number, y: number, w: number, h: number, r = 14): Forma => ({ tipo: "ret", x, y, w, h, r });
const espelho = (f: Forma): Forma =>
  f.tipo === "ret" ? { ...f, x: VB_L - f.x - f.w } : { ...f, cx: VB_L - f.cx };

// Sufixo E/D = lado de quem olha a tela, não do paciente.
const BRACO = ret(40, 94, 52, 74, 16);
const ANTEBRACO = ret(34, 170, 52, 66);
const MAO: Forma = { tipo: "elipse", cx: 60, cy: 264, rx: 26, ry: 26 };
const COXA = ret(96, 262, 52, 94);
const PERNA = ret(96, 358, 52, 76);
const PE = ret(92, 436, 56, 32, 12);

// Ordem de desenho = ordem de prioridade do toque: as com alcance vêm por último.
const PECAS: { peca: Peca; forma: Forma; alcance?: number }[] = [
  { peca: "cabeca", forma: { tipo: "elipse", cx: 150, cy: 34, rx: 28, ry: 30 } },
  { peca: "troncoSup", forma: ret(96, 92, 108, 76, 16) },
  { peca: "troncoInf", forma: ret(96, 170, 108, 62, 10) },
  { peca: "bracoE", forma: BRACO },
  { peca: "bracoD", forma: espelho(BRACO) },
  { peca: "antebracoE", forma: ANTEBRACO },
  { peca: "antebracoD", forma: espelho(ANTEBRACO) },
  { peca: "maoE", forma: MAO },
  { peca: "maoD", forma: espelho(MAO) },
  { peca: "coxaE", forma: COXA },
  { peca: "coxaD", forma: espelho(COXA) },
  { peca: "pernaE", forma: PERNA },
  { peca: "pernaD", forma: espelho(PERNA) },
  { peca: "pescoco", forma: ret(124, 66, 52, 24, 8), alcance: 13 },
  { peca: "pelve", forma: ret(108, 234, 84, 26, 10), alcance: 12 },
  { peca: "peE", forma: PE, alcance: 9 },
  { peca: "peD", forma: espelho(PE), alcance: 9 },
];

// De frente, a direita do paciente fica à esquerda de quem olha; de costas, coincide.
const LOCAIS: Record<Vista, Record<Peca, string>> = {
  frente: {
    cabeca: "Face",
    pescoco: "Pescoço",
    troncoSup: "Tórax",
    troncoInf: "Abdome",
    pelve: "Virilha e região genital",
    bracoE: "Braço direito",
    bracoD: "Braço esquerdo",
    antebracoE: "Antebraço direito",
    antebracoD: "Antebraço esquerdo",
    maoE: "Mão direita (palma)",
    maoD: "Mão esquerda (palma)",
    coxaE: "Coxa direita",
    coxaD: "Coxa esquerda",
    pernaE: "Perna direita",
    pernaD: "Perna esquerda",
    peE: "Pé direito (peito do pé)",
    peD: "Pé esquerdo (peito do pé)",
  },
  costas: {
    cabeca: "Couro cabeludo",
    pescoco: "Nuca",
    troncoSup: "Dorso",
    troncoInf: "Região lombar",
    pelve: "Glúteos",
    bracoE: "Braço esquerdo",
    bracoD: "Braço direito",
    antebracoE: "Antebraço esquerdo",
    antebracoD: "Antebraço direito",
    maoE: "Mão esquerda (dorso)",
    maoD: "Mão direita (dorso)",
    coxaE: "Coxa esquerda",
    coxaD: "Coxa direita",
    pernaE: "Perna esquerda",
    pernaD: "Perna direita",
    peE: "Pé esquerdo (sola)",
    peD: "Pé direito (sola)",
  },
};

const vistaDoLocal = (local: string): Vista =>
  Object.values(LOCAIS.frente).includes(local) ? "frente" : "costas";

const desenhar = (f: Forma, props: Record<string, unknown>) =>
  f.tipo === "ret" ? (
    <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} {...props} />
  ) : (
    <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...props} />
  );

function Boneco({ vista, local, escolher }: { vista: Vista; local: string; escolher: (l: string) => void }) {
  const [ladoEsq, ladoDir] = vista === "frente" ? ["Direita", "Esquerda"] : ["Esquerda", "Direita"];
  return (
    <svg
      viewBox={`0 0 ${VB_L} ${VB_A}`}
      height={ALTURA_BONECO_PX}
      role="group"
      aria-label={vista === "frente" ? "Corpo visto de frente" : "Corpo visto de costas"}
      style={S.boneco}
    >
      <text x={6} y={22} style={S.ladoSvg} aria-hidden="true">{ladoEsq}</text>
      <text x={VB_L - 6} y={22} textAnchor="end" style={S.ladoSvg} aria-hidden="true">{ladoDir}</text>
      {PECAS.map(({ peca, forma, alcance }) => {
        const nome = LOCAIS[vista][peca];
        const marcado = nome === local;
        const tecla = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            escolher(nome);
          }
        };
        return (
          <g
            key={peca}
            role="button"
            tabIndex={0}
            aria-label={nome}
            aria-pressed={marcado}
            onClick={() => escolher(nome)}
            onKeyDown={tecla}
            style={S.peca}
          >
            {alcance ? desenhar(forma, { fill: "transparent", stroke: "transparent", strokeWidth: alcance * 2 }) : null}
            {desenhar(forma, {
              fill: marcado ? "var(--cor-laranja)" : "var(--cor-branco)",
              stroke: "var(--cor-grafite)",
              strokeWidth: marcado ? 4 : 2,
            })}
          </g>
        );
      })}
    </svg>
  );
}

const soDigitos = (codigo: string) => codigo.slice(CODIGO_ATENDIMENTO_PREFIXO.length);

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atendimento, atualizar } = useSessao();
  // Voltar de 1.5 mantém os dados: parte do que já está na sessão.
  const [codigo, setCodigo] = useState<string | null>(atendimento?.codigo ?? null);
  const [local, setLocal] = useState(atendimento?.local ?? "");
  const [vista, setVista] = useState<Vista>(atendimento?.local ? vistaDoLocal(atendimento.local) : "frente");
  const [faixa, setFaixa] = useState(atendimento?.faixaIdade);
  const [sexo, setSexo] = useState(atendimento?.sexo);
  const [usaMetadata, setUsaMetadata] = useState<boolean | null>(null);
  const [editando, setEditando] = useState(false);
  const [digitos, setDigitos] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [jaUsado, setJaUsado] = useState(false);

  // Só na montagem: o código sugerido não deve sobrescrever uma edição.
  useEffect(() => {
    let ativo = true;
    if (!atendimento) buscarProximoCodigoAtendimento().then((c) => ativo && setCodigo(c));
    buscarModeloUsaMetadata().then((m) => ativo && setUsaMetadata(m));
    return () => {
      ativo = false;
    };
  }, []);

  if (!usuario) return <Navigate to="/login" replace />;

  const abrirTeclado = () => {
    setDigitos("");
    setEditando(true);
  };

  const prosseguir = () => {
    if (!codigo) return;
    atualizar({
      atendimento: {
        codigo,
        local,
        ...(usaMetadata ? { faixaIdade: faixa, sexo } : null),
      },
    });
    navigate("/triagem/captura");
  };

  const continuar = async () => {
    if (!codigo || !local) return;
    setVerificando(true);
    const usado = await codigoTemTriagemHoje(codigo);
    setVerificando(false);
    if (usado) setJaUsado(true);
    else prosseguir();
  };

  const faixaEscolhida = FAIXAS.find((f) => f.id === faixa);
  const podeContinuar = !!codigo && !!local && !verificando;

  return (
    <div style={S.tela}>
      <h1 style={S.titulo}>Novo atendimento</h1>

      <div style={{ ...S.colunas, ...(usaMetadata ? null : S.colunasSemMetadata) }}>
        <div style={S.coluna}>
          <section style={S.secao} aria-labelledby="titulo-codigo">
            <h2 id="titulo-codigo" style={S.rotulo}>
              Código do atendimento
            </h2>
            <div style={S.linhaCodigo}>
              <span style={S.codigo} aria-live="polite">
                {codigo ?? "…"}
              </span>
              <Botao variante="secundario" onClick={abrirTeclado} disabled={!codigo}>
                Alterar código
              </Botao>
            </div>
            <p style={S.secundario}>Use só o código. Nunca nome, CPF ou cartão SUS.</p>
          </section>

          {usaMetadata && (
            <>
              <section style={S.secao} aria-labelledby="titulo-idade">
                <h2 id="titulo-idade" style={S.rotulo}>
                  Idade
                  {faixaEscolhida && <span style={S.escolha}> · {faixaEscolhida.longo}</span>}
                </h2>
                <div style={S.gradeIdade}>
                  {FAIXAS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={faixa === f.id}
                      aria-label={f.longo}
                      onClick={() => setFaixa(faixa === f.id ? undefined : f.id)}
                      style={{ ...S.opcao, ...(faixa === f.id ? S.opcaoMarcada : null) }}
                    >
                      {f.curto}
                    </button>
                  ))}
                </div>
              </section>

              <section style={S.secao} aria-labelledby="titulo-sexo">
                <h2 id="titulo-sexo" style={S.rotulo}>
                  Sexo
                </h2>
                <div style={S.gradeSexo}>
                  {SEXOS.map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={sexo === id}
                      onClick={() => setSexo(sexo === id ? undefined : id)}
                      style={{ ...S.opcao, ...(sexo === id ? S.opcaoMarcada : null) }}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <section style={S.secaoLocal} aria-labelledby="titulo-local">
          <div style={S.cabecalhoLocal}>
            <h2 id="titulo-local" style={S.tituloLocal}>
              Onde está a lesão?
            </h2>
            <div style={S.alternador} role="group" aria-label="Vista do corpo">
              {(["frente", "costas"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vista === v}
                  onClick={() => setVista(v)}
                  style={{ ...S.opcao, ...S.opcaoVista, ...(vista === v ? S.opcaoMarcada : null) }}
                >
                  {v === "frente" ? "Frente" : "Costas"}
                </button>
              ))}
            </div>
          </div>

          <div style={S.areaBoneco}>
            <Boneco vista={vista} local={local} escolher={setLocal} />
            <div style={S.infoLocal}>
              <p style={S.selecionado} aria-live="polite">
                Selecionado: {local ? <strong>{local}</strong> : <span style={S.secundario}>—</span>}
              </p>
              <p style={S.secundario}>
                {vista === "frente"
                  ? "Paciente de frente para você: o lado direito dele fica à sua esquerda."
                  : "Paciente de costas para você: o lado direito dele fica à sua direita."}
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer style={S.rodape}>
        <Botao variante="secundario" onClick={() => navigate("/inicio")}>
          Voltar
        </Botao>
        <div style={S.rodapeDireita}>
          {!local && (
            <p id="aviso-local" style={S.aviso}>
              Toque no local da lesão.
            </p>
          )}
          <Botao
            onClick={continuar}
            disabled={!podeContinuar}
            aria-describedby={local ? undefined : "aviso-local"}
            style={S.continuar}
          >
            Continuar
          </Botao>
        </div>
      </footer>

      <Dialogo
        aberto={editando}
        texto="Código do atendimento"
        confirmar={{
          rotulo: "Usar este código",
          desabilitado: digitos.length !== CODIGO_ATENDIMENTO_DIGITOS,
          onClick: () => {
            setCodigo(CODIGO_ATENDIMENTO_PREFIXO + digitos);
            setEditando(false);
          },
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setEditando(false) }}
      >
        <p style={S.secundario}>
          Digite os {CODIGO_ATENDIMENTO_DIGITOS} números depois de {CODIGO_ATENDIMENTO_PREFIXO}
          {codigo && <> (atual: {soDigitos(codigo)})</>}.
        </p>
        <TecladoNumerico
          valor={digitos}
          onChange={setDigitos}
          max={CODIGO_ATENDIMENTO_DIGITOS}
          rotulo="Números do código do atendimento"
        />
      </Dialogo>

      <Dialogo
        aberto={jaUsado}
        texto="Este código já tem triagem hoje. É uma segunda lesão do mesmo atendimento?"
        confirmar={{
          rotulo: "Sim",
          onClick: () => {
            setJaUsado(false);
            prosseguir();
          },
        }}
        cancelar={{
          rotulo: "Não",
          onClick: () => {
            setJaUsado(false);
            abrirTeclado();
          },
        }}
      >
        <p style={S.secundario}>Código {codigo}</p>
      </Dialogo>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const ALTURA_RODAPE = 88;

const S: Record<string, CSSProperties> = {
  tela: {
    maxWidth: 1232,
    margin: "0 auto",
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
    paddingBottom: ALTURA_RODAPE,
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  colunas: {
    display: "grid",
    gridTemplateColumns: "440px 1fr",
    gap: "calc(var(--espaco) * 4)",
    alignItems: "start",
  },
  colunasSemMetadata: { gridTemplateColumns: "360px 1fr" },
  coluna: { display: "grid", gap: "calc(var(--espaco) * 3)" },
  secao: { display: "grid", gap: "var(--espaco)" },
  rotulo: { fontSize: 20, lineHeight: 1.3 },
  escolha: { fontWeight: 400, color: "var(--cor-secundario)" },
  linhaCodigo: { display: "flex", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  codigo: {
    fontSize: "var(--fonte-titulo)",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.05em",
    minWidth: 130,
  },
  secundario: { color: "var(--cor-secundario)" },
  gradeIdade: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--espaco)" },
  gradeSexo: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--espaco)" },
  opcao: {
    minHeight: "var(--toque)",
    padding: "0 var(--espaco)",
    font: "inherit",
    fontVariantNumeric: "tabular-nums",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  // Marcado: cor + borda grossa + negrito (a cor não vai sozinha).
  opcaoMarcada: {
    background: "var(--cor-laranja)",
    border: "3px solid var(--cor-grafite)",
    fontWeight: 700,
  },
  opcaoVista: { minWidth: 120 },
  secaoLocal: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  cabecalhoLocal: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--espaco)" },
  tituloLocal: { fontSize: 24, lineHeight: 1.2 },
  alternador: { display: "flex", gap: "var(--espaco)" },
  areaBoneco: { display: "flex", gap: "calc(var(--espaco) * 3)", alignItems: "start" },
  boneco: { flexShrink: 0, overflow: "visible" },
  ladoSvg: { fontSize: 19, fill: "var(--cor-secundario)", fontFamily: "var(--fonte)" },
  peca: { cursor: "pointer", outlineOffset: 0 },
  infoLocal: { display: "grid", gap: "calc(var(--espaco) * 2)", paddingTop: "calc(var(--espaco) * 4)" },
  selecionado: { fontSize: 24, lineHeight: 1.3 },
  rodape: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: ALTURA_RODAPE,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 3)",
    background: "var(--cor-offwhite)",
    borderTop: "1px solid var(--cor-borda)",
  },
  rodapeDireita: { display: "flex", alignItems: "center", gap: "calc(var(--espaco) * 3)" },
  aviso: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  continuar: { minWidth: 240, minHeight: 56, fontSize: 22 },
};
