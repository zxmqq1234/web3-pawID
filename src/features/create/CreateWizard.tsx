import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, RefObject } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  CloudUpload,
  Dog,
  ImagePlus,
  LoaderCircle,
  PawPrint,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
} from 'lucide-react';
import type { AvatarStyle, CreateDraft, Pet, PetGender, PetSpecies } from '../../domain/types';
import { useDemoStore } from '../../store/DemoProvider';
import { deleteImage, getImage, saveImage } from '../../store/storage';
import { Button, DemoBadge, Modal, SelectField, StatusTag } from '../../shared/ui';
import './create.css';

/** 创建向导的表单数据；step 由页面状态单独管理，便于在草稿中恢复当前位置。 */
type FormValues = Omit<CreateDraft, 'step'>;

type PhotoStatus = 'idle' | 'loading' | 'ready' | 'error';
type AvatarGeneration = 'idle' | 'analyzing' | 'generating' | 'complete';
type SubmissionPhase = 'idle' | 'confirming' | 'generating' | 'success' | 'error';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXAMPLE_PHOTO_KEYS: Record<PetSpecies, string> = { cat: 'example-cat', dog: 'example-dog' };
const AVATAR_STYLES: ReadonlyArray<{ key: AvatarStyle; label: string; description: string }> = [
  { key: '3d', label: '3D 萌宠', description: '柔和立体的陪伴感' },
  { key: 'pixel', label: '像素宠物', description: '复古游戏风格' },
  { key: 'illustration', label: '插画宠物', description: '轻盈手绘质感' },
];

/** 把固定 SVG 编码为本地 data URL，示例素材随页面交付，不请求外部网络。 */
function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

/** 生成两张本地示例照片，避免示例功能依赖远程图片服务。 */
const EXAMPLE_PHOTOS: Record<PetSpecies, string> = {
  cat: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffe9d8"/><stop offset="1" stop-color="#ffc5ae"/></linearGradient></defs><rect width="640" height="480" rx="40" fill="url(#bg)"/><circle cx="112" cy="92" r="62" fill="#fff8ed" opacity=".7"/><circle cx="520" cy="370" r="100" fill="#f49d91" opacity=".35"/><path d="M175 224 198 100l92 78c25-9 50-9 76 0l92-78 22 124c3 92-65 150-153 150S172 316 175 224Z" fill="#d99669"/><path d="m198 100 33 100-70-27Z" fill="#b97455"/><path d="m458 100-33 100 70-27Z" fill="#b97455"/><ellipse cx="264" cy="247" rx="14" ry="19" fill="#3c3040"/><ellipse cx="376" cy="247" rx="14" ry="19" fill="#3c3040"/><path d="M303 273q17 15 34 0" fill="none" stroke="#3c3040" stroke-linecap="round" stroke-width="9"/><path d="M318 291v32m-58-16h-61m180 0h61" stroke="#8a5d4d" stroke-linecap="round" stroke-width="6"/><text x="320" y="425" fill="#754c43" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">示例猫咪 · 待确认</text></svg>`),
  dog: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#dcefff"/><stop offset="1" stop-color="#b9d7ff"/></linearGradient></defs><rect width="640" height="480" rx="40" fill="url(#bg)"/><circle cx="106" cy="100" r="64" fill="#fff" opacity=".7"/><circle cx="530" cy="350" r="110" fill="#87b7eb" opacity=".35"/><path d="M184 170c-38-62-117-81-136-35-17 42 32 104 90 129 4 99 80 153 182 153s178-54 182-153c58-25 107-87 90-129-19-46-98-27-136 35-41-28-135-28-176 0Z" fill="#c58a57"/><path d="M138 144c-49-53-77-34-70-4 7 29 47 65 81 76Z" fill="#96623f"/><path d="M502 144c49-53 77-34 70-4-7 29-47 65-81 76Z" fill="#96623f"/><ellipse cx="262" cy="258" rx="14" ry="19" fill="#2b3748"/><ellipse cx="378" cy="258" rx="14" ry="19" fill="#2b3748"/><ellipse cx="320" cy="289" rx="31" ry="23" fill="#503c3a"/><path d="M320 298v19" stroke="#f9a9ae" stroke-linecap="round" stroke-width="9"/><text x="320" y="425" fill="#3f5b7c" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">示例狗狗 · 待确认</text></svg>`),
};

