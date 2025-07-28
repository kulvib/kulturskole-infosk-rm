import React from "react";
import { useParams } from "react-router-dom";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  return <ClientDetailsPage clientId={clientId} />;
}
