import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  cenarioLoginPainel,
  verificarCodigoPainel,
  verificarCredenciaisPainel,
  type PerfilPainel,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Logo } from "../ui";

// Pendentes de mover para config.ts (LIMITES / CODIGOS); ver relatório da tela.
const CODIGO_2FA_DIGITOS = 6;
const COD_CREDENCIAIS = "PAINEL-CREDENCIAIS";
const COD_2FA = "PAINEL-2FA";
const COD_SESSAO = "PAINEL-SESSAO";

const DESTINO: Record<PerfilPainel, string> = {
  dermatologista: "/painel/casos",
  equipe: "/painel/metricas",
};

type Etapa = "credenciais" | "codigo";
type Aviso = { texto: string; codigo: string } | null;

const AVISO_SESSAO: Aviso = {
  texto: "Sua sessão expirou por inatividade. Entre de novo.",
  codigo: COD_SESSAO,
};

export default function Tela() {
  const navigate = useNavigate();
  const location = useLocation();
  const { atualizar } = useSessao();

  // Quem encerra a sessão por inatividade navega para cá com state { motivo: "sessao-expirada" }.
  const sessaoExpirada =
    (location.state as { motivo?: string } | null)?.motivo === "sessao-expirada" ||
    cenarioLoginPainel === "sessao-expirada";

  const [etapa, setEtapa] = useState<Etapa>("credenciais");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [desafio, setDesafio] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(sessaoExpirada ? AVISO_SESSAO : null);
  const [enviando, setEnviando] = useState(false);

  const refSenha = useRef<HTMLInputElement>(null);
  const refCodigo = useRef<HTMLInputElement>(null);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  useEffect(() => {
    if (etapa === "codigo") refCodigo.current?.focus();
  }, [etapa]);

  const enviarCredenciais = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || !email.trim() || !senha) return;
    setEnviando(true);
    const r = await verificarCredenciaisPainel(email, senha);
    if (!ativo.current) return;
    setEnviando(false);
    setSenha("");
    if (r.status === "ok") {
      setDesafio(r.desafio);
      setAviso(null);
      setEtapa("codigo");
    } else {
      setAviso({ texto: "E-mail ou senha não conferem.", codigo: COD_CREDENCIAIS });
      refSenha.current?.focus();
    }
  };

  const enviarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || !desafio || codigo.length !== CODIGO_2FA_DIGITOS) return;
    setEnviando(true);
    const r = await verificarCodigoPainel(desafio, codigo);
    if (!ativo.current) return;
    setEnviando(false);
    if (r.status === "ok") {
      const { email: emailConta, nome, perfil } = r.conta;
      atualizar({ usuarioPainel: { email: emailConta, nome, perfil }, tokenPainel: r.token });
      navigate(DESTINO[perfil], { replace: true });
    } else {
      setCodigo("");
      setAviso({ texto: "Código não confere. Confira o aplicativo autenticador.", codigo: COD_2FA });
      refCodigo.current?.focus();
    }
  };

  const voltar = () => {
    setEtapa("credenciais");
    setDesafio(null);
    setCodigo("");
    setAviso(null);
  };

  return (
    <div style={S.pagina}>
      <main style={S.centro}>
        <div style={S.cartao}>
          <div style={S.cabecalho}>
            <Logo grande />
            <p style={S.secundario}>Painel Skin Analyzer AI — acesso restrito a profissionais e equipe autorizados.</p>
          </div>

          <div role="alert" aria-live="assertive">
            {aviso && (
              <div style={S.aviso}>
                <p style={S.avisoTexto}>{aviso.texto}</p>
                <p style={S.avisoCodigo}>{aviso.codigo}</p>
              </div>
            )}
          </div>

          {etapa === "credenciais" ? (
            <form style={S.form} onSubmit={enviarCredenciais} noValidate aria-busy={enviando}>
              <label style={S.campo}>
                <span style={S.rotulo}>E-mail</span>
                <input
                  style={S.input}
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                />
              </label>
              <label style={S.campo}>
                <span style={S.rotulo}>Senha</span>
                <input
                  ref={refSenha}
                  style={S.input}
                  type="password"
                  name="senha"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={enviando}
                />
              </label>
              <Botao type="submit" disabled={enviando || !email.trim() || !senha}>
                {enviando ? "Conferindo…" : "Entrar"}
              </Botao>
            </form>
          ) : (
            <form style={S.form} onSubmit={enviarCodigo} noValidate aria-busy={enviando}>
              <p>
                Digite o código de {CODIGO_2FA_DIGITOS} dígitos do aplicativo autenticador.
              </p>
              <p style={S.secundario}>{email.trim()}</p>
              <label style={S.campo}>
                <span style={S.rotulo}>Código</span>
                <input
                  ref={refCodigo}
                  style={{ ...S.input, ...S.inputCodigo }}
                  type="text"
                  name="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={CODIGO_2FA_DIGITOS}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, CODIGO_2FA_DIGITOS))}
                  disabled={enviando}
                />
              </label>
              <div style={S.acoes}>
                <Botao variante="secundario" onClick={voltar} disabled={enviando}>
                  Voltar
                </Botao>
                <Botao type="submit" disabled={enviando || codigo.length !== CODIGO_2FA_DIGITOS}>
                  {enviando ? "Conferindo…" : "Confirmar"}
                </Botao>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer style={S.rodape}>Contas são criadas pela equipe Skin Analyzer AI a pedido da instituição.</footer>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  pagina: { minHeight: "100vh", display: "flex", flexDirection: "column", fontSize: 16 },
  centro: { flex: 1, display: "grid", placeItems: "center", padding: "calc(var(--espaco) * 4) calc(var(--espaco) * 2)" },
  cartao: {
    width: "100%",
    maxWidth: 440,
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
    padding: "calc(var(--espaco) * 4)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cabecalho: { display: "grid", gap: "var(--espaco)" },
  secundario: { color: "var(--cor-secundario)" },
  aviso: {
    display: "grid",
    gap: 4,
    padding: "calc(var(--espaco) * 1.5) calc(var(--espaco) * 2)",
    background: "var(--cor-offwhite)",
    borderLeft: "6px solid var(--cor-laranja)",
    borderRadius: "var(--raio)",
  },
  avisoTexto: { color: "var(--cor-laranja-700)", fontWeight: 600 },
  avisoCodigo: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  form: { display: "grid", gap: "calc(var(--espaco) * 2)" },
  campo: { display: "grid", gap: 4 },
  rotulo: { fontWeight: 600 },
  input: {
    minHeight: "var(--toque)",
    padding: "0 calc(var(--espaco) * 1.5)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-secundario)",
    borderRadius: "var(--raio)",
  },
  inputCodigo: { fontSize: 24, letterSpacing: "0.3em", textAlign: "center" },
  acoes: { display: "flex", justifyContent: "space-between", gap: "var(--espaco)" },
  rodape: {
    padding: "calc(var(--espaco) * 2)",
    textAlign: "center",
    fontSize: "var(--fonte-pequena)",
    color: "var(--cor-secundario)",
  },
};
