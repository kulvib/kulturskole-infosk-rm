import { api, setAuthToken } from "./api";

export async function login(username, password) {
  try {
    const response = await api.post("/login", { username, password });
    const { access_token } = response.data;
    setAuthToken(access_token);
    return access_token;
  } catch (error) {
    // Smid fejlbesked fra backend eller standard fejl
    throw error.response?.data?.detail || "Login fejlede";
  }
}
