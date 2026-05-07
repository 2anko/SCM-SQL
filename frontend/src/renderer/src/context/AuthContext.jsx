import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

function parseJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('scm_token'))
  const [user, setUser] = useState(() => {
    const t = sessionStorage.getItem('scm_token')
    return t ? parseJwt(t) : null
  })

  // Listen for 401 responses from the API client
  useEffect(() => {
    const handle = () => logout()
    window.addEventListener('scm:unauthorized', handle)
    return () => window.removeEventListener('scm:unauthorized', handle)
  }, [])

  function login(newToken) {
    sessionStorage.setItem('scm_token', newToken)
    setToken(newToken)
    setUser(parseJwt(newToken))
  }

  function logout() {
    sessionStorage.removeItem('scm_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
