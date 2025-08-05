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
    if (clientId && token) {
      setRefreshing(true);
      try {
        const data = await getClient(clientId);
        setClient(data);
      } catch {
        setClient(null);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let timer;
    // Automatisk polling
    async function fetchClient() {
      if (clientId && token) {
        try {
          const data = await getClient(clientId);
          setClient(data);
        } catch {
          setClient(null);
        }
      }
    }
    fetchClient();
    timer = setInterval(fetchClient, 30000);
    return () => clearInterval(timer);
  }, [clientId, token]);

  // Send refreshing og handleRefresh med til ClientDetailsPage
  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
    />
  );
}
