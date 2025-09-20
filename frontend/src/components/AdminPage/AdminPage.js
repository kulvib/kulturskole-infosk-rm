import React from "react";
import SchoolAdministration from "./SchoolAdministration";
import UserAdministration from "./UserAdministration";

export default function AdminPage() {
  return (
    <div>
      <SchoolAdministration />
      <UserAdministration />
    </div>
  );
}
