import { ArrowRight, BadgeCheck, HeartHandshake, Landmark, PawPrint, QrCode, ShieldCheck, Sparkles, Stethoscope, Tag, UsersRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button, Modal, TopBar, useToast } from '../../shared/ui';
import { useDemoStore } from '../../store/DemoProvider';
import './EcosystemPage.css';

type ServiceCategory = 'pet-owner' | 'institution' | 'public-good';

type ServiceDefinition = {
  id: string;
  category: ServiceCategory;
  icon: LucideIcon;
  title: string;
  shortDescription: string;
  audience: string;
  problem: string;
  value: string;
  futureModel: string;
  accent: string;
};

/** 服务分类标签，严格对应 PRD 3.7 的三类服务。 */
const SERVICE_CATEGORIES: ReadonlyArray<{ id: ServiceCategory; label: string; note: string }> = [
  { id: 'pet-owner', label: '宠主服务', note: '让日常陪伴更有连续性' },
  { id: 'institution', label: '机构服务', note: '让授权与来源更清晰' },
  { id: 'public-good', label: '公益服务', note: '让每一份善意可以接力' },
];

/** PawID 服务生态的最小 PRD 清单：宠主 3 张、机构 4 张、公益 3 张，共 10 张。 */
const SERVICES: ReadonlyArray<ServiceDefinition> = [
  {
    id: 'pawid-plus', category: 'pet-owner', icon: Sparkles, title: 'PawID Plus',
    shortDescription: '把一只宠物的数字身份，变成持续可用的陪伴工具。',
    audience: '希望长期管理宠物资料的宠主与家庭',
    problem: '宠物照片、记录和家人分散在不同应用，重要信息难以持续整理。',
    value: '以同一份 PawID 作为家庭共享的身份入口，连接成长记录、数字形象与可授权的服务体验。',
    futureModel: '方案待定 · 可能采用订阅权益组合', accent: 'violet',
  },
  {
    id: 'ai-digital-content', category: 'pet-owner', icon: Sparkles, title: 'AI 数字内容',
    shortDescription: '把日常瞬间转成属于它的数字形象与纪念内容。',
    audience: '想为宠物留下个性化内容的宠主',
    problem: '照片和纪念内容缺少持续的身份关联，换设备或换工具后难以找回完整脉络。',
    value: '让内容与 PawID 关联，形成可追溯的成长叙事；AI 生成能力仅作未来方向，当前未接入真实 AI。',
    futureModel: '方案待定 · 可能按内容包或会员权益提供', accent: 'peach',
  },
  {
    id: 'pawtag', category: 'pet-owner', icon: QrCode, title: 'PawTag 宠物牌',
    shortDescription: '将数字身份连接到现实中的寻回协作。',
    audience: '需要日常防丢与公开资料管理的宠主',
    problem: '宠物走失时，发现者无法快速确认公开特征，主人也难以接收结构化线索。',
    value: '通过 PawTag 指向受控的公开身份页，只分享必要资料并保留家庭隐私；寻回协作为本机记录能力。',
    futureModel: '方案待定 · 可能采用宠物牌与增值服务组合', accent: 'sky',
  },
  {
    id: 'health-credential', category: 'institution', icon: Stethoscope, title: '医院健康凭证',
    shortDescription: '让健康记录在宠主授权下保持连续可读。',
    audience: '宠物医院与希望管理健康资料的宠主',
    problem: '跨医院就诊时，既往记录分散，宠主需要反复整理和转述。',
    value: '机构可在授权范围内向 PawID 写入可验证格式的记录摘要，帮助宠主确认来源与时间；不代表真实医疗认证。',
    futureModel: '方案待定 · 机构接入与授权服务方式待探索', accent: 'mint',
  },
  {
    id: 'breeder-provenance', category: 'institution', icon: Landmark, title: '猫舍犬舍来源证明',
    shortDescription: '让来源资料与宠物身份建立清晰连接。',
    audience: '规范化管理资料的猫舍、犬舍与新宠家庭',
    problem: '来源、交接和早期资料容易以纸面或聊天记录保存，后续查阅不便。',
    value: '通过 PawID 连接来源记录与监护变更，展示信息来源和双方确认轨迹；双方确认不等于血统真实性认证。',
    futureModel: '方案待定 · 机构服务费用与资料范围待定', accent: 'gold',
  },
  {
    id: 'insurance-authorization', category: 'institution', icon: ShieldCheck, title: '保险授权资料',
    shortDescription: '让宠主更清楚地控制资料如何被使用。',
    audience: '宠物保险服务方与希望掌控授权的宠主',
    problem: '投保或理赔需要重复提交资料，授权范围和有效期限不够透明。',
    value: '以宠物数字身份作为授权上下文，让宠主知道哪些资料被请求、用于什么场景；当前不提供保险报价或理赔。',
    futureModel: '方案待定 · 按授权服务与机构合作方式探索', accent: 'blue',
  },
  {
    id: 'brand-activities', category: 'institution', icon: Tag, title: '品牌活动',
    shortDescription: '把品牌会员权益与宠物身份体验连接起来。',
    audience: '宠物品牌、活动组织者与参与活动的宠主',
    problem: '活动参与记录和权益分散在不同渠道，宠主难以持续管理。',
    value: '将活动参与、数字纪念物或权益与宠物身份关联，形成可由宠主管理的活动记录；不虚构合作品牌。',
    futureModel: '方案待定 · 活动权益与品牌合作模式待定', accent: 'coral',
  },
  {
    id: 'rescue-adoption', category: 'public-good', icon: HeartHandshake, title: '救助领养',
    shortDescription: '让领养后的监护变更与生命历史保持连续。',
    audience: '救助组织、寄养家庭与领养宠主',
    problem: '宠物从救助到领养的资料交接容易断裂，后续监护人难以了解完整背景。',
    value: '以监护关系变更承接既有 PawID 与公开历史，让交接更清晰；当前不代表任何真实救助机构或领养撮合。',
    futureModel: '公益属性 · 不生成订单，合作机制待探索', accent: 'green',
  },
  {
    id: 'lost-pet-collaboration', category: 'public-good', icon: UsersRound, title: '寻回协作',
    shortDescription: '让社区中的发现、线索和确认回到同一条协作路径。',
    audience: '走失宠物家庭与愿意提供帮助的社区成员',
    problem: '寻宠信息发布渠道分散，发现者不知道该反馈给谁，家庭也难以整理线索。',
    value: '通过 PawTag 公开页承接必要线索，再由主人确认状态；当前仅在本机保存线索，不提供真实通知或定位。',
    futureModel: '公益属性 · 不收费，协作网络与治理方式待探索', accent: 'teal',
  },
  {
    id: 'life-memorial', category: 'public-good', icon: BadgeCheck, title: '生命纪念',
    shortDescription: '为重要的陪伴保留一份可持续阅读的记忆。',
    audience: '希望保存宠物生命记忆的家庭与纪念服务组织',
    problem: '宠物生命故事容易随时间和设备更换而散落，家人缺少共同的记忆载体。',
    value: '把经家庭确认的成长片段连接到数字生命护照，保留可由家人管理的纪念脉络；不暗示链上永久存储。',
    futureModel: '公益属性 · 服务边界与支持方式待探索', accent: 'rose',
  },
];

