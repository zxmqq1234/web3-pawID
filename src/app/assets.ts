/** 将种子中的旧素材路径映射到实际 public/assets 目录。 */
export function resolveAvatarAssetPath(path: string, species: 'cat' | 'dog'): string {
  if (path.startsWith('/assets/') || path.startsWith('data:')) return path;

  const style = path.match(/(?:^|[-_/])(3d|pixel|illustration)(?:\.svg|$)/)?.[1] ?? '3d';
  return `/assets/avatars/${species}-${style}.svg`;
}
