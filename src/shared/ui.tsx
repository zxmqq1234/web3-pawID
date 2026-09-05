import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes } from 'react';
import { Copy, X, Check, AlertCircle, Home, PawPrint, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Pet } from '../domain/types';
import { useDemoStore } from '../store/DemoProvider';

/** 小型固定演示模式标识，避免与真实认证或交易混淆。 */
export function DemoBadge(): JSX.Element {
  return <span className="demo-badge">演示模式</span>;
}

/** Toast 消息。成功消息自动消失，错误消息由调用方通过 close 控制。 */
interface ToastMessage { id: string; kind: 'success' | 'error'; text: string; }
interface ToastContextValue { showSuccess(text: string): void; showError(text: string): void; close(id: string): void; }
const ToastContext = createContext<ToastContextValue | null>(null);

/** ToastProvider 提供全局轻量反馈，不混入业务状态。 */
export function ToastProvider({ children }: PropsWithChildren): JSX.Element {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const close = (id: string): void => setMessages((current) => current.filter((message) => message.id !== id));
  const show = (kind: ToastMessage['kind'], text: string): void => {
    const id = `${Date.now()}-${Math.random()}`;
    setMessages((current) => [...current, { id, kind, text }]);
    if (kind === 'success') window.setTimeout(() => close(id), 3000);
  };
  const value: ToastContextValue = {
    showSuccess: (text) => show('success', text),
    showError: (text) => show('error', text),
    close,
  };
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">{messages.map((message) => <div className={`toast toast-${message.kind}`} key={message.id} role={message.kind === 'error' ? 'alert' : 'status'}>
      {message.kind === 'success' ? <Check size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
      <span>{message.text}</span>
      {message.kind === 'error' && <button type="button" className="toast-close" onClick={() => close(message.id)} aria-label="关闭提示"><X size={15} /></button>}
    </div>)}</div>
  </ToastContext.Provider>;
}

/** 读取 Toast API。 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast 必须在 ToastProvider 内使用');
  return context;
}

interface OverlayProps { open: boolean; onClose: () => void; title?: string; children: ReactNode; className?: string; }

/** 可访问模态框，支持遮罩点击、Esc 和焦点回收。 */
export function Modal({ open, onClose, title, children, className = '' }: OverlayProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
      <div className="modal-header">{title && <h2>{title}</h2>}<IconButton icon={<X />} label="关闭" onClick={onClose} /></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}

