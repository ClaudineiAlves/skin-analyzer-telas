import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.6"
      titulo="Captura reprovada"
      saidas={[
        ["Capturar de novo", "/triagem/captura"],
        ["Encerrar sem resultado", "/inicio"],
      ]}
    />
  );
}
