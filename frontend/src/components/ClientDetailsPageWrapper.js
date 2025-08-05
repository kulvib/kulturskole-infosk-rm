import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/authcontext";
import { getClient } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";

// Wrapper henter altid frisk klientdata fra API, og bruger token fra context
export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const { token } = useAuth();
  const [client, setClient] = useState(null);

  useEffect(() => {
    async function fetchClient() {
      if (clientId && token) {
        try {
          const data = await getClient(clientId); // KUN clientId som argument!
          setClient(data);
        } catch {
          setClient(null);
        }
      }
    }
    fetchClient();
  }, [clientId, token]);

  return <ClientDetailsPage client={client} />;
}
