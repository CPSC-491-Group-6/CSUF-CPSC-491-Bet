import { useEffect, useState } from "react";
import { AuthContext } from "./authContextObject";

export function AuthProvide({children}) {
    // strore current logged-in user
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkSession()
    }, [])

    async function checkSession() {
        try {
            setUser(null)
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
