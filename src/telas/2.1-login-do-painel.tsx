import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="2.1"
      titulo="Login do painel"
      saidas={[
        ["Dermatologista → 2.2", "/painel/casos"],
        ["Equipe → 2.4", "/painel/metricas"],
      ]}
    />
  );
}
