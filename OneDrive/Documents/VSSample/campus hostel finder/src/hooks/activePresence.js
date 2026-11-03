import { createContext, useContext } from "react";

export const ActivePresenceContext = createContext(new Set());
export const useActiveUsers = () => useContext(ActivePresenceContext);
