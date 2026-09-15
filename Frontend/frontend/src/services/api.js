const API_URL = "http://localhost:3301/";

export async function getHealth() {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
        throw new Error("Backend connection failed");
    }

    return response.json();
}