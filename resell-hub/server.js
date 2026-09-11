require("dotenv").config();
const path = require("path");
const express = require("express");

const listingsRouter = require("./routes/listings");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/listings", listingsRouter);

app.get("/api/marketplaces", (req, res) => {
  const { CONNECTORS } = require("./services/connectors");
  res.json(
    Object.values(CONNECTORS).map((c) => ({
      id: c.id,
      name: c.name,
      mode: c.mode(),
      automated: c.automated,
    }))
  );
});

app.listen(PORT, () => {
  console.log(`Resell Hub running at http://localhost:${PORT}`);
});
