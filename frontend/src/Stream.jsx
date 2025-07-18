export default function Stream({ clientId }) {
  return (
    <div style={{ margin: "10px 0" }}>
      <img
        src={`https://kulturskole-infoskaerm-backend.onrender.com/stream/${clientId}`}
        alt="Livestream"
        style={{ width: "100%", maxWidth: 500 }}
      />
    </div>
  );
}
