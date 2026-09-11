const ebay = require("./ebay");
const { createManualConnector } = require("./manual");

const CONNECTORS = {
  ebay,
  vinted: createManualConnector("vinted", "Vinted"),
  depop: createManualConnector("depop", "Depop"),
  poshmark: createManualConnector("poshmark", "Poshmark"),
  facebook: createManualConnector("facebook", "Facebook Marketplace"),
};

async function publishTo(listing, marketplaceIds) {
  const results = {};
  for (const id of marketplaceIds) {
    const connector = CONNECTORS[id];
    if (!connector) continue;
    try {
      results[id] = await connector.publish(listing);
    } catch (err) {
      results[id] = { status: "error", note: err.message };
    }
  }
  return results;
}

async function unpublishFrom(listing, marketplaceStates) {
  const results = {};
  for (const [id, state] of Object.entries(marketplaceStates)) {
    const connector = CONNECTORS[id];
    if (!connector) continue;
    if (!["listed", "ready_to_post"].includes(state.status)) continue;
    try {
      results[id] = await connector.unpublish(listing, state);
    } catch (err) {
      results[id] = { status: "error", note: err.message };
    }
  }
  return results;
}

module.exports = { CONNECTORS, publishTo, unpublishFrom };