/** 服务页顶栏导航，只保留首页和当前页两个真实入口。 */
function EcosystemNavigation(): JSX.Element {
  return <nav className="ecosystem-navigation" aria-label="服务生态导航"><a href="#/">首页</a><a className="active" href="#/ecosystem">服务生态</a></nav>;
}

/** 服务卡统一展示对象、问题和服务方向，点击整卡打开详情。 */
function ServiceCard({ service, interested, onOpen }: { service: ServiceDefinition; interested: boolean; onOpen: (service: ServiceDefinition) => void }): JSX.Element {
  const Icon = service.icon;
  return (
    <button type="button" className={`service-card service-card-${service.accent}`} onClick={() => onOpen(service)}>
      <span className="service-card-topline"><span className="service-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span><span className="service-audience">{service.audience}</span></span>
      <span className="service-card-content"><span className="service-card-title-row"><strong>{service.title}</strong>{interested && <span className="interest-dot" aria-label="已记录感兴趣" />}</span><span className="service-card-description">{service.shortDescription}</span><span className="service-card-problem"><b>解决</b>{service.problem}</span></span>
      <span className="service-card-footer"><span>{service.futureModel.startsWith('公益') ? '公益属性' : '方案待定'}</span><span className="service-card-open">查看详情 <ArrowRight size={15} aria-hidden="true" /></span></span>
    </button>
  );
}

