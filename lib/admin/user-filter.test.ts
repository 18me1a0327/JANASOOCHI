import { describe, expect, it } from 'vitest'

import { filterUserDirectory } from './user-filter'

const users = [
  { id: '1', email: 'admin@example.com', role: 'admin' as const },
  { id: '2', email: 'viewer@example.com', role: 'viewer' as const },
  { id: '3', email: null, role: 'viewer' as const },
]

describe('administration user directory filters', () => {
  it('matches email case-insensitively without changing the directory', () => {
    expect(filterUserDirectory(users, 'ADMIN@EXAMPLE', 'all').map((user) => user.id)).toEqual(['1'])
    expect(users).toHaveLength(3)
  })

  it('combines email and role with AND logic', () => {
    expect(filterUserDirectory(users, 'example.com', 'viewer').map((user) => user.id)).toEqual(['2'])
  })

  it('safely handles empty emails and filters', () => {
    expect(filterUserDirectory(users, '', 'all')).toHaveLength(3)
    expect(filterUserDirectory(users, 'missing', 'all')).toEqual([])
  })
})

