import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ActivePresenceContext } from "./activePresence";

export function ActivePresenceProvider({ userId, children }) {
  const [activeUsers, setActiveUsers] = useState(() => new Set());

  useEffect(() => {
    const channel = supabase.channel("active-users", {
      config: { presence: { key: userId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      setActiveUsers(new Set(Object.keys(channel.presenceState())));
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ user_id: userId });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <ActivePresenceContext.Provider value={activeUsers}>
      {children}
    </ActivePresenceContext.Provider>
  );
}
