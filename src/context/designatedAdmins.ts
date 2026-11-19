export interface DesignatedAdminAccount {
  username: string
  aliases: string[]
  password: string
  email: string
  displayName: string
}

/**
 * Designated Placement Administrators
 * Required accounts with full administrative privileges:
 * 1. GMercy / Diya@291018
 * 2. DMoksha / KA51HA4142
 * 3. Surya / sreyash@6714369 (also accepts alias sreyash)
 */
export const DESIGNATED_ADMIN_ACCOUNTS: DesignatedAdminAccount[] = [
  {
    username: 'GMercy',
    aliases: ['gmercy', 'gmercy@gitam.in'],
    password: 'Diya@291018',
    email: 'gmercy@gitam.in',
    displayName: 'GMercy',
  },
  {
    username: 'DMoksha',
    aliases: ['dmoksha', 'dmoksha@gitam.in'],
    password: 'KA51HA4142',
    email: 'dmoksha@gitam.in',
    displayName: 'DMoksha',
  },
  {
    username: 'Surya',
    aliases: ['surya', 'surya@gitam.in', 'sreyash', 'sreyash@gitam.in'],
    password: 'sreyash@6714369',
    email: 'surya@gitam.in',
    displayName: 'Surya',
  },
]
