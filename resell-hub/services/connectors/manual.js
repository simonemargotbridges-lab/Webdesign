// Vinted, Depop, Poshmark, and Facebook Marketplace don't publish a public
// API that lets a third-party app create or remove listings on a seller's
// behalf. Rather than fake automation (or scrape/automate a browser against
// those sites' wishes), this connector type gives the seller copy-ready
// listing content and simply tracks the status the seller confirms by hand:
//
//   not_listed -> ready_to_post -> listed -> unlisted / sold
//
// "publish" here means "prepare the copy-ready bundle", and the app moves a
// listing to "listed" only once the seller clicks "I posted this" after
// pasting it in themselves.

function createManualConnector(id, name) {
  return {
    id,
    name,
    automated: false,
    mode: () => "manual",
    async publish() {
      return {
        status: "ready_to_post",
        mode: "manual",
        note: `${name} has no public listing API — copy the generated title/description/price below and post it there yourself, then mark it posted.`,
      };
    },
    async unpublish(listing, marketplaceState) {
      if (marketplaceState?.status !== "listed" && marketplaceState?.status !== "ready_to_post") {
        return { status: marketplaceState?.status || "not_listed" };
      }
      return {
        status: "needs_manual_removal",
        mode: "manual",
        note: `Sold elsewhere — remove this listing from ${name} manually, then mark it removed.`,
      };
    },
  };
}

module.exports = { createManualConnector };
