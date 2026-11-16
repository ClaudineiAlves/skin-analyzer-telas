import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { TEMPOS } from "../config";
import { buscarPendentesSync, buscarSaude } from "../mocks";
import { useSessao } from "../sessao";
import { Botao, Logo } from "./basicos";

// ── BarraStatus ────────────────────────────────────────────────────────
export function BarraStatus() {
  const { usuario, sair } = useSessao();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [versao, setVersao] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const { pathname } = useLocation();

  // Recarrega a cada troca de tela: salvar uma triagem muda o número de pendentes.
  useEffect(() => {
    let ativo = true;
    buscarPendentesSync().then((n) => ativo && setPendentes(n));
    return () => {
      ativo = false;
    };
  }, [pathname]);

  useEffect(() => {
    buscarSaude().then((s) => setVersao(s.modelo_versao));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const ir = (rota: string) => {
    setMenu(false);
    navigate(rota);
  };

  return (
    <header className="barra-status">
      <Logo />
      <div className="barra-status__info">
        <div className="barra-status__menu">
          <button type="button" className="barra-status__nome" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {usuario?.nome ?? "Sem operador"} ▾
          </button>
          {menu && (
            <ul className="menu-flutuante">
              <li><button type="button" onClick={() => ir("/historico")}>Meu histórico</button></li>
              <li><button type="button" onClick={() => { sair(); ir("/login"); }}>Trocar operador</button></li>
              <li><button type="button" onClick={() => ir("/relatar")}>Relatar um problema</button></li>
              <li><button type="button" onClick={() => { sair(); ir("/login"); }}>Sair</button></li>
            </ul>
          )}
        </div>
        {versao && <span>modelo v{versao}</span>}
        <span>{online ? "● online" : "○ offline"}</span>
        {pendentes > 0 && <span>{pendentes} pendentes</span>}
      </div>
    </header>
  );
}

// ── Inatividade: 2 min sem toque → /bloqueio (pausa durante 1.7) ───────
function useBloqueioPorInatividade() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { usuario } = useSessao();
  const timer = useRef<number>();

  useEffect(() => {
    if (!usuario || pathname === "/triagem/processando") return;
    const reiniciar = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(
        () => navigate("/bloqueio", { state: { voltarPara: pathname + location.search, voltarEstado: location.state } }),
        TEMPOS.inatividadeMs,
      );
    };
    reiniciar();
    window.addEventListener("pointerdown", reiniciar);
    window.addEventListener("keydown", reiniciar);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointerdown", reiniciar);
      window.removeEventListener("keydown", reiniciar);
    };
  }, [usuario, pathname, navigate]);
}

export function LayoutAparelho() {
  useBloqueioPorInatividade();
  return (
    <div className="aparelho">
      <BarraStatus />
      <main className="aparelho__conteudo">
        <Outlet />
      </main>
    </div>
  );
}

// ── MenuAdmin + LayoutAdmin (1.13–1.17) ────────────────────────────────
const ITENS_ADMIN = [
  ["/admin/status", "Status do aparelho"],
  ["/admin/operadores", "Operadores"],
  ["/admin/historico", "Histórico da unidade"],
  ["/admin/modelo", "Atualização do modelo"],
  ["/admin/configuracoes", "Configurações"],
] as const;

export function MenuAdmin() {
  return (
    <nav className="menu-admin" aria-label="Administração">
      {ITENS_ADMIN.map(([rota, rotulo]) => (
        <NavLink key={rota} to={rota} className="menu-admin__item">
          {rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

export function LayoutAdmin() {
  useBloqueioPorInatividade();
  return (
    <div className="aparelho">
      <BarraStatus />
      <div className="aparelho__admin">
        <MenuAdmin />
        <main className="aparelho__conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── LayoutPainel ───────────────────────────────────────────────────────
export function LayoutPainel() {
  const { usuarioPainel, sairPainel } = useSessao();
  const navigate = useNavigate();
  return (
    <div className="painel">
      <header className="painel__barra">
        <Logo />
        <div className="painel__usuario">
          <span>{usuarioPainel?.nome ?? "Sem sessão"}</span>
          <Botao
            variante="texto"
            onClick={() => {
              sairPainel();
              navigate("/painel/login");
            }}
          >
            Sair
          </Botao>
        </div>
      </header>
      <main className="painel__conteudo">
        <Outlet />
      </main>
    </div>
  );
}
