import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { LIMITES } from "../config";
import {
  PAUSA_PIN_MINUTOS,
  buscarUsuariosLogin,
  criarPin,
  verificarPin,
  type Funcao,
  type UsuarioLogin,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Logo, MensagemProblema, TecladoNumerico } from "../ui";

// Pendentes de mover para config.ts (CODIGOS / TEMPOS); ver relatório da tela.
const CODIGO_PIN_PAUSA = "PIN-PAUSA";
const TREMOR_MS = 320;
const TREMOR_PX = 6;

const ROTULO_FUNCAO: Record<Funcao, string> = {
  enfermeiro: "Enfermeiro(a)",
  medico: "Médico(a)",
  tecnico_enfermagem: "Técnico(a) de enfermagem",
  administracao: "Administração",
  outro: "Outra função",
};

type Etapa = "pin" | "criar" | "confirmar" | "pausado";

const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/);
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
};

const textoRestantes = (n: number) =>
  n === 1 ? "PIN incorreto. Resta 1 tentativa." : `PIN incorreto. Restam ${n} tentativas.`;

export default function Tela() {
  const navigate = useNavigate();
  const { atualizar } = useSessao();
  const [usuarios, setUsuarios] = useState<UsuarioLogin[] | null>(null);
  const [escolhido, setEscolhido] = useState<UsuarioLogin | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("pin");
  const [pin, setPin] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [minutosPausa, setMinutosPausa] = useState(PAUSA_PIN_MINUTOS);
  const [enviando, setEnviando] = useState(false);
  const areaPin = useRef<HTMLDivElement>(null);
  const ativo = useRef(true);

  const carregar = () => {
    buscarUsuariosLogin().then((u) => ativo.current && setUsuarios(u));
  };

  useEffect(() => {
    ativo.current = true;
    carregar();
    return () => {
      ativo.current = false;
    };
  }, []);

  const tremer = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    areaPin.current?.querySelector(".teclado__visor")?.animate(
      [0, -TREMOR_PX, TREMOR_PX, -TREMOR_PX, TREMOR_PX, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: TREMOR_MS, easing: "ease-in-out" },
    );
  };

  const escolher = (u: UsuarioLogin) => {
    setEscolhido(u);
    setPin("");
    setPinNovo("");
    setAviso(null);
    setEtapa(u.pausado ? "pausado" : u.primeiro_acesso ? "criar" : "pin");
  };

  const voltar = () => {
    setEscolhido(null);
    setPin("");
    setPinNovo("");
    setAviso(null);
    carregar();
  };

  const entrar = (u: UsuarioLogin) => {
    atualizar({ usuario: { id: u.id, nome: u.nome, funcao: u.funcao, perfil: u.perfil, ativo: u.ativo } });
    navigate(u.perfil === "administrador" ? "/admin/status" : "/inicio", { replace: true });
  };

  const enviar = async (u: UsuarioLogin, valor: string) => {
    if (etapa === "criar") {
      setPinNovo(valor);
      setPin("");
      setAviso(null);
      setEtapa("confirmar");
      return;
    }

    setEnviando(true);
    if (etapa === "confirmar") {
      if (valor !== pinNovo) {
        setEnviando(false);
        setPin("");
        setPinNovo("");
        setEtapa("criar");
        setAviso("Os dois PINs não são iguais. Crie o PIN de novo.");
        tremer();
        return;
      }
      await criarPin(u.id, valor);
      if (ativo.current) entrar(u);
      return;
    }

    const r = await verificarPin(u.id, valor);
    if (!ativo.current) return;
    setEnviando(false);
    if (r.status === "ok") {
      entrar(u);
    } else if (r.status === "incorreto") {
      setPin("");
      setAviso(textoRestantes(r.restantes));
      tremer();
    } else {
      setPin("");
      setMinutosPausa(r.minutos);
      setEtapa("pausado");
    }
  };

  const digitar = (valor: string) => {
    if (!escolhido || enviando) return;
    setPin(valor);
    if (valor.length === LIMITES.pinDigitos) enviar(escolhido, valor);
  };

  // ── Acesso pausado ───────────────────────────────────────────────────
  if (escolhido && etapa === "pausado") {
    return (
      <div className="tela-cheia">
        <Logo grande />
        <MensagemProblema
          oQueHouve={`Acesso de ${escolhido.nome} pausado por ${minutosPausa} minutos.`}
          oQueFazer="Se esqueceu o PIN, fale com a administração da unidade."
          acoes={[{ rotulo: "Voltar", onClick: voltar }]}
          codigo={CODIGO_PIN_PAUSA}
        />
      </div>
    );
  }

  // ── PIN (entrada, criação ou confirmação) ────────────────────────────
  if (escolhido) {
    const instrucao =
      etapa === "criar"
        ? `Crie um PIN de ${LIMITES.pinDigitos} dígitos`
        : etapa === "confirmar"
          ? "Digite o novo PIN de novo para confirmar"
          : "Digite seu PIN";
    return (
      <div className="tela-cheia" style={S.telaPin}>
        <div style={S.cabecalhoPin}>
          <p style={S.nomePin}>{escolhido.nome}</p>
          {etapa !== "pin" && <p style={S.secundario}>Primeiro acesso</p>}
          <p>{instrucao}</p>
        </div>
        <p role="alert" style={S.aviso}>
          {aviso}
        </p>
        <div ref={areaPin}>
          <TecladoNumerico valor={pin} onChange={digitar} max={LIMITES.pinDigitos} mascarar rotulo={instrucao} />
        </div>
        <Botao variante="secundario" onClick={voltar} disabled={enviando}>
          Voltar
        </Botao>
      </div>
    );
  }

  // ── Grade de usuários ────────────────────────────────────────────────
  const semOperadores = usuarios !== null && !usuarios.some((u) => u.perfil === "operador");

  return (
    <div className="tela-cheia">
      <Logo grande />
      <h1 style={S.titulo}>Quem vai usar o aparelho agora?</h1>
      {usuarios === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando usuários…
        </p>
      ) : (
        <>
          {semOperadores && <p style={S.semOperadores}>Cadastre os operadores para começar.</p>}
          <div style={S.grade}>
            {usuarios.map((u) => (
              <button key={u.id} type="button" style={S.cartao} onClick={() => escolher(u)}>
                <span style={S.iniciais} aria-hidden="true">
                  {iniciais(u.nome)}
                </span>
                <span style={S.nomeCartao}>{u.nome}</span>
                <span style={S.secundario}>{ROTULO_FUNCAO[u.funcao]}</span>
                {u.primeiro_acesso && <span style={S.marca}>Primeiro acesso</span>}
                {u.pausado && <span style={S.marca}>Acesso pausado</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  semOperadores: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
    gap: "calc(var(--espaco) * 2)",
    width: "100%",
    maxWidth: 1040,
  },
  cartao: {
    minHeight: 200,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--espaco)",
    padding: "calc(var(--espaco) * 3) calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    color: "var(--cor-grafite)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    font: "inherit",
    cursor: "pointer",
  },
  iniciais: {
    width: 72,
    height: 72,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "var(--cor-offwhite)",
    border: "3px solid var(--cor-laranja)",
    fontSize: 28,
    fontWeight: 700,
  },
  nomeCartao: { fontSize: 22, fontWeight: 700 },
  marca: {
    padding: "2px var(--espaco)",
    border: "1px solid var(--cor-laranja-700)",
    borderRadius: "var(--raio)",
    color: "var(--cor-laranja-700)",
    fontSize: "var(--fonte-corpo)",
  },
  telaPin: { gap: "calc(var(--espaco) * 2)" },
  cabecalhoPin: { display: "grid", gap: "var(--espaco)" },
  nomePin: { fontSize: "var(--fonte-titulo)", fontWeight: 700, lineHeight: 1.2 },
  aviso: { minHeight: "1.4em", color: "var(--cor-laranja-700)", fontWeight: 600 },
};