/** 详情弹窗：明确表达 Web3 价值，同时声明不是真实认证或交易。 */
function ServiceDetail({ service, interested, pending, onToggle, onClose }: { service: ServiceDefinition; interested: boolean; pending: boolean; onToggle: () => void; onClose: () => void }): JSX.Element {
  const Icon = service.icon;
  return (
    <Modal open title={service.title} onClose={onClose} className="service-modal">
      <div className={`service-detail service-detail-${service.accent}`}>
        <div className="service-detail-heading"><span className="service-detail-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span><div><p>{service.category === 'pet-owner' ? '宠主服务' : service.category === 'institution' ? '机构服务' : '公益服务'}</p><h3>{service.shortDescription}</h3></div></div>
        <div className="service-detail-grid"><div><span>服务对象</span><strong>{service.audience}</strong></div><div><span>解决的问题</span><strong>{service.problem}</strong></div></div>
        <section className="service-detail-value"><p className="service-detail-label"><PawPrint size={14} aria-hidden="true" /> Web3 价值（方案方向）</p><p>{service.value}</p></section>
        <div className="service-detail-model"><span>{service.futureModel.startsWith('公益') ? '公益属性' : '未来方式'}</span><strong>{service.futureModel.replace(/^公益属性 · /, '')}</strong></div>
        <p className="service-detail-disclaimer">本页仅用于了解服务方向，服务尚未上线、方案待定。这里展示的是产品价值方向，不代表已完成真实认证、机构合作、链上交易、支付或订单。</p>
        <div className="service-detail-actions"><Button variant={interested ? 'secondary' : 'primary'} disabled={pending} onClick={onToggle}>{pending ? '记录中…' : interested ? '取消意向' : '感兴趣'} {interested && !pending ? <X size={16} aria-hidden="true" /> : <HeartHandshake size={16} aria-hidden="true" />}</Button><Button variant="ghost" onClick={onClose}>稍后了解</Button></div>
      </div>
    </Modal>
  );
}

