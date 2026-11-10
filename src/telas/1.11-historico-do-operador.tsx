import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.11"
      titulo="Histórico do operador"
      saidas={[
        ["Voltar", "/inicio"],
        ["Ver detalhes", "/triagem/detalhes"],
      ]}
    />
  );
}
