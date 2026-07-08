import app from "./app.js";

const port = Number(process.env["PORT"] ?? 10000);

if (Number.isNaN(port) || port <= 0) {
  console.error("Invalid PORT value:", process.env["PORT"]);
  process.exit(1);
}

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`✅  AttendX server listening on port ${port}`);
});
