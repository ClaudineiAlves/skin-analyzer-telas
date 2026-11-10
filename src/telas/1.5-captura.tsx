import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.5"
      titulo="Captura"
      saidas={[
        ["Captura aprovada", "/triagem/processando"],
        ["Captura reprovada", "/triagem/captura-reprovada"],
        ["Voltar", "/triagem/atendimento"],
      ]}
    />
  );
}
