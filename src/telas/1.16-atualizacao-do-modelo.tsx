import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CODIGOS, LIMITES, TEMPOS } from "../config";
import {
  CODIGO_PIN_PAUSADO_1_15,
  ETAPAS_INSTALACAO_1_16,
  buscarSituacaoModelo1_16,
  instalarModelo1_16,
  triagemEmAndamentoTeste1_16,
  verificarPin,
  type AcaoModelo1_16,
  type EtapaInstalacao1_16,
  type RespostaPin,
  type SituacaoModelo1_16,
  type VersaoModelo1_16,
} from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Dialogo, MensagemProblema, TecladoNumerico } from "../ui";

const TEXTO_ETAPA: Record<EtapaInstalacao1_16, string> = {
  integridade: "Conferindo integridade",
  teste: "Teste de verificação",
  troca: "Trocando a versão",
};

const CODIGO_ETAPA: Record<EtapaInstalacao1_16, string> = {
  integridade: CODIGOS.MOD_INTEGRIDADE,
  teste: CODIGOS.MOD_FUMACA,
  troca: CODIGOS.MOD_FUMACA,
};

const dois = (n: number) => String(n).padStart(2, "0");

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const plural = (n: number, um: string, varios: string) =>
  n === 1 ? um : varios;

type Confirmando = {
  acao: AcaoModelo1_16;
  alvo: VersaoModelo1_16;
  pin: string;
  enviando: boolean;
  retorno: Exclude<RespostaPin, { status: "ok" }> | null;
};

type Andamento =
  | {
      fase: "instalando";
      acao: AcaoModelo1_16;
      alvo: VersaoModelo1_16;
      etapa: EtapaInstalacao1_16;
    }
  | { fase: "ok"; versao: VersaoModelo1_16 }
  | {
      fase: "nao_passou";
      etapa: EtapaInstalacao1_16;
      versao: VersaoModelo1_16;
      continua_com: VersaoModelo1_16;
    };

