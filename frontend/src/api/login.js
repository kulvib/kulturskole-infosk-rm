// Login-funktionen er midlertidigt fjernet eller kommenteret ud
// import { api, setAuthToken } from "./api";

// export async function login(username, password) {
//   try {
//     const res = await api.post("/login", { username, password });
//     setAuthToken(res.data.access_token);
//     return res.data.access_token;
//   } catch (err) {
//     throw err.response?.data?.detail || "Login fejlede";
//   }
// }
