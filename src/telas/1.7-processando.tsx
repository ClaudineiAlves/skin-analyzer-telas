import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.7"
      titulo="Processando"
      saidas={[
        ["Resultado conclusivo", "/triagem/resultado"],
        ["Indeterminado", "/triagem/indeterminado"],
        ["Cancelar", "/inicio"],
      ]}
    />
  );
}
