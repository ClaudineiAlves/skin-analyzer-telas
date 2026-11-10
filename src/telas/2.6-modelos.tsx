import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="2.6"
      titulo="Modelos"
      saidas={[
        ["Métricas", "/painel/metricas"],
        ["Aparelhos", "/painel/aparelhos"],
      ]}
    />
  );
}
