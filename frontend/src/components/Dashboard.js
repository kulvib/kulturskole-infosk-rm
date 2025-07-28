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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Fab,
  Stack,
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

  const handleAddClient = () => {
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
          <Button color="inherit" disabled>
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
                {/* Prominent green Add Client button, placed at top right */}
                <Box sx={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  mt: 2,
                  mr: 2,
                  zIndex: 1201
                }}>
                  <Fab
                    aria-label="Tilføj klient"
                    onClick={handleAddClient}
                    sx={{
                      px: 3,
                      bgcolor: "success.main",
                      color: "white",
                      boxShadow: "0px 6px 20px 2px rgba(76,175,80,0.3)",
                      border: "3px solid #388e3c",
                      transform: "scale(1.2)",
                      "&:hover": {
                        bgcolor: "success.dark",
                        border: "3px solid #2e7031",
                        boxShadow: "0px 8px 28px 4px rgba(56,142,60,0.4)",
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 1 }}>
                      <AddIcon sx={{ fontSize: 32 }} />
                      <span style={{
                        fontWeight: "bold",
                        fontSize: "1.2rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase"
                      }}>
                        Tilføj klient
                      </span>
                    </Stack>
                  </Fab>
                </Box>
                <ClientInfoPage
                  clients={clients.filter((c) => c.apiStatus === "approved")}
                  onRemoveClient={handleRemoveClient}
                  setClients={setClients}
                />
                {/* Modal: Godkend nye klienter */}
                <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                  <DialogTitle>Godkend nye klienter</DialogTitle>
                  <DialogContent>
                    <Table>
                      <TableBody>
                        {clients.filter((c) => c.apiStatus !== "approved").length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2}>Ingen ikke-godkendte klienter.</TableCell>
                          </TableRow>
                        ) : (
                          clients
                            .filter((c) => c.apiStatus !== "approved")
                            .map((client) => (
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
          <Route path="clients/:clientId" element={<ClientDetailsPageWrapper />} />
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
