const ICON_MAP = {
  trophy: 'military_tech',
  sword: 'swords',
  users: 'groups',
  'chart-bar': 'leaderboard',
  'calendar-event': 'event',
  settings: 'settings',
  bell: 'notifications',
  'shield-check': 'verified_user',
  star: 'star',
  home: 'home',
  logout: 'logout',
  search: 'search',
  plus: 'add',
  refresh: 'refresh',
  filter: 'filter_list',
  'chevron-right': 'chevron_right',
  check: 'check_circle',
  lock: 'lock',
  'info-circle': 'info',
  'alert-triangle': 'warning',
  crown: 'workspace_premium',
  share: 'share',
  'user-plus': 'person_add',
  'help-circle': 'help',
  dashboard: 'dashboard',
  'account-tree': 'account_tree',
  'sports-esports': 'sports_esports',
}

export function mapIcon(name) {
  return ICON_MAP[name] || name
}
