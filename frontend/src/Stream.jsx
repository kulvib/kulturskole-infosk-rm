export default function Stream({ clientId }) {
  // Brug base-url fra VITE_API_BASE, fjern evt /api
  let imgBase = import.meta.env.VITE_API_BASE.replace(/\/api$/, "");
  return (
    <div style={{ margin: "10px 0" }}>
      <img
        src={`${imgBase}/stream/${clientId}`}
        alt="Livestream"
        style={{ width: "100%", maxWidth: 500 }}
      />
    </div>
  );
}
