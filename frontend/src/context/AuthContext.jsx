import { createContext, useContext, useEffect, useState } from "react";

// Who is currently logged in?

const AuthContext = createContext(null)

export function AuthProvide({children}) {
    // strore current logged-in user
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkSession()
    }, [])

    async function checkSession() {
        try {
            // const response = await fetch('/api/auth/me', {
            //     credentials: 'include',
            // })

            if (!response.ok) {
                setUser(null)
                return
            }

            const data = await response.json()
            setUser(data.user)
        } catch(error) {
            console.error('Failed to check authentication session:', error)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    function login(userData) {
        setUser(userData)
    }

    function logout() {
        setUser(null)
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated: Boolean(user),
                login,
                logout,
                checkSession
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext);
}