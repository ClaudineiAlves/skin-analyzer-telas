import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.4"
      titulo="Dados do atendimento"
      saidas={[
        ["Continuar", "/triagem/captura"],
        ["Voltar", "/inicio"],
      ]}
    />
  );
}
