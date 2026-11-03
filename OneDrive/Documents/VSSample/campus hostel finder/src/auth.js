import { createContext, useContext } from "react";

export const HOME = {
  STUDENT: "/student/dashboard",
  LANDLORD: "/landlord/dashboard",
  ADMIN: "/admin/dashboard",
};

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
