import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.12"
      titulo="Bloqueio por inatividade"
      saidas={[
        ["PIN correto", "/inicio"],
        ["Trocar operador", "/login"],
      ]}
    />
  );
}
