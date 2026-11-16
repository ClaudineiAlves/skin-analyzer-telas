import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate } from "react-router-dom";
import {
  buscarUsuariosCadastro1_14,
  criarUsuario1_14,
  desativarUsuario1_14,
  redefinirPin1_14,
  type Funcao,
  type Perfil,
  type UsuarioCadastro1_14,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Dialogo } from "../ui";

// Pendente de mover para config.ts (CODIGOS); ver relatório da tela.
const CODIGO_ULTIMO_ADMIN = "ADM-ULTIMO-ADMIN";

const ROTULO_FUNCAO: Record<Funcao, string> = {
  enfermeiro: "Enfermeiro(a)",
  medico: "Médico(a)",
  tecnico_enfermagem: "Técnico(a) de enfermagem",
  administracao: "Administração",
  outro: "Outro",
};

// "administracao" existe nos dados, mas não é oferecida no cadastro.
const FUNCOES_CADASTRO: Funcao[] = ["enfermeiro", "medico", "tecnico_enfermagem", "outro"];

const ROTULO_PERFIL: Record<Perfil, string> = {
  operador: "Operador",
  administrador: "Administrador",
};

const PERFIS: Perfil[] = ["operador", "administrador"];

type Modo =
  | { tipo: "lista" }
  | { tipo: "novo"; perfilInicial: Perfil }
  | { tipo: "pin"; nome: string; pin: string; cadastro: boolean };

type Confirmacao =
  | { tipo: "desativar"; usuario: UsuarioCadastro1_14 }
  | { tipo: "ultimo_admin"; usuario: UsuarioCadastro1_14 }
  | { tipo: "redefinir"; usuario: UsuarioCadastro1_14 };

const ordenar = (lista: UsuarioCadastro1_14[]) =>
  [...lista].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));

function Opcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  texto,
}: {
  rotulo: string;
  opcoes: T[];
  valor: T | null;
  onChange: (v: T) => void;
  texto: (v: T) => string;
}) {
  return (
    <div style={S.campo} role="radiogroup" aria-label={rotulo}>
      <span style={S.rotulo}>{rotulo}</span>
      <div style={S.opcoes}>
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={valor === o}
            onClick={() => onChange(o)}
            style={{ ...S.opcao, ...(valor === o ? S.opcaoMarcada : null) }}
          >
            <span aria-hidden="true">{valor === o ? "◉ " : "○ "}</span>
            {texto(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormNovo({
  perfilInicial,
  onCriado,
  onCancelar,
}: {
  perfilInicial: Perfil;
  onCriado: (u: UsuarioCadastro1_14, pin: string) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState<Funcao | null>(null);
  const [registro, setRegistro] = useState("");
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [enviando, setEnviando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => nomeRef.current?.focus(), []);

  const pronto = nome.trim().length > 0 && funcao !== null;

  const criar = () => {
    if (!pronto || !funcao || enviando) return;
    setEnviando(true);
    criarUsuario1_14({ nome: nome.trim(), funcao, perfil, registro: registro.trim() || null }).then((r) =>
      onCriado(r.usuario, r.pinTemporario),
    );
  };

  return (
    <form
      style={S.tela}
      onSubmit={(e) => {
        e.preventDefault();
        criar();
      }}
    >
      <h1 style={S.titulo}>Novo usuário</h1>

      <label style={S.campo}>
        <span style={S.rotulo}>Nome</span>
        <input
          ref={nomeRef}
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="off"
          style={S.entrada}
        />
      </label>

      <Opcoes rotulo="Função" opcoes={FUNCOES_CADASTRO} valor={funcao} onChange={setFuncao} texto={(f) => ROTULO_FUNCAO[f]} />

      <label style={S.campo}>
        <span style={S.rotulo}>
          Registro profissional <span style={S.secundario}>(opcional)</span>
        </span>
        <input
          type="text"
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
          autoComplete="off"
          style={S.entrada}
        />
      </label>

      <Opcoes rotulo="Perfil" opcoes={PERFIS} valor={perfil} onChange={setPerfil} texto={(p) => ROTULO_PERFIL[p]} />

      <div style={S.rodapeForm}>
        {!pronto && <p style={S.secundario}>Preencha nome e função para continuar.</p>}
        <div style={S.acoes}>
          <Botao variante="secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={!pronto || enviando}>
            {enviando ? "Criando…" : "Criar usuário"}
          </Botao>
        </div>
      </div>
    </form>
  );
}

export default function Tela() {
  const { usuario } = useSessao();
  const [usuarios, setUsuarios] = useState<UsuarioCadastro1_14[] | null>(null);
  const [modo, setModo] = useState<Modo>({ tipo: "lista" });
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ativo = useRef(true);

  const carregar = () => buscarUsuariosCadastro1_14().then((u) => ativo.current && setUsuarios(ordenar(u)));

  useEffect(() => {
    ativo.current = true;
    carregar();
    return () => {
      ativo.current = false;
    };
  }, []);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== "administrador") return <Navigate to="/inicio" replace />;

  const adminsAtivos = usuarios?.filter((u) => u.ativo && u.perfil === "administrador").length ?? 0;

  const pedirDesativar = (u: UsuarioCadastro1_14) => {
    setAviso(null);
    setConfirmacao({ tipo: u.perfil === "administrador" && adminsAtivos <= 1 ? "ultimo_admin" : "desativar", usuario: u });
  };

  const desativar = (u: UsuarioCadastro1_14) => {
    setEnviando(true);
    desativarUsuario1_14(u.id).then((r) => {
      if (!ativo.current) return;
      setEnviando(false);
      if (r.status === "ultimo_admin") {
        setConfirmacao({ tipo: "ultimo_admin", usuario: u });
        return;
      }
      setConfirmacao(null);
      setAviso(`${u.nome} foi desativado(a).`);
      carregar();
    });
  };

  const redefinir = (u: UsuarioCadastro1_14) => {
    setEnviando(true);
    redefinirPin1_14(u.id).then((r) => {
      if (!ativo.current) return;
      setEnviando(false);
      setConfirmacao(null);
      setModo({ tipo: "pin", nome: u.nome, pin: r.pinTemporario, cadastro: false });
    });
  };

  if (modo.tipo === "novo") {
    return (
      <FormNovo
        perfilInicial={modo.perfilInicial}
        onCancelar={() => setModo({ tipo: "lista" })}
        onCriado={(u, pin) => {
          if (!ativo.current) return;
          setModo({ tipo: "pin", nome: u.nome, pin, cadastro: true });
          carregar();
        }}
      />
    );
  }

  if (modo.tipo === "pin") {
    return (
      <section style={S.telaPin} aria-labelledby="titulo-pin">
        <h1 id="titulo-pin" style={S.titulo}>
          {modo.cadastro ? "PIN temporário" : "Novo PIN temporário"}
        </h1>
        <p>
          {modo.cadastro ? "Usuário criado: " : "PIN redefinido para "}
          <strong>{modo.nome}</strong>
        </p>
        <p style={S.pin} aria-label={`PIN temporário: ${modo.pin.split("").join(" ")}`}>
          {modo.pin}
        </p>
        <p style={S.instrucao}>Anote e entregue ao usuário. Este PIN não será mostrado de novo.</p>
        <Botao onClick={() => setModo({ tipo: "lista" })}>Já anotei</Botao>
      </section>
    );
  }

  return (
    <div style={S.tela}>
      <div style={S.cabecalho}>
        <h1 style={S.titulo}>Operadores</h1>
        <Botao onClick={() => setModo({ tipo: "novo", perfilInicial: "operador" })}>+ Novo usuário</Botao>
      </div>

      {aviso && (
        <p style={S.aviso} role="status">
          {aviso}
        </p>
      )}

      {usuarios === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando usuários…
        </p>
      ) : (
        <table style={S.tabela}>
          <thead>
            <tr>
              <th style={S.th}>Nome</th>
              <th style={S.th}>Função</th>
              <th style={S.th}>Perfil</th>
              <th style={S.th}>Situação</th>
              <th style={S.th}>
                <span style={S.somenteLeitor}>Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} style={u.ativo ? undefined : S.linhaDesativada}>
                <td style={{ ...S.td, fontWeight: 600 }}>
                  {u.nome}
                  {u.id === usuario.id && <span style={S.secundario}> (você)</span>}
                </td>
                <td style={S.td}>
                  {ROTULO_FUNCAO[u.funcao]}
                  {u.registro && <span style={S.registro}>{u.registro}</span>}
                </td>
                <td style={S.td}>{ROTULO_PERFIL[u.perfil]}</td>
                <td style={S.td}>
                  {u.ativo ? (
                    <span>
                      <span aria-hidden="true">● </span>Ativo
                    </span>
                  ) : (
                    <span style={S.secundario}>
                      <span aria-hidden="true">○ </span>Desativado
                    </span>
                  )}
                </td>
                <td style={{ ...S.td, ...S.tdAcoes }}>
                  {u.ativo && (
                    <div style={S.acoes}>
                      <Botao variante="secundario" onClick={() => setConfirmacao({ tipo: "redefinir", usuario: u })}>
                        Redefinir PIN
                      </Botao>
                      <Botao variante="secundario" onClick={() => pedirDesativar(u)}>
                        Desativar
                      </Botao>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialogo
        aberto={confirmacao?.tipo === "desativar"}
        texto={`Desativar «${confirmacao?.usuario.nome}»?`}
        confirmar={{
          rotulo: enviando ? "Desativando…" : "Desativar",
          desabilitado: enviando,
          onClick: () => confirmacao && desativar(confirmacao.usuario),
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setConfirmacao(null) }}
      >
        <p>Essa pessoa não poderá mais entrar. As triagens feitas por ela continuam no histórico.</p>
      </Dialogo>

      <Dialogo
        aberto={confirmacao?.tipo === "redefinir"}
        texto={`Redefinir o PIN de «${confirmacao?.usuario.nome}»?`}
        confirmar={{
          rotulo: enviando ? "Gerando…" : "Gerar novo PIN",
          desabilitado: enviando,
          onClick: () => confirmacao && redefinir(confirmacao.usuario),
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setConfirmacao(null) }}
      >
        <p>O PIN atual deixa de valer. Um novo PIN temporário será mostrado uma única vez.</p>
      </Dialogo>

      <Dialogo
        aberto={confirmacao?.tipo === "ultimo_admin"}
        texto="Não é possível desativar o último administrador."
        confirmar={{
          rotulo: "Cadastrar outro administrador",
          onClick: () => {
            setConfirmacao(null);
            setModo({ tipo: "novo", perfilInicial: "administrador" });
          },
        }}
        cancelar={{ rotulo: "Voltar", onClick: () => setConfirmacao(null) }}
      >
        <p>Para desativar «{confirmacao?.usuario.nome}», cadastre antes outro usuário com perfil Administrador.</p>
        <p style={S.codigo}>{CODIGO_ULTIMO_ADMIN}</p>
      </Dialogo>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: { display: "grid", gap: "calc(var(--espaco) * 3)", alignContent: "start" },
  cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "calc(var(--espaco) * 2)" },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)", fontWeight: 400 },
  aviso: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    background: "var(--cor-branco)",
    borderLeft: "4px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  th: {
    textAlign: "left",
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    color: "var(--cor-secundario)",
    fontWeight: 600,
    borderBottom: "1px solid var(--cor-borda)",
  },
  td: { padding: "var(--espaco) calc(var(--espaco) * 2)", borderBottom: "1px solid var(--cor-borda)", verticalAlign: "middle" },
  tdAcoes: { textAlign: "right" },
  linhaDesativada: { background: "var(--cor-offwhite)" },
  registro: { display: "block", fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
  acoes: { display: "flex", justifyContent: "flex-end", gap: "var(--espaco)", flexWrap: "wrap" },
  somenteLeitor: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" },
  campo: { display: "grid", gap: "var(--espaco)", maxWidth: 720 },
  rotulo: { fontWeight: 600 },
  entrada: {
    minHeight: "var(--toque)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  opcoes: { display: "flex", flexWrap: "wrap", gap: "var(--espaco)" },
  opcao: {
    minHeight: "var(--toque)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  // Marcado: cor + borda grossa + negrito + ícone (a cor não vai sozinha).
  opcaoMarcada: { background: "var(--cor-laranja)", border: "3px solid var(--cor-grafite)", fontWeight: 700 },
  rodapeForm: { display: "grid", gap: "var(--espaco)", maxWidth: 720 },
  telaPin: { display: "grid", gap: "calc(var(--espaco) * 3)", justifyItems: "center", textAlign: "center", paddingTop: "calc(var(--espaco) * 4)" },
  pin: {
    fontSize: 56,
    fontWeight: 700,
    letterSpacing: "0.3em",
    fontVariantNumeric: "tabular-nums",
    padding: "calc(var(--espaco) * 2) calc(var(--espaco) * 4)",
    background: "var(--cor-branco)",
    border: "3px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
  instrucao: { fontWeight: 600, color: "var(--cor-laranja-700)", maxWidth: 560 },
  codigo: { fontSize: "var(--fonte-pequena)", color: "var(--cor-secundario)" },
};
