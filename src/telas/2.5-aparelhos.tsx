import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="2.5"
      titulo="Aparelhos"
      saidas={[
        ["Métricas", "/painel/metricas"],
        ["Modelos", "/painel/modelos"],
      ]}
    />
  );
}
