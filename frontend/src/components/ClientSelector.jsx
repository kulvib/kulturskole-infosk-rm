import React, { useEffect, useState } from "react";
import { FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput, Box, Button } from "@mui/material";

export default function ClientSelector({ selectedClients, setSelectedClients }) {
  const [clients, setClients] = useState([]);
  const [allSelected, setAllSelected] = useState(false);

  useEffect(() => {
    // Her antages at backend har /api/clients/approved - filtrering sker der!
    fetch("/api/clients/approved")
      .then(res => res.json())
      .then(data => setClients(data));
  }, []);

  useEffect(() => {
    setAllSelected(selectedClients.length === clients.length && clients.length > 0);
  }, [selectedClients, clients]);

  const handleChange = (event) => {
    const value = event.target.value;
    setSelectedClients(typeof value === "string" ? value.split(',') : value);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <FormControl sx={{ minWidth: 320 }}>
        <InputLabel id="client-select-label">Vælg klient(er)</InputLabel>
        <Select
          labelId="client-select-label"
          multiple
          value={selectedClients}
          onChange={handleChange}
          input={<OutlinedInput label="Vælg klient(er)" />}
          renderValue={selected =>
            selected.length === clients.length
              ? "Alle"
              : selected.map(id => {
                  const c = clients.find(cli => cli.id === id);
                  return c ? c.name : id;
                }).join(", ")
          }
        >
          <MenuItem
            value="all"
            onClick={handleSelectAll}
            dense
          >
            <Checkbox checked={allSelected} indeterminate={selectedClients.length > 0 && !allSelected} />
            <ListItemText primary="Vælg alle" />
          </MenuItem>
          {clients.map(cli => (
            <MenuItem key={cli.id} value={cli.id}>
              <Checkbox checked={selectedClients.indexOf(cli.id) > -1} />
              <ListItemText primary={cli.name} secondary={cli.unique_id} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box sx={{ mt: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSelectAll}
        >
          {allSelected ? "Fravælg alle" : "Vælg alle"}
        </Button>
      </Box>
    </Box>
  );
}
