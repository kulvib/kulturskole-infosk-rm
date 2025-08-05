import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/authcontext";
import { getClient } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";

function isEqualClient(a, b) {
  // Sammenlign relevante felter - evt. med JSON.stringify(a) === JSON.stringify(b)
  // Her sammenlignes alt:
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const { token } = useAuth();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Funktion til manuel opdatering (knap)
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClient(true); // force update
    setRefreshing(false);
  };

  // Funktion til at hente klientdata
  const fetchClient = async (forceUpdate = false) => {
    if (clientId && token) {
      try {
        const data = await getClient(clientId, token);
        // Kun opdatér hvis data er ændret eller hvis det er et "force update"
        if (forceUpdate || !isEqualClient(data, client)) {
          setClient(data);
        }
      } catch {
        // evt. fejl-håndtering
      }
    }
  };

  // Polling: tjek hvert 5. sekund
  useEffect(() => {
    fetchClient();
    const timer = setInterval(() => fetchClient(false), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [clientId, token]);

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
    />
  );
}
