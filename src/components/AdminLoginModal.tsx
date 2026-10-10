import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  User,
  Mail,
  Key,
  LogOut,
  Check,
  AlertCircle,
  Sparkles,
  PlusCircle,
  LayoutDashboard,
  Crown,
  FileCode,
  Download,
} from 'lucide-react';
import { AppUser } from '../types/drama';
import {
  loginUserWithEmail,
  logoutAdmin,
  getCurrentUser,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  isAdminEmail,
  verifyAdminPassword,
} from '../services/storage';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentUser?: AppUser | null;
  onUserLogin?: (user: AppUser) => void;
  onUserLogout?: () => void;
  onAdminStatusChange: (status: boolean) => void;
  onSuccessMessage?: (msg: string) => void;
  onOpenMonetization?: () => void;
  onOpenUpload?: () => void;
  onOpenStudio?: () => void;
  onOpenBlogger?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  currentUser: initialCurrentUser,
  onUserLogin,
  onUserLogout,
  onAdminStatusChange,
  onSuccessMessage,
  onOpenMonetization,
  onOpenUpload,
  onOpenStudio,
  onOpenBlogger,
}) => {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(
    initialCurrentUser || getCurrentUser()
  );
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [secretTaps, setSecretTaps] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSecretIconTap = () => {
    const next = secretTaps + 1;
    if (next >= 3) {
      setEmailInput(DEFAULT_ADMIN_EMAIL);
      setPasswordInput(DEFAULT_ADMIN_PASSWORD);
      setNameInput('Sandy Orbe');
      setSecretTaps(0);
      onSuccessMessage?.('Credenciales de administrador cargadas discretamente.');
    } else {
      setSecretTaps(next);
      setTimeout(() => setSecretTaps(0), 2500);
    }
  };

  const handleEmailLogin = (
    e?: React.FormEvent,
    targetEmail?: string,
    targetPassword?: string
  ) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const email = (targetEmail || emailInput).trim();
    if (!email) {
      setErrorMsg('Por favor introduce tu dirección de correo electrónico.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Por favor introduce un correo electrónico válido (ej. usuario@gmail.com).');
      return;
    }

    const isTargetAdmin = isAdminEmail(email);

    // If logging into an admin account, verify password securely without revealing admin status
    if (isTargetAdmin) {
      const pass = targetPassword !== undefined ? targetPassword : passwordInput.trim();
      if (!pass || !verifyAdminPassword(pass)) {
        setErrorMsg('Correo o contraseña incorrectos.');
        return;
      }
    }

    const defaultAdminName =
      email.toLowerCase() === 'sandyorbe2@gmail.com' ? 'Sandy Orbe' : 'Sandy Manuel';
    const user = loginUserWithEmail(
      email,
      nameInput.trim() || (isTargetAdmin ? defaultAdminName : undefined)
    );

    setCurrentUserState(user);
    onUserLogin?.(user);

    if (user.role === 'admin') {
      onAdminStatusChange(true);
      setSuccessMsg(`¡Bienvenido ${user.name}! Modo Administrador activado sin candados.`);
      onSuccessMessage?.(
        'Modo Administrador activado: candados retirados y acceso completo a gestión.'
      );
    } else {
      onAdminStatusChange(false);
      setSuccessMsg(`¡Bienvenido ${user.name}! Sesión iniciada con éxito.`);
      onSuccessMessage?.(`Sesión iniciada con ${user.email}`);
    }

    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1100);
  };

  const handleLogout = () => {
    logoutAdmin();
    setCurrentUserState(null);
    onUserLogout?.();
    onAdminStatusChange(false);
    onSuccessMessage?.('Sesión cerrada.');
    onClose();
  };

  const isUserAdmin = isAdmin || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#16161E] rounded-3xl border border-slate-800 p-6 sm:p-7 shadow-2xl relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-800/80">
          <div
            onClick={!currentUser ? handleSecretIconTap : undefined}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform ${
              !currentUser ? 'cursor-default active:scale-95' : ''
            } ${
              isUserAdmin
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20'
                : currentUser
                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-purple-500/20'
                : 'bg-gradient-to-tr from-[#E50914] to-[#FF2E93] shadow-[#E50914]/20'
            }`}
          >
            {isUserAdmin ? (
              <Crown className="w-6 h-6 stroke-[2.5]" />
            ) : currentUser ? (
              <User className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <User className="w-6 h-6 stroke-[2.5]" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>
                {isUserAdmin
                  ? 'Panel de Administrador'
                  : currentUser
                  ? 'Mi Perfil'
                  : 'Iniciar Sesión'}
              </span>
              {isUserAdmin && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUserAdmin
                ? 'Permisos completos de administración activos'
                : currentUser
                ? `Conectado como ${currentUser.email}`
                : 'Inicia sesión con tu correo y contraseña'}
            </p>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STATE A: NOT LOGGED IN (Discreet, clean, no visible admin clues) */}
        {!currentUser && !isAdmin ? (
          <div className="space-y-4">
            {/* Standard Email & Password Login Form */}
            <form onSubmit={(e) => handleEmailLogin(e)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Correo Electrónico</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#E50914] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contraseña</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nombre / Alias (Opcional)</span>
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-[#E50914] to-[#FF2E93] hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#E50914]/25 transition-all text-xs sm:text-sm active:scale-98 mt-2"
              >
                <User className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </button>
            </form>
          </div>
        ) : (
          /* STATE B: LOGGED IN */
          <div className="space-y-4">
            {/* User Profile Card */}
            <div
              className={`p-4 rounded-2xl border ${
                isUserAdmin
                  ? 'bg-gradient-to-br from-emerald-950/50 via-teal-950/30 to-slate-900 border-emerald-500/40 shadow-xl'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                    isUserAdmin
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {currentUser?.name ? currentUser.name[0].toUpperCase() : 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm sm:text-base truncate">
                      {currentUser?.name || (isUserAdmin ? 'Sandy Orbe' : 'Usuario')}
                    </h4>
                    {isUserAdmin && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                        Super Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {currentUser?.email || (isUserAdmin ? DEFAULT_ADMIN_EMAIL : '')}
                  </p>
                </div>
              </div>

              {isUserAdmin && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 text-[11px] text-emerald-200/90 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Modo Administrador activo sin restricciones.</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Candados retirados: acceso libre a todos los capítulos.</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Permisos para subir, editar y eliminar series y episodios.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Quick Admin Actions */}
            {isUserAdmin && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Herramientas Rápidas de Administrador:
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {onOpenUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenUpload();
                      }}
                      className="p-2.5 bg-gradient-to-r from-[#E50914] to-[#FF2E93] hover:from-red-600 hover:to-pink-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Subir Capítulo</span>
                    </button>
                  )}

                  {onOpenStudio && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStudio();
                      }}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                      <span>Creator Studio</span>
                    </button>
                  )}

                  {onOpenMonetization && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenMonetization();
                      }}
                      className="p-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-amber-500/30 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Monetización</span>
                    </button>
                  )}

                  {onOpenBlogger && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBlogger();
                      }}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5 text-orange-400" />
                      <span>Exportar Blogger</span>
                    </button>
                  )}
                </div>

                {/* Netlify Deploy Package Download */}
                <a
                  href="/sanshort-netlify-deploy.zip"
                  download="sanshort-netlify-deploy.zip"
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 mt-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Archivo Web para Netlify (.zip)</span>
                </a>
              </div>
            )}

            {/* Logout Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 hover:text-white font-bold text-xs rounded-xl border border-red-800/60 flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
