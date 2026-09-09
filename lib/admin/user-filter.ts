export type UserDirectoryRow = {
  email: string | null
  role: 'admin' | 'viewer'
}

export function filterUserDirectory<T extends UserDirectoryRow>(
  users: T[],
  search: string,
  role: 'all' | 'admin' | 'viewer',
) {
  const query = search.trim().toLocaleLowerCase()
  return users.filter((user) =>
    (role === 'all' || user.role === role) &&
    (!query || (user.email ?? '').toLocaleLowerCase().includes(query)),
  )
}

