import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { TEMPOS } from "../config";
import {
  OPCOES_BLOQUEIO_MIN_1_17,
  buscarConfiguracoes1_17,
  salvarConfiguracoes1_17,
  type Configuracoes1_17,
  type InfoConfiguracoes1_17,
  type ModoDataHora1_17,
  type TipoRede1_17,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Dialogo, TecladoNumerico } from "../ui";

const dois = (n: number) => String(n).padStart(2, "0");

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const plural = (n: number, um: string, varios: string) =>
  n === 1 ? um : varios;

const ROTULO_REDE: Record<TipoRede1_17, string> = {
  wifi: "Wi-Fi",
  cabo: "Cabo de rede",
};

const ROTULO_MODO: Record<ModoDataHora1_17, string> = {
  automatica: "Automática",
  manual: "Manual",
};
const MODOS: ModoDataHora1_17[] = ["automatica", "manual"];

// ── Ajuste manual da hora (só teclado numérico) ────────────────────────
const MASCARA_HORA = "dd/mm/aaaa hh:mm";
const DIGITOS_HORA = MASCARA_HORA.replace(/[^a-z]/g, "").length;

const digitosDe = (iso: string) => dataHora(iso).replace(/\D/g, "");

function preencherMascara(digitos: string) {
  let i = 0;
  return MASCARA_HORA.replace(/[a-z]/g, (letra) =>
    i < digitos.length ? digitos[i++] : letra,
  );
}

// Devolve o ISO local se os 12 dígitos formam uma data e hora que existem.
function isoDosDigitos(digitos: string): string | null {
  if (digitos.length !== DIGITOS_HORA) return null;
  const [dia, mes, ano, hora, min] = [
    digitos.slice(0, 2),
    digitos.slice(2, 4),
    digitos.slice(4, 8),
    digitos.slice(8, 10),
    digitos.slice(10, 12),
  ].map(Number);
  const d = new Date(ano, mes - 1, dia, hora, min);
  const confere =
    d.getFullYear() === ano &&
    d.getMonth() === mes - 1 &&
    d.getDate() === dia &&
    d.getHours() === hora &&
    d.getMinutes() === min;
  return confere
    ? `${ano}-${dois(mes)}-${dois(dia)}T${dois(hora)}:${dois(min)}:00`
    : null;
}

const textoDiferenca = (min: number) =>
  min === 0
    ? "Sem diferença"
    : `${Math.abs(min)} min ${min > 0 ? "adiantado" : "atrasado"}`;

