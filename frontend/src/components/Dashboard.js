import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ClientInfoPage from "./ClientInfoPage";
import HolidaysPage from "./HolidaysPage";
import ClientDetailsPageWrapper from "./ClientDetailsPageWrapper";

const initialClients = [
  { id: 1, name: "Klient A", locality: "Lokale 1", status: "online", apiStatus: "approved" },
  { id: 2, name: "Klient B", locality: "Lokale 2", status: "offline", apiStatus: "approved" },
  { id: 3, name: "Klient C", locality: "Lokale 3", status: "online", apiStatus: "pending" },
  { id: 4, name: "Klient D", locality: "Lokale 4", status: "offline", apiStatus: "pending" },
];

const drawerWidth = 200;

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState(initialClients);
  const [openDialog, setOpenDialog] = useState(false);

  // Open approve dialog
  const handleOpenApproveDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleApproveClient = (id) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, apiStatus: "approved" } : c))
    );
  };

  const handleRemoveClient = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

  // Find if there are pending clients
  const pendingClients = clients.filter(c => c.apiStatus === "pending");

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/")}
            color="inherit"
          >
            Kulturskolen Viborg - infoskærme administration
          </Typography>
          <Button color="inherit" sx={{ color: "#fff" }}>
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={location.pathname === item.to}
              sx={{
                color: "black",
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "black",
                  fontWeight: "bold",
                },
              }}
            >
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${drawerWidth}px`,
          position: "relative",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Routes>
          <Route
            path="clients"
            element={
              <Box sx={{ position: "relative", minHeight: "100vh" }}>
                {/* Mindre grøn "Tilføj klient" knap, vises kun hvis der er pending klienter */}
                {pendingClients.length > 0 && (
                  <Box sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    mt: 2,
                    mr: 2,
                    zIndex: 1201
                  }}>
                    <Fab
                      variant="extended"
                      color="success"
                      onClick={handleOpenApproveDialog}
                      sx={{
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        boxShadow: "0px 3px 10px 1px rgba(76,175,80,0.11)",
    color: "#fff",
    height: 32,
    minHeight: 32,
    paddingLeft: 1.2,
    paddingRight: 1.2,
    '& svg': { fontSize: 18 }
  }}
>
  <AddIcon sx={{ mr: 1 }} />
  Tilføj klient
</Fab>
                  </Box>
                )}
                <ClientInfoPage
                  clients={clients} // VIGTIGT: Send ALLE klienter
                  onRemoveClient={handleRemoveClient}
                  setClients={setClients}
                />
                {/* Modal: Godkend nye klienter */}
                <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                  <DialogTitle>Godkend nye klienter</DialogTitle>
                  <DialogContent>
                    <Table>
                      <TableBody>
                        {pendingClients.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2}>Ingen ikke-godkendte klienter.</TableCell>
                          </TableRow>
                        ) : (
                          pendingClients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell>{client.name}</TableCell>
                              <TableCell>
                                <Button
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleApproveClient(client.id)}
                                >
                                  Godkend
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={handleCloseDialog}>Luk</Button>
                  </DialogActions>
                </Dialog>
              </Box>
            }
          />
          <Route path="clients/:clientId" element={<ClientDetailsPageWrapper clients={clients} />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route
            path="*"
            element={<Typography variant="h5">Velkommen til adminpanelet.</Typography>}
          />
        </Routes>
      </Box>
    </Box>
  );
}
