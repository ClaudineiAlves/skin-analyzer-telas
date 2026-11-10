import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="2.4"
      titulo="Métricas"
      saidas={[
        ["Aparelhos", "/painel/aparelhos"],
        ["Modelos", "/painel/modelos"],
      ]}
    />
  );
}
