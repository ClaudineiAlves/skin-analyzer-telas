import type { ButtonHTMLAttributes, ReactNode } from "react";
import { TEXTO_CONDUTA, type Conduta } from "../dominio";

// ── Botao ──────────────────────────────────────────────────────────────
type VarianteBotao = "primario" | "secundario" | "texto";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return <button type="button" className={`botao botao--${variante} ${className}`} {...props} />;
}

// ── Logo ───────────────────────────────────────────────────────────────
export function Logo({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`logo ${grande ? "logo--grande" : ""}`}>
      <span className="logo__marca" aria-hidden="true" />
      <span>Skin Analyzer AI</span>
    </div>
  );
}

// ── FaixaTriagem ───────────────────────────────────────────────────────
// Sem aviso não há resultado: a falta dele é defeito de dados, não estado de tela.
export function FaixaTriagem({ aviso }: { aviso: string }) {
  if (!aviso?.trim()) throw new Error("FaixaTriagem sem aviso: resultado não pode ser exibido.");
  const corte = aviso.indexOf(". ") + 1;
  return (
    <div className="faixa-triagem" role="note">
      <span aria-hidden="true">⚠ </span>
      <strong>{corte > 0 ? aviso.slice(0, corte) : aviso}</strong>
      {corte > 0 && aviso.slice(corte)}
    </div>
  );
}

// ── BlocoConduta ───────────────────────────────────────────────────────
export function BlocoConduta({
  conduta,
  variante = "grande",
}: {
  conduta: Conduta;
  variante?: "grande" | "marcador";
}) {
  const t = TEXTO_CONDUTA[conduta];
  if (variante === "marcador") {
    return (
      <span className="marcador-conduta" data-conduta={conduta}>
        <span className="marcador-conduta__ponto" aria-hidden="true" />
        {t.tituloCurto}
      </span>
    );
  }
  return (
    <div className="bloco-conduta" data-conduta={conduta}>
      {t.titulo}
    </div>
  );
}

// ── MensagemProblema ───────────────────────────────────────────────────
export function MensagemProblema({
  oQueHouve,
  oQueFazer,
  acoes = [],
  codigo,
  rodape,
}: {
  oQueHouve: string;
  oQueFazer?: ReactNode;
  acoes?: { rotulo: string; onClick: () => void; variante?: VarianteBotao }[];
  codigo: string;
  rodape?: ReactNode;
}) {
  return (
    <section className="mensagem-problema" role="alert">
      <h1 className="mensagem-problema__titulo">{oQueHouve}</h1>
      {oQueFazer && <p className="mensagem-problema__fazer">{oQueFazer}</p>}
      {acoes.length > 0 && (
        <div className="mensagem-problema__acoes">
          {acoes.map((a) => (
            <Botao key={a.rotulo} variante={a.variante ?? "primario"} onClick={a.onClick}>
              {a.rotulo}
            </Botao>
          ))}
        </div>
      )}
      <p className="mensagem-problema__codigo">
        {codigo}
        {rodape && <> · {rodape}</>}
      </p>
    </section>
  );
}

// ── Dialogo ────────────────────────────────────────────────────────────
export function Dialogo({
  aberto,
  texto,
  children,
  confirmar,
  cancelar,
}: {
  aberto: boolean;
  texto: string;
  children?: ReactNode;
  confirmar: { rotulo: string; onClick: () => void; desabilitado?: boolean };
  cancelar: { rotulo: string; onClick: () => void };
}) {
  if (!aberto) return null;
  return (
    <div className="dialogo__fundo">
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={texto}>
        <p className="dialogo__texto">{texto}</p>
        {children}
        <div className="dialogo__acoes">
          <Botao variante="secundario" onClick={cancelar.onClick}>
            {cancelar.rotulo}
          </Botao>
          <Botao onClick={confirmar.onClick} disabled={confirmar.desabilitado}>
            {confirmar.rotulo}
          </Botao>
        </div>
      </div>
    </div>
  );
}

// ── TecladoNumerico ────────────────────────────────────────────────────
export function TecladoNumerico({
  valor,
  onChange,
  max,
  mascarar = false,
  rotulo,
}: {
  valor: string;
  onChange: (v: string) => void;
  max: number;
  mascarar?: boolean;
  rotulo: string;
}) {
  const teclar = (d: string) => valor.length < max && onChange(valor + d);
  return (
    <div className="teclado" role="group" aria-label={rotulo}>
      <div className="teclado__visor" aria-live="polite" aria-label={`${valor.length} de ${max} dígitos`}>
        {mascarar
          ? Array.from({ length: max }, (_, i) => (
              <span key={i} aria-hidden="true">{i < valor.length ? "●" : "○"}</span>
            ))
          : valor || " "}
      </div>
      <div className="teclado__teclas">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="teclado__tecla" onClick={() => teclar(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="teclado__tecla" onClick={() => teclar("0")}>
          0
        </button>
        <button
          type="button"
          className="teclado__tecla"
          aria-label="Apagar"
          onClick={() => onChange(valor.slice(0, -1))}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
