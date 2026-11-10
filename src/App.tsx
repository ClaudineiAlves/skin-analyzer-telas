import { Navigate, Route, Routes } from "react-router-dom";
import { LayoutAdmin, LayoutAparelho, LayoutPainel } from "./ui";
import T1_1 from "./telas/1.1-inicializacao";
import T1_1b from "./telas/1.1b-bloqueio-tecnico";
import T1_2 from "./telas/1.2-login";
import T1_3 from "./telas/1.3-inicio";
import T1_4 from "./telas/1.4-dados-do-atendimento";
import T1_5 from "./telas/1.5-captura";
import T1_6 from "./telas/1.6-captura-reprovada";
import T1_7 from "./telas/1.7-processando";
import T1_8 from "./telas/1.8-resultado";
import T1_9 from "./telas/1.9-resultado-indeterminado";
import T1_10 from "./telas/1.10-detalhes-tecnicos";
import T1_11 from "./telas/1.11-historico-do-operador";
import T1_12 from "./telas/1.12-bloqueio-inatividade";
import T1_13 from "./telas/1.13-status-do-aparelho";
import T1_14 from "./telas/1.14-operadores";
import T1_15 from "./telas/1.15-historico-da-unidade";
import T1_16 from "./telas/1.16-atualizacao-do-modelo";
import T1_17 from "./telas/1.17-configuracoes";
import T1_18 from "./telas/1.18-relatar-problema";
import T2_1 from "./telas/2.1-login-do-painel";
import T2_2 from "./telas/2.2-fila-de-casos";
import T2_3 from "./telas/2.3-revisao-do-caso";
import T2_4 from "./telas/2.4-metricas";
import T2_5 from "./telas/2.5-aparelhos";
import T2_6 from "./telas/2.6-modelos";

export default function App() {
  return (
    <Routes>
      {/* Aparelho — sem barra de status (ninguém entrou ainda ou tela de bloqueio) */}
      <Route path="/" element={<T1_1 />} />
      <Route path="/bloqueio-tecnico" element={<T1_1b />} />
      <Route path="/login" element={<T1_2 />} />
      <Route path="/bloqueio" element={<T1_12 />} />

      {/* Aparelho — operador */}
      <Route element={<LayoutAparelho />}>
        <Route path="/inicio" element={<T1_3 />} />
        <Route path="/triagem/atendimento" element={<T1_4 />} />
        <Route path="/triagem/captura" element={<T1_5 />} />
        <Route path="/triagem/captura-reprovada" element={<T1_6 />} />
        <Route path="/triagem/processando" element={<T1_7 />} />
        <Route path="/triagem/resultado" element={<T1_8 />} />
        <Route path="/triagem/indeterminado" element={<T1_9 />} />
        <Route path="/triagem/detalhes" element={<T1_10 />} />
        <Route path="/historico" element={<T1_11 />} />
        <Route path="/historico/:triagemId" element={<T1_11 />} />
        <Route path="/relatar" element={<T1_18 />} />
      </Route>

      {/* Aparelho — administrador */}
      <Route element={<LayoutAdmin />}>
        <Route path="/admin/status" element={<T1_13 />} />
        <Route path="/admin/operadores" element={<T1_14 />} />
        <Route path="/admin/historico" element={<T1_15 />} />
        <Route path="/admin/modelo" element={<T1_16 />} />
        <Route path="/admin/configuracoes" element={<T1_17 />} />
      </Route>

      {/* Painel web */}
      <Route path="/painel/login" element={<T2_1 />} />
      <Route path="/painel" element={<LayoutPainel />}>
        <Route index element={<Navigate to="/painel/login" replace />} />
        <Route path="casos" element={<T2_2 />} />
        <Route path="casos/:casoId" element={<T2_3 />} />
        <Route path="metricas" element={<T2_4 />} />
        <Route path="aparelhos" element={<T2_5 />} />
        <Route path="aparelhos/:aparelhoId" element={<T2_5 />} />
        <Route path="modelos" element={<T2_6 />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
