import { createTheme } from "@mui/material/styles";

// Temafarver er baseret på det visuelle udtryk der allerede er i applikationen:
// - AppBar/primær: blå (#1976d2 / #1565c0 som hover/mørk)
// - Sidebar valgt: teal-100 (#e0f2f1), hover: cyan-100 (#b2ebf2)
// - Login gradient: #b2fefa → #0ed2f7
// - Sidebagtekst: #f6f9fb
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
      dark: "#1565c0",
      light: "#42a5f5",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0097a7",
      dark: "#00838f",
      light: "#56c8d8",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f6f9fb",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", "Arial", sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 10,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: "#f0f4f8",
        },
      },
    },
  },
});

export default theme;
