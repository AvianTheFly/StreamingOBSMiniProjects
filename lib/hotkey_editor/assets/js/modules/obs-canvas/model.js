export const NUMERIC_FIELDS = [
  'positionX', 'positionY', 'boundsWidth', 'boundsHeight',
  'cropLeft', 'cropTop', 'cropRight', 'cropBottom',
  'scaleX', 'scaleY', 'rotation', 'alignment', 'boundsAlignment',
];

export function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round(value) {
  return Math.round(number(value));
}

export function canvasSize(layoutData) {
  const canvas = layoutData?.canvas || {};
  const width = number(canvas.baseWidth || canvas.outputWidth, 1920);
  const height = number(canvas.baseHeight || canvas.outputHeight, 1080);
  return { width, height };
}

export function layoutGroups(layoutData) {
  return Array.isArray(layoutData?.groups) ? layoutData.groups : [];
}

export function sourceNameForSound(layoutData, sound) {
  // In single-source mode all sounds share one OBS source; return it directly.
  if (layoutData?.singleSourceName) return layoutData.singleSourceName;
  return `${layoutData?.prefix || ''}${sound.stem}`;
}

export function firstObsTransformForGroup(layoutData, group) {
  const transforms = layoutData?.transforms || {};
  for (const sound of group?.sounds || []) {
    const transform = transforms[sourceNameForSound(layoutData, sound)];
    if (transform) return transform;
  }
  return null;
}

export function normalizeLayoutRule(raw, group = null) {
  const rule = { ...(raw || {}) };
  NUMERIC_FIELDS.forEach(field => { rule[field] = number(rule[field], 0); });

  const sourceWidth = Math.max(1, number(group?.width, rule.sourceWidth || rule.width || 1));
  const sourceHeight = Math.max(1, number(group?.height, rule.sourceHeight || rule.height || 1));

  if (!rule.boundsWidth) rule.boundsWidth = sourceWidth * (rule.scaleX || 1);
  if (!rule.boundsHeight) rule.boundsHeight = sourceHeight * (rule.scaleY || 1);
  rule.scaleX = rule.boundsWidth / sourceWidth;
  rule.scaleY = rule.boundsHeight / sourceHeight;

  rule.cropLeft = Math.max(0, Math.min(sourceWidth - 1, rule.cropLeft));
  rule.cropRight = Math.max(0, Math.min(sourceWidth - rule.cropLeft - 1, rule.cropRight));
  rule.cropTop = Math.max(0, Math.min(sourceHeight - 1, rule.cropTop));
  rule.cropBottom = Math.max(0, Math.min(sourceHeight - rule.cropTop - 1, rule.cropBottom));

  rule.boundsType = 'OBS_BOUNDS_NONE';
  rule.alignment = number(rule.alignment, 5);
  rule.boundsAlignment = number(rule.boundsAlignment, 0);
  rule.rotation = number(rule.rotation, 0);
  return rule;
}

export function ruleFromObsTransform(transform, group) {
  const sourceWidth = Math.max(1, number(group?.width, 1));
  const sourceHeight = Math.max(1, number(group?.height, 1));
  const scaleX = number(transform?.scaleX ?? transform?.scale_x, 1) || 1;
  const scaleY = number(transform?.scaleY ?? transform?.scale_y, 1) || 1;
  const boundsWidth = number(
    transform?.boundsWidth ?? transform?.bounds_width ?? transform?.width,
    sourceWidth * scaleX,
  );
  const boundsHeight = number(
    transform?.boundsHeight ?? transform?.bounds_height ?? transform?.height,
    sourceHeight * scaleY,
  );
  const cropLeft = number(transform?.cropLeft ?? transform?.crop_left ?? 0);
  const cropTop = number(transform?.cropTop ?? transform?.crop_top ?? 0);
  return normalizeLayoutRule({
    positionX: number(transform?.positionX ?? transform?.position_x ?? 0) - cropLeft * scaleX,
    positionY: number(transform?.positionY ?? transform?.position_y ?? 0) - cropTop * scaleY,
    boundsWidth,
    boundsHeight,
    cropLeft,
    cropTop,
    cropRight: transform?.cropRight ?? transform?.crop_right ?? 0,
    cropBottom: transform?.cropBottom ?? transform?.crop_bottom ?? 0,
    scaleX: boundsWidth / sourceWidth,
    scaleY: boundsHeight / sourceHeight,
    rotation: transform?.rotation ?? 0,
  }, group);
}

export function defaultLayoutRuleForGroup(group, layoutData = null, { fromObs = false } = {}) {
  const current = fromObs ? firstObsTransformForGroup(layoutData, group) : null;
  if (current) return ruleFromObsTransform(current, group);

  const sourceWidth = Math.max(1, number(group?.width, 320));
  const sourceHeight = Math.max(1, number(group?.height, 240));
  return normalizeLayoutRule({
    positionX: 0,
    positionY: 0,
    boundsWidth: sourceWidth,
    boundsHeight: sourceHeight,
    scaleX: 1,
    scaleY: 1,
    cropLeft: 0,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    boundsType: 'OBS_BOUNDS_NONE',
    alignment: 5,
    boundsAlignment: 0,
  }, group);
}

export function layoutRulesEqual(left, right, epsilon = 0.01) {
  const keys = [
    'positionX', 'positionY', 'boundsWidth', 'boundsHeight',
    'cropLeft', 'cropTop', 'cropRight', 'cropBottom',
    'scaleX', 'scaleY', 'rotation', 'alignment', 'boundsAlignment',
  ];
  for (const key of keys) {
    if (Math.abs(number(left?.[key], 0) - number(right?.[key], 0)) > epsilon) return false;
  }
  return String(left?.boundsType || 'OBS_BOUNDS_NONE') === String(right?.boundsType || 'OBS_BOUNDS_NONE');
}
