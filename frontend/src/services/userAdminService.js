import {
  getUsers as apiGetUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "../api";

export const getUsers = () => apiGetUsers();
export const createUser = (userData) => apiCreateUser(userData);
export const updateUser = (id, updates) => apiUpdateUser(id, updates);
export const deleteUser = (id) => apiDeleteUser(id);
