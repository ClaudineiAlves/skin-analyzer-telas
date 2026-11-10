import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.8"
      titulo="Resultado"
      saidas={[
        ["Salvar", "/inicio"],
        ["Nova captura", "/triagem/captura"],
        ["Ver detalhes", "/triagem/detalhes"],
      ]}
    />
  );
}
