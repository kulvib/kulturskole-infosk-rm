import React from "react";
import { useParams } from "react-router-dom";
import ClientDetailsPage from "./ClientDetailsPage";

// Wrapper der giver clientId fra URL til ClientDetailsPage og videresender clients-prop fra parent (Dashboard)
export default function ClientDetailsPageWrapper({ clients }) {
  const { clientId } = useParams();
  return <ClientDetailsPage clientId={clientId} clients={clients} />;
}
