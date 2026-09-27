import {render, screen} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";

import ProtectedRoute from "./ProtectedRoute";
import {useAuth} from "../context/useAuth";

// mock: replace a real function with a fake version during testing
vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn()
}));

// describe: the following tests are about ProtectedRoute
describe("ProtectedRoute", () => {
    // 1st test: authenticated user
    it("shows loading message while authentication is being checked", () => {
        useAuth.mockReturnValue({
            user: null, // initially
            loading: true // still checking, dont know yet whether user's logged in or not
        });

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <p>Protected Content</p>
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(
            screen.getByText("Checking authentication...")
        ).toBeInTheDocument();
    });

    // 2nd test: unauthenticated user
    it("redirects unauthenticated users to login", () => {
        useAuth.mockReturnValue({
            user: null, // currently no authenticated user
            loading: false // finished checking 
        });

        render(
            // pretend the current URL is /profile 
            <MemoryRouter initialEntries={["/profile"]}>
                <Routes>
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <p>Protected Content</p>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            <p>Login Page</p>
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(
            screen.getByText("Login Page")
        ).toBeInTheDocument();
    });

    // 3rd test: authenticated user can see protected content
    it("renders protected content for authenticated users", () => {
        useAuth.mockReturnValue({
            user: {
                // technically {} should be good but return email for readability
                email: "test@gmail.com"
            },
            loading: false
        });

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <p>Protected Content</p>
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(
            screen.getByText("Protected Content")
        ).toBeInTheDocument();
    });
});