/** 生成三种风格的本地数字形象素材，所有颜色与图形都是固定演示数据。 */
function createAvatarAssets(species: PetSpecies): Record<AvatarStyle, string> {
  const isDog = species === 'dog';
  const body = isDog ? '#c58a57' : '#d99669';
  const dark = isDog ? '#865334' : '#9d6249';
  const light = isDog ? '#f4d0a7' : '#ffe0c4';
  const ears = isDog
    ? '<path d="M108 145C32 92 28 218 116 244l34-70Z" fill="#865334"/><path d="M532 145c76-53 80 73-8 99l-34-70Z" fill="#865334"/>'
    : '<path d="m129 174 35-111 86 75Z" fill="#9d6249"/><path d="m511 174-35-111-86 75Z" fill="#9d6249"/>';
  const threeD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><radialGradient id="fur"><stop stop-color="${light}"/><stop offset="1" stop-color="${body}"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="13" flood-opacity=".18"/></filter></defs><circle cx="320" cy="320" r="282" fill="#fff7ed"/><circle cx="320" cy="337" r="210" fill="url(#fur)" filter="url(#shadow)"/>${ears}<ellipse cx="252" cy="316" rx="17" ry="23" fill="#2e2a3a"/><ellipse cx="388" cy="316" rx="17" ry="23" fill="#2e2a3a"/><circle cx="246" cy="309" r="6" fill="#fff"/><circle cx="382" cy="309" r="6" fill="#fff"/><path d="M294 362q26 23 52 0" fill="none" stroke="#503c3a" stroke-linecap="round" stroke-width="12"/><path d="M320 380v38" stroke="#865b4b" stroke-linecap="round" stroke-width="7"/><circle cx="320" cy="461" r="35" fill="#7765f5"/><path d="m320 440 8 17 19 3-14 13 3 19-16-9-16 9 3-19-14-13 19-3Z" fill="#fff"/></svg>`;
  const pixel = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" shape-rendering="crispEdges"><rect width="320" height="320" rx="24" fill="#243047"/><rect x="40" y="44" width="240" height="232" rx="20" fill="#53627d"/><path d="M80 124V76h40v20h80V76h40v48h24v96h-24v32H80v-32H56v-96Z" fill="${body}"/><path d="M80 76h40v48H80Zm160 0h-40v48h40Z" fill="${dark}"/><rect x="112" y="168" width="24" height="32" fill="#182234"/><rect x="184" y="168" width="24" height="32" fill="#182234"/><rect x="144" y="216" width="32" height="16" fill="#182234"/><rect x="132" y="248" width="56" height="12" fill="#7765f5"/><rect x="80" y="108" width="24" height="12" fill="${light}"/><rect x="216" y="108" width="24" height="12" fill="${light}"/></svg>`;
  const illustration = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><rect width="640" height="640" rx="120" fill="#e8f5ef"/><path d="M174 190 206 95l86 74c18-5 38-7 56-7s38 2 56 7l86-74 32 95c8 23 5 57-8 80 18 34 26 72 21 108-12 92-102 153-229 153S103 470 91 378c-5-36 3-74 21-108-13-23-16-57-8-80Z" fill="#fcfbf5" stroke="${dark}" stroke-width="11" stroke-linejoin="round"/><path d="m206 95 33 106-82-32Zm228 0-33 106 82-32Z" fill="${light}" stroke="${dark}" stroke-width="11" stroke-linejoin="round"/><ellipse cx="247" cy="321" rx="15" ry="22" fill="#253143"/><ellipse cx="393" cy="321" rx="15" ry="22" fill="#253143"/><path d="M289 372q31 25 62 0" fill="none" stroke="#253143" stroke-linecap="round" stroke-width="11"/><path d="M320 398v42" stroke="#b57b67" stroke-width="7"/><path d="m320 475 16 25 29 7-22 20 4 29-27-15-27 15 4-29-22-20 29-7Z" fill="#ffb859" stroke="#9b6a36" stroke-width="8"/></svg>`;
  return { '3d': svgDataUrl(threeD), pixel: svgDataUrl(pixel), illustration: svgDataUrl(illustration) };
}

const AVATAR_ASSETS: Record<PetSpecies, Record<AvatarStyle, string>> = {
  cat: createAvatarAssets('cat'),
  dog: createAvatarAssets('dog'),
};

/** 示例宠物资料只用于预填表单，所有识别相关字段仍明确标记为待确认。 */
const EXAMPLE_PROFILES: Record<PetSpecies, Omit<FormValues, 'photoKey' | 'avatarAssetPath'>> = {
  cat: {
    name: 'Mochi', species: 'cat', breed: '英短', gender: 'female', birthDate: '2023-05-20',
    coatColor: '奶油白', introduction: '一只喜欢在窗边晒太阳的温柔猫咪。', avatarStyle: '3d',
  },
  dog: {
    name: 'Biscuit', species: 'dog', breed: '柴犬', gender: 'male', birthDate: '2022-09-18',
    coatColor: '赤色', introduction: '一只喜欢散步和追逐阳光的小狗。', avatarStyle: '3d',
  },
};

/** 生成空白表单，示例数字形象默认从猫咪 3D 风格开始。 */
function createEmptyForm(): FormValues {
  return {
    photoKey: null, name: '', species: 'cat', breed: '', gender: 'unknown', birthDate: null,
    coatColor: '', introduction: '', avatarStyle: '3d', avatarAssetPath: AVATAR_ASSETS.cat['3d'],
  };
}

/** 将可能来自旧版本的草稿补齐，避免刷新恢复时出现不可用的预览资源。 */
function formFromDraft(draft: CreateDraft | null): FormValues {
  const empty = createEmptyForm();
  if (!draft) return empty;
  return {
    ...empty,
    ...draft,
    avatarAssetPath: draft.avatarAssetPath || AVATAR_ASSETS[draft.species]?.[draft.avatarStyle] || empty.avatarAssetPath,
  };
}

/** 返回本地日期，避免 UTC 跨日导致生日校验误判。 */
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 读取异常信息，但不把底层存储细节直接暴露给用户。 */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 文件选择校验：限制格式、大小和单张上传，错误会显示在上传区域原位。 */
function validatePhotoFile(file: File): string | null {
  const acceptedMime = ['image/jpeg', 'image/png', 'image/webp'];
  const acceptedExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!acceptedMime.includes(file.type) && !acceptedExtension) return '仅支持 JPG、PNG 或 WebP 图片。';
  if (file.size > MAX_PHOTO_BYTES) return '图片不能超过 5MB，请压缩后再试。';
  return null;
}

/** 确认信息的字段校验，生日允许未知但不允许晚于今天。 */
function getInfoErrors(form: FormValues): { name?: string; birthDate?: string } {
  const errors: { name?: string; birthDate?: string } = {};
  const nameLength = Array.from(form.name.trim()).length;
  if (!nameLength) errors.name = '请输入宠物名。';
  else if (nameLength > 20) errors.name = '宠物名最多 20 个字。';
  if (form.birthDate && form.birthDate > getTodayString()) errors.birthDate = '生日不能晚于今天。';
  return errors;
}

/** 四步通用进度条，当前步骤和已完成步骤都用文字与图形表达。 */
function WizardProgress({ step }: { step: number }): JSX.Element {
  const steps = ['上传照片', '确认信息', '选择数字形象', '创建 PawID'];
  return <nav className="create-progress" aria-label="创建身份进度">
    {steps.map((label, index) => {
      const number = index + 1;
      const state = number < step ? 'complete' : number === step ? 'current' : 'upcoming';
      return <div className={`create-progress-item create-progress-${state}`} key={label}>
        <span className="create-progress-dot" aria-hidden="true">{number < step ? <Check size={15} /> : number}</span>
        <span>{label}</span>
        {number < steps.length && <span className="create-progress-line" aria-hidden="true" />}
      </div>;
    })}
  </nav>;
}

interface PhotoStepProps {
  form: FormValues;
  photoUrl: string | null;
  photoStatus: PhotoStatus;
  photoError: string | null;
  dragActive: boolean;
  onDragStateChange: (active: boolean) => void;
  onFile: (file: File) => void;
  onExample: (species: PetSpecies) => void;
  onOpenFile: () => void;
  photoInputRef: RefObject<HTMLInputElement>;
}

/** 第一步：照片上传、拖拽和本地示例选择。 */
function PhotoStep({ form, photoUrl, photoStatus, photoError, dragActive, onDragStateChange, onFile, onExample, onOpenFile, photoInputRef }: PhotoStepProps): JSX.Element {
  const exampleSpecies = form.photoKey === EXAMPLE_PHOTO_KEYS.cat ? 'cat' : form.photoKey === EXAMPLE_PHOTO_KEYS.dog ? 'dog' : null;
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    onDragStateChange(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 1) {
      onFile(new File([], '多张图片'));
      return;
    }
    if (files[0]) onFile(files[0]);
  };
  return <section className="create-step-content" aria-labelledby="step-photo-title">
    <div className="create-step-kicker"><span>01 / 04</span><StatusTag tone="neutral">本地保存</StatusTag></div>
    <h1 id="step-photo-title">先让我们认识它</h1>
    <p className="create-lead">上传一张清晰照片，作为它的数字身份起点。照片只会保存在当前演示设备中。</p>

    <label
      className={`create-dropzone ${dragActive ? 'create-dropzone-active' : ''} ${photoError ? 'create-dropzone-error' : ''}`}
      htmlFor="create-photo-input"
      onDragOver={(event) => { event.preventDefault(); onDragStateChange(true); }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={handleDrop}
    >
      <input id="create-photo-input" ref={photoInputRef} className="create-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} aria-describedby="photo-upload-help" />
      <span className="create-upload-icon"><CloudUpload size={28} aria-hidden="true" /></span>
      <strong>{photoStatus === 'loading' ? '正在保存照片…' : '拖拽照片到这里，或点击选择'}</strong>
      <span id="photo-upload-help">JPG / PNG / WebP · 单张不超过 5MB</span>
      <span className="create-upload-action"><Upload size={15} aria-hidden="true" />选择照片</span>
      {photoError && <span className="create-inline-error" role="alert"><CircleAlert size={15} aria-hidden="true" />{photoError}</span>}
    </label>

    {photoUrl && <div className="create-photo-selected">
      <div className="create-selected-image"><img src={photoUrl} alt={exampleSpecies ? `示例${exampleSpecies === 'cat' ? '猫咪' : '狗狗'}照片` : '已选择的宠物照片'} /></div>
      <div className="create-selected-copy">
        <strong>{exampleSpecies ? `已选择示例${exampleSpecies === 'cat' ? '猫咪' : '狗狗'}` : '照片已保存到本机'}</strong>
        <span>{exampleSpecies ? '示例资料会在下一步预填，可继续编辑。' : '这张照片将作为身份卡的原图。'}</span>
      </div>
      <Button variant="secondary" type="button" onClick={onOpenFile}><RefreshCw size={15} aria-hidden="true" />替换照片</Button>
    </div>}

    <div className="create-example-block">
      <div className="create-example-heading"><span>想先体验一下？</span><small>示例资料可随时改成真实信息</small></div>
      <div className="create-example-actions">
        <Button variant={exampleSpecies === 'cat' ? 'primary' : 'secondary'} type="button" onClick={() => onExample('cat')}><PawPrint size={16} aria-hidden="true" />使用示例猫咪</Button>
        <Button variant={exampleSpecies === 'dog' ? 'primary' : 'secondary'} type="button" onClick={() => onExample('dog')}><Dog size={16} aria-hidden="true" />使用示例狗狗</Button>
      </div>
    </div>

    <div className="create-note"><ShieldCheck size={17} aria-hidden="true" /><span>不接入真实 AI 识别。任何颜色、品种和介绍都只会显示为“待确认示例值”，由你亲自确认。</span></div>
  </section>;
}

interface InfoStepProps {
  form: FormValues;
  showValidation: boolean;
  onChange: (patch: Partial<FormValues>) => void;
  onSpeciesChange: (species: PetSpecies) => void;
}

/** 第二步：确认并编辑宠物资料，绝不把上传照片描述成自动识别结果。 */
function InfoStep({ form, showValidation, onChange, onSpeciesChange }: InfoStepProps): JSX.Element {
  const errors = getInfoErrors(form);
  const birthUnknown = form.birthDate === null;
  return <section className="create-step-content" aria-labelledby="step-info-title">
    <div className="create-step-kicker"><span>02 / 04</span><StatusTag tone="pending">待确认示例值</StatusTag></div>
    <h1 id="step-info-title">确认它的基本信息</h1>
    <p className="create-lead">下面的资料由你决定。示例宠物会预填一组演示值，上传照片不会触发任何识别。</p>

    <div className="create-form-grid">
      <label className="create-field create-field-wide" htmlFor="create-pet-name"><span>宠物名 <em>必填</em></span><input id="create-pet-name" value={form.name} maxLength={20} placeholder="例如：Mochi" onChange={(event) => onChange({ name: event.target.value })} aria-invalid={Boolean(showValidation && errors.name)} />{showValidation && errors.name && <small className="create-field-error">{errors.name}</small>}</label>
      <SelectField id="create-species" label="物种（必选）" value={form.species} onChange={(event) => onSpeciesChange(event.target.value as PetSpecies)}>
        <option value="cat">猫</option><option value="dog">狗</option>
      </SelectField>
      <label className="create-field" htmlFor="create-breed"><span>品种 <small>选填</small></span><input id="create-breed" value={form.breed} maxLength={40} placeholder="例如：英短、柴犬" onChange={(event) => onChange({ breed: event.target.value })} /></label>
      <SelectField id="create-gender" label="性别" value={form.gender} onChange={(event) => onChange({ gender: event.target.value as PetGender })}>
        <option value="female">女</option><option value="male">男</option><option value="unknown">未知</option>
      </SelectField>
      <div className="create-field create-date-field">
        <label htmlFor="create-birth-date"><span>生日</span><input id="create-birth-date" type="date" max={getTodayString()} value={form.birthDate ?? ''} disabled={birthUnknown} onChange={(event) => onChange({ birthDate: event.target.value || null })} aria-invalid={Boolean(showValidation && errors.birthDate)} /></label>
        <label className="create-check"><input type="checkbox" checked={birthUnknown} onChange={(event) => onChange({ birthDate: event.target.checked ? null : '' })} />生日未知</label>
        {showValidation && errors.birthDate && <small className="create-field-error">{errors.birthDate}</small>}
      </div>
      <label className="create-field" htmlFor="create-coat-color"><span>毛色 <small>待确认示例值</small></span><input id="create-coat-color" value={form.coatColor} maxLength={40} placeholder="例如：奶油白" onChange={(event) => onChange({ coatColor: event.target.value })} /></label>
      <label className="create-field create-field-wide" htmlFor="create-introduction"><span>介绍 <small>待确认示例值</small></span><textarea id="create-introduction" value={form.introduction} maxLength={180} rows={4} placeholder="写下它的性格或你想记住的一句话" onChange={(event) => onChange({ introduction: event.target.value })} /></label>
    </div>

    <div className="create-note create-note-warm"><CircleAlert size={17} aria-hidden="true" /><span>请核对示例值是否准确；PawID 不会宣称照片识别成功。</span></div>
  </section>;
}

interface AvatarStepProps {
  form: FormValues;
  photoUrl: string | null;
  generation: AvatarGeneration;
  generatedStyle: AvatarStyle | null;
  onStyleChange: (style: AvatarStyle) => void;
  onGenerate: () => void;
}

/** 第三步：风格切换会清空完成态，生成过程用三段约两秒的演示进度表达。 */
function AvatarStep({ form, photoUrl, generation, generatedStyle, onStyleChange, onGenerate }: AvatarStepProps): JSX.Element {
  const isComplete = generation === 'complete' && generatedStyle === form.avatarStyle;
  const phaseLabel = generation === 'analyzing' ? '分析特征' : generation === 'generating' ? '生成形象' : generation === 'complete' ? '完成' : '等待生成';
  return <section className="create-step-content" aria-labelledby="step-avatar-title">
    <div className="create-step-kicker"><span>03 / 04</span><StatusTag tone={isComplete ? 'success' : 'neutral'}>{isComplete ? '预览已完成' : '风格预览'}</StatusTag></div>
    <h1 id="step-avatar-title">选择它的数字形象</h1>
    <p className="create-lead">原图和数字形象并列展示。切换风格后需要重新预览，完成后会标记为“预置形象演示”。</p>

    <div className="create-style-grid" role="radiogroup" aria-label="数字形象风格">
      {AVATAR_STYLES.map((style) => <button key={style.key} type="button" className={`create-style-card ${form.avatarStyle === style.key ? 'create-style-card-active' : ''}`} aria-pressed={form.avatarStyle === style.key} onClick={() => onStyleChange(style.key)}>
        <img src={AVATAR_ASSETS[form.species][style.key]} alt={`${style.label}预览`} />
        <span className="create-style-title">{style.label}</span>
        <span>{style.description}</span>
        {form.avatarStyle === style.key && <span className="create-style-check"><Check size={14} aria-hidden="true" /></span>}
      </button>)}
    </div>

    <div className="create-avatar-compare">
      <div className="create-compare-panel"><span className="create-compare-label">原图</span>{photoUrl ? <img src={photoUrl} alt="宠物原图" /> : <div className="create-compare-empty"><ImagePlus size={24} /><span>照片读取中</span></div>}</div>
      <div className="create-compare-arrow" aria-hidden="true"><ArrowRight size={20} /></div>
      <div className={`create-compare-panel create-digital-panel ${isComplete ? 'create-digital-ready' : ''}`}><span className="create-compare-label">数字形象</span><img src={form.avatarAssetPath} alt={`${form.name || '宠物'}的数字形象预览`} />{isComplete && <span className="create-preset-badge">预置形象演示</span>}</div>
    </div>

    <div className="create-generation-box" aria-live="polite">
      <div className="create-generation-head"><span><Sparkles size={17} aria-hidden="true" />{phaseLabel}</span>{generation !== 'idle' && generation !== 'complete' && <LoaderCircle className="create-spin" size={17} aria-hidden="true" />}</div>
      <div className="create-generation-track">{['分析特征', '生成形象', '完成'].map((label, index) => {
        const phaseIndex = generation === 'analyzing' ? 0 : generation === 'generating' ? 1 : generation === 'complete' ? 2 : -1;
        return <span className={index <= phaseIndex ? 'create-generation-active' : ''} key={label}><i>{index < phaseIndex || generation === 'complete' ? <Check size={12} /> : index + 1}</i>{label}</span>;
      })}</div>
      <Button type="button" variant={isComplete ? 'secondary' : 'primary'} onClick={onGenerate} disabled={generation === 'analyzing' || generation === 'generating'}><Sparkles size={16} aria-hidden="true" />{isComplete ? '重新生成预览' : '生成数字形象'}</Button>
    </div>
  </section>;
}

interface ReviewStepProps {
  form: FormValues;
  reviewConfirmed: boolean;
  showValidation: boolean;
  submissionPhase: SubmissionPhase;
  submissionError: string | null;
  createdPet: Pet | null;
  onReviewChange: (confirmed: boolean) => void;
}

/** 第四步：创建前展示姓名、形象、生日、监护人与公开字段，成功后展示身份卡。 */
function ReviewStep({ form, reviewConfirmed, showValidation, submissionPhase, submissionError, createdPet, onReviewChange }: ReviewStepProps): JSX.Element {
  if (submissionPhase === 'success' && createdPet) {
    return <section className="create-success" aria-labelledby="create-success-title">
      <div className="create-success-icon"><BadgeCheck size={42} aria-hidden="true" /></div>
      <StatusTag tone="success">成功</StatusTag>
      <h1 id="create-success-title">{createdPet.name} 的 PawID 已生成</h1>
      <p>身份资料已保存在演示环境，接下来可以进入它的数字世界。</p>
      <div className="create-success-card">
        <div className="create-success-card-head"><span>PAWID IDENTITY CARD</span><StatusTag tone="success">100 PAWS</StatusTag></div>
        <div className="create-success-card-main"><img src={createdPet.avatarAssetPath} alt={`${createdPet.name}的数字形象`} /><div><strong>{createdPet.name}</strong><span>{createdPet.species === 'cat' ? '猫' : '狗'} · {createdPet.breed || '品种待补充'}</span><span>预置形象演示</span></div></div>
        <div className="create-success-data"><div><span>宠物 ID</span><code>{createdPet.id}</code></div><div><span>模拟账户</span><code>{createdPet.identityAccount.address}</code></div><div><span>网络</span><strong>{createdPet.identityAccount.network}</strong></div></div>
      </div>
      <div className="create-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <a className="create-world-link" href={`#/pets/${createdPet.id}?tab=overview`}>进入它的数字世界 <ArrowRight size={17} aria-hidden="true" /></a>
    </section>;
  }

  const birthLabel = form.birthDate || '未知';
  const styleLabel = AVATAR_STYLES.find((style) => style.key === form.avatarStyle)?.label ?? '3D 萌宠';
  const isSubmitting = submissionPhase === 'confirming' || submissionPhase === 'generating';
  return <section className="create-step-content" aria-labelledby="step-review-title">
    <div className="create-step-kicker"><span>04 / 04</span><StatusTag tone={isSubmitting ? 'pending' : submissionPhase === 'error' ? 'danger' : 'neutral'}>{isSubmitting ? (submissionPhase === 'confirming' ? '确认中' : '身份生成中') : submissionPhase === 'error' ? '创建失败，可重试' : '最后确认'}</StatusTag></div>
    <h1 id="step-review-title">创建它的 PawID</h1>
    <p className="create-lead">确认这些信息后，PawID 会在演示环境中生成一张身份卡和模拟账户。</p>

    <div className="create-review-grid">
      <div className="create-review-block"><span className="create-review-label">身份姓名</span><strong>{form.name || '未填写'}</strong><span>{form.species === 'cat' ? '猫' : '狗'} · {form.breed || '品种待补充'}</span></div>
      <div className="create-review-block"><span className="create-review-label">数字形象</span><strong>{styleLabel}</strong><span>预置形象演示</span></div>
      <div className="create-review-block"><span className="create-review-label">生日</span><strong>{birthLabel}</strong><span>生日可在身份资料中继续补充</span></div>
      <div className="create-review-block"><span className="create-review-label">主监护人</span><strong>小林</strong><span>主监护人 · 已确认</span></div>
    </div>

    <div className="create-public-fields"><div className="create-public-heading"><span>公开字段</span><small>这些字段将出现在 PawTag 公开资料中</small></div><div className="create-public-list">{[
      ['姓名', form.name || '待填写'], ['物种', form.species === 'cat' ? '猫' : '狗'], ['品种', form.breed || '待补充'], ['性别', form.gender === 'female' ? '女' : form.gender === 'male' ? '男' : '未知'], ['生日', birthLabel], ['毛色', form.coatColor || '待补充'], ['介绍', form.introduction || '待补充'],
    ].map(([label, value]) => <span key={label}><Check size={14} aria-hidden="true" />{label}<strong>{value}</strong></span>)}</div></div>

    <label className={`create-confirm-check ${showValidation && !reviewConfirmed ? 'create-confirm-check-error' : ''}`}><input type="checkbox" checked={reviewConfirmed} onChange={(event) => onReviewChange(event.target.checked)} /><span>我已确认姓名、形象、生日、主监护人与公开字段。</span></label>
    {showValidation && !reviewConfirmed && <p className="create-field-error" role="alert">请先确认以上信息，再创建 PawID。</p>}
    {submissionError && <div className="create-submit-error" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>这次创建没有写入数据</strong><span>{submissionError}</span><small>你的输入和草稿都已保留，可以直接重试。</small></div></div>}
    {isSubmitting && <div className="create-submit-progress" aria-live="polite"><LoaderCircle className="create-spin" size={18} aria-hidden="true" /><span>{submissionPhase === 'confirming' ? '确认中…' : '身份生成中…'}</span></div>}
  </section>;
}