/** 服务生态页：本地筛选、详情和意向状态均来自本机 Store，不接真实服务。 */
export default function EcosystemPage(): JSX.Element {
  const { state, actions } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('pet-owner');
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const visibleServices = SERVICES.filter((service) => service.category === activeCategory);
  const selectedInterested = selectedService ? state.serviceInterests.some((interest) => interest.serviceId === selectedService.id && interest.interested) : false;

  /** 让三分类 tab 支持左右方向键、Home 和 End。 */
  const handleCategoryKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? SERVICE_CATEGORIES.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + SERVICE_CATEGORIES.length) % SERVICE_CATEGORIES.length;
    const nextCategory = SERVICE_CATEGORIES[nextIndex];
    setActiveCategory(nextCategory.id);
    document.getElementById(`ecosystem-tab-${nextCategory.id}`)?.focus();
  };

  /** 将服务意向写入本地 Store，并给用户明确反馈。 */
  const toggleSelectedInterest = async (): Promise<void> => {
    if (!selectedService) return;
    setPendingServiceId(selectedService.id);
    try {
      await actions.toggleInterest(selectedService.id);
      const wasInterested = selectedInterested;
      showSuccess(wasInterested ? '已取消这项服务意向。' : '已记录感兴趣，意向保存在本机记录中。');
    } catch (error) {
      showError(error instanceof Error ? error.message : '记录服务意向失败，请稍后重试。');
    } finally {
      setPendingServiceId(null);
    }
  };

  return (
    <div className="ecosystem-page">
      <TopBar messageSlot={<span className="ecosystem-top-note">服务方案探索中 · 尚未上线</span>}><EcosystemNavigation /></TopBar>
      <main>
        <section className="ecosystem-hero" aria-labelledby="ecosystem-title">
          <div className="ecosystem-hero-copy"><p className="ecosystem-kicker"><span />THE PAWID ECOSYSTEM</p><h1 id="ecosystem-title">围绕一张护照，<br /><em>连接更多善意。</em></h1><p>数字身份不只属于屏幕里的宠物。PawID 试着把宠主、机构与公益协作放进同一套可理解、可授权的服务想象里。</p><div className="ecosystem-hero-note"><ShieldCheck size={17} aria-hidden="true" /><span>Web3 价值：让身份、授权和记录拥有清晰的关联。<strong>本页不代表真实认证或交易。</strong></span></div></div>
          <div className="ecosystem-hero-art" aria-hidden="true"><div className="ecosystem-art-ring ecosystem-art-ring-one" /><div className="ecosystem-art-ring ecosystem-art-ring-two" /><div className="ecosystem-art-card"><PawPrint size={42} /><span>ONE ID</span><strong>ONE STORY</strong></div><span className="art-label art-label-one">家庭</span><span className="art-label art-label-two">机构</span><span className="art-label art-label-three">公益</span></div>
        </section>

        <section className="ecosystem-catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading"><div><p className="section-eyebrow">SERVICE DIRECTIONS</p><h2 id="catalog-title">服务生态，从真实需求开始</h2></div><p>共 10 个服务方向<br />先了解价值，再决定是否感兴趣</p></div>
          <div className="ecosystem-tabs" role="tablist" aria-label="服务生态分类">
            {SERVICE_CATEGORIES.map((category, index) => <button key={category.id} id={`ecosystem-tab-${category.id}`} type="button" role="tab" aria-selected={activeCategory === category.id} aria-controls={`ecosystem-panel-${category.id}`} tabIndex={activeCategory === category.id ? 0 : -1} className={activeCategory === category.id ? 'active' : ''} onClick={() => setActiveCategory(category.id)} onKeyDown={(event) => handleCategoryKeyDown(event, index)}><span>{category.label}</span><small>{category.note}</small><b>{SERVICES.filter((service) => service.category === category.id).length}</b></button>)}
          </div>
          <div id={`ecosystem-panel-${activeCategory}`} className="service-grid" role="tabpanel" aria-labelledby={`ecosystem-tab-${activeCategory}`}>
            {visibleServices.map((service) => <ServiceCard key={service.id} service={service} interested={state.serviceInterests.some((interest) => interest.serviceId === service.id && interest.interested)} onOpen={setSelectedService} />)}
          </div>
        </section>

        <section className="ecosystem-principles" aria-labelledby="principles-title"><div><p className="section-eyebrow">BUILT WITH CARE</p><h2 id="principles-title">不是把宠物变成资产，<br />而是让重要的关系更清楚。</h2></div><div className="principles-list"><div><span>01</span><p><strong>身份连续</strong>从创建、共同监护到生命记忆，围绕同一只宠物连接信息。</p></div><div><span>02</span><p><strong>授权优先</strong>机构服务的价值建立在宠主可理解、可控制的资料授权上。</p></div><div><span>03</span><p><strong>能力边界</strong>当前不生成订单、不连接钱包、不声称已认证，所有意向只保存于本机。</p></div></div></section>
      </main>
      <footer className="ecosystem-footer"><span>© PawID · 宠物数字生命护照</span><span>方案待定 · 价值探索中</span></footer>
      {selectedService && <ServiceDetail service={selectedService} interested={selectedInterested} pending={pendingServiceId === selectedService.id} onToggle={() => void toggleSelectedInterest()} onClose={() => setSelectedService(null)} />}
    </div>
  );
}
