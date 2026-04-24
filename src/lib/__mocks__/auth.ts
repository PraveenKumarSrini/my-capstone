export const auth = jest.fn().mockResolvedValue(null)
export const handlers = { GET: jest.fn(), POST: jest.fn() }
export const signIn = jest.fn()
export const signOut = jest.fn()
export const unstable_update = jest.fn()
