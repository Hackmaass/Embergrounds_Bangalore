import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb, clearDemoStore, seedDemoStore } from "@cortex/db";
import { handleInboundMessage } from "./orchestrator.js";

test("orchestrator: Atharva Chaskar asking for stock status routes to Vikram with custom reply", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "STAFF",
    identityId: "919876500000@s.whatsapp.net",
    senderName: "Atharva Chaskar",
    text: "How much paneer do we have left in stock?",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "vikram-procurement");
  assert.ok(result.replyText?.includes("Butter Paneer"));
  assert.ok(result.replyText?.includes("Sharma Dairy"));
});

test("orchestrator: Self-chat user asking who owes money routes to Munim with khata summary", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "OWNER",
    identityId: "owner",
    senderName: "Merchant (Owner)",
    text: "Munim ji, kitna udhaar baaki hai?",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "munim-accounts");
  assert.ok(result.replyText?.includes("₹18,600"));
  assert.ok(result.replyText?.includes("Gupta Caterers"));
});

test("orchestrator: Check payment ₹350 routes to Aman and confirms payment verification", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "OWNER",
    identityId: "owner",
    senderName: "Merchant (Owner)",
    text: "Check payment ₹350",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "aman-support");
  assert.ok(result.replyText?.includes("Payment Verified"));
  assert.ok(result.replyText?.includes("350"));
});

test("orchestrator: Atharva check-in 'Haazir' routes to Meera and records attendance", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "STAFF",
    identityId: "919876500000@s.whatsapp.net",
    senderName: "Atharva Chaskar",
    text: "Haazir",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "meera-staff");
  assert.ok(result.replyText?.includes("Haaziri darj ho gayi hai"));
  assert.ok(result.replyText?.includes("Atharva ji"));
});

test("orchestrator: Sales report query routes to Priya with yesterday's dip diagnostics", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "OWNER",
    identityId: "owner",
    senderName: "Merchant (Owner)",
    text: "Priya, how are sales today? Any revenue dip?",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "priya-sales");
  assert.ok(result.replyText?.includes("Priya"));
});

test("orchestrator: User texting 'hello priya' directly routes to Priya with greeting and diagnostic report", async () => {
  const db = await getDb();
  await clearDemoStore(db);
  await seedDemoStore(db);

  const result = await handleInboundMessage({
    db,
    storeId: "store-ramesh",
    role: "OWNER",
    identityId: "owner",
    senderName: "Merchant (Owner)",
    text: "hello priya",
    channel: "WHATSAPP",
  });

  assert.equal(result.handled, true);
  assert.equal(result.routedTo, "priya-sales");
  assert.ok(result.replyText?.includes("Priya"));
});


