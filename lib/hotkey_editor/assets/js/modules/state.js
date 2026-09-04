export const state = {
  // Data
  sounds:        [],
  hotkeys:       {},
  groupNames:    {},
  displayNames:  {},
  categories:    [],
  soundCategories: {},
  phrases: {},
  interfaceHotkeys: {},
  projectVolumeDb: 0,
  profileVolumeDb: 0,
  categoryVolumeDb: {},
  fileVolumeOffsets: {},
  activeVolumeStem: null,
  layoutMixerSort: localStorage.getItem('hk-layout-mixer-sort') || 'effective-desc',
  layoutSceneSearch: '',
  layoutSceneFilter: 'all',
  hotkeyTesterEnabled: false,
  hotkeyTesterBuffer: '',
  hotkeyTesterStatus: '',
  emptyGroups:   [],
  unboundGroups: [],

  // Profile / project
  activeProfile: 'default',
  liveProfile:   'default',
  profileNames:  ['default'],
  profileTriggerSequences: '',
  projects:      [],
  configSettings: {},
  configFields:   [],
  canCreateProfiles: false,

  // UI state
  selected:     null,
  activeFilter: 'all',
  libraryShow:  'all',
  mediaTypeFilter: 'all',
  activeCategoryFilter: 'all',
  rightMode: 'hotkeys',
  categoryPanelQuery: '',
  searchQuery:  '',
  dirty:        false,
  sortMode:     localStorage.getItem('hk-sort') || 'recent-first',
  groupCardWidth: Number(localStorage.getItem('hk-group-card-width') || 205),
  settingsOpen: false,
  mediaProfileCreateOpen: false,
  layoutData:   null,
  layoutRules:  {},
  layoutOverrides: {},
  layoutSection: 'canvas',
  layoutSelectedGroup: null,
  layoutFilterDimension: null,
  layoutFilterCategory: 'all',
  layoutEditingStem: null,
  layoutZoom: 1,
  layoutLoading: false,
  layoutDirty: false,
  layoutStatus: '',
  layoutApplyResult: null,
  layoutPropertyScope: 'group',
  layoutSourceControlsOpen: localStorage.getItem('hk-layout-source-controls-open') === '1',
  layoutPropertyGroups: [],
  layoutPropertyStatus: '',
  layoutVisibilityStatus: '',
  layoutVolumeDb: null,
  layoutVolumeScope: 'group',
  layoutVolumeCategory: 'all',
  layoutVolumeHotkey: '',
  layoutVolumeMode: 'add-offset',
  layoutVolumeValue: 0,
  layoutVolumeSearch: '',
  layoutVolumeStatus: '',

  // Current project identity (set by applyServerData)
  currentProjectKey: '',
  currentAssetDir: '',

  // Move Assets
  moveAssetsPending: [],
  moveAssetsStatus: '',

  // Preview
  previewStem:      null,
  previewEl:        null,
  previewUrlObject: null,

  // Drag
  dragStem: null,
  dragStems: [],
  multiSelectedStems: new Set(),
  multiSelectAnchorStem: null,

  // Media cache
  mediaBlobUrlCache: new Map(),

  // Undo stacks
  undoStack:       [],
  fileUndoStacks:  {},
  groupUndoStacks: {},

  // Hover timers
  chipHoverTimer:             null,
  groupHoverTimer:            null,
  hoverLinkedKey:             null,
  hoverLinkedGroupClearTimer: null,
  hoverLinkedStem:            null,
  hoverLinkedClearTimer:      null,

  // Pending key-capture modes
  pendingGroupRebindKey:   null,
  pendingEmptyGroupCreate: false,
  pendingUnboundBind:      null,

  // Volume
  volume:  0.64,
  volumeLevel: 0.8,
  lastVol: 0.64,
  lastVolLevel: 0.8,
};
