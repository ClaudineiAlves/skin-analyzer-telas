import { useNavigate } from "react-router-dom";
import { Botao } from "./basicos";

// Ponto de partida de cada tela: título + botões para as saídas. Remova ao construir a tela.
export function Placeholder({
  id,
  titulo,
  saidas,
}: {
  id: string;
  titulo: string;
  saidas: [rotulo: string, rota: string][];
}) {
  const navigate = useNavigate();
  return (
    <section className="placeholder">
      <p className="placeholder__id">Tela {id} · a construir</p>
      <h1>{titulo}</h1>
      <div className="placeholder__saidas">
        {saidas.map(([rotulo, rota]) => (
          <Botao key={rotulo} variante="secundario" onClick={() => navigate(rota)}>
            Simular: {rotulo}
          </Botao>
        ))}
      </div>
    </section>
  );
}
