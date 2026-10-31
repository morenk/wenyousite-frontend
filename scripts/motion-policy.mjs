/** Web 动效接入门禁；数值来自已锁定 Foundation，等待时长与 toast 生存期不属于过渡。 */
export function motionViolations(source, file) {
  const rules = [
    [/\btransition-all\b/u, "禁止不可界定的 transition-all"],
    [/\btransition-\[width\]/u, "进度不能通过 width 逐帧布局"],
    [/\bduration-(?:\d|\[\d)/u, "动效时长必须使用 Foundation Token"],
    [/transition=\{\{[^}]*\bduration:\s*[\d.]/su, "JS 过渡必须使用共享 motion 接入"],
    [/\.animate\??\.?(?:\([^;]*?\bduration:\s*\d)/su, "Web Animation 必须使用共享 motion Token"],
    [/behavior:\s*["']smooth["']/u, "滚动必须通过减少动画偏好选择 behavior"],
  ];
  if (file.endsWith(".css")) rules.push([/transition\s*:[^;]*\b\d+(?:ms|s)\b/su, "CSS 过渡必须使用 Foundation Token"]);
  return rules.flatMap(([pattern, message]) => pattern.test(source) ? [message] : []);
}
