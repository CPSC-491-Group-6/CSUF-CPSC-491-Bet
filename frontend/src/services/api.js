export async function getHealth() {
  const response = await fetch("/health");

  if (!response.ok) {
    throw new Error("Backend connection failed");
  }

  return response.json();
}