interface PreviewCardProps {
  form: FormValues;
  photoUrl: string | null;
  step: number;
}

/** 右侧身份卡预览，桌面常驻、手机通过 details 折叠，避免挤压表单。 */
function PreviewCard({ form, photoUrl, step }: PreviewCardProps): JSX.Element {
  return <div className="create-preview-card">
    <div className="create-preview-top"><span>PAWID / IDENTITY</span><span className="create-preview-step">{String(step).padStart(2, '0')} / 04</span></div>
    <div className="create-preview-orbit"><div className="create-preview-photo">{photoUrl ? <img src={photoUrl} alt="身份卡原图预览" /> : <ImagePlus size={28} aria-hidden="true" />}</div><div className="create-preview-plus" aria-hidden="true">+</div><div className="create-preview-avatar"><img src={form.avatarAssetPath} alt="身份卡数字形象预览" /></div></div>
    <div className="create-preview-name"><span>{form.name || '等待命名'}</span><StatusTag tone="neutral">演示身份</StatusTag></div>
    <div className="create-preview-meta"><span>{form.species === 'cat' ? '猫' : '狗'}</span><i /> <span>{form.breed || '品种待补充'}</span><i /> <span>{form.birthDate || '生日未知'}</span></div>
    <div className="create-preview-divider" />
    <div className="create-preview-footer"><span><ShieldCheck size={15} aria-hidden="true" />主监护人：小林</span><span><WalletCards size={15} aria-hidden="true" />100 PAWS · 模拟</span></div>
    <div className="create-preview-caption">完成后生成身份卡</div>
  </div>;
}

