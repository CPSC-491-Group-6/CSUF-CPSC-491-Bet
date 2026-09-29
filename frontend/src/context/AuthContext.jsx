import { useEffect, useState } from "react";
import { AuthContext } from "./authContextObject";

export function AuthProvider({children}) {
    // store current logged-in user
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkSession()
    }, [])

    async function checkSession() {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "include"
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch(error) {
            console.error('Session check failed:', error)
            setUser(null)
        } finally {
            setLoading(false);
        }
    };

    function login(userData) {
        setUser(userData)
    }

    async function logout() {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Logout failed!");
            }

            setUser(null);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

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