/** 从屏幕右侧打开的抽屉，移动端自动占满屏幕。 */
export function Drawer({ open, onClose, title, children, className = '' }: OverlayProps): JSX.Element | null {
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    drawerRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className={`drawer ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={drawerRef}>
      <div className="modal-header">{title && <h2>{title}</h2>}<IconButton icon={<X />} label="关闭" onClick={onClose} /></div>
      <div className="modal-body">{children}</div>
    </aside>
  </div>;
}

/** 危险操作确认框，使用原生按钮保证键盘可操作。 */
export function ConfirmDialog({ open, onClose, onConfirm, title = '请确认操作', children }: OverlayProps & { onConfirm: () => void }): JSX.Element {
  return <Modal open={open} onClose={onClose} title={title}><div className="confirm-content">{children}<div className="button-row"><Button variant="secondary" onClick={onClose}>取消</Button><Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>确认</Button></div></div></Modal>;
}

/** 统一按钮尺寸、焦点态和主次视觉。 */
export function Button({ variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }): JSX.Element {
  return <button {...props} className={`button button-${variant} ${props.className ?? ''}`} />;
}

/** 仅图标按钮必须有可见 title 与 aria-label。 */
export function IconButton({ icon, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; label: string }): JSX.Element {
  return <button {...props} type={props.type ?? 'button'} className={`icon-button ${props.className ?? ''}`} aria-label={label} title={label}>{icon}</button>;
}

/** 带上方中文标签的文本输入框。 */
export function InputField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }): JSX.Element {
  const id = props.id ?? `input-${label}`;
  return <label className="field" htmlFor={id}><span>{label}</span><input {...props} id={id} aria-invalid={Boolean(error)} />{error && <small className="field-error">{error}</small>}</label>;
}

/** 带上方中文标签的下拉选择框。 */
export function SelectField({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }): JSX.Element {
  const id = props.id ?? `select-${label}`;
  return <label className="field" htmlFor={id}><span>{label}</span><select {...props} id={id} aria-invalid={Boolean(error)}>{children}</select>{error && <small className="field-error">{error}</small>}</label>;
}

/** 文字与颜色同时表达业务状态。 */
export function StatusTag({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'success' | 'pending' | 'danger' | 'neutral' }>): JSX.Element {
  return <span className={`status-tag status-${tone}`}>{children}</span>;
}

/** 空状态必须包含解释文本，避免业务页面出现空白。 */
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }): JSX.Element {
  return <div className="empty-state"><PawPrint size={28} aria-hidden="true" /><h3>{title}</h3><p>{description}</p>{action}</div>;
}

/** 复制优先使用 Clipboard API，失败时保留可手动选择的文本。 */
export function CopyBox({ value, label = '复制内容' }: { value: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopied(true); setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };
  return <div className="copy-box"><input aria-label={label} value={value} readOnly onFocus={(event) => event.currentTarget.select()} /><Button variant="secondary" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{copied ? '已复制' : '复制'}</Button>{failed && <small className="field-error">自动复制失败，请选中文本手动复制。</small>}</div>;
}

/** 仅展示本地 URL 文本二维码，不发起真实链上跳转。 */
export function QrCode({ value, label = 'PawTag 二维码（演示）' }: { value: string; label?: string }): JSX.Element {
  return <figure className="qr-code"><QRCodeSVG value={value} size={168} includeMargin aria-label={label} /><figcaption>{label}</figcaption><code>{value}</code></figure>;
}

/** 宠物照片与预置数字形象叠层，并预留装扮覆盖槽。 */
export function PetAvatar({ pet, photoUrl, equippedAssetPath, showPresetLabel = true, size = 'medium' }: { pet: Pet; photoUrl?: string; equippedAssetPath?: string; showPresetLabel?: boolean; size?: 'small' | 'medium' | 'large' }): JSX.Element {
  return <div className={`pet-avatar pet-avatar-${size}`} aria-label={`${pet.name} 的数字形象`}>
    {photoUrl ? <img className="pet-avatar-photo" src={photoUrl} alt={`${pet.name} 的照片`} /> : <div className="pet-avatar-photo avatar-fallback"><PawPrint size={42} aria-hidden="true" /></div>}
    <img className="pet-avatar-digital" src={pet.avatarAssetPath} alt={`${pet.name} 的数字形象`} />
    {equippedAssetPath && <img className="pet-avatar-item" src={equippedAssetPath} alt="已穿戴装扮" />}
    {showPresetLabel && <span className="avatar-label">预置形象演示</span>}
  </div>;
}

/** 桌面顶栏，预留消息入口插槽并固定展示演示模式。 */
export function TopBar({ children, messageSlot }: PropsWithChildren<{ messageSlot?: ReactNode }>): JSX.Element {
  return <header className="top-bar"><a className="brand" href="#/"><span className="brand-mark"><PawPrint size={17} /></span><span>PawID</span></a><div className="top-bar-content">{children}</div><div className="top-bar-actions"><DemoBadge />{messageSlot}</div></header>;
}

/** 演示控制面板，集中管理角色、失败注入与重置，不干扰业务页面布局。 */
export function DemoControl(): JSX.Element {
  const { state, actions } = useDemoStore();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return <>
    <Button variant="ghost" onClick={() => setOpen(true)}><RotateCcw size={16} aria-hidden="true" />演示控制</Button>
    <Drawer open={open} onClose={() => setOpen(false)} title="演示控制">
      <div className="control-panel"><SelectField label="当前角色" value={state.currentRole} onChange={(event) => actions.setRole(event.target.value as 'owner' | 'invitee' | 'visitor')}>
        <option value="owner">小林（主监护人）</option><option value="invitee">阿宁（受邀者）</option><option value="visitor">访客（只读）</option>
      </SelectField><label className="switch-field"><input type="checkbox" checked={state.failNext} onChange={(event) => actions.setFailNext(event.target.checked)} />下次操作失败</label><p className="muted-text">失败只作用于下一次模拟提交，数据不会写入。</p><Button variant="danger" onClick={() => setConfirm(true)}>重置演示</Button></div>
    </Drawer>
    <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { void actions.resetDemo(); setOpen(false); }} title="重置演示数据">将清除 PawID 本地演示数据和上传图片，并恢复种子数据。</ConfirmDialog>
  </>;
}

/** 非业务页面统一占位，明确提示功能接入状态。 */
export function FeatureSlot({ title, description = '该功能模块正在接入，当前仅提供应用骨架。' }: { title: string; description?: string }): JSX.Element {
  return <section className="feature-slot"><DemoBadge /><div className="feature-slot-icon"><PawPrint size={32} /></div><h1>{title}</h1><p>{description}</p><div className="feature-slot-hint">功能正在接入</div></section>;
}

/** 无效路由和 ID 的解释型页面，保留首页及 Mochi 体验入口。 */
export function NotFoundPage({ reason = '找不到对应的页面或演示资源。' }: { reason?: string }): JSX.Element {
  return <main className="not-found"><div className="not-found-icon"><AlertCircle size={36} /></div><h1>这个 PawID 暂时不存在</h1><p>{reason}</p><div className="button-row"><Button onClick={() => { window.location.hash = '#/'; }}><Home size={16} />回到首页</Button><Button variant="secondary" onClick={() => { window.location.hash = '#/pets/mochi?tab=overview'; }}>体验 Mochi</Button></div></main>;
}