export default function Tela() {
  const navigate = useNavigate();
  const { usuario, atendimento, sair } = useSessao();
  const [situacao, setSituacao] = useState<SituacaoModelo1_16 | null>(null);
  const [confirmando, setConfirmando] = useState<Confirmando | null>(null);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const ativo = useRef(true);

  const carregar = () =>
    buscarSituacaoModelo1_16().then((s) => ativo.current && setSituacao(s));

  useEffect(() => {
    ativo.current = true;
    carregar();
    return () => {
      ativo.current = false;
    };
  }, []);

  // Instalado: o aparelho reinicia pela 1.1 para conferir e carregar a nova versão.
  const reiniciar = () => {
    navigate("/", { replace: true });
    sair();
  };

  useEffect(() => {
    if (andamento?.fase !== "ok") return;
    const t = window.setTimeout(reiniciar, TEMPOS.confirmacaoSalvoMs);
    return () => window.clearTimeout(t);
  }, [andamento]);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== "administrador")
    return <Navigate to="/inicio" replace />;

  const triagemEmAndamento =
    atendimento !== null || triagemEmAndamentoTeste1_16;

  const abrirConfirmacao = (acao: AcaoModelo1_16, alvo: VersaoModelo1_16) =>
    setConfirmando({ acao, alvo, pin: "", enviando: false, retorno: null });

  const iniciar = (acao: AcaoModelo1_16, alvo: VersaoModelo1_16) => {
    setAndamento({
      fase: "instalando",
      acao,
      alvo,
      etapa: ETAPAS_INSTALACAO_1_16[0],
    });
    instalarModelo1_16(acao, (etapa) => {
      if (ativo.current)
        setAndamento({ fase: "instalando", acao, alvo, etapa });
    }).then((r) => {
      if (!ativo.current) return;
      setAndamento(
        r.status === "ok"
          ? { fase: "ok", versao: r.versao }
          : { fase: "nao_passou", ...r },
      );
    });
  };

  const confirmar = () => {
    if (
      !confirmando ||
      confirmando.pin.length < LIMITES.pinDigitos ||
      triagemEmAndamento
    )
      return;
    const { acao, alvo, pin } = confirmando;
    setConfirmando({ ...confirmando, enviando: true });
    verificarPin(usuario.id, pin).then((r) => {
      if (!ativo.current) return;
      if (r.status === "ok") {
        setConfirmando(null);
        iniciar(acao, alvo);
        return;
      }
      setConfirmando(
        (atual) => atual && { ...atual, pin: "", enviando: false, retorno: r },
      );
    });
  };

  const voltarATela = () => {
    setAndamento(null);
    setSituacao(null);
    carregar();
  };

  if (andamento?.fase === "instalando") {
    const atual = ETAPAS_INSTALACAO_1_16.indexOf(andamento.etapa);
    return (
      <div style={S.centro}>
        <h1 style={S.titulo}>
          {andamento.acao === "instalar"
            ? `Instalando a versão ${andamento.alvo.versao}…`
            : `Revertendo para a versão ${andamento.alvo.versao}…`}
        </h1>
        <div
          className="progresso"
          role="progressbar"
          aria-label="Instalação em andamento"
          style={S.barra}
        />
        <ol style={S.etapas} aria-live="polite">
          {ETAPAS_INSTALACAO_1_16.map((e, i) => {
            const situacaoEtapa =
              i < atual ? "feita" : i === atual ? "atual" : "pendente";
            return (
              <li
                key={e}
                style={{ ...S.etapa, ...S[situacaoEtapa] }}
                aria-current={i === atual ? "step" : undefined}
              >
                <span style={S.icone} aria-hidden="true">
                  {situacaoEtapa === "feita"
                    ? "✓"
                    : situacaoEtapa === "atual"
                      ? "●"
                      : "○"}
                </span>
                {TEXTO_ETAPA[e]}
              </li>
            );
          })}
        </ol>
        <p style={S.secundario}>
          Não desligue o aparelho durante a troca.
        </p>
      </div>
    );
  }

  if (andamento?.fase === "ok") {
    return (
      <div style={S.centro}>
        <section style={S.confirmacao} role="status">
          <h1 style={S.titulo}>
            <span aria-hidden="true">✓ </span>
            {`Pacote ${andamento.versao.versao} verificado. Integridade conferida.`}
          </h1>
          <p>{`O aparelho vai reiniciar para carregar a versão ${andamento.versao.versao}.`}</p>
          <Botao onClick={reiniciar}>Reiniciar agora</Botao>
        </section>
      </div>
    );
  }

  if (andamento?.fase === "nao_passou") {
    return (
      <div style={S.centro}>
        <MensagemProblema
          oQueHouve={`A versão ${andamento.versao.versao} não passou na verificação. O aparelho continua com a ${andamento.continua_com.versao}.`}
          oQueFazer="Relate ao suporte para que a equipe técnica confira o pacote. As triagens não foram alteradas."
          acoes={[
            {
              rotulo: "Relatar ao suporte",
              onClick: () =>
                navigate("/relatar", {
                  state: {
                    codigo: CODIGO_ETAPA[andamento.etapa],
                    voltarPara: "/admin/modelo",
                  },
                }),
            },
            { rotulo: "Voltar", onClick: voltarATela, variante: "secundario" },
          ]}
          codigo={CODIGO_ETAPA[andamento.etapa]}
        />
      </div>
    );
  }

  const avisoTriagem = (verbo: string) => (
    <p style={S.avisoTriagem} role="note">
      <span aria-hidden="true">⚠ </span>
      Há uma triagem em andamento. {verbo} depois que ela for salva.
    </p>
  );

  const tituloDialogo =
    confirmando?.acao === "instalar"
      ? `Instalar a versão ${confirmando.alvo.versao}?`
      : `Reverter para a versão ${confirmando?.alvo.versao}?`;

  return (
    <div style={S.tela}>
      <h1 style={S.titulo}>Atualização do modelo</h1>

      {situacao === null ? (
        <p style={S.secundario} aria-live="polite">
          Carregando versões…
        </p>
      ) : (
        <>
          <section style={S.cartao} aria-labelledby="titulo-em-uso">
            <h2 id="titulo-em-uso" style={S.oculto}>
              Modelo em uso
            </h2>
            <p style={S.linhaDestaque}>
              Modelo em uso: {situacao.em_uso.nome} · {situacao.em_uso.versao} ·
              instalado em {dataHora(situacao.em_uso.instalado_em)}
            </p>
          </section>

          <section
            style={{
              ...S.cartao,
              ...(situacao.disponivel ? S.cartaoDisponivel : null),
            }}
            aria-labelledby="titulo-disponivel"
          >
            {situacao.disponivel ? (
              <>
                <h2 id="titulo-disponivel" style={S.linhaDestaque}>
                  Disponível: {situacao.disponivel.nome} ·{" "}
                  {situacao.disponivel.versao}
                </h2>
                <div style={S.bloco}>
                  <h3 style={S.subtitulo}>O que muda nesta versão</h3>
                  <ul style={S.mudancas}>
                    {situacao.disponivel.mudancas.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
                <p>
                  <span style={S.rotulo}>Tipo de mudança:</span>{" "}
                  {situacao.disponivel.tipo_mudanca}
                </p>
                <div style={S.acao}>
                  <Botao
                    disabled={triagemEmAndamento}
                    onClick={() =>
                      situacao.disponivel &&
                      abrirConfirmacao("instalar", situacao.disponivel)
                    }
                  >
                    Instalar {situacao.disponivel.versao}
                  </Botao>
                  {triagemEmAndamento && avisoTriagem("Instale")}
                </div>
              </>
            ) : (
              <h2 id="titulo-disponivel" style={S.linhaDestaque}>
                Nenhuma atualização disponível.
              </h2>
            )}
          </section>

          {situacao.anterior && (
            <section style={S.cartao} aria-labelledby="titulo-anterior">
              <h2 id="titulo-anterior" style={S.linhaDestaque}>
                Versão anterior disponível: {situacao.anterior.versao}
              </h2>
              <p style={S.secundario}>
                Use só se o suporte técnico orientar a voltar para a versão anterior.
              </p>
              <div style={S.acao}>
                <Botao
                  variante="secundario"
                  disabled={triagemEmAndamento}
                  onClick={() =>
                    situacao.anterior &&
                    abrirConfirmacao("reverter", situacao.anterior)
                  }
                >
                  Reverter
                </Botao>
                {triagemEmAndamento && avisoTriagem("Reverta")}
              </div>
            </section>
          )}

          <p style={S.nota}>
            O aparelho nunca troca de versão sozinho. A instalação só começa
            quando um administrador confirma com o PIN.
          </p>
        </>
      )}

      <Dialogo
        aberto={!!confirmando && confirmando.retorno?.status !== "pausado"}
        texto={tituloDialogo}
        confirmar={{
          rotulo: confirmando?.enviando
            ? "Conferindo…"
            : confirmando?.acao === "instalar"
              ? `Instalar ${confirmando.alvo.versao}`
              : "Reverter",
          desabilitado:
            !confirmando ||
            confirmando.enviando ||
            triagemEmAndamento ||
            confirmando.pin.length < LIMITES.pinDigitos,
          onClick: confirmar,
        }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setConfirmando(null) }}
      >
        <p>
          Durante a troca o aparelho fica sem triagem e reinicia ao final. Se a
          nova versão não passar na verificação, ele continua com a versão em
          uso.
        </p>
        <p>Digite o seu PIN de administrador para confirmar.</p>
        {confirmando?.retorno?.status === "incorreto" && (
          <p style={S.alerta} role="alert">
            PIN não confere. {confirmando.retorno.restantes}{" "}
            {plural(
              confirmando.retorno.restantes,
              "tentativa restante.",
              "tentativas restantes.",
            )}
          </p>
        )}
        <TecladoNumerico
          rotulo="PIN do administrador"
          valor={confirmando?.pin ?? ""}
          max={LIMITES.pinDigitos}
          mascarar
          onChange={(pin) =>
            confirmando &&
            !confirmando.enviando &&
            setConfirmando({ ...confirmando, pin })
          }
        />
      </Dialogo>

      <Dialogo
        aberto={confirmando?.retorno?.status === "pausado"}
        texto="Não foi possível confirmar o PIN agora."
        confirmar={{ rotulo: "Voltar", onClick: () => setConfirmando(null) }}
        cancelar={{ rotulo: "Cancelar", onClick: () => setConfirmando(null) }}
      >
        <p>
          Depois de várias tentativas, o PIN fica pausado por{" "}
          {confirmando?.retorno?.status === "pausado" &&
            confirmando.retorno.minutos}{" "}
          minutos. Aguarde e tente de novo, ou peça a outro administrador. Nada
          foi instalado.
        </p>
        <p style={S.codigoProblema}>{CODIGO_PIN_PAUSADO_1_15}</p>
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
    maxWidth: 880,
  },
  titulo: { fontSize: "var(--fonte-titulo)", lineHeight: 1.2 },
  secundario: { color: "var(--cor-secundario)" },
  cartao: {
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    padding: "calc(var(--espaco) * 3)",
    background: "var(--cor-branco)",
    border: "1px solid var(--cor-borda)",
    borderRadius: "var(--raio)",
  },
  cartaoDisponivel: { borderLeft: "6px solid var(--cor-laranja)" },
  linhaDestaque: { fontSize: 22, lineHeight: 1.3, fontWeight: 700 },
  bloco: { display: "grid", gap: "var(--espaco)" },
  subtitulo: { fontSize: "var(--fonte-corpo)", fontWeight: 700 },
  mudancas: { margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 },
  rotulo: { fontWeight: 700 },
  acao: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "calc(var(--espaco) * 2)",
  },
  avisoTriagem: { fontWeight: 600, color: "var(--cor-laranja-700)" },
  nota: {
    padding: "var(--espaco) calc(var(--espaco) * 2)",
    borderLeft: "4px solid var(--cor-secundario)",
    color: "var(--cor-secundario)",
  },
  oculto: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
  },
  alerta: { fontWeight: 600, color: "var(--cor-laranja-700)" },
  codigoProblema: {
    fontSize: "var(--fonte-pequena)",
    color: "var(--cor-secundario)",
  },
  centro: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "calc(var(--espaco) * 4)",
    paddingTop: "calc(var(--espaco) * 8)",
    textAlign: "center",
  },
  barra: { width: 480, height: 6 },
  etapas: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    fontSize: 24,
    textAlign: "left",
  },
  etapa: {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--espaco) * 2)",
  },
  icone: { width: "1.5em", textAlign: "center", fontWeight: 700 },
  feita: {},
  atual: { fontWeight: 700, color: "var(--cor-laranja-700)" },
  pendente: { color: "var(--cor-secundario)" },
  confirmacao: {
    maxWidth: 720,
    display: "grid",
    gap: "calc(var(--espaco) * 2)",
    justifyItems: "center",
    padding: "calc(var(--espaco) * 4)",
    background: "var(--cor-branco)",
    borderLeft: "6px solid var(--cor-grafite)",
    borderRadius: "var(--raio)",
  },
};
