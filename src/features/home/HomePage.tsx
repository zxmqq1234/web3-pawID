import {
  ArrowRight,
  BadgeCheck,
  CircleUserRound,
  Fingerprint,
  HeartHandshake,
  Link2,
  PawPrint,
  QrCode,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { Pet } from '../../domain/types';
import { Button, PetAvatar, TopBar } from '../../shared/ui';
import { useDemoStore } from '../../store/DemoProvider';
import { resolveAvatarAssetPath } from '../../app/assets';
import './HomePage.css';

/** 首页价值卡所需的静态说明，链接到已经存在的演示路径。 */
const VALUE_CARDS = [
  {
    icon: Fingerprint,
    eyebrow: 'IDENTITY',
    title: '身份',
    description: '给每只宠物一张持续生长的数字生命护照，让名字、形象与重要记录始终相连。',
    href: '#/pets/mochi?tab=overview',
    tone: 'lavender',
  },
  {
    icon: UsersRound,
    eyebrow: 'FAMILY',
    title: '家庭',
    description: '邀请家人共同守护，同一只宠物的日常与决定，不再散落在不同聊天记录里。',
    href: '#/pets/mochi?tab=family',
    tone: 'mint',
  },
  {
    icon: Sparkles,
    eyebrow: 'GROWTH',
    title: '成长',
    description: '把陪伴、记录和里程碑沉淀为可验证成长凭证，并获得 PAWS 演示积分。',
    href: '#/pets/mochi?tab=life',
    tone: 'peach',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'SAFETY',
    title: '安全',
    description: '用 PawTag 连接现实世界的寻回协作，只公开必要信息，不暴露家庭隐私。',
    href: '#/pets/mochi?tab=safety',
    tone: 'sky',
  },
] as const;

/** 五分钟演示流程，使用真实 hash 链接串起首页之外的现有体验入口。 */
const DEMO_STEPS = [
  { number: '01', label: '创建', detail: '建立一份专属 PawID', href: '#/create', icon: CircleUserRound },
  { number: '02', label: '共同守护', detail: '邀请家人加入照护', href: '#/pets/mochi?tab=family', icon: HeartHandshake },
  { number: '03', label: '成长资产', detail: '记录陪伴，获得 PAWS', href: '#/pets/mochi?tab=assets', icon: BadgeCheck },
  { number: '04', label: 'PawTag 防丢', detail: '让现实中的它更容易被找回', href: '#/pets/mochi?tab=safety', icon: QrCode },
] as const;

/** 首页顶栏导航，仅提供有实际目标的页面链接。 */
function HomeNavigation(): JSX.Element {
  return (
    <nav className="home-navigation" aria-label="首页导航">
      <a href="#/">首页</a>
      <a href="#/ecosystem">服务生态</a>
    </nav>
  );
}

/** 首页身份卡：将预置 Mochi 的数字形象、网络和状态集中呈现。 */
function IdentityCard({ pet, guardianCount, balance }: { pet: Pet; guardianCount: number; balance: number }): JSX.Element {
  const displayPet = { ...pet, avatarAssetPath: resolveAvatarAssetPath(pet.avatarAssetPath, pet.species) };
  return (
    <article className="identity-card">
      <div className="identity-card-topline">
        <span className="identity-card-label"><span className="status-dot" />DIGITAL LIFE PASSPORT</span>
        <span className="identity-card-network">Monad · 测试演示网络</span>
      </div>
      <div className="identity-card-portrait">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <PetAvatar pet={displayPet} showPresetLabel size="large" />
        <span className="portrait-stamp"><PawPrint size={15} aria-hidden="true" />VERIFIED DEMO</span>
      </div>
      <div className="identity-card-info">
        <div>
          <p className="identity-card-kicker">PawID / PET-0001</p>
          <h2>{pet.name}</h2>
          <p className="identity-card-bio">{pet.coatColor} · {pet.breed} · {pet.introduction}</p>
        </div>
        <span className="identity-card-mark"><Link2 size={14} aria-hidden="true" />ID</span>
      </div>
      <div className="identity-card-divider" />
      <div className="identity-card-meta">
        <div><span>共同监护</span><strong>{guardianCount} 人</strong></div>
        <div><span>成长记录</span><strong>持续累积</strong></div>
        <div><span>PAWS</span><strong>{balance}</strong></div>
      </div>
      <a className="identity-card-link" href="#/pets/mochi?tab=overview">打开 Mochi 的数字世界 <ArrowRight size={16} aria-hidden="true" /></a>
    </article>
  );
}

/** 首页主页面：用本地 Store 读取 Mochi 的真实演示状态，不创建新的 Provider。 */
export default function HomePage(): JSX.Element {
  const { state, selectors } = useDemoStore();
  const pet = selectors.getPetById(state, 'mochi');

  if (!pet) {
    return <main className="home-page home-empty"><PawPrint size={34} aria-hidden="true" /><h1>演示身份暂不可用</h1><p>请在演示控制中恢复初始数据后再试。</p></main>;
  }

  const stats = selectors.getPetStats(state, pet.id);
  const guardians = selectors.getGuardians(state, pet.id);

  return (
    <div className="home-page">
      <TopBar messageSlot={<span className="home-network-note">Monad · 测试演示网络</span>}>
        <HomeNavigation />
      </TopBar>

      <main>
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-copy">
            <div className="hero-kicker"><span className="hero-kicker-line" />PawID · PET IDENTITY LAYER</div>
            <h1 id="home-hero-title">每一只宠物，<br /><em>都有自己的数字世界。</em></h1>
            <p className="hero-lede">PawID 是宠物数字生命护照：把 Web3 的数字身份、可验证成长凭证和家庭共同监护，变成一段看得懂、用得上的陪伴记录。</p>
            <div className="hero-tags" aria-label="PawID 核心能力">
              <span>Web3 数字身份</span>
              <span>可验证成长凭证</span>
              <span>家庭共同监护</span>
              <span>PAWS 演示积分</span>
            </div>
            <div className="hero-actions">
              <a className="home-button home-button-primary" href="#/create">创建 PawID <ArrowRight size={17} aria-hidden="true" /></a>
              <a className="home-button home-button-secondary" href="#/pets/mochi?tab=overview">体验 Mochi <span>→</span></a>
            </div>
            <p className="hero-disclaimer"><span className="disclaimer-lock">✦</span> 纯前端交互演示 · 预置形象演示 · 不连接真实钱包或链上交易</p>
          </div>
          <div className="home-hero-card" aria-label="Mochi 身份卡预览">
            <div className="hero-card-decoration hero-card-decoration-one" />
            <div className="hero-card-decoration hero-card-decoration-two" />
            <IdentityCard pet={pet} guardianCount={guardians.length} balance={stats.balance} />
          </div>
        </section>

        <section className="home-values" aria-labelledby="home-values-title">
          <div className="section-heading">
            <div><p className="section-eyebrow">ONE PET · ONE CONTINUOUS STORY</p><h2 id="home-values-title">把重要的事，放在同一张护照里</h2></div>
            <p>从身份开始，连接家庭、成长与现实安全。<br />每一块信息，都由你决定如何分享。</p>
          </div>
          <div className="value-grid">
            {VALUE_CARDS.map(({ icon: Icon, eyebrow, title, description, href, tone }) => (
              <a className={`value-card value-card-${tone}`} href={href} key={title}>
                <div className="value-card-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></div>
                <div className="value-card-copy"><p>{eyebrow}</p><h3>{title}</h3><span>{description}</span></div>
                <ArrowRight className="value-card-arrow" size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section className="home-demo-flow" aria-labelledby="home-flow-title">
          <div className="flow-header">
            <div><p className="section-eyebrow">A FIVE-MINUTE WALKTHROUGH</p><h2 id="home-flow-title">五分钟，看懂 PawID</h2></div>
            <p>从创建到寻回，每一步都在本地演示数据中即时发生。</p>
          </div>
          <div className="flow-track">
            {DEMO_STEPS.map(({ number, label, detail, href, icon: Icon }, index) => (
              <a className="flow-step" href={href} key={number}>
                <div className="flow-step-number">{number}</div>
                <div className="flow-step-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></div>
                <div className="flow-step-copy"><h3>{label}</h3><p>{detail}</p></div>
                {index < DEMO_STEPS.length - 1 && <span className="flow-connector" aria-hidden="true" />}
              </a>
            ))}
          </div>
        </section>

        <section className="home-ecosystem-banner" aria-label="服务生态入口">
          <div className="ecosystem-banner-mark"><Sparkles size={22} aria-hidden="true" /></div>
          <div><p className="section-eyebrow">THE PAWID ECOSYSTEM</p><h2>让数字身份，连接更多善意</h2><p>从宠主工具到公益协作，探索围绕宠物生命护照的服务可能。</p></div>
          <Button variant="primary" className="home-button home-button-dark" onClick={() => { window.location.hash = '#/ecosystem'; }}>查看服务生态 <ArrowRight size={17} aria-hidden="true" /></Button>
        </section>
      </main>

      <footer className="home-footer"><span>© PawID · 宠物数字生命护照</span><span><span className="footer-pulse" />纯前端演示 · 方案持续探索中</span></footer>
    </div>
  );
}
