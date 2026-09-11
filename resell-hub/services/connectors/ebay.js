// eBay is the only marketplace in this app with a real, public listing API
// (the Sell Inventory API). If EBAY_OAUTH_TOKEN is set in .env, this connector
// makes real calls against it. Otherwise it runs in "simulated" mode so the
// rest of the app still works end-to-end without any credentials.

const BASE = () =>
  process.env.EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

function isLive() {
  return Boolean(process.env.EBAY_OAUTH_TOKEN);
}

function mode() {
  return isLive() ? "live" : "simulated";
}

async function ebayFetch(pathname, options) {
  const res = await fetch(`${BASE()}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EBAY_OAUTH_TOKEN}`,
      "Content-Language": "en-US",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`eBay API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function publish(listing) {
  if (!isLive()) {
    return {
      status: "listed",
      mode: "simulated",
      note: "Simulated — add EBAY_OAUTH_TOKEN (and business policy IDs) in .env to publish for real.",
    };
  }

  const sku = `resellhub-${listing.id}`;
  const imageUrls = listing.images.map((img) => `${process.env.PUBLIC_BASE_URL || ""}/uploads/${img}`);

  await ebayFetch(`/sell/inventory/v1/inventory_item/${sku}`, {
    method: "PUT",
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition: listing.condition === "new-with-tags" ? "NEW" : "USED_EXCELLENT",
      product: {
        title: listing.title.slice(0, 80),
        description: listing.description,
        imageUrls,
        brand: listing.brand || undefined,
      },
    }),
  });

  const offer = await ebayFetch(`/sell/inventory/v1/offer`, {
    method: "POST",
    body: JSON.stringify({
      sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      availableQuantity: 1,
      categoryId: "11450",
      listingDescription: listing.description,
      pricingSummary: { price: { value: String(listing.price.list), currency: "USD" } },
      merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
      listingPolicies: {
        fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
        paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
        returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
      },
    }),
  });

  const published = await ebayFetch(`/sell/inventory/v1/offer/${offer.offerId}/publish`, {
    method: "POST",
  });

  return {
    status: "listed",
    mode: "live",
    externalId: published.listingId,
    offerId: offer.offerId,
    sku,
    url: `https://www.${process.env.EBAY_ENV === "production" ? "" : "sandbox."}ebay.com/itm/${published.listingId}`,
  };
}

async function unpublish(listing, marketplaceState) {
  if (!isLive() || marketplaceState?.mode !== "live") {
    return { status: "unlisted", mode: mode(), note: "Simulated unlist." };
  }

  await ebayFetch(`/sell/inventory/v1/offer/${marketplaceState.offerId}/withdraw`, {
    method: "POST",
  });

  return { status: "unlisted", mode: "live" };
}

module.exports = {
  id: "ebay",
  name: "eBay",
  automated: true,
  mode,
  publish,
  unpublish,
};
