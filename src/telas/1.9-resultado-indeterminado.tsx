import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.9"
      titulo="Resultado indeterminado"
      saidas={[
        ["Salvar", "/inicio"],
        ["Tentar com nova captura", "/triagem/captura"],
        ["Ver detalhes", "/triagem/detalhes"],
      ]}
    />
  );
}
