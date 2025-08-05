import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/authcontext";
import { getClient } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const { token } = useAuth();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Funktion til manuel opdatering (knap)
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClient();
    setRefreshing(false);
  };

  // Funktion til at hente klientdata
  const fetchClient = async () => {
    if (clientId && token) {
      try {
        const data = await getClient(clientId, token); // Husk at sende token hvis det kræves!
        setClient(data);
      } catch {
        setClient(null);
      }
    }
  };

  // Polling: hent data hvert 5. sekund
  useEffect(() => {
    fetchClient();
    const timer = setInterval(fetchClient, 5000);
    return () => clearInterval(timer);
  }, [clientId, token]);

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
    />
  );
}
