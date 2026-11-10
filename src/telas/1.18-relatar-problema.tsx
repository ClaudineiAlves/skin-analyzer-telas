import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.18"
      titulo="Relatar um problema"
      saidas={[
        ["Enviar relato", "/inicio"],
        ["Cancelar", "/inicio"],
      ]}
    />
  );
}
