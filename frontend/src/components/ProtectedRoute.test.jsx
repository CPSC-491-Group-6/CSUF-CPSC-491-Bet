import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";

import ProtectedRoute from "./ProtectedRoute";
import {useAuth} from "../context/useAuth";

// mock: replace a real function with a fake version during testing
vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn()
}));

// describe: the following tests are about ProtectedRoute
describe("ProtectedRoute", () => {
    it("shows loading message while authentication is being checked", () => {
        useAuth.mockReturnValue({
            user: null,
            loading: true
        })

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
});