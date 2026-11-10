import { Placeholder } from "../ui";

export default function Tela() {
  return (
    <Placeholder
      id="1.2"
      titulo="Login"
      saidas={[
        ["Operador → 1.3", "/inicio"],
        ["Administrador → 1.13", "/admin/status"],
      ]}
    />
  );
}