/** 统一读取并保存四步创建身份向导的草稿、图片与提交状态。 */
export default function CreateWizard(): JSX.Element {
  const { state, actions } = useDemoStore();
  const initialDraft = useMemo(() => formFromDraft(state.createDraft), [state.createDraft]);
  const [form, setForm] = useState<FormValues>(initialDraft);
  const [step, setStep] = useState(() => Math.min(4, Math.max(1, state.createDraft?.step ?? 1)));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>(initialDraft.photoKey ? 'loading' : 'idle');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [avatarGeneration, setAvatarGeneration] = useState<AvatarGeneration>('idle');
  const [generatedStyle, setGeneratedStyle] = useState<AvatarStyle | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [createdPet, setCreatedPet] = useState<Pet | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(`create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const initialPetIdsRef = useRef(new Set(state.pets.map((pet) => pet.id)));
  const submissionStartedRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const avatarPhaseTimerRef = useRef<number | null>(null);
  const avatarCompleteTimerRef = useRef<number | null>(null);
  const saveDraftRef = useRef(actions.saveCreateDraft);

  /** 清理数字形象生成计时器，防止切换风格后旧流程覆盖新预览。 */
  const clearAvatarTimers = (): void => {
    if (avatarPhaseTimerRef.current !== null) {
      window.clearTimeout(avatarPhaseTimerRef.current);
      avatarPhaseTimerRef.current = null;
    }
    if (avatarCompleteTimerRef.current !== null) {
      window.clearTimeout(avatarCompleteTimerRef.current);
      avatarCompleteTimerRef.current = null;
    }
  };

  /** 让草稿保存函数始终指向最新 Store action，避免保存 effect 形成循环。 */
  useEffect(() => {
    saveDraftRef.current = actions.saveCreateDraft;
  }, [actions]);

  /** 刷新恢复后从 IndexedDB 读取照片，并在每次替换时释放旧的 object URL。 */
  useEffect(() => {
    const photoKey = form.photoKey;
    if (!photoKey) {
      setPhotoUrl(null);
      setPhotoStatus('idle');
      return undefined;
    }
    const exampleSpecies = photoKey === EXAMPLE_PHOTO_KEYS.cat ? 'cat' : photoKey === EXAMPLE_PHOTO_KEYS.dog ? 'dog' : null;
    if (exampleSpecies) {
      setPhotoUrl(EXAMPLE_PHOTOS[exampleSpecies]);
      setPhotoStatus('ready');
      setPhotoError(null);
      return undefined;
    }
    let disposed = false;
    let objectUrl: string | null = null;
    setPhotoStatus('loading');
    void getImage(photoKey).then((blob) => {
      if (disposed) return;
      if (!blob) throw new Error('照片记录不存在');
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
      setPhotoStatus('ready');
      setPhotoError(null);
    }).catch(() => {
      if (disposed) return;
      setPhotoUrl(null);
      setPhotoStatus('error');
      setPhotoError('照片暂时无法读取，图片存储可能不可用。请重新选择，或使用示例猫咪/示例狗狗。');
    });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [form.photoKey]);

  /** 组件销毁时释放计时器和最后一张 object URL，避免重复创建造成资源泄漏。 */
  useEffect(() => () => {
    if (progressTimerRef.current !== null) window.clearTimeout(progressTimerRef.current);
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    clearAvatarTimers();
  }, []);

  /** 仅在可编辑或失败状态自动保存草稿，创建处理中不重新写回已清空的草稿。 */
  const draft = useMemo<CreateDraft>(() => ({ ...form, step }), [form, step]);
  useEffect(() => {
    if (submissionPhase === 'idle' || submissionPhase === 'error') saveDraftRef.current(draft);
  }, [draft, submissionPhase]);

  /** createPet 返回后从 Store 找到本次新增宠物，并将成功展示延迟到约两秒完成。 */
  useEffect(() => {
    if (createdPet || (submissionPhase !== 'confirming' && submissionPhase !== 'generating')) return;
    const newPet = state.pets.find((pet) => !initialPetIdsRef.current.has(pet.id));
    if (!newPet) return;
    setCreatedPet(newPet);
    const startedAt = submissionStartedRef.current ?? Date.now();
    const remaining = Math.max(0, 1900 - (Date.now() - startedAt));
    completionTimerRef.current = window.setTimeout(() => setSubmissionPhase('success'), remaining);
  }, [createdPet, state.pets, submissionPhase]);

  /** 更新任意表单字段并清除上一次的阻塞提示。 */
  const updateForm = (patch: Partial<FormValues>): void => {
    setForm((current) => ({ ...current, ...patch }));
    setValidationAttempted(false);
  };

  /** 选择猫狗示例，同时预填可编辑资料并替换本地照片预览。 */
  const handleExample = (species: PetSpecies): void => {
    const previousKey = form.photoKey;
    const profile = EXAMPLE_PROFILES[species];
    setForm({ ...profile, photoKey: EXAMPLE_PHOTO_KEYS[species], avatarAssetPath: AVATAR_ASSETS[species]['3d'] });
    setPhotoUrl(EXAMPLE_PHOTOS[species]);
    setPhotoStatus('ready');
    setPhotoError(null);
    clearAvatarTimers();
    setAvatarGeneration('idle');
    setGeneratedStyle(null);
    setValidationAttempted(false);
    if (previousKey && !previousKey.startsWith('example-')) void deleteImage(previousKey).catch(() => undefined);
  };

  /** 保存用户上传的 Blob，失败时保留原输入并引导使用示例图片。 */
  const handlePhotoFile = (file: File): void => {
    const fileError = file.name === '多张图片' ? '一次只能上传一张图片。' : validatePhotoFile(file);
    if (fileError) {
      setPhotoError(fileError);
      return;
    }
    const previousKey = form.photoKey;
    const photoKey = `${requestIdRef.current}-photo-${Date.now()}`;
    setPhotoStatus('loading');
    setPhotoError(null);
    void saveImage(photoKey, file).then(() => {
      setForm((current) => ({ ...current, photoKey }));
      setPhotoStatus('loading');
      setPhotoError(null);
      if (previousKey && !previousKey.startsWith('example-')) void deleteImage(previousKey).catch(() => undefined);
    }).catch((error: unknown) => {
      setPhotoStatus(previousKey ? 'ready' : 'idle');
      setPhotoError(`照片保存失败：${getErrorMessage(error, '当前设备拒绝了图片存储')}。请重试，或改用示例猫咪/示例狗狗。`);
    });
  };

  /** 选择数字形象风格，切换后必须重新走生成预览流程。 */
  const handleAvatarStyle = (style: AvatarStyle): void => {
    clearAvatarTimers();
    setForm((current) => ({ ...current, avatarStyle: style, avatarAssetPath: AVATAR_ASSETS[current.species][style] }));
    setAvatarGeneration('idle');
    setGeneratedStyle(null);
    setValidationAttempted(false);
  };

  /** 以三个阶段和固定短延迟模拟数字形象生成，不接入真实 AI。 */
  const handleGenerateAvatar = (): void => {
    if (avatarGeneration === 'analyzing' || avatarGeneration === 'generating') return;
    clearAvatarTimers();
    const selectedStyle = form.avatarStyle;
    setAvatarGeneration('analyzing');
    avatarPhaseTimerRef.current = window.setTimeout(() => {
      avatarPhaseTimerRef.current = null;
      setAvatarGeneration('generating');
    }, 680);
    avatarCompleteTimerRef.current = window.setTimeout(() => {
      avatarCompleteTimerRef.current = null;
      setAvatarGeneration('complete');
      setGeneratedStyle(selectedStyle);
    }, 1500);
  };

  /** 当前步骤的最小可检查条件，任何失败都停留在当前步骤。 */
  const validateCurrentStep = (): string | null => {
    if (step === 1) {
      if (!form.photoKey) return '请先上传照片，或选择一张示例照片。';
      if (photoStatus === 'loading') return '照片仍在保存或读取，请稍候。';
      if (photoStatus !== 'ready' || photoError) return '照片不可用，请重新选择，或使用示例猫咪/示例狗狗。';
    }
    if (step === 2) {
      const errors = getInfoErrors(form);
      if (errors.name) return errors.name;
      if (errors.birthDate) return errors.birthDate;
    }
    if (step === 3 && (avatarGeneration !== 'complete' || generatedStyle !== form.avatarStyle)) return '请先生成当前风格的数字形象预览。';
    if (step === 4 && !reviewConfirmed) return '请先确认姓名、形象、生日、主监护人与公开字段。';
    return null;
  };

  /** 处理底部下一步或创建按钮，创建按钮只在第四步调用一次稳定 requestId。 */
  const handleNext = (): void => {
    if (submissionPhase === 'confirming' || submissionPhase === 'generating' || submissionPhase === 'success') return;
    const error = validateCurrentStep();
    if (error) {
      setValidationAttempted(true);
      return;
    }
    setValidationAttempted(false);
    if (step < 4) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    submissionStartedRef.current = Date.now();
    setSubmissionError(null);
    setCreatedPet(null);
    setSubmissionPhase('confirming');
    progressTimerRef.current = window.setTimeout(() => setSubmissionPhase((current) => current === 'confirming' ? 'generating' : current), 620);
    void actions.createPet({
      requestId: requestIdRef.current,
      name: form.name.trim(), species: form.species, breed: form.breed.trim(), gender: form.gender,
      birthDate: form.birthDate || null, coatColor: form.coatColor.trim(), introduction: form.introduction.trim(),
      photoKey: form.photoKey, avatarStyle: form.avatarStyle, avatarAssetPath: form.avatarAssetPath,
    }).then(() => {
      setSubmissionPhase((current) => current === 'confirming' ? 'generating' : current);
    }).catch((error: unknown) => {
      if (progressTimerRef.current !== null) window.clearTimeout(progressTimerRef.current);
      if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
      setSubmissionError(getErrorMessage(error, '创建失败，请稍后重试。'));
      setSubmissionPhase('error');
    });
  };

  /** 失败时允许回到上一步修订资料，成功和处理中不允许离开当前提交流程。 */
  const handlePrevious = (): void => {
    if (submissionPhase === 'confirming' || submissionPhase === 'generating' || submissionPhase === 'success') return;
    if (step > 1) {
      setStep((current) => current - 1);
      setValidationAttempted(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /** 选择物种时同步切换数字形象素材，避免出现猫狗资料与图形不一致。 */
  const handleSpecies = (species: PetSpecies): void => {
    clearAvatarTimers();
    setForm((current) => ({ ...current, species, avatarAssetPath: AVATAR_ASSETS[species][current.avatarStyle] }));
    setAvatarGeneration('idle');
    setGeneratedStyle(null);
    setValidationAttempted(false);
  };

  /** 离开向导前打开保留或清除草稿的明确选择，不使用浏览器拦截。 */
  const requestLeave = (): void => {
    if (submissionPhase === 'confirming' || submissionPhase === 'generating') return;
    setLeaveOpen(true);
  };

  /** 保留当前草稿并返回应用首页。 */
  const leaveWithDraft = (): void => {
    saveDraftRef.current(draft);
    setLeaveOpen(false);
    window.location.hash = '#/';
  };

  /** 清除当前草稿并返回应用首页，图片由下一次示例或上传操作替换。 */
  const leaveWithoutDraft = (): void => {
    actions.clearCreateDraft();
    setLeaveOpen(false);
    window.location.hash = '#/';
  };

  const isSubmitting = submissionPhase === 'confirming' || submissionPhase === 'generating';
  const stepContent = step === 1
    ? <PhotoStep form={form} photoUrl={photoUrl} photoStatus={photoStatus} photoError={photoError} dragActive={dragActive} onDragStateChange={setDragActive} onFile={handlePhotoFile} onExample={handleExample} onOpenFile={() => fileInputRef.current?.click()} photoInputRef={fileInputRef} />
    : step === 2
      ? <InfoStep form={form} showValidation={validationAttempted} onChange={updateForm} onSpeciesChange={handleSpecies} />
      : step === 3
        ? <AvatarStep form={form} photoUrl={photoUrl} generation={avatarGeneration} generatedStyle={generatedStyle} onStyleChange={handleAvatarStyle} onGenerate={handleGenerateAvatar} />
        : <ReviewStep form={form} reviewConfirmed={reviewConfirmed} showValidation={validationAttempted} submissionPhase={submissionPhase} submissionError={submissionError} createdPet={createdPet} onReviewChange={(confirmed) => { setReviewConfirmed(confirmed); setValidationAttempted(false); }} />;

  return <div className="create-page">
    <header className="create-header"><button className="create-header-back" type="button" onClick={requestLeave}><ArrowLeft size={17} aria-hidden="true" />返回</button><div className="create-header-brand"><span className="create-header-mark"><PawPrint size={17} aria-hidden="true" /></span><strong>PawID</strong><span>创建身份</span></div><DemoBadge /></header>
    <main className="create-main">
      <div className="create-intro"><div><span className="create-eyebrow">A DIGITAL IDENTITY, MADE WITH CARE</span><h2>给它一张会成长的数字身份证</h2></div><button className="create-abandon" type="button" onClick={requestLeave}>放弃草稿</button></div>
      <WizardProgress step={step} />
      <div className="create-layout">
        <div className="create-form-column">{stepContent}
          {validationAttempted && validateCurrentStep() && step !== 2 && <p className="create-step-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{validateCurrentStep()}</p>}
          {submissionPhase !== 'success' && <div className="create-navigation"><Button variant="secondary" type="button" onClick={handlePrevious} disabled={step === 1 || isSubmitting}>{step === 1 ? '上一步' : <><ArrowLeft size={16} aria-hidden="true" />上一步</>}</Button><Button type="button" onClick={handleNext} disabled={isSubmitting}>{step < 4 ? <>下一步<ArrowRight size={16} aria-hidden="true" /></> : <>{submissionPhase === 'error' ? '重试创建' : '创建 PawID'}<Sparkles size={16} aria-hidden="true" /></>}</Button></div>}
        </div>
        <aside className="create-preview-column" aria-label="身份卡预览"><div className="create-preview-heading"><span>实时预览</span><small>你的每一步都会在这里留下痕迹</small></div><PreviewCard form={form} photoUrl={photoUrl} step={step} /></aside>
      </div>
      <details className="create-preview-mobile"><summary><span>查看身份卡预览</span><span>展开</span></summary><PreviewCard form={form} photoUrl={photoUrl} step={step} /></details>
    </main>
    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="要如何处理这份草稿？"><div className="create-leave-dialog"><p>离开创建向导前，你可以保留当前输入，之后回来继续；也可以清除这份草稿，从头开始。</p><div className="create-leave-actions"><Button variant="secondary" type="button" onClick={leaveWithDraft}>保留草稿并返回</Button><Button variant="danger" type="button" onClick={leaveWithoutDraft}>清除草稿并返回</Button></div></div></Modal>
  </div>;
}
