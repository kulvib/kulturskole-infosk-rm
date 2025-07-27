import { api } from "./api";

export async function login(username, password) {
  return api.post("/login", { username, password });
}
