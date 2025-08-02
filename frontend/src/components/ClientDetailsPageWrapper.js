import React from "react";
import { useParams } from "react-router-dom";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper({ clients, fetchClient }) {
  const { clientId } = useParams();
  const client = clients.find(c => String(c.id) === String(clientId));
  return <ClientDetailsPage client={client} fetchClient={fetchClient} />;
}