// ── Peças locais ───────────────────────────────────────────────────────
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `grupo-${titulo.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section style={S.grupo} aria-labelledby={id}>
      <h2 id={id} style={S.tituloGrupo}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Linhas({ linhas }: { linhas: [string, ReactNode][] }) {
  return (
    <dl style={S.linhas}>
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} style={S.linha}>
          <dt style={S.rotulo}>{rotulo}</dt>
          <dd style={S.valor}>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Atencao({ texto }: { texto: string }) {
  return (
    <p style={S.atencao} role="note">
      <span aria-hidden="true">⚠ </span>
      {texto}
    </p>
  );
}

function Interruptor({
  rotulo,
  ligado,
  onChange,
}: {
  rotulo: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      style={S.interruptor}
    >
      <span>{rotulo}</span>
      <span style={S.interruptorEstado}>
        <span
          style={{ ...S.trilho, ...(ligado ? S.trilhoLigado : null) }}
          aria-hidden="true"
        >
          <span
            style={{
              ...S.botaoTrilho,
              ...(ligado ? S.botaoTrilhoLigado : null),
            }}
          />
        </span>
        <span style={{ ...S.textoEstado, ...(ligado ? S.textoLigado : null) }}>
          {ligado ? "Ligado" : "Desligado"}
        </span>
      </span>
    </button>
  );
}

function Opcoes<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  onChange,
  texto,
}: {
  rotulo: string;
  opcoes: readonly T[];
  valor: T;
  onChange: (v: T) => void;
  texto: (v: T) => string;
}) {
  return (
    <div style={S.campo} role="radiogroup" aria-label={rotulo}>
      <span style={S.rotuloCampo}>{rotulo}</span>
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

// ── Tela ───────────────────────────────────────────────────────────────
export default function Tela() {
  const navigate = useNavigate();
  const { usuario } = useSessao();
  const [info, setInfo] = useState<InfoConfiguracoes1_17 | null>(null);
  const [salvo, setSalvo] = useState<Configuracoes1_17 | null>(null);
  const [rascunho, setRascunho] = useState<Configuracoes1_17 | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [ajusteHora, setAjusteHora] = useState<string | null>(null); // dígitos digitados
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    buscarConfiguracoes1_17().then(({ config, info }) => {
      if (!ativo.current) return;
      setInfo(info);
      setSalvo(config);
      setRascunho(config);
    });
    return () => {
      ativo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmado) return;
    const t = window.setTimeout(
      () => setConfirmado(false),
      TEMPOS.confirmacaoSalvoMs,
    );
    return () => window.clearTimeout(t);
  }, [confirmado]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== "administrador")
    return <Navigate to="/inicio" replace />;

  if (!info || !rascunho || !salvo) {
    return (
      <div style={S.tela}>
        <h1 style={S.titulo}>Configurações</h1>
        <p style={S.secundario} aria-live="polite">
          Carregando configurações…
        </p>
      </div>
    );
  }

  const alterado = JSON.stringify(rascunho) !== JSON.stringify(salvo);

  const mudar = (parcial: Partial<Configuracoes1_17>) => {
    setConfirmado(false);
    setRascunho({ ...rascunho, ...parcial });
  };

  const salvar = () => {
    setSalvando(true);
    salvarConfiguracoes1_17(rascunho).then(({ config, info }) => {
      if (!ativo.current) return;
      setInfo(info);
      setSalvo(config);
      setRascunho(config);
      setSalvando(false);
      setConfirmado(true);
    });
  };

  const horaExibida = rascunho.hora_manual ?? info.relogio.hora_aparelho;
  const isoAjuste = ajusteHora === null ? null : isoDosDigitos(ajusteHora);
  const { rede, sincronizacao, relogio, unidade, sobre } = info;

  return (
    <div style={S.tela}>
      <h1 style={S.titulo}>Configurações</h1>

      <div style={S.colunas}>
        <Grupo titulo="Rede">
          <Linhas
            linhas={[
              ["Tipo", ROTULO_REDE[rede.tipo]],
              ["Rede", rede.nome],
              [
                "Situação",
                <span style={rede.conectada ? undefined : S.textoAtencao}>
                  <span aria-hidden="true">{rede.conectada ? "● " : "○ "}</span>
                  {rede.conectada ? "Conectado" : "Desconectado"}
                </span>,
              ],
              ["Última sincronização", dataHora(sincronizacao.ultima)],
              [
                "Pendentes",
                `${sincronizacao.pendentes} ${plural(sincronizacao.pendentes, "triagem", "triagens")}`,
              ],
            ]}
          />
          {sincronizacao.atencao && <Atencao texto={sincronizacao.atencao} />}
          {/* Sem ação no protótipo. */}
          <div style={S.acoes}>
            <Botao variante="secundario">Trocar rede</Botao>
            <Botao variante="secundario">Testar conexão</Botao>
          </div>
        </Grupo>

        <Grupo titulo="Data e hora">
          <Opcoes
            rotulo="Modo"
            opcoes={MODOS}
            valor={rascunho.data_hora}
            texto={(m) => ROTULO_MODO[m]}
            onChange={(m) =>
              mudar({
                data_hora: m,
                hora_manual: m === "automatica" ? null : rascunho.hora_manual,
              })
            }
          />
          <Linhas
            linhas={[
              [
                "Hora do aparelho",
                rascunho.hora_manual
                  ? `${dataHora(horaExibida)} (aplicada ao salvar)`
                  : dataHora(horaExibida),
              ],
              ["Diferença da rede", textoDiferenca(relogio.diferenca_rede_min)],
            ]}
          />
          {relogio.atencao && <Atencao texto={relogio.atencao} />}
          {rascunho.data_hora === "automatica" ? (
            <p style={S.secundario}>A hora é acertada pela rede.</p>
          ) : (
            <div style={S.acoes}>
              <Botao
                variante="secundario"
                onClick={() => setAjusteHora(digitosDe(horaExibida))}
              >
                Ajustar data e hora
              </Botao>
            </div>
          )}
        </Grupo>

        <Grupo titulo="Sessão">
          <Opcoes
            rotulo="Bloquear a tela sem toque por"
            opcoes={OPCOES_BLOQUEIO_MIN_1_17}
            valor={rascunho.bloqueio_min}
            texto={(n) => `${n} min`}
            onChange={(n) => mudar({ bloqueio_min: n })}
          />
          <p style={S.secundario}>
            Depois desse tempo, o aparelho pede o PIN de novo.
          </p>
        </Grupo>

        <Grupo titulo="Retenção">
          <Linhas
            linhas={[
              ["Prazo de guarda", "Prazo a definir com a assessoria jurídica."],
            ]}
          />
          <Interruptor
            rotulo="Descarte ao vencer"
            ligado={rascunho.descarte_ao_vencer}
            onChange={(v) => mudar({ descarte_ao_vencer: v })}
          />
        </Grupo>

        <Grupo titulo="Saídas">
          <Interruptor
            rotulo="Impressão"
            ligado={rascunho.impressao}
            onChange={(v) => mudar({ impressao: v })}
          />
          <Interruptor
            rotulo="Pendrive"
            ligado={rascunho.pendrive}
            onChange={(v) => mudar({ pendrive: v })}
          />
        </Grupo>

        <Grupo titulo="Unidade">
          <Linhas
            linhas={[
              ["Nome", unidade.nome],
              ["Código", unidade.codigo],
            ]}
          />
          <p style={S.secundario}>
            Definidos na instalação. Para alterar, fale com o suporte técnico.
          </p>
        </Grupo>

        <Grupo titulo="Som">
          <Interruptor
            rotulo="Bipe de captura"
            ligado={rascunho.bipe_captura}
            onChange={(v) => mudar({ bipe_captura: v })}
          />
        </Grupo>

        <Grupo titulo="Sobre">
          <Linhas
            linhas={[
              ["Aparelho", sobre.aparelho],
              ["Software do aparelho", `versão ${sobre.software_versao}`],
              ["Modelo", `${sobre.modelo.nome} · ${sobre.modelo.versao}`],
            ]}
          />
          <div style={S.bloco}>
            <h3 style={S.subtitulo}>Licenças</h3>
            <ul style={S.lista}>
              {sobre.licencas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <div style={S.bloco}>
            <h3 style={S.subtitulo}>Suporte técnico</h3>
            <Linhas
              linhas={[
                ["Telefone", sobre.suporte.telefone],
                ["E-mail", sobre.suporte.email],
                ["Horário", sobre.suporte.horario],
              ]}
            />
          </div>
          <div style={S.acoes}>
            <Botao
              variante="secundario"
              onClick={() =>
                navigate("/relatar", {
                  state: { voltarPara: "/admin/configuracoes" },
                })
              }
            >
              Relatar um problema
            </Botao>
          </div>
        </Grupo>
      </div>

      <div style={S.rodape}>
        <p
          style={confirmado ? S.confirmacao : S.secundario}
          role="status"
          aria-live="polite"
        >
          {confirmado ? (
            <>
              <span aria-hidden="true">✓ </span>Configurações salvas.
            </>
          ) : alterado ? (
            "Há alterações não salvas."
          ) : (
            ""
          )}
        </p>
        <Botao onClick={salvar} disabled={!alterado || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Botao>
      </div>

      <Dialogo
        aberto={ajusteHora !== null}
        texto="Ajustar data e hora"
        confirmar={{
          rotulo: "Usar esta hora",
          desabilitado: !isoAjuste,
          onClick: () => {
            if (!isoAjuste) return;
            mudar({ hora_manual: isoAjuste });
            setAjusteHora(null);
          },
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setAjusteHora(null) }}
      >
        <p style={S.previa} aria-live="polite">
          {preencherMascara(ajusteHora ?? "")}
        </p>
        {ajusteHora?.length === DIGITOS_HORA && !isoAjuste && (
          <p style={S.textoAtencao} role="alert">
            Confira a data e a hora digitadas.
          </p>
        )}
        <TecladoNumerico
          rotulo="Data e hora"
          valor={ajusteHora ?? ""}
          max={DIGITOS_HORA}
          onChange={setAjusteHora}
        />
      </Dialogo>
    </div>
  );
}

// Estilos locais: estilos.css é compartilhado; ver relatório para migrar para classes.
const S: Record<string, CSSProperties> = {
  tela: {
    display: "grid",
    gap: "calc(var(--espaco) * 3)",
    alignContent: "start",
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  colunas: { columnCount: 2, columnGap: "calc(var(--espaco) * 2)" },
  grupo: {
    breakInside: "avoid",
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    marginBottom: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  tituloGrupo: { fontSize: 22, lineHeight: 1.2 },
  linhas: { margin: 0, display: "grid", gap: 4 },
  linha: {
    display: "flex",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
  },
  rotulo: { color: "var(--cor-secundario)" },
  valor: {
    margin: 0,
    fontWeight: 600,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  atencao: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    borderLeft: "4px solid var(--cor-laranja)",
    color: "var(--cor-grafite)",
    background: "var(--cor-offwhite)",
  },
  textoAtencao: { fontWeight: 600, color: "var(--cor-laranja-700)" },
  acoes: { display: "flex", flexWrap: "wrap", gap: "var(--espaco)" },
  campo: { display: "grid", gap: "var(--espaco)" },
  rotuloCampo: { fontWeight: 600 },
  opcoes: { display: "flex", flexWrap: "wrap", gap: "var(--espaco)" },
  opcao: {
    minHeight: "var(--toque)",
    minWidth: "var(--toque)",
    padding: "0 calc(var(--espaco) * 2)",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
    cursor: "pointer",
  },
  // Marcado: cor + borda grossa + negrito + ícone (a cor não vai sozinha).
  opcaoMarcada: {
    background: "var(--cor-laranja)",
    border: "3px solid var(--cor-grafite)",
    fontWeight: 700,
  },
  interruptor: {
    minHeight: "var(--toque)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "calc(var(--espaco) * 2)",
    padding: "var(--espaco) 0",
    font: "inherit",
    color: "var(--cor-grafite)",
    background: "transparent",
    border: "none",
    borderTop: "1px solid var(--cor-borda)",
    textAlign: "left",
    cursor: "pointer",
  },
  interruptorEstado: {
    display: "flex",
    alignItems: "center",
    gap: "var(--espaco)",
  },
  trilho: {
    width: 56,
    height: 32,
    padding: 3,
    display: "flex",
    alignItems: "center",
    background: "var(--cor-branco)",
    border: "2px solid var(--cor-secundario)",
    borderRadius: 16,
  },
  trilhoLigado: {
    justifyContent: "flex-end",
    background: "var(--cor-laranja)",
    borderColor: "var(--cor-grafite)",
  },
  botaoTrilho: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "var(--cor-secundario)",
  },
  botaoTrilhoLigado: { background: "var(--cor-grafite)" },
  textoEstado: { minWidth: "5.5em", color: "var(--cor-secundario)" },
  textoLigado: { color: "var(--cor-grafite)", fontWeight: 700 },
  bloco: { display: "grid", gap: "var(--espaco)" },
  subtitulo: { fontSize: "var(--fonte-corpo)", fontWeight: 700 },
  lista: { margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 },
  rodape: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 2) 0",
    background: "var(--cor-offwhite)",
    borderTop: "1px solid var(--cor-borda)",
  },
  confirmacao: { fontWeight: 700, color: "var(--cor-grafite)" },
  previa: {
    fontSize: "var(--fonte-titulo)",
    fontWeight: 700,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
};
