import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.3"
      titulo="Início"
      saidas={[
        ["Nova triagem", "/triagem/atendimento"],
        ["Ver histórico", "/historico"],
      ]}
    />
  );
